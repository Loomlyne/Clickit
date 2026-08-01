#!/usr/bin/env node
/**
 * One-off: upload compressed hero MP4s to Supabase Storage and refresh app_config URLs.
 * Usage: node scripts/upload-compressed-hero-videos.mjs
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
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
  resolve(root, '.env.vercel.production'),
]
let env = {}
for (const path of envCandidates) {
  try {
    env = { ...env, ...loadEnvFile(path) }
  } catch {
    // try next
  }
}
const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, key)
const tmpDir = resolve(root, '.tmp/hero-compress')
const uploads = [
  { local: 'video.mp4', path: 'hero/video.mp4', column: 'hero_video_url' },
  {
    local: 'video-mobile.mp4',
    path: 'hero/video-mobile.mp4',
    column: 'hero_video_mobile_url',
  },
]

const version = String(Date.now())

for (const item of uploads) {
  const body = readFileSync(resolve(tmpDir, item.local))
  console.log(`Uploading ${item.path} (${(body.length / 1024 / 1024).toFixed(2)} MB)...`)

  const { error } = await supabase.storage
    .from('site-assets')
    .upload(item.path, body, {
      upsert: true,
      contentType: 'video/mp4',
      cacheControl: '31536000',
    })

  if (error) {
    console.error(`Upload failed for ${item.path}:`, error.message)
    process.exit(1)
  }

  const { data: urlData } = supabase.storage
    .from('site-assets')
    .getPublicUrl(item.path)
  const publicUrl = `${urlData.publicUrl}?v=${version}`

  const { error: dbError } = await supabase
    .from('app_config')
    .update({
      [item.column]: publicUrl,
      [item.column === 'hero_video_url'
        ? 'hero_video_type'
        : 'hero_video_mobile_type']: 'mp4',
    })
    .eq('id', 1)

  if (dbError) {
    console.error(`DB update failed for ${item.column}:`, dbError.message)
    process.exit(1)
  }

  console.log(`  -> ${publicUrl}`)
}

console.log('Done.')
