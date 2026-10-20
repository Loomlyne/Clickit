#!/usr/bin/env node

/**
 * No-key copy of Clickit's public Supabase media into the R2 bucket that
 * workers/media serves (key = `<supabase bucket>/<object path>`).
 *
 * Unlike migrate-supabase-media-to-r2.mjs (S3 API, needs R2 + service-role
 * keys), this uses only logins already on Koss's Mac:
 *   - listing: `supabase db query --linked` (SELECT on storage.objects)
 *   - source bytes: the PUBLIC Supabase object URL (read-only)
 *   - R2 writes/reads: `wrangler r2 object put|get --remote` (OAuth login in
 *     HOME=/Users/koss/.clickit-cloudflare, ClickitStory account)
 *
 * Supabase is never written to. R2 objects are only written when missing, or
 * with --update-changed when their bytes differ from the current source.
 *
 *   node scripts/copy-supabase-media-to-r2-wrangler.mjs            # manifest (dry run)
 *   node scripts/copy-supabase-media-to-r2-wrangler.mjs --refresh  # rebuild manifest
 *   node scripts/copy-supabase-media-to-r2-wrangler.mjs --execute  # copy + verify
 *   node scripts/copy-supabase-media-to-r2-wrangler.mjs --execute --update-changed  # re-sync
 *   node scripts/copy-supabase-media-to-r2-wrangler.mjs --verify   # re-verify all, writes nothing
 */

import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream, existsSync, promises as fs } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const MANIFEST_VERSION = 1
const DEFAULTS = {
  manifestPath: resolve(PROJECT_ROOT, '.tmp/r2-wrangler-manifest.json'),
  workDir: resolve(PROJECT_ROOT, '.tmp/r2-copy-work'),
  projectRef: 'lajguozmtissnnfccmej',
  bucket: 'clickit-media',
  sourceBuckets: ['show-artwork', 'site-assets', 'avatars'],
  wranglerHome: '/Users/koss/.clickit-cloudflare',
  wranglerVersion: '4.151.2',
  concurrency: 4,
}

function parseOptions(args) {
  const options = {
    mode: 'manifest',
    refresh: false,
    updateChanged: false,
    manifestPath: DEFAULTS.manifestPath,
    concurrency: DEFAULTS.concurrency,
  }
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === '--execute') options.mode = 'execute'
    else if (argument === '--verify') options.mode = 'verify'
    else if (argument === '--refresh') options.refresh = true
    else if (argument === '--update-changed') options.updateChanged = true
    else if (argument === '--manifest') {
      const path = args[++index]
      if (!path) throw new Error('--manifest requires a path')
      options.manifestPath = resolve(PROJECT_ROOT, path)
    } else if (argument === '--concurrency') {
      const value = Number(args[++index])
      if (!Number.isInteger(value) || value < 1 || value > 4) {
        throw new Error('--concurrency must be 1-4')
      }
      options.concurrency = value
    } else if (argument === '--help' || argument === '-h') options.mode = 'help'
    else throw new Error(`Unknown argument ${argument}`)
  }
  if (options.updateChanged && options.mode !== 'execute') {
    throw new Error('--update-changed only applies to --execute')
  }
  return options
}

function destinationKey(bucket, key) {
  if (!bucket || !key || key.startsWith('/') || key.split('/').some((part) => !part || part === '.' || part === '..')) {
    throw new Error(`Invalid source object path ${bucket}/${key}`)
  }
  return `${bucket}/${key}`
}

function publicObjectUrl(sourceOrigin, bucket, key) {
  const encodedKey = key.split('/').map(encodeURIComponent).join('/')
  return `${sourceOrigin}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodedKey}`
}

function normalizedEtag(value) {
  return typeof value === 'string' && value ? value.replace(/^W\//i, '').replace(/^"|"$/g, '') : null
}

// ---------- manifest (read-only SQL) ----------

async function listSourceObjects(projectRef, buckets) {
  const list = buckets.map((bucket) => `'${bucket.replace(/'/g, "''")}'`).join(',')
  const sql = `select bucket_id, name, (metadata->>'size')::bigint as size,
    metadata->>'mimetype' as mimetype, metadata->>'cacheControl' as cache_control,
    metadata->>'eTag' as etag, metadata->>'lastModified' as last_modified
    from storage.objects where bucket_id in (${list}) order by bucket_id, name`
  const { stdout } = await run(
    'supabase',
    ['db', 'query', '--linked', '--project-ref', projectRef, '--output-format', 'json', sql],
    { cwd: PROJECT_ROOT, maxBuffer: 64 * 1024 * 1024 }
  )
  const rows = JSON.parse(stdout.slice(stdout.indexOf('{'))).rows
  if (!Array.isArray(rows)) throw new Error('Unexpected supabase db query output')
  return rows.map((row) => {
    const size = Number(row.size)
    if (!Number.isSafeInteger(size) || size < 0) {
      throw new Error(`Missing size metadata for ${row.bucket_id}/${row.name}`)
    }
    return {
      sourceBucket: row.bucket_id,
      sourceKey: row.name,
      destinationKey: destinationKey(row.bucket_id, row.name),
      source: {
        size,
        contentType: row.mimetype || null,
        cacheControl: row.cache_control || null,
        etag: row.etag || null,
        lastModified: row.last_modified || null,
      },
    }
  })
}

async function writeJson(path, value) {
  await fs.mkdir(dirname(path), { recursive: true })
  await fs.writeFile(`${path}.tmp`, `${JSON.stringify(value, null, 2)}\n`)
  await fs.rename(`${path}.tmp`, path)
}

function summarize(objects) {
  const perBucket = {}
  for (const object of objects) {
    const entry = (perBucket[object.sourceBucket] ??= { objects: 0, bytes: 0 })
    entry.objects += 1
    entry.bytes += object.source.size
  }
  const total = objects.reduce((sum, object) => sum + object.source.size, 0)
  return { objects: objects.length, bytes: total, perBucket }
}

async function createManifest(options) {
  if (existsSync(options.manifestPath) && !options.refresh) {
    throw new Error(`Manifest exists at ${options.manifestPath}. Review it or pass --refresh.`)
  }
  const objects = await listSourceObjects(DEFAULTS.projectRef, DEFAULTS.sourceBuckets)
  const keys = new Set()
  for (const object of objects) {
    if (keys.has(object.destinationKey)) throw new Error(`Duplicate key ${object.destinationKey}`)
    keys.add(object.destinationKey)
  }
  const manifest = {
    version: MANIFEST_VERSION,
    generatedAt: new Date().toISOString(),
    sourceOrigin: `https://${DEFAULTS.projectRef}.supabase.co`,
    destinationBucket: DEFAULTS.bucket,
    objects,
  }
  await writeJson(options.manifestPath, manifest)
  console.log(JSON.stringify({ manifest: options.manifestPath, ...summarize(objects) }, null, 2))
}

// ---------- copy / verify ----------

function wrangler(args) {
  return run('npx', ['-y', `wrangler@${DEFAULTS.wranglerVersion}`, ...args], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, HOME: DEFAULTS.wranglerHome, WRANGLER_SEND_METRICS: 'false' },
    maxBuffer: 16 * 1024 * 1024,
  })
}

function isMissingObject(error) {
  const output = `${error?.stdout ?? ''}\n${error?.stderr ?? ''}\n${error?.message ?? ''}`
  return /does not exist|not found|NoSuchKey|10007/i.test(output)
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
  return { size, sha256: sha256.digest('hex'), md5: md5.digest('hex') }
}

async function downloadSource(object, sourceOrigin, path) {
  const response = await fetch(publicObjectUrl(sourceOrigin, object.sourceBucket, object.sourceKey), {
    cache: 'no-store',
    headers: { 'Accept-Encoding': 'identity' },
  })
  if (response.status !== 200 || !response.body) {
    throw new Error(`source HTTP ${response.status}`)
  }
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
  const result = { size, sha256: sha256.digest('hex'), md5: md5.digest('hex') }

  if (size !== object.source.size) {
    throw new Error(`source size ${size} != manifest ${object.source.size}; refresh the manifest`)
  }
  // A single-part Supabase eTag is the MD5 of the stored bytes: cross-check it.
  const etag = normalizedEtag(object.source.etag)
  if (etag && !etag.includes('-') && etag !== result.md5) {
    throw new Error(`source md5 ${result.md5} != stored eTag ${etag}; refresh the manifest`)
  }
  return result
}

async function getR2(key, path) {
  await fs.rm(path, { force: true })
  try {
    await wrangler(['r2', 'object', 'get', `${DEFAULTS.bucket}/${key}`, '--file', path, '--remote'])
  } catch (error) {
    if (isMissingObject(error)) return null
    throw error
  }
  if (!existsSync(path)) return null
  return hashFile(path)
}

async function putR2(object, path) {
  const args = ['r2', 'object', 'put', `${DEFAULTS.bucket}/${object.destinationKey}`, '--file', path, '--remote']
  if (object.source.contentType) args.push('--content-type', object.source.contentType)
  if (object.source.cacheControl) args.push('--cache-control', object.source.cacheControl)
  await wrangler(args)
}

const same = (left, right) =>
  left && right && left.size === right.size && left.sha256 === right.sha256 && left.md5 === right.md5

async function processObject(object, sourceOrigin, options, dir) {
  const sourcePath = join(dir, 'source')
  const destinationPath = join(dir, 'destination')
  const source = await downloadSource(object, sourceOrigin, sourcePath)
  const existing = await getR2(object.destinationKey, destinationPath)

  let status
  if (same(existing, source)) {
    status = 'verified-existing'
  } else if (options.mode === 'verify') {
    throw new Error(existing ? 'R2 bytes differ from source' : 'missing in R2')
  } else {
    if (existing && !options.updateChanged) {
      throw new Error('R2 object differs from source; not overwritten (re-run with --update-changed)')
    }
    await putR2(object, sourcePath)
    const copied = await getR2(object.destinationKey, destinationPath)
    if (!same(copied, source)) throw new Error('R2 read-back checksum mismatch after put')
    status = existing ? 'updated-and-verified' : 'copied-and-verified'
  }
  return { status, verifiedAt: new Date().toISOString(), size: source.size, sha256: source.sha256, md5: source.md5 }
}

// wrangler errors: keep the exit code/signal and its own error line, not the argv.
function describeError(error) {
  if (error?.cmd === undefined) return error.message.split('\n')[0]
  const detail = `${error.stderr ?? ''}\n${error.stdout ?? ''}`
    .split('\n')
    .map((line) => line.replace(/\u001b\[[0-9;]*m/g, '').trim())
    .find((line) => /ERROR|✘/.test(line))
  return `wrangler ${error.cmd.split(' ').slice(3, 6).join(' ')} failed (code ${error.code ?? '-'}, signal ${error.signal ?? '-'}): ${detail ?? 'no error line'}`
}

async function withRetries(label, fn, attempts = 3) {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      console.error(`attempt ${attempt} failed: ${label}: ${describeError(error)}`)
      // Deterministic refusals are not retried.
      if (/not overwritten|refresh the manifest|missing in R2|differ from source/.test(error.message)) break
      await new Promise((done) => setTimeout(done, 1000 * attempt))
    }
  }
  throw lastError
}

async function executeManifest(options) {
  const manifest = JSON.parse(await fs.readFile(options.manifestPath, 'utf8'))
  if (manifest.version !== MANIFEST_VERSION || manifest.destinationBucket !== DEFAULTS.bucket) {
    throw new Error('Manifest version or destination bucket mismatch')
  }
  for (const object of manifest.objects) {
    if (object.destinationKey !== destinationKey(object.sourceBucket, object.sourceKey)) {
      throw new Error(`Bad destination key ${object.destinationKey}`)
    }
  }

  await fs.mkdir(DEFAULTS.workDir, { recursive: true })
  const queue = [...manifest.objects]
  const counts = {}
  let failures = 0
  let writes = Promise.resolve()
  const save = () => (writes = writes.then(() => writeJson(options.manifestPath, manifest)))

  async function worker(slot) {
    const dir = join(DEFAULTS.workDir, `w${slot}`)
    await fs.mkdir(dir, { recursive: true })
    for (let object = queue.shift(); object; object = queue.shift()) {
      try {
        object.copy = await withRetries(object.destinationKey, () => processObject(object, manifest.sourceOrigin, options, dir))
        console.log(`${object.copy.status}: ${object.destinationKey} (${object.copy.size} B sha256 ${object.copy.sha256.slice(0, 12)})`)
      } catch (error) {
        failures += 1
        object.copy = { status: 'failed', failedAt: new Date().toISOString(), error: describeError(error) }
        console.error(`failed: ${object.destinationKey}: ${object.copy.error}`)
      }
      counts[object.copy.status] = (counts[object.copy.status] ?? 0) + 1
      await save()
    }
  }

  try {
    await Promise.all(Array.from({ length: options.concurrency }, (_, slot) => worker(slot)))
    await writes
  } finally {
    await fs.rm(DEFAULTS.workDir, { recursive: true, force: true })
  }

  console.log(JSON.stringify({ mode: options.mode, ...summarize(manifest.objects), results: counts, failures }, null, 2))
  if (failures) throw new Error(`${failures} objects failed. Supabase was not changed.`)
}

async function main() {
  const options = parseOptions(process.argv.slice(2))
  if (options.mode === 'help') {
    console.log('See the header of scripts/copy-supabase-media-to-r2-wrangler.mjs')
    return
  }
  if (options.mode === 'manifest') await createManifest(options)
  else await executeManifest(options)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
