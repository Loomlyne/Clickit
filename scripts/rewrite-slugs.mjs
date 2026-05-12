// One-time backfill: rewrites every shows.slug to match the current English title.
// Uses the Supabase service-role key (server-only).
//
// Usage:
//   node scripts/rewrite-slugs.mjs            # reads .env.local automatically
//   node scripts/rewrite-slugs.mjs --dry-run  # prints planned changes, writes nothing

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// --- .env.local loader (no dotenv dep) -------------------------------------
function loadEnvLocal() {
  const path = resolve(process.cwd(), '.env.local')
  let raw
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    return
  }
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) {
      process.env[key] = value
    }
  }
}
loadEnvLocal()

// --- slug logic (mirrors src/lib/slug.ts) ----------------------------------
const SLUG_MAX_LENGTH = 60

function generateSlug(title, fallback) {
  const base = (title ?? '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/, '')
  return base || fallback || ''
}

function dedupeSlug(base, takenSlugs) {
  if (!takenSlugs.has(base)) return base
  for (let i = 2; ; i++) {
    const candidate = `${base}-${i}`
    if (!takenSlugs.has(candidate)) return candidate
  }
}

// --- main ------------------------------------------------------------------
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url) {
  console.error('NEXT_PUBLIC_SUPABASE_URL is not set (check .env.local)')
  process.exit(1)
}
if (!key) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is not set (check .env.local)')
  process.exit(1)
}

const dryRun = process.argv.includes('--dry-run')
const supabase = createClient(url, key)

const { data: shows, error } = await supabase
  .from('shows')
  .select('id, slug, title')
  .order('created_at', { ascending: true })

if (error) {
  console.error('Failed to fetch shows:', error.message)
  process.exit(1)
}

if (!shows || shows.length === 0) {
  console.log('No shows found. Nothing to do.')
  process.exit(0)
}

const takenSlugs = new Set()
const plan = []

for (const row of shows) {
  const fallback = `show-${row.id.slice(0, 8)}`
  const base = generateSlug(row.title, fallback)
  const finalSlug = dedupeSlug(base, takenSlugs)
  takenSlugs.add(finalSlug)
  plan.push({ id: row.id, title: row.title, old: row.slug, new: finalSlug })
}

const changed = plan.filter((p) => p.old !== p.new)

console.log(`\n${plan.length} shows checked, ${changed.length} need updating.\n`)
if (changed.length === 0) {
  console.log('All slugs already match titles. Nothing to do.')
  process.exit(0)
}

console.log('Planned changes:')
for (const p of changed) {
  console.log(`  ${p.title}`)
  console.log(`    ${p.old}  ->  ${p.new}`)
}

if (dryRun) {
  console.log('\n--dry-run was set. No writes performed.')
  process.exit(0)
}

console.log('\nApplying...')
let updated = 0
let failed = 0
for (const p of changed) {
  const { error: updateErr } = await supabase
    .from('shows')
    .update({ slug: p.new })
    .eq('id', p.id)
  if (updateErr) {
    console.error(`  FAILED ${p.title}: ${updateErr.message}`)
    failed++
  } else {
    updated++
  }
}

console.log(`\nDone. ${updated} updated, ${failed} failed.`)
process.exit(failed > 0 ? 1 : 0)
