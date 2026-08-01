// One-shot live data cleanup for archived duplicate shows.
// Deletes archived rows that collide with active replacements, then moves the
// active replacements back to their clean slugs.

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ARCHIVED_DUPLICATES = [
  {
    id: 'da1f0df5-62b9-4bc1-b47c-ca71576f7e6c',
    title: '360',
    activeId: '52f26a74-fe53-478e-a824-888644c597b0',
    activeSlug: '360',
  },
  {
    id: '9133b9b3-3891-49a1-b374-01cdc3ae0c5d',
    title: 'Meta Talk',
    activeId: 'b27ccffd-3404-4b18-9a36-d5780b573a27',
    activeSlug: 'meta-talk',
  },
]

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

function curlJson(path, options = {}) {
  const method = options.method ?? 'GET'
  const args = [
    '--http1.1',
    '--connect-timeout',
    '5',
    '--max-time',
    '30',
    '-sS',
    '-X',
    method,
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}${path}`,
    '-H',
    `apikey: ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    '-H',
    `Authorization: Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    '-H',
    'Content-Type: application/json',
  ]
  if (options.body) {
    args.push('--data', JSON.stringify(options.body))
  }
  const raw = execFileSync('curl', args, { encoding: 'utf8' }).trim()
  return raw ? JSON.parse(raw) : null
}

function restSelectShows(query) {
  const params = new URLSearchParams(query)
  return curlJson(`/rest/v1/shows?${params.toString()}`, {
    method: 'GET',
  })
}

function restUpdateShow(id, body) {
  return curlJson(`/rest/v1/shows?id=eq.${id}`, {
    method: 'PATCH',
    body,
  })
}

function restDeleteShow(id) {
  return curlJson(`/rest/v1/shows?id=eq.${id}`, {
    method: 'DELETE',
  })
}

function listStorageFiles(bucket, showId) {
  return curlJson(`/storage/v1/object/list/${bucket}`, {
    method: 'POST',
    body: { prefix: `shows/${showId}`, limit: 1000 },
  })
}

function removeStorageFiles(bucket, paths) {
  return curlJson(`/storage/v1/object/${bucket}`, {
    method: 'DELETE',
    body: { prefixes: paths },
  })
}

function purgeShowFolder(bucket, showId) {
  const files = listStorageFiles(bucket, showId)
  if (!files || files.length === 0) {
    console.log(`  ${bucket}: no files`)
    return
  }

  const paths = files
    .filter((file) => file.name)
    .map((file) => `shows/${showId}/${file.name}`)

  if (paths.length === 0) {
    console.log(`  ${bucket}: no files`)
    return
  }

  removeStorageFiles(bucket, paths)
  console.log(`  ${bucket}: removed ${paths.length} file(s)`)
}

loadEnvLocal()

if (process.env.NEXT_PUBLIC_MEDIA_ORIGIN?.trim()) {
  console.error(
    'This one-shot source-only cleanup is disabled after the R2 public-media cutover.'
  )
  process.exit(1)
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.error('NEXT_PUBLIC_SUPABASE_URL is not set (check .env.local)')
  process.exit(1)
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is not set (check .env.local)')
  process.exit(1)
}

for (const duplicate of ARCHIVED_DUPLICATES) {
  const archivedRows = restSelectShows({
    select: 'id,title,slug,archived',
    id: `eq.${duplicate.id}`,
  })
  const archivedShow = archivedRows[0]

  purgeShowFolder('show-artwork', duplicate.id)
  purgeShowFolder('site-assets', duplicate.id)

  if (archivedShow) {
    if (!archivedShow.archived) {
      console.error(`${duplicate.title}: expected archived duplicate, found active row`)
      process.exit(1)
    }

    console.log(`${duplicate.title}: deleting archived ${archivedShow.slug}`)
    restDeleteShow(duplicate.id)
  } else {
    console.log(`${duplicate.title}: archived duplicate already deleted`)
  }

  const activeRows = restSelectShows({
    select: 'id,title,slug,archived',
    id: `eq.${duplicate.activeId}`,
  })
  const activeShow = activeRows[0]

  if (!activeShow) {
    console.error(`Failed to find active ${duplicate.title}`)
    process.exit(1)
  }
  if (activeShow.archived) {
    console.error(`${duplicate.title}: active replacement is archived`)
    process.exit(1)
  }
  if (activeShow.slug !== duplicate.activeSlug) {
    restUpdateShow(duplicate.activeId, { slug: duplicate.activeSlug })
    console.log(`${duplicate.title}: ${activeShow.slug} -> ${duplicate.activeSlug}`)
  } else {
    console.log(`${duplicate.title}: active slug already ${duplicate.activeSlug}`)
  }
}

console.log('Done.')
