#!/usr/bin/env node
/**
 * List large MP4 objects referenced by shows (hero_video_url).
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

let env = {}
for (const path of [
  resolve(root, '.env.local'),
  resolve(root, '.env.vercel.production'),
]) {
  try {
    env = { ...env, ...loadEnvFile(path) }
  } catch {}
}

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
)

const { data: shows } = await supabase
  .from('shows')
  .select('title, slug, hero_video_url, hero_video_type, hero_video_mobile_url, hero_video_mobile_type')

for (const show of shows ?? []) {
  for (const [label, url, type] of [
    ['desktop', show.hero_video_url, show.hero_video_type],
    ['mobile', show.hero_video_mobile_url, show.hero_video_mobile_type],
  ]) {
    if (type !== 'mp4' || !url) continue
    try {
      const res = await fetch(url, { method: 'HEAD' })
      const len = res.headers.get('content-length')
      const mb = len ? (Number(len) / 1024 / 1024).toFixed(2) : '?'
      console.log(`${show.slug} (${label}): ${mb} MB`)
    } catch (e) {
      console.log(`${show.slug} (${label}): HEAD failed`)
    }
  }
}
