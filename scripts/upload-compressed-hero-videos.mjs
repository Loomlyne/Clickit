#!/usr/bin/env node
/**
 * One-off: upload compressed hero MP4s to Supabase Storage and refresh app_config URLs.
 * Usage: node scripts/upload-compressed-hero-videos.mjs
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DeleteObjectsCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

function loadEnvFile(path) {
  const text = readFileSync(path, 'utf8')
  const env = {}
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq)
    let value = trimmed.slice(eq + 1)
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    env[key] = value
  }
  return env
}

const envCandidates = [
  resolve(root, '.env.local'),
]
let env = {}
for (const path of envCandidates) {
  try {
    env = { ...env, ...loadEnvFile(path) }
  } catch {
    // try next
  }
}
const value = (name) => env[name]?.trim() || process.env[name]?.trim() || ''
const url = value('NEXT_PUBLIC_SUPABASE_URL')
const key = value('SUPABASE_SERVICE_ROLE_KEY')
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

function isValidPublicMediaOrigin(origin) {
  if (!origin) return false
  try {
    const parsed = new URL(origin)
    return (
      parsed.protocol === 'https:' &&
      !parsed.username &&
      !parsed.password &&
      parsed.pathname === '/' &&
      !parsed.search &&
      !parsed.hash
    )
  } catch {
    return false
  }
}

const r2Values = {
  accountId: value('CLOUDFLARE_ACCOUNT_ID'),
  bucket: value('CLOUDFLARE_R2_BUCKET'),
  accessKeyId: value('R2_ACCESS_KEY_ID'),
  secretAccessKey: value('R2_SECRET_ACCESS_KEY'),
}
const r2Configured = Object.values(r2Values).every(Boolean)
const cutoverEnabled =
  value('NEXT_PUBLIC_MEDIA_CUTOVER_READY') === 'verified' &&
  isValidPublicMediaOrigin(value('NEXT_PUBLIC_MEDIA_ORIGIN'))
if (cutoverEnabled && !r2Configured) {
  console.error(
    'R2 media mirroring is required while NEXT_PUBLIC_MEDIA_ORIGIN is enabled.'
  )
  process.exit(1)
}

const r2 = r2Configured
  ? new S3Client({
      region: 'auto',
      endpoint: `https://${r2Values.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: r2Values.accessKeyId,
        secretAccessKey: r2Values.secretAccessKey,
      },
    })
  : null

const supabase = createClient(url, key)
const tmpDir = resolve(root, '.tmp/hero-compress')
const uploads = [
  {
    local: 'video.mp4',
    prefix: 'hero/video',
    column: 'hero_video_url',
    typeColumn: 'hero_video_type',
  },
  {
    local: 'video-mobile.mp4',
    prefix: 'hero/video-mobile',
    column: 'hero_video_mobile_url',
    typeColumn: 'hero_video_mobile_type',
  },
]

const version = String(Date.now())

const { data: currentConfig, error: currentConfigError } = await supabase
  .from('app_config')
  .select('hero_video_url, hero_video_mobile_url')
  .eq('id', 1)
  .single()
if (currentConfigError || !currentConfig) {
  console.error(currentConfigError?.message ?? 'Could not load site config')
  process.exit(1)
}

function getPublicStoragePath(url, bucket) {
  if (!url) return null
  try {
    const parsed = new URL(url)
    const prefix = `/storage/v1/object/public/${bucket}/`
    if (!parsed.pathname.startsWith(prefix)) return null
    const path = decodeURIComponent(parsed.pathname.slice(prefix.length))
    return path && !path.startsWith('/') && !path.split('/').includes('..')
      ? path
      : null
  } catch {
    return null
  }
}

class R2HeroRollbackError extends Error {
  constructor() {
    super('Could not restore the R2 hero media state')
    this.name = 'R2HeroRollbackError'
  }
}

async function deleteR2Object(objectKey) {
  if (!r2) return true

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await r2.send(
        new DeleteObjectsCommand({
          Bucket: r2Values.bucket,
          Delete: { Objects: [{ Key: objectKey }], Quiet: true },
        })
      )
      if (!result.Errors?.length) return true
    } catch {
      // Retry one transient R2 deletion failure.
    }
  }

  return false
}

async function discardHeroVideo(path) {
  if (!(await deleteR2Object(`site-assets/${path}`))) return false
  const { error } = await supabase.storage.from('site-assets').remove([path])
  return !error
}

async function mirrorHeroVideo(path, body) {
  if (!r2) return

  const objectKey = `site-assets/${path}`
  let writeStarted = false
  try {
    writeStarted = true
    await r2.send(
      new PutObjectCommand({
        Bucket: r2Values.bucket,
        Key: objectKey,
        Body: body,
        ContentType: 'video/mp4',
        CacheControl: '31536000',
      })
    )
    const head = await r2.send(
      new HeadObjectCommand({ Bucket: r2Values.bucket, Key: objectKey })
    )
    if (
      head.ContentLength !== body.length ||
      head.ContentType !== 'video/mp4' ||
      head.CacheControl !== '31536000'
    ) {
      throw new Error('verification failed')
    }
  } catch {
    if (writeStarted && !(await deleteR2Object(objectKey))) {
      throw new R2HeroRollbackError()
    }
    throw new Error('Could not mirror hero video to R2')
  }
}

for (const item of uploads) {
  const path = `${item.prefix}-${version}.mp4`
  const body = readFileSync(resolve(tmpDir, item.local))
  console.log(`Uploading ${path} (${(body.length / 1024 / 1024).toFixed(2)} MB)...`)

  const { error } = await supabase.storage
    .from('site-assets')
    .upload(path, body, {
      upsert: false,
      contentType: 'video/mp4',
      cacheControl: '31536000',
    })

  if (error) {
    console.error(`Upload failed for ${path}:`, error.message)
    process.exit(1)
  }

  try {
    await mirrorHeroVideo(path, body)
  } catch (error) {
    if (!(error instanceof R2HeroRollbackError)) {
      await discardHeroVideo(path)
    }
    console.error(error instanceof Error ? error.message : 'R2 mirror failed')
    process.exit(1)
  }

  const { data: urlData } = supabase.storage
    .from('site-assets')
    .getPublicUrl(path)
  const publicUrl = `${urlData.publicUrl}?v=${version}`

  const { error: dbError } = await supabase
    .from('app_config')
    .update({
      [item.column]: publicUrl,
      [item.typeColumn]: 'mp4',
    })
    .eq('id', 1)

  if (dbError) {
    const cleaned = await discardHeroVideo(path)
    console.error(`DB update failed for ${item.column}:`, dbError.message)
    if (!cleaned) console.error(`Cleanup failed for ${path}`)
    process.exit(1)
  }

  const previousPath = getPublicStoragePath(
    currentConfig[item.column],
    'site-assets'
  )
  if (previousPath && previousPath !== path) {
    const cleaned = await discardHeroVideo(previousPath)
    if (!cleaned) console.error(`Previous media cleanup failed for ${previousPath}`)
  }

  console.log(`  -> ${publicUrl}`)
}

console.log('Done.')
