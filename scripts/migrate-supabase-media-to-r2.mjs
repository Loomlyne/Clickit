#!/usr/bin/env node

/**
 * Creates a verified, non-destructive, optimised copy of Clickit's public
 * Supabase media in one R2 bucket. Source objects stay untouched; nothing is
 * ever deleted in Supabase or R2.
 *
 * Default (read-only, no R2 call): list Supabase Storage, download each object
 * to a temp file to measure it, write the manifest and a dry-run report
 * (.tmp/r2-media-reports/dry-run-<timestamp>.json and .md):
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   CLOUDFLARE_R2_BUCKET=<bucket> npm run r2:media -- --refresh
 *
 * After the dry-run report is reviewed, copy and verify (write path, needs
 * --execute plus the ClickitStory account/bucket guard):
 *   CLOUDFLARE_ACCOUNT_ID=<account> CLOUDFLARE_R2_BUCKET=<bucket> \
 *   R2_ACCESS_KEY_ID=<key> R2_SECRET_ACCESS_KEY=<secret> npm run r2:media -- --execute
 *
 * R2 transfers use Cloudflare's S3-compatible API and the credentials above.
 * They do not use Wrangler login, OAuth, or an API token.
 */

import { createHash } from 'node:crypto'
import {
  createReadStream,
  createWriteStream,
  existsSync,
  promises as fs,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import sharp from 'sharp'
import { createClient } from '@supabase/supabase-js'
import { CLICKIT_ACCOUNT_ID } from './cf/wrangler-guard.mjs'
import { MEDIA_BUCKET_NAME } from './cf/deploy-guard.mjs'
import { isFaststart } from './media/faststart.mjs'
import {
  buildCopyReport,
  buildDryRunReport,
  extractMediaReferences,
  manifestFileInfo,
  writeReportFiles,
} from './media/report.mjs'
import {
  VARIANT_SPEC_VERSION,
  displayWidth,
  encodeVariant,
  planVariants,
} from './media/variants.mjs'

const {
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} = await import('@aws-sdk/client-s3')

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_MANIFEST_PATH = resolve(
  PROJECT_ROOT,
  '.tmp/r2-media-manifest.json'
)
const DEFAULT_SOURCE_BUCKETS = ['show-artwork', 'site-assets', 'avatars']
const MANIFEST_VERSION = 1
const DEFAULT_REPORT_DIR = resolve(PROJECT_ROOT, '.tmp/r2-media-reports')
const FASTSTART_PROBE_BYTES = 64 * 1024
const VARIANT_CACHE_CONTROL = 'public, max-age=31536000, immutable'
// app_config columns that may hold media URLs. youtube_api_key and
// admin_user_id are deliberately never selected.
const APP_CONFIG_SCAN_COLUMNS = [
  'favicon_dark_url',
  'favicon_url',
  'footer_content',
  'cta_copy',
  'genre_config',
  'feature_flags',
  'hero_description',
  'hero_description_ar',
  'hero_video_url',
  'live_stream_url',
  'og_image_url',
  'portfolio_heading',
  'portfolio_heading_ar',
  'site_description',
  'site_description_ar',
  'site_tagline',
  'site_tagline_ar',
  'site_title',
  'top_ticker',
]
const EXTENSION_TYPES = {
  avif: 'image/avif',
  gif: 'image/gif',
  ico: 'image/x-icon',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  mp4: 'video/mp4',
  png: 'image/png',
  svg: 'image/svg+xml',
  webm: 'video/webm',
  webp: 'image/webp',
}

function requiredEnv(name, env = process.env) {
  const value = env[name]?.trim()
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

async function loadEnvFile(path) {
  if (!existsSync(path)) return

  const contents = await fs.readFile(path, 'utf8')
  for (const line of contents.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const separator = trimmed.indexOf('=')
    if (separator === -1) continue

    const name = trimmed.slice(0, separator).trim()
    let value = trimmed.slice(separator + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!(name in process.env)) process.env[name] = value
  }
}

function nullableString(value) {
  return typeof value === 'string' && value ? value : null
}

function nullableSize(value) {
  const size = Number(value)
  return Number.isSafeInteger(size) && size >= 0 ? size : null
}

function sourceMetadata(entry) {
  const metadata = entry.metadata ?? {}
  return {
    size: nullableSize(metadata.size),
    contentType: nullableString(metadata.mimetype),
    cacheControl: nullableString(metadata.cacheControl),
    etag: nullableString(metadata.eTag),
    lastModified: nullableString(metadata.lastModified),
  }
}

function destinationKey(bucket, key) {
  if (!bucket || !key || key.startsWith('/')) {
    throw new Error('Invalid source object path')
  }
  return `${bucket}/${key}`
}

function createR2Client(env = process.env) {
  const accountId = requiredEnv('CLOUDFLARE_ACCOUNT_ID', env)
  const accessKeyId = requiredEnv('R2_ACCESS_KEY_ID', env)
  const secretAccessKey = requiredEnv('R2_SECRET_ACCESS_KEY', env)
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  })
}

export async function assertR2BucketAccess(client, bucket) {
  await client.send(new HeadBucketCommand({ Bucket: bucket }))
}

function normalizedDestinationMetadata(metadata) {
  return {
    size: nullableSize(metadata.ContentLength),
    contentType: nullableString(metadata.ContentType),
    cacheControl: nullableString(metadata.CacheControl),
    contentDisposition: nullableString(metadata.ContentDisposition),
    contentEncoding: nullableString(metadata.ContentEncoding),
    contentLanguage: nullableString(metadata.ContentLanguage),
  }
}

export function r2DestinationMetadataMatches(source, destination) {
  const actual = normalizedDestinationMetadata(destination)
  return (
    actual.size === source.size &&
    actual.contentType === source.contentType &&
    actual.cacheControl === source.cacheControl &&
    actual.contentDisposition === source.contentDisposition &&
    actual.contentEncoding === source.contentEncoding &&
    actual.contentLanguage === source.contentLanguage
  )
}

export async function verifyR2DestinationMetadata(
  client,
  bucket,
  key,
  source,
  { attempts = 5, delayMs = 250 } = {}
) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const destination = await client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: key })
    )
    if (r2DestinationMetadataMatches(source, destination)) {
      return normalizedDestinationMetadata(destination)
    }
    if (attempt + 1 < attempts && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)))
    }
  }

  throw new Error(`R2 metadata mismatch for ${key}`)
}

function publicObjectUrl(sourceOrigin, bucket, key) {
  const url = new URL('/storage/v1/object/public/', sourceOrigin)
  const encodedKey = key.split('/').map(encodeURIComponent).join('/')
  url.pathname += `${encodeURIComponent(bucket)}/${encodedKey}`
  return url.toString()
}

export function createR2MediaManifest({
  sourceOrigin,
  destinationBucket = null,
  objects,
}) {
  const normalizedOrigin = new URL(sourceOrigin).origin
  const normalizedObjects = objects
    .map((object) => ({
      sourceBucket: object.sourceBucket,
      sourceKey: object.sourceKey,
      destinationKey: destinationKey(object.sourceBucket, object.sourceKey),
      source: object.source,
      ...(object.analysis ? { analysis: object.analysis } : {}),
    }))
    .sort((left, right) =>
      left.destinationKey.localeCompare(right.destinationKey)
    )

  return {
    version: MANIFEST_VERSION,
    generatedAt: new Date().toISOString(),
    sourceOrigin: normalizedOrigin,
    destinationBucket,
    objects: normalizedObjects,
  }
}

export function validateR2MediaManifest(manifest) {
  if (
    !manifest ||
    manifest.version !== MANIFEST_VERSION ||
    typeof manifest.sourceOrigin !== 'string' ||
    !Array.isArray(manifest.objects)
  ) {
    throw new Error('Invalid R2 media manifest')
  }

  const sourceOrigin = new URL(manifest.sourceOrigin).origin
  const seenDestinationKeys = new Set()
  for (const object of manifest.objects) {
    if (
      !object ||
      typeof object.sourceBucket !== 'string' ||
      typeof object.sourceKey !== 'string' ||
      !object.source ||
      !Number.isSafeInteger(object.source.size) ||
      object.source.size < 0
    ) {
      throw new Error('Invalid media object in manifest')
    }

    const expectedDestinationKey = destinationKey(
      object.sourceBucket,
      object.sourceKey
    )
    if (object.destinationKey !== expectedDestinationKey) {
      throw new Error(
        `Unexpected destination key for ${expectedDestinationKey}`
      )
    }
    if (seenDestinationKeys.has(expectedDestinationKey)) {
      throw new Error(`Duplicate destination key ${expectedDestinationKey}`)
    }
    seenDestinationKeys.add(expectedDestinationKey)
  }

  return { ...manifest, sourceOrigin }
}

async function collectBucketObjects(client, bucket) {
  const objects = []
  const visitedPrefixes = new Set()

  async function visit(prefix) {
    if (visitedPrefixes.has(prefix)) return
    visitedPrefixes.add(prefix)

    let offset = 0
    for (;;) {
      const { data, error } = await client.storage.from(bucket).list(prefix, {
        limit: 1000,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      })
      if (error) throw new Error(`${bucket}/${prefix || '.'}: ${error.message}`)

      const entries = data ?? []
      for (const entry of entries) {
        if (!entry.name) continue
        const key = prefix ? `${prefix}/${entry.name}` : entry.name
        if (entry.id) {
          const source = sourceMetadata(entry)
          if (source.size === null) {
            throw new Error(`Missing size metadata for ${bucket}/${key}`)
          }
          objects.push({ sourceBucket: bucket, sourceKey: key, source })
        } else {
          await visit(key)
        }
      }

      if (entries.length < 1000) break
      offset += entries.length
    }
  }

  await visit('')
  return objects
}

async function writeManifest(path, manifest) {
  await fs.mkdir(dirname(path), { recursive: true })
  const temporaryPath = `${path}.tmp`
  await fs.writeFile(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`)
  await fs.rename(temporaryPath, path)
}

export async function hashFile(path) {
  const sha256 = createHash('sha256')
  const md5 = createHash('md5')
  let size = 0

  for await (const chunk of createReadStream(path)) {
    sha256.update(chunk)
    md5.update(chunk)
    size += chunk.length
  }

  return {
    size,
    sha256: sha256.digest('hex'),
    md5: md5.digest('base64'),
  }
}

function normalizedEtag(value) {
  const etag = nullableString(value)
  if (!etag) return null
  return etag.replace(/^W\//i, '').replace(/^"|"$/g, '')
}

function normalizedLastModified(value) {
  const lastModified = nullableString(value)
  if (!lastModified) return null

  const timestamp = Date.parse(lastModified)
  return Number.isNaN(timestamp)
    ? lastModified
    : new Date(Math.floor(timestamp / 1000) * 1000).toISOString()
}

export function sourceIdentityMatches(manifestSource, responseIdentity = {}) {
  const manifestEtag = normalizedEtag(manifestSource?.etag)
  const responseEtag = normalizedEtag(responseIdentity.etag)
  const manifestLastModified = normalizedLastModified(
    manifestSource?.lastModified
  )
  const responseLastModified = normalizedLastModified(
    responseIdentity.lastModified
  )

  return (
    (manifestEtag === null
      ? responseEtag === null
      : responseEtag !== null && manifestEtag === responseEtag) &&
    (manifestLastModified === null
      ? responseLastModified === null
      : responseLastModified !== null &&
        manifestLastModified === responseLastModified)
  )
}

function assertSourceIdentityMatches(object, response) {
  const responseIdentity = {
    etag: response.headers.get('etag'),
    lastModified: response.headers.get('last-modified'),
  }
  if (!sourceIdentityMatches(object.source, responseIdentity)) {
    throw new Error(
      `Source changed since manifest for ${object.destinationKey}, refresh the manifest before copying`
    )
  }
}

export async function downloadSourceObject(object, sourceOrigin, path) {
  const response = await fetch(
    publicObjectUrl(sourceOrigin, object.sourceBucket, object.sourceKey),
    { cache: 'no-store', headers: { 'Accept-Encoding': 'identity' } }
  )
  if (response.status !== 200 || !response.body) {
    throw new Error(
      `Source download failed for ${object.destinationKey} with HTTP ${response.status}`
    )
  }
  assertSourceIdentityMatches(object, response)

  const sha256 = createHash('sha256')
  const md5 = createHash('md5')
  let size = 0
  const hash = new Transform({
    transform(chunk, _encoding, callback) {
      sha256.update(chunk)
      md5.update(chunk)
      size += chunk.length
      callback(null, chunk)
    },
  })
  await pipeline(Readable.fromWeb(response.body), hash, createWriteStream(path))

  const contentLength = nullableSize(response.headers.get('content-length'))
  if (contentLength !== null && contentLength !== size) {
    throw new Error(
      `Source Content-Length mismatch for ${object.destinationKey}`
    )
  }
  if (object.source.size !== size) {
    throw new Error(
      `Source changed since manifest for ${object.destinationKey}, refresh the manifest before copying`
    )
  }

  return {
    size,
    sha256: sha256.digest('hex'),
    md5: md5.digest('base64'),
    metadata: {
      size,
      contentType:
        nullableString(response.headers.get('content-type')) ??
        object.source.contentType,
      cacheControl:
        nullableString(response.headers.get('cache-control')) ??
        object.source.cacheControl,
      contentDisposition: nullableString(
        response.headers.get('content-disposition')
      ),
      contentEncoding: nullableString(response.headers.get('content-encoding')),
      contentLanguage: nullableString(response.headers.get('content-language')),
    },
  }
}

function isMissingR2Object(error) {
  if (error && typeof error === 'object') {
    if (error.name === 'NoSuchKey') return true
    if (error.$metadata?.httpStatusCode === 404) return true
  }
  const output = error instanceof Error ? error.message : String(error)
  return /NoSuchKey|not found|10007/i.test(output)
}

export async function downloadR2Object(client, bucket, key, path) {
  try {
    const object = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key })
    )
    if (!object.Body || typeof object.Body.pipe !== 'function') {
      throw new Error(`R2 returned no readable body for ${key}`)
    }
    await pipeline(object.Body, createWriteStream(path))
    return true
  } catch (error) {
    if (isMissingR2Object(error)) return false
    throw error
  }
}

export async function putR2Object(client, bucket, key, path, metadata) {
  const body = createReadStream(path)
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentLength: metadata.size,
        ContentType: metadata.contentType ?? undefined,
        CacheControl: metadata.cacheControl ?? undefined,
        ContentDisposition: metadata.contentDisposition ?? undefined,
        ContentEncoding: metadata.contentEncoding ?? undefined,
        ContentLanguage: metadata.contentLanguage ?? undefined,
        Metadata: metadata.customMetadata ?? undefined,
      })
    )
  } finally {
    body.destroy()
  }
}


// ---------------------------------------------------------------------------
// Helpers shared by the dry-run and the copy
// ---------------------------------------------------------------------------

function effectiveContentType(contentType, key) {
  const declared = String(contentType ?? '')
    .split(';')[0]
    .trim()
    .toLowerCase()
  if (declared && declared !== 'application/octet-stream') return declared
  const extension = key.split('.').pop()?.toLowerCase() ?? ''
  return EXTENSION_TYPES[extension] ?? (declared || 'application/octet-stream')
}

function isMp4(contentType, key) {
  return contentType === 'video/mp4' || key.toLowerCase().endsWith('.mp4')
}

function isRasterType(contentType) {
  return /^image\/(jpeg|png|webp|avif)$/.test(contentType)
}

async function readPrefix(path, length = FASTSTART_PROBE_BYTES) {
  const handle = await fs.open(path, 'r')
  try {
    const buffer = Buffer.alloc(length)
    const { bytesRead } = await handle.read(buffer, 0, length, 0)
    return new Uint8Array(buffer.buffer, buffer.byteOffset, bytesRead)
  } finally {
    await handle.close()
  }
}

function sha256Of(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

function toolMissingError(name) {
  return new Error(
    `${name} was not found on PATH. Install it (for example: brew install ffmpeg) or set ${name.toUpperCase()}_PATH. This script never downloads binaries.`
  )
}

/**
 * Default ffprobe runner: argument array, no shell.
 * @returns {{ durationSeconds: number | null, bitRate: number | null }}
 */
export function runFfprobe(path) {
  const result = spawnSync(
    process.env.FFPROBE_PATH || 'ffprobe',
    [
      '-v',
      'error',
      '-show_entries',
      'format=duration,bit_rate',
      '-of',
      'json',
      path,
    ],
    { encoding: 'utf8' }
  )
  if (result.error?.code === 'ENOENT') throw toolMissingError('ffprobe')
  if (result.status !== 0) throw new Error('ffprobe failed')
  const format = JSON.parse(result.stdout).format ?? {}
  const duration = Number(format.duration)
  const bitRate = Number(format.bit_rate)
  return {
    durationSeconds: Number.isFinite(duration) ? duration : null,
    bitRate: Number.isFinite(bitRate) ? bitRate : null,
  }
}

/**
 * Default lossless remux: ffmpeg -i in -c copy -movflags +faststart out.
 * Argument array and temp file names only, never a shell string.
 */
export function runFfmpegFaststart(inputPath, outputPath) {
  const result = spawnSync(
    process.env.FFMPEG_PATH || 'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-i',
      inputPath,
      '-c',
      'copy',
      '-movflags',
      '+faststart',
      outputPath,
    ],
    { encoding: 'utf8' }
  )
  if (result.error?.code === 'ENOENT') throw toolMissingError('ffmpeg')
  if (result.status !== 0) throw new Error('ffmpeg faststart remux failed')
}

/**
 * Write-path guard: only the ClickitStory account and the clickit-media
 * bucket, never an API token. Values are never printed.
 */
export function assertWriteGuard(env, bucket) {
  if (env.CLOUDFLARE_API_TOKEN) {
    throw new Error('refused: CLOUDFLARE_API_TOKEN is set; the copy uses R2 S3 keys only')
  }
  if (String(env.CLOUDFLARE_ACCOUNT_ID ?? '').trim().toLowerCase() !== CLICKIT_ACCOUNT_ID) {
    throw new Error('refused: CLOUDFLARE_ACCOUNT_ID is not the ClickitStory account')
  }
  if (bucket !== MEDIA_BUCKET_NAME) {
    throw new Error(`refused: CLOUDFLARE_R2_BUCKET must be ${MEDIA_BUCKET_NAME}`)
  }
}

// ---------------------------------------------------------------------------
// Dry run: manifest + analysis + report (reads Supabase, no R2 call)
// ---------------------------------------------------------------------------

async function analyzeObject({ object, sourceOrigin, tempDir, probe, specVersion }) {
  const path = join(tempDir, 'analysis-object')
  await fs.rm(path, { force: true })
  const source = await downloadSourceObject(object, sourceOrigin, path)
  const contentType = effectiveContentType(
    source.metadata.contentType,
    object.sourceKey
  )
  const analysis = {
    sha256: source.sha256,
    size: source.size,
    contentType,
    width: null,
    height: null,
    pages: null,
    faststart: null,
    willRemux: false,
    durationSeconds: null,
    bitRate: null,
    plannedVariants: [],
    skipReason: null,
  }

  if (isRasterType(contentType)) {
    try {
      const metadata = await sharp(await fs.readFile(path)).metadata()
      analysis.width = displayWidth(metadata)
      analysis.height = metadata.height ?? null
      analysis.pages = metadata.pages ?? 1
    } catch (error) {
      analysis.error = `unreadable image: ${error instanceof Error ? error.message : String(error)}`
    }
  }
  if (isMp4(contentType, object.sourceKey)) {
    analysis.faststart = isFaststart(await readPrefix(path))
    analysis.willRemux = analysis.faststart === false
    try {
      Object.assign(analysis, probe(path))
    } catch (error) {
      analysis.probeError = error instanceof Error ? error.message : String(error)
    }
  }
  const plan = planVariants(
    { contentType, width: analysis.width, pages: analysis.pages },
    object.destinationKey,
    { specVersion }
  )
  analysis.plannedVariants = plan.variants.map((variant) => variant.key)
  analysis.skipReason = plan.skipReason
  await fs.rm(path, { force: true })
  return analysis
}

async function findReferencesOutsideManifest(client, manifest) {
  const { data, error } = await client
    .from('app_config')
    .select(APP_CONFIG_SCAN_COLUMNS.join(','))
  if (error) throw new Error(`app_config scan failed: ${error.message}`)
  const known = new Set(manifest.objects.map((object) => object.destinationKey))
  const buckets = new Set([
    ...DEFAULT_SOURCE_BUCKETS,
    ...manifest.objects.map((object) => object.sourceBucket),
  ])
  const missing = new Map()
  for (const row of data ?? []) {
    for (const ref of extractMediaReferences(row, buckets)) {
      const destination = `${ref.bucket}/${ref.key}`
      if (known.has(destination)) continue
      const entry = missing.get(destination) ?? {
        bucket: ref.bucket,
        key: ref.key,
        url: ref.url,
        columns: [],
      }
      if (!entry.columns.includes(ref.column)) entry.columns.push(ref.column)
      missing.set(destination, entry)
    }
  }
  return [...missing.values()].sort((a, b) =>
    `${a.bucket}/${a.key}`.localeCompare(`${b.bucket}/${b.key}`)
  )
}

export async function createManifest(options, deps = {}) {
  const env = deps.env ?? process.env
  const log = deps.log ?? console.log
  const now = deps.now ?? (() => new Date())
  const probe = deps.runFfprobe ?? runFfprobe
  const specVersion = deps.specVersion ?? VARIANT_SPEC_VERSION
  const reportDir = deps.reportDir ?? DEFAULT_REPORT_DIR
  if (existsSync(options.manifestPath) && !options.refresh) {
    throw new Error(
      `Manifest already exists at ${options.manifestPath}. Review it or use --refresh.`
    )
  }

  const sourceOrigin = new URL(requiredEnv('NEXT_PUBLIC_SUPABASE_URL', env)).origin
  const destinationBucket = requiredEnv('CLOUDFLARE_R2_BUCKET', env)
  const client =
    deps.supabase ??
    createClient(sourceOrigin, requiredEnv('SUPABASE_SERVICE_ROLE_KEY', env), {
      auth: { persistSession: false },
    })
  const buckets = options.buckets.length
    ? [...new Set(options.buckets)]
    : DEFAULT_SOURCE_BUCKETS
  const objects = (
    await Promise.all(
      buckets.map((bucket) => collectBucketObjects(client, bucket))
    )
  ).flat()
  const manifest = createR2MediaManifest({ sourceOrigin, destinationBucket, objects })
  validateR2MediaManifest(manifest)

  // Read-only: download each object to a temp file to measure it. No R2 call.
  const tempDir = await fs.mkdtemp(join(tmpdir(), 'clickit-r2-analyze-'))
  try {
    for (const object of manifest.objects) {
      try {
        object.analysis = await analyzeObject({
          object,
          sourceOrigin,
          tempDir,
          probe,
          specVersion,
        })
      } catch (error) {
        object.analysis = {
          error: error instanceof Error ? error.message : String(error),
        }
      }
    }
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true })
  }
  const referencedNotInManifest = await findReferencesOutsideManifest(client, manifest)

  await writeManifest(options.manifestPath, manifest)
  const info = manifestFileInfo(options.manifestPath)
  const report = buildDryRunReport({
    manifest,
    ...info,
    referencedNotInManifest,
    generatedAt: now().toISOString(),
  })
  const paths = await writeReportFiles(reportDir, 'dry-run', report, now())
  log(`Wrote ${manifest.objects.length} objects to ${options.manifestPath}`)
  log(`Dry-run report: ${paths.mdPath} (detail: ${paths.jsonPath})`)
  return { manifest, report, paths }
}

// ---------------------------------------------------------------------------
// Execute: copy originals, remux, variants, checksum report
// ---------------------------------------------------------------------------

async function headR2Object(client, bucket, key) {
  try {
    return await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
  } catch (error) {
    if (isMissingR2Object(error)) return null
    throw error
  }
}

function bytesDiffer(destination, source) {
  return (
    destination.size !== source.size ||
    destination.sha256 !== source.sha256 ||
    (source.md5 !== undefined && destination.md5 !== source.md5)
  )
}

async function copyPlain({ r2Client, bucket, dstKey, sourcePath, source, tempDir }) {
  const dstPath = join(tempDir, 'destination-object')
  await fs.rm(dstPath, { force: true })
  let status = 'skipped (identical)'
  const exists = await downloadR2Object(r2Client, bucket, dstKey, dstPath)
  if (exists) {
    if (bytesDiffer(await hashFile(dstPath), source)) {
      throw new Error(`Destination conflict for ${dstKey}; it was not overwritten`)
    }
  } else {
    await putR2Object(r2Client, bucket, dstKey, sourcePath, source.metadata)
    const copied = await downloadR2Object(r2Client, bucket, dstKey, dstPath)
    if (!copied) throw new Error(`R2 did not return ${dstKey}`)
    if (bytesDiffer(await hashFile(dstPath), source)) {
      throw new Error(`R2 checksum mismatch for ${dstKey}`)
    }
    status = 'copied'
  }
  await verifyR2DestinationMetadata(r2Client, bucket, dstKey, source.metadata)
  const head = await headR2Object(r2Client, bucket, dstKey)
  return {
    status,
    sha256: source.sha256,
    size: source.size,
    etag: normalizedEtag(head?.ETag),
  }
}

async function copyRemuxed({ object, source, sourcePath, ctx, push }) {
  const { r2Client, bucket, tempDir, runFfmpeg } = ctx
  const servedKey = object.destinationKey
  const keptKey = `_orig/${servedKey}`
  const contentType = effectiveContentType(source.metadata.contentType, object.sourceKey)

  // The untouched original first, so a crash never leaves a remux without it.
  const kept = await copyPlain({ r2Client, bucket, dstKey: keptKey, sourcePath, source, tempDir })
  push({
    role: 'original-kept',
    srcBucket: object.sourceBucket,
    srcKey: object.sourceKey,
    srcSha256: source.sha256,
    dstKey: keptKey,
    dstSha256: kept.sha256,
    dstSize: kept.size,
    dstEtag: kept.etag,
    contentType,
    transform: 'none',
    status: kept.status,
    verified: kept.sha256 === source.sha256,
  })

  const dstPath = join(tempDir, 'destination-object')
  await fs.rm(dstPath, { force: true })
  const head = await headR2Object(r2Client, bucket, servedKey)
  if (head) {
    const metadata = head.Metadata ?? {}
    if (metadata['src-sha256'] !== source.sha256 || metadata.transform !== 'ffmpeg:faststart') {
      throw new Error(`Destination conflict for ${servedKey}; it was not overwritten`)
    }
    const present = await downloadR2Object(r2Client, bucket, servedKey, dstPath)
    if (!present) throw new Error(`R2 did not return ${servedKey}`)
    const dst = await hashFile(dstPath)
    const faststart = isFaststart(await readPrefix(dstPath)) === true
    await verifyR2DestinationMetadata(r2Client, bucket, servedKey, {
      ...source.metadata,
      size: dst.size,
    })
    push({
      role: 'video-remux',
      srcBucket: object.sourceBucket,
      srcKey: object.sourceKey,
      srcSha256: source.sha256,
      dstKey: servedKey,
      dstSha256: dst.sha256,
      dstSize: dst.size,
      dstEtag: normalizedEtag(head.ETag),
      contentType,
      transform: 'ffmpeg:faststart',
      status: 'skipped (identical)',
      verified: faststart,
    })
    return
  }

  const outputPath = join(tempDir, 'remuxed-object.mp4')
  await fs.rm(outputPath, { force: true })
  await runFfmpeg(sourcePath, outputPath)
  if (isFaststart(await readPrefix(outputPath)) !== true) {
    throw new Error(`ffmpeg output for ${servedKey} is not faststart`)
  }
  const output = await hashFile(outputPath)
  const metadata = {
    ...source.metadata,
    size: output.size,
    customMetadata: {
      'src-sha256': source.sha256,
      transform: 'ffmpeg:faststart',
    },
  }
  await putR2Object(r2Client, bucket, servedKey, outputPath, metadata)
  const written = await downloadR2Object(r2Client, bucket, servedKey, dstPath)
  if (!written) throw new Error(`R2 did not return ${servedKey}`)
  const dst = await hashFile(dstPath)
  if (dst.sha256 !== output.sha256 || dst.size !== output.size) {
    throw new Error(`R2 checksum mismatch for ${servedKey}`)
  }
  await verifyR2DestinationMetadata(r2Client, bucket, servedKey, metadata)
  const after = await headR2Object(r2Client, bucket, servedKey)
  push({
    role: 'video-remux',
    srcBucket: object.sourceBucket,
    srcKey: object.sourceKey,
    srcSha256: source.sha256,
    dstKey: servedKey,
    dstSha256: dst.sha256,
    dstSize: dst.size,
    dstEtag: normalizedEtag(after?.ETag),
    contentType,
    transform: 'ffmpeg:faststart',
    status: 'remuxed',
    verified: true,
  })
}

async function copyVariants({ object, source, sourcePath, contentType, ctx, push }) {
  const { r2Client, bucket, tempDir, specVersion } = ctx
  const input = await fs.readFile(sourcePath)
  // Buffers, not paths: libvips caches by file name and every temp file here is reused.
  const metadata = await sharp(input).metadata()
  const plan = planVariants(
    { contentType, width: displayWidth(metadata), pages: metadata.pages ?? 1 },
    object.destinationKey,
    { specVersion }
  )
  if (plan.variants.length === 0) return

  const variantPath = join(tempDir, 'variant-object')
  const dstPath = join(tempDir, 'destination-object')
  for (const variant of plan.variants) {
    await Promise.all([
      fs.rm(variantPath, { force: true }),
      fs.rm(dstPath, { force: true }),
    ])
    const head = await headR2Object(r2Client, bucket, variant.key)
    let status = 'skipped (identical)'
    let expected = null
    const existing = head?.Metadata ?? {}
    const identical =
      head &&
      existing['src-sha256'] === source.sha256 &&
      existing['variant-spec'] === variant.spec
    if (head && !identical && !existing['variant-spec']) {
      // Not a variant this script wrote: never overwrite it.
      throw new Error(`Destination conflict for ${variant.key}; it was not overwritten`)
    }
    let variantMetadata = {
      size: head ? Number(head.ContentLength) : 0,
      contentType: variant.contentType,
      cacheControl: VARIANT_CACHE_CONTROL,
      contentDisposition: null,
      contentEncoding: null,
      contentLanguage: null,
    }
    if (!identical) {
      const encoded = await encodeVariant(input, variant.width, variant.format)
      await fs.writeFile(variantPath, encoded.data)
      expected = { sha256: sha256Of(encoded.data), size: encoded.data.length }
      variantMetadata = {
        ...variantMetadata,
        size: encoded.data.length,
        customMetadata: {
          'src-sha256': source.sha256,
          'variant-spec': variant.spec,
        },
      }
      await putR2Object(r2Client, bucket, variant.key, variantPath, variantMetadata)
      status = 'written'
    }
    const present = await downloadR2Object(r2Client, bucket, variant.key, dstPath)
    if (!present) throw new Error(`R2 did not return ${variant.key}`)
    const dst = await hashFile(dstPath)
    if (expected && (dst.sha256 !== expected.sha256 || dst.size !== expected.size)) {
      throw new Error(`R2 checksum mismatch for ${variant.key}`)
    }
    variantMetadata.size = dst.size
    await verifyR2DestinationMetadata(r2Client, bucket, variant.key, variantMetadata)
    const decoded = await sharp(await fs.readFile(dstPath)).metadata()
    if (decoded.width !== variant.width) {
      throw new Error(`Variant ${variant.key} decodes to width ${decoded.width}, expected ${variant.width}`)
    }
    const after = await headR2Object(r2Client, bucket, variant.key)
    push({
      role: 'variant',
      srcBucket: object.sourceBucket,
      srcKey: object.sourceKey,
      srcSha256: source.sha256,
      dstKey: variant.key,
      dstSha256: dst.sha256,
      dstSize: dst.size,
      dstEtag: normalizedEtag(after?.ETag),
      contentType: variant.contentType,
      transform: `sharp:${variant.format}:${variant.width}:${variant.spec}`,
      variantWidth: variant.width,
      variantFormat: variant.format,
      variantSpec: variant.spec,
      status,
      verified: true,
    })
  }
}

/**
 * Copies every manifest object, then writes the checksum report (also after
 * failures). Never deletes anything; never overwrites a differing original.
 */
export async function runCopy({
  manifest,
  bucket,
  sourceOrigin,
  r2Client,
  manifestSha256,
  manifestObjectCount,
  reportDir = DEFAULT_REPORT_DIR,
  runFfmpeg = runFfmpegFaststart,
  specVersion = VARIANT_SPEC_VERSION,
  now = () => new Date(),
  log = console.log,
  tempRoot = tmpdir(),
}) {
  const startedAt = now().toISOString()
  const rows = []
  const failures = []
  const tempDir = await fs.mkdtemp(join(tempRoot, 'clickit-r2-media-'))
  const ctx = { r2Client, bucket, tempDir, runFfmpeg, specVersion }
  const push = (row) => {
    rows.push(row)
    log(`${row.status}: ${row.dstKey}`)
  }
  try {
    for (const object of manifest.objects) {
      const sourcePath = join(tempDir, 'source-object')
      try {
        await fs.rm(sourcePath, { force: true })
        const source = await downloadSourceObject(object, sourceOrigin, sourcePath)
        if (object.analysis?.sha256 && object.analysis.sha256 !== source.sha256) {
          throw new Error(
            `Source changed since manifest for ${object.destinationKey}, refresh the manifest before copying`
          )
        }
        const contentType = effectiveContentType(source.metadata.contentType, object.sourceKey)
        const needsRemux =
          isMp4(contentType, object.sourceKey) &&
          isFaststart(await readPrefix(sourcePath)) === false
        if (needsRemux) {
          await copyRemuxed({ object, source, sourcePath, ctx, push })
          continue
        }
        const original = await copyPlain({
          r2Client,
          bucket,
          dstKey: object.destinationKey,
          sourcePath,
          source,
          tempDir,
        })
        push({
          role: 'original',
          srcBucket: object.sourceBucket,
          srcKey: object.sourceKey,
          srcSha256: source.sha256,
          dstKey: object.destinationKey,
          dstSha256: original.sha256,
          dstSize: original.size,
          dstEtag: original.etag,
          contentType,
          transform: 'none',
          status: original.status,
          verified: original.sha256 === source.sha256,
        })
        if (isRasterType(contentType)) {
          await copyVariants({ object, source, sourcePath, contentType, ctx, push })
        }
      } catch (error) {
        failures.push({
          key: object.destinationKey,
          error: error instanceof Error ? error.message : String(error),
        })
        log(`failed: ${object.destinationKey}`)
      }
    }
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true })
  }

  const report = buildCopyReport({
    rows,
    failures,
    manifestSha256,
    manifestObjectCount,
    bucket,
    startedAt,
    finishedAt: now().toISOString(),
    specVersion,
  })
  const paths = await writeReportFiles(reportDir, 'copy', report, now())
  if (failures.length === 0) {
    log(`Verified ${report.summary.originals} originals, ${report.summary.variants} variants`)
  }
  log(`Checksum report: ${paths.jsonPath} and ${paths.mdPath}`)
  return { report, paths }
}

export function assertManifestDestinationBucket(manifest, bucket) {
  if (!manifest.destinationBucket || manifest.destinationBucket !== bucket) {
    throw new Error('CLOUDFLARE_R2_BUCKET does not match the reviewed manifest')
  }
}

export function assertManifestSourceOrigin(manifest, currentSourceUrl) {
  const currentSourceOrigin = new URL(currentSourceUrl).origin
  if (manifest.sourceOrigin !== currentSourceOrigin) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL does not match the reviewed manifest source origin'
    )
  }
  return currentSourceOrigin
}

export async function executeManifest(options, deps = {}) {
  const env = deps.env ?? process.env
  const bucket = requiredEnv('CLOUDFLARE_R2_BUCKET', env)
  assertWriteGuard(env, bucket)
  const source = await fs.readFile(options.manifestPath, 'utf8')
  const manifest = validateR2MediaManifest(JSON.parse(source))
  assertManifestDestinationBucket(manifest, bucket)
  const sourceOrigin = assertManifestSourceOrigin(
    manifest,
    requiredEnv('NEXT_PUBLIC_SUPABASE_URL', env)
  )
  const info = manifestFileInfo(options.manifestPath)
  const r2Client = deps.r2Client ?? createR2Client(env)
  await assertR2BucketAccess(r2Client, bucket)

  const { report } = await runCopy({
    manifest,
    bucket,
    sourceOrigin,
    r2Client,
    ...info,
    reportDir: deps.reportDir,
    runFfmpeg: deps.runFfmpeg,
    specVersion: deps.specVersion,
    now: deps.now,
    log: deps.log,
  })
  if (report.failures.length) {
    throw new Error(
      `${report.failures.length} objects failed. Source objects were not changed.`
    )
  }
  return report
}

function usage() {
  return `Usage:
  CLOUDFLARE_R2_BUCKET=<bucket> npm run r2:media [-- --refresh --manifest <path> --bucket <name> ...]
  CLOUDFLARE_R2_BUCKET=<bucket> npm run r2:media -- --execute [--manifest <path>]

The default command is a dry run. It reads Supabase Storage, downloads each
object to a temp file to measure it (type, size, sha256, width, MP4 faststart,
duration, bitrate), writes the manifest, and writes a dry-run report to
.tmp/r2-media-reports/dry-run-<timestamp>.json and .md (planned variants,
skipped types with reasons, totals, media URLs found in app_config that are not
in the manifest). It makes no R2 call and no Supabase write.

--execute is the only write path. It requires CLOUDFLARE_ACCOUNT_ID to be the
ClickitStory account and CLOUDFLARE_R2_BUCKET to be ${MEDIA_BUCKET_NAME}. It copies
each original byte-for-byte (SHA-256 checked by downloading the R2 object),
writes WebP and AVIF variants at 640, 1280 and 1920 px only when strictly
narrower than the original (not for SVG, ICO, GIF, animated images or video),
and remuxes an MP4 whose moov box follows mdat with ffmpeg -c copy
-movflags +faststart: the remux is served at the original key and the untouched
original is kept at _orig/<bucket>/<key>. Re-running changes nothing that is
already identical. A differing existing original is never overwritten. Nothing
is ever deleted. Every run writes a checksum report to
.tmp/r2-media-reports/copy-<timestamp>.json and .md.

--execute uses Cloudflare's S3-compatible API directly. It requires
CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_R2_BUCKET, R2_ACCESS_KEY_ID, and
R2_SECRET_ACCESS_KEY. Wrangler login, OAuth, and API tokens are not used.
ffmpeg (and ffprobe) must be on PATH for the MP4 steps; they are never downloaded.`
}

function parseOptions(args) {
  const options = {
    execute: false,
    refresh: false,
    manifestPath: DEFAULT_MANIFEST_PATH,
    buckets: [],
  }

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === '--execute') {
      options.execute = true
    } else if (argument === '--refresh') {
      options.refresh = true
    } else if (argument === '--manifest') {
      const path = args[++index]
      if (!path) throw new Error('--manifest requires a path')
      options.manifestPath = resolve(PROJECT_ROOT, path)
    } else if (argument === '--bucket') {
      const bucket = args[++index]
      if (!bucket) throw new Error('--bucket requires a bucket name')
      options.buckets.push(bucket)
    } else if (argument === '--help' || argument === '-h') {
      options.help = true
    } else {
      throw new Error(`Unknown argument ${argument}`)
    }
  }

  if (options.execute && options.refresh) {
    throw new Error('--refresh cannot be used with --execute')
  }
  return options
}

async function main() {
  await loadEnvFile(resolve(PROJECT_ROOT, '.env.local'))
  const options = parseOptions(process.argv.slice(2))
  if (options.help) {
    console.log(usage())
    return
  }
  if (options.execute) {
    await executeManifest(options)
  } else {
    await createManifest(options)
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
