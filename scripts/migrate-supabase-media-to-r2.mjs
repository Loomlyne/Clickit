#!/usr/bin/env node

/**
 * Creates a verified, non-destructive copy of Clickit's public Supabase media
 * into one R2 bucket. Source objects stay untouched throughout this process.
 *
 * First create a manifest:
 *   CLOUDFLARE_R2_BUCKET=clickit-media npm run r2:media
 *
 * After reviewing it and enabling R2, copy and verify every object:
 *   CLOUDFLARE_ACCOUNT_ID=<account> CLOUDFLARE_R2_BUCKET=clickit-media \
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
import { createClient } from '@supabase/supabase-js'

const { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } =
  await import('@aws-sdk/client-s3')

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_MANIFEST_PATH = resolve(
  PROJECT_ROOT,
  '.tmp/r2-media-manifest.json'
)
const DEFAULT_SOURCE_BUCKETS = ['show-artwork', 'site-assets', 'avatars']
const MANIFEST_VERSION = 1

function requiredEnv(name) {
  const value = process.env[name]?.trim()
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

function createR2Client() {
  const accountId = requiredEnv('CLOUDFLARE_ACCOUNT_ID')
  const accessKeyId = requiredEnv('R2_ACCESS_KEY_ID')
  const secretAccessKey = requiredEnv('R2_SECRET_ACCESS_KEY')
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  })
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

async function verifyR2DestinationMetadata(client, bucket, key, source) {
  const destination = await client.send(
    new HeadObjectCommand({ Bucket: bucket, Key: key })
  )
  if (!r2DestinationMetadataMatches(source, destination)) {
    throw new Error(`R2 metadata mismatch for ${key}`)
  }
  return normalizedDestinationMetadata(destination)
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

async function hashFile(path) {
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
    : new Date(timestamp).toISOString()
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

async function downloadSourceObject(object, sourceOrigin, path) {
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
      })
    )
  } finally {
    body.destroy()
  }
}

async function copyAndVerifyObject({
  object,
  sourceOrigin,
  bucket,
  r2Client,
  tempDir,
}) {
  const sourcePath = join(tempDir, 'source-object')
  const destinationPath = join(tempDir, 'destination-object')
  await Promise.all([
    fs.rm(sourcePath, { force: true }),
    fs.rm(destinationPath, { force: true }),
  ])

  const source = await downloadSourceObject(object, sourceOrigin, sourcePath)
  const exists = await downloadR2Object(
    r2Client,
    bucket,
    object.destinationKey,
    destinationPath
  )
  let status = 'verified-existing'
  if (exists) {
    const destination = await hashFile(destinationPath)
    if (
      destination.size !== source.size ||
      destination.sha256 !== source.sha256 ||
      destination.md5 !== source.md5
    ) {
      throw new Error(
        `Destination conflict for ${object.destinationKey}; it was not overwritten`
      )
    }
  } else {
    await putR2Object(
      r2Client,
      bucket,
      object.destinationKey,
      sourcePath,
      source.metadata
    )
    const copied = await downloadR2Object(
      r2Client,
      bucket,
      object.destinationKey,
      destinationPath
    )
    if (!copied) throw new Error(`R2 did not return ${object.destinationKey}`)

    const destination = await hashFile(destinationPath)
    if (
      destination.size !== source.size ||
      destination.sha256 !== source.sha256 ||
      destination.md5 !== source.md5
    ) {
      throw new Error(`R2 checksum mismatch for ${object.destinationKey}`)
    }
    status = 'copied-and-verified'
  }

  const destinationMetadata = await verifyR2DestinationMetadata(
    r2Client,
    bucket,
    object.destinationKey,
    source.metadata
  )

  return {
    status,
    verifiedAt: new Date().toISOString(),
    byteLength: source.size,
    sha256: source.sha256,
    md5: source.md5,
    sourceMetadata: source.metadata,
    destinationMetadata,
  }
}

function usage() {
  return `Usage:
  CLOUDFLARE_R2_BUCKET=<bucket> npm run r2:media [-- --manifest <path> --bucket <name> ...]
  CLOUDFLARE_R2_BUCKET=<bucket> npm run r2:media -- --execute [--manifest <path>]

The default command only creates a manifest. --execute copies each object,
never deletes source data, refuses destination conflicts, and verifies SHA-256
byte length, source identity, and response metadata by downloading and heading
the R2 object after upload.

--execute uses Cloudflare's S3-compatible API directly. It requires
CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_R2_BUCKET, R2_ACCESS_KEY_ID, and
R2_SECRET_ACCESS_KEY. Wrangler login, OAuth, and API tokens are not used.`
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

async function createManifest(options) {
  if (existsSync(options.manifestPath) && !options.refresh) {
    throw new Error(
      `Manifest already exists at ${options.manifestPath}. Review it or use --refresh.`
    )
  }

  const sourceOrigin = new URL(requiredEnv('NEXT_PUBLIC_SUPABASE_URL')).origin
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY')
  const client = createClient(sourceOrigin, serviceRoleKey, {
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
  const manifest = createR2MediaManifest({
    sourceOrigin,
    destinationBucket: requiredEnv('CLOUDFLARE_R2_BUCKET'),
    objects,
  })
  validateR2MediaManifest(manifest)
  await writeManifest(options.manifestPath, manifest)
  console.log(
    `Wrote ${manifest.objects.length} objects to ${options.manifestPath}`
  )
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

async function executeManifest(options) {
  const source = await fs.readFile(options.manifestPath, 'utf8')
  const manifest = validateR2MediaManifest(JSON.parse(source))
  const bucket = requiredEnv('CLOUDFLARE_R2_BUCKET')
  assertManifestDestinationBucket(manifest, bucket)
  const sourceOrigin = assertManifestSourceOrigin(
    manifest,
    requiredEnv('NEXT_PUBLIC_SUPABASE_URL')
  )
  const r2Client = createR2Client()

  const tempDir = await fs.mkdtemp(join(tmpdir(), 'clickit-r2-media-'))
  let failures = 0
  try {
    for (const object of manifest.objects) {
      try {
        object.copy = await copyAndVerifyObject({
          object,
          sourceOrigin,
          bucket,
          r2Client,
          tempDir,
        })
        await writeManifest(options.manifestPath, manifest)
        console.log(`${object.copy.status}: ${object.destinationKey}`)
      } catch (error) {
        failures += 1
        object.copy = {
          status: 'failed',
          failedAt: new Date().toISOString(),
          error: error instanceof Error ? error.message : String(error),
        }
        await writeManifest(options.manifestPath, manifest)
        console.error(`failed: ${object.destinationKey}`)
      }
    }
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true })
  }

  if (failures) {
    throw new Error(
      `${failures} objects failed. Source objects were not changed.`
    )
  }
  console.log(`Verified ${manifest.objects.length} R2 objects.`)
}

async function main() {
  await loadEnvFile(resolve(PROJECT_ROOT, '.vercel/.env.production.local'))
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
