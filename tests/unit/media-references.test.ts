// Deferred items 21-23: every place a media url can be live, across all scopes, and the
// matching of a key in every url form. Pure module, fake Supabase.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import test from 'node:test'
import {
  MEDIA_JSON_COLUMNS,
  MEDIA_SAVE_CONFLICT,
  MEDIA_URL_COLUMNS,
  findLiveReferences,
  isMediaKeyReferenced,
  readMediaReferenceUrls,
  referencedKeysOf,
  type ReferenceDb,
} from '../../src/server/media-references.ts'
import { createFakeSupabase } from './helpers/fake-supabase.ts'

const ORIGIN = 'https://media.test'
const SHOW = '0b9f2a0e-1111-4222-8333-444455556666'
const KEY = `show-artwork/shows/${SHOW}/poster-1750000000000-12345678.webp`
const SUPA = 'https://proj.supabase.co/storage/v1/object/public/'

const db = (fake: ReturnType<typeof createFakeSupabase>) => fake.client as ReferenceDb

test('the save-conflict copy is the exact English line', () => {
  assert.equal(MEDIA_SAVE_CONFLICT, 'This item changed while you were saving. Reload and try again.')
})

test('a key is matched in every url form: origin, ?v=, Supabase public url, variant url, other host', () => {
  for (const url of [
    `${ORIGIN}/${KEY}`,
    `${ORIGIN}/${KEY}?v=3`,
    `${ORIGIN}/${KEY}#x`,
    `${SUPA}${KEY}`,
    `${SUPA}${KEY}?t=1`,
    `${ORIGIN}/_v/640/webp/${KEY}`,
    `${ORIGIN}/_v/1920/avif/${KEY}`,
    // A stored url on another media host (old origin, preview loopback) still counts: keep on doubt.
    `https://media.clickitstory.ae/${KEY}`,
    `http://127.0.0.1:8789/${KEY}?w=640`,
    KEY,
  ]) {
    assert.deepEqual(referencedKeysOf(url, ORIGIN), [KEY], url)
  }
  assert.deepEqual(referencedKeysOf(`${SUPA}${encodeURIComponent(KEY)}`, ORIGIN), [KEY])
})

test('urls inside text are found; non-media strings and other paths are not', () => {
  assert.deepEqual(referencedKeysOf(`See ${ORIGIN}/${KEY}, and more.`, ORIGIN), [KEY])
  for (const s of ['', 'poster', 'https://x.com/a', `${ORIGIN}/other/${KEY}`, `${ORIGIN}/%2e%2e/${KEY}x//y`, 'https://i.ytimg.com/vi/abc/hq720.jpg']) {
    assert.deepEqual(referencedKeysOf(s, ORIGIN), [], s)
  }
  // A url with dot segments is resolved the way a browser fetches it: it references that file.
  assert.deepEqual(referencedKeysOf(`${ORIGIN}/${KEY}/../x.webp`, ORIGIN), [`show-artwork/shows/${SHOW}/x.webp`])
})

function world(extra: Record<string, unknown[]> = {}) {
  return createFakeSupabase({
    shows: [
      {
        id: SHOW,
        poster_url: `${ORIGIN}/show-artwork/shows/${SHOW}/poster-1.webp`,
        card_image_url: `${ORIGIN}/show-artwork/shows/${SHOW}/card-1.webp`,
        hero_url: `${ORIGIN}/show-artwork/shows/${SHOW}/hero-1.webp`,
        hero_image_mobile_url: `${ORIGIN}/show-artwork/shows/${SHOW}/hero-mobile-1.webp`,
        logo_url: `${ORIGIN}/show-artwork/shows/${SHOW}/logo-1.png`,
        hero_video_url: `${ORIGIN}/site-assets/shows/${SHOW}/hero-desktop-1.mp4`,
        hero_video_mobile_url: `${ORIGIN}/site-assets/shows/${SHOW}/hero-mobile-1.mp4`,
        title: 'not a url',
      },
    ],
    show_cast: [{ id: 'c1', show_id: SHOW, image_url: `${ORIGIN}/show-artwork/shows/${SHOW}/cast/1.png` }],
    app_config: [
      {
        id: 1,
        og_image_url: `${ORIGIN}/site-assets/settings/og-1.jpg`,
        favicon_url: `${ORIGIN}/site-assets/settings/favicon-1.png`,
        favicon_dark_url: `${ORIGIN}/site-assets/settings/favicon-dark-1.png`,
        auth_image_url: `${ORIGIN}/site-assets/settings/auth-1.webp`,
        hero_video_url: `${ORIGIN}/site-assets/hero/video-1.mp4`,
        hero_video_mobile_url: `${ORIGIN}/site-assets/hero/video-mobile-1.mp4`,
        preloader_video_url: `${ORIGIN}/site-assets/preloader/video-1.mp4`,
        live_stream_url: 'https://www.youtube.com/watch?v=abcdefghijk',
        youtube_api_key: 'SECRET-never-read',
        footer_content: { social: [{ platform: 'x', iconUrl: `${ORIGIN}/site-assets/settings/social-icons/1.png` }] },
        cta_copy: { nested: [{ deep: `see ${SUPA}site-assets/settings/cta-1.webp` }] },
        top_ticker: { items: [] },
      },
    ],
    profiles: [{ id: 'u1', avatar_url: `${ORIGIN}/avatars/u1/avatar-1.webp` }],
    shorts: [{ id: 's1', thumbnail_url: `${ORIGIN}/site-assets/shorts/thumb-1.webp` }],
    ...extra,
  })
}

test('readMediaReferenceUrls reads every media column of every table, and app_config jsonb deeply', async () => {
  const r = await readMediaReferenceUrls(db(world()))
  assert.equal(r.error, null)
  const keys = new Set(r.urls.flatMap((u) => referencedKeysOf(u, ORIGIN)))
  for (const k of [
    `show-artwork/shows/${SHOW}/poster-1.webp`,
    `show-artwork/shows/${SHOW}/card-1.webp`,
    `show-artwork/shows/${SHOW}/hero-1.webp`,
    `show-artwork/shows/${SHOW}/hero-mobile-1.webp`,
    `show-artwork/shows/${SHOW}/logo-1.png`,
    `site-assets/shows/${SHOW}/hero-desktop-1.mp4`,
    `site-assets/shows/${SHOW}/hero-mobile-1.mp4`,
    `show-artwork/shows/${SHOW}/cast/1.png`,
    'site-assets/settings/og-1.jpg',
    'site-assets/settings/favicon-1.png',
    'site-assets/settings/favicon-dark-1.png',
    'site-assets/settings/auth-1.webp',
    'site-assets/hero/video-1.mp4',
    'site-assets/hero/video-mobile-1.mp4',
    'site-assets/preloader/video-1.mp4',
    'site-assets/settings/social-icons/1.png',
    'site-assets/settings/cta-1.webp',
    'avatars/u1/avatar-1.webp',
    'site-assets/shorts/thumb-1.webp',
  ]) {
    assert.ok(keys.has(k), `missing ${k}`)
  }
  assert.ok(!r.urls.includes('SECRET-never-read'), 'the api key column is never read')
  assert.ok(!r.urls.includes('not a url'), 'only media columns are read')
})

test('readMediaReferenceUrls reads every page (more rows than one PostgREST page)', async () => {
  const profiles = Array.from({ length: 2345 }, (_, i) => ({
    id: `u${String(i).padStart(5, '0')}`,
    avatar_url: `${ORIGIN}/avatars/u${i}/avatar-1.webp`,
  }))
  const r = await readMediaReferenceUrls(db(world({ profiles })))
  assert.equal(r.error, null)
  assert.ok(r.urls.includes(`${ORIGIN}/avatars/u2344/avatar-1.webp`))
  assert.ok(r.urls.includes(`${ORIGIN}/avatars/u0/avatar-1.webp`))
})

test('readMediaReferenceUrls fails closed: any table error is an error, not an empty list', async () => {
  for (const table of ['shows', 'show_cast', 'app_config', 'profiles', 'shorts']) {
    const fake = world()
    fake.failOn({ table, op: 'select', nth: 1 })
    const r = await readMediaReferenceUrls(db(fake))
    assert.ok(r.error, `${table} failure must surface`)
  }
  const fake = world()
  fake.throwOn({ table: 'shows', op: 'select', nth: 1 })
  assert.ok((await readMediaReferenceUrls(db(fake))).error)
})

test('readMediaReferenceUrls fails closed when the row count is missing (a short page cannot be trusted)', async () => {
  const fake = world()
  const noCount = {
    from: (t: string) => {
      const b = fake.client.from(t)
      const select = b.select.bind(b)
      b.select = (cols: string) => select(cols)
      return b
    },
  }
  const r = await readMediaReferenceUrls(noCount as ReferenceDb)
  assert.ok(r.error)
})

test('findLiveReferences: only the referenced keys (and variants of a referenced original) are live', async () => {
  const fake = world()
  const source = () => readMediaReferenceUrls(db(fake))
  const og = 'site-assets/settings/og-1.jpg'
  const free = 'site-assets/settings/og-0.jpg'
  const r = await findLiveReferences([og, `_v/640/webp/${og}`, free, `_v/640/webp/${free}`], source, ORIGIN)
  assert.equal(r.error, null)
  assert.deepEqual(r.live, [og, `_v/640/webp/${og}`])
  assert.equal(await isMediaKeyReferenced(og, source, ORIGIN), true)
  assert.equal(await isMediaKeyReferenced(free, source, ORIGIN), false)
})

test('findLiveReferences: a failed read counts every key as live (nothing may be deleted)', async () => {
  const keys = ['site-assets/settings/og-0.jpg']
  const failing = async () => ({ urls: [], error: 'db down' })
  const throwing = async () => {
    throw new Error('network')
  }
  for (const source of [failing, throwing]) {
    const r = await findLiveReferences(keys, source, ORIGIN)
    assert.ok(r.error)
    assert.deepEqual(r.live, keys)
    assert.equal(await isMediaKeyReferenced(keys[0]!, source, ORIGIN), true)
  }
})

// ---- static coverage: a media column the reference list misses fails here ----

const NOT_MEDIA: Record<string, string> = {
  youtube_video_id: 'YouTube id, not a url',
  hero_video_type: 'mp4/youtube flag',
  hero_video_mobile_type: 'mp4/youtube flag',
  hero_video_muted: 'boolean',
  icon: 'categories.icon is an icon name, not an uploaded file',
  cover_url: 'categories.cover_url was dropped (20260511000000)',
}

function migrationColumns() {
  const dir = 'supabase/migrations'
  const found = new Map<string, Set<string>>()
  const add = (table: string, col: string) => {
    if (!found.has(table)) found.set(table, new Set())
    found.get(table)!.add(col)
  }
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    const sql = readFileSync(`${dir}/${file}`, 'utf8').replace(/--[^\n]*/g, '')
    for (const stmt of sql.split(';')) {
      const head = /(?:create\s+table(?:\s+if\s+not\s+exists)?|alter\s+table(?:\s+if\s+exists)?)\s+(?:public\.)?([a-z_]+)/i.exec(stmt)
      if (!head) continue
      const table = head[1]!.toLowerCase()
      const colRe = /(?:^|,|\(|add\s+column(?:\s+if\s+not\s+exists)?)\s*([a-z_]+)\s+(text|jsonb|varchar)/gi
      for (const m of stmt.matchAll(colRe)) add(table, m[1]!.toLowerCase())
    }
  }
  return found
}

const looksLikeMedia = (col: string) => /(_url|image|avatar|poster|logo|icon|video|thumbnail|favicon)/.test(col)

test('static: every media-looking text column in the migrations is in the reference list (or named not-media)', () => {
  const cols = migrationColumns()
  const listed = MEDIA_URL_COLUMNS as Record<string, readonly string[]>
  const missing: string[] = []
  for (const [table, set] of cols) {
    for (const col of set) {
      if (!looksLikeMedia(col)) continue
      if (listed[table]?.includes(col)) continue
      if (col in NOT_MEDIA) continue
      missing.push(`${table}.${col}`)
    }
  }
  assert.deepEqual(missing, [], 'add these to MEDIA_URL_COLUMNS (src/server/media-references.ts) or NOT_MEDIA here')
  // The list names only columns that exist.
  for (const [table, list] of Object.entries(listed)) {
    for (const col of list) assert.ok(cols.get(table)?.has(col), `${table}.${col} is not in any migration`)
  }
})

test('static: every app_config jsonb column is scanned', () => {
  const jsonCols: string[] = []
  for (const file of readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql'))) {
    const sql = readFileSync(`supabase/migrations/${file}`, 'utf8')
    if (!/alter\s+table\s+(?:public\.)?app_config/i.test(sql)) continue
    for (const m of sql.matchAll(/add\s+column(?:\s+if\s+not\s+exists)?\s+([a-z_]+)\s+jsonb/gi)) jsonCols.push(m[1]!)
  }
  assert.ok(jsonCols.length >= 5)
  for (const col of jsonCols) assert.ok(MEDIA_JSON_COLUMNS.app_config.includes(col as never), `app_config.${col} not scanned`)
})

test('static: every finalize target column is in the reference list', () => {
  const actions = readFileSync('src/app/[locale]/admin/actions.ts', 'utf8')
  const block = (name: string) => {
    const m = new RegExp(`const ${name} = \\{([\\s\\S]*?)\\}`).exec(actions)
    assert.ok(m, `${name} not found`)
    return [...m[1]!.matchAll(/:\s*'([a-z_]+)'/g)].map((x) => x[1]!)
  }
  const artwork = block('ARTWORK_COLUMN')
  const site = block('SITE_IMAGE_COLUMN')
  assert.ok(artwork.length >= 5 && site.length >= 4)
  for (const c of artwork) assert.ok(MEDIA_URL_COLUMNS.shows.includes(c as never), `shows.${c}`)
  for (const c of site) assert.ok(MEDIA_URL_COLUMNS.app_config.includes(c as never), `app_config.${c}`)
  for (const c of ['hero_video_url', 'hero_video_mobile_url']) {
    assert.ok(MEDIA_URL_COLUMNS.shows.includes(c as never))
    assert.ok(MEDIA_URL_COLUMNS.app_config.includes(c as never))
  }
  assert.ok(MEDIA_URL_COLUMNS.app_config.includes('preloader_video_url' as never))
  assert.ok(MEDIA_URL_COLUMNS.show_cast.includes('image_url' as never))
  assert.ok(MEDIA_URL_COLUMNS.profiles.includes('avatar_url' as never))
  assert.ok(MEDIA_JSON_COLUMNS.app_config.includes('footer_content' as never), 'social iconUrl lives in footer_content')
})

test('media-references.ts stays pure: no next/, server-only or @/ imports', () => {
  const src = readFileSync('src/server/media-references.ts', 'utf8')
  assert.ok(!/from\s+['"](next\/|server-only|@\/)/.test(src))
})
