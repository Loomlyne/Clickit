// "Edited on Clickit" flags (PR #27 review item 7, Koss 2026-10-20: refresh
// unless edited). The admin saves set <field>_edited when a field is changed on
// Clickit; the daily check skips flagged fields (youtube-recheck.test.ts).
// Pure helpers, the episode cores on the fake Supabase, and source guards for
// the shorts actions (actions.ts imports next/*). No live call, no key.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { createEpisodeCore, updateEpisodeCore } from '../../src/lib/admin/season-episode-writes.ts'
import {
  EPISODE_TEXT_FIELDS,
  SHORT_TEXT_FIELDS,
  episodeTextFromYouTube,
  flagsOnCreate,
  flagsOnUpdate,
  shortTextFromYouTube,
} from '../../src/lib/admin/youtube-text-edits.ts'
import type { VerifyOutcome, YouTubeMeta } from '../../src/lib/admin/youtube-verify.ts'
import { routeYouTubeText } from '../../src/server/youtube/script.ts'
import { createFakeSupabase, type Row } from './helpers/fake-supabase.ts'

const S1 = 'aaaaaaaa-0000-4000-8000-000000000001'
const SE1 = 'cccccccc-0000-4000-8000-000000000001'
const E1 = 'eeeeeeee-0000-4000-8000-000000000001'
// updated_at as PostgREST returns it; every episode update passes it (review item 8, PR #29).
const V0 = '2026-10-20T10:00:00.000001+00:00'

const stored = (over: Row = {}): Row => ({
  id: E1,
  show_id: S1,
  season_id: SE1,
  episode_number: 1,
  title: 'YouTube title',
  title_ar: null,
  description: 'YouTube text',
  description_ar: null,
  youtube_video_id: 'storedVid01',
  duration: 10,
  status: 'draft',
  archived: false,
  title_edited: false,
  title_ar_edited: false,
  description_edited: false,
  description_ar_edited: false,
  updated_at: V0,
  ...over,
})

function world(ep: Row = stored()) {
  return createFakeSupabase({
    shows: [{ id: S1, title: 'Show 1', season_count: 1, episode_count: 1 }],
    seasons: [{ id: SE1, show_id: S1, title: 'Season 1', season_number: 1, episode_count: 1 }],
    episodes: [ep],
  }, { updatedAtTables: ['episodes'] })
}

const meta = (over: Partial<YouTubeMeta> = {}): YouTubeMeta => ({
  videoId: 'newVideo001',
  title: 'YouTube title',
  description: 'YouTube text',
  channelTitle: 'Channel',
  thumbnailUrl: 'https://i.ytimg.com/vi/newVideo001/maxresdefault.jpg',
  durationSeconds: 600,
  durationMinutes: 10,
  ...over,
})

function deps(f: ReturnType<typeof world>, answer?: (raw: string) => VerifyOutcome) {
  return {
    audit: f.auditWriter,
    adminUserId: 'admin-1',
    // The real fill translates a blank Arabic field; here it keeps what is given.
    fillArabic: async (_en: string | null | undefined, ar: string | null | undefined) => ar ?? null,
    ...(answer ? { verifyVideo: async (raw: string) => answer(raw) } : {}),
  }
}

const ep = (f: ReturnType<typeof world>, id = E1) => f.tables.episodes!.find((e) => e.id === id)!
const lastPatch = (f: ReturnType<typeof world>) =>
  f.calls.filter((c) => c.table === 'episodes' && c.op === 'update').at(-1)!.patch as Row

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

test('episodeTextFromYouTube is routeYouTubeText (the import routing) with empty values as null', () => {
  for (const [title, description] of [
    ['English title', 'English text'],
    ['عنوان عربي', 'نص عربي'],
    ['English title', 'نص عربي'],
    ['  padded  ', ''],
  ]) {
    const r = routeYouTubeText({ title: title!, description: description! })
    const t = episodeTextFromYouTube({ title: title!, description: description! })
    assert.equal(t.title, r.title || null)
    assert.equal(t.title_ar, r.title_ar || null)
    assert.equal(t.description, r.description || null)
    assert.equal(t.description_ar, r.description_ar || null)
  }
  // Arabic title: mirrored into the required English title, as on import.
  assert.deepEqual(episodeTextFromYouTube({ title: 'عنوان', description: '' }), {
    title: 'عنوان',
    title_ar: 'عنوان',
    description: null,
    description_ar: null,
  })
})

test('shortTextFromYouTube: title, channel and an https thumbnail only', () => {
  assert.deepEqual(shortTextFromYouTube(meta({ title: ' A short ', channelTitle: 'Ch' })), {
    title: 'A short',
    channel_name: 'Ch',
    thumbnail_url: 'https://i.ytimg.com/vi/newVideo001/maxresdefault.jpg',
  })
  assert.equal(shortTextFromYouTube(meta({ thumbnailUrl: 'http://x.test/a.jpg' })).thumbnail_url, null)
  assert.equal(shortTextFromYouTube(meta({ thumbnailUrl: null })).thumbnail_url, null)
  assert.deepEqual([...SHORT_TEXT_FIELDS], ['title', 'channel_name'])
})

test('flagsOnCreate: differs from YouTube -> edited; same -> not; no YouTube text -> every non-empty field', () => {
  const yt = episodeTextFromYouTube(meta())
  assert.deepEqual(
    flagsOnCreate(EPISODE_TEXT_FIELDS, { title: 'YouTube title ', title_ar: '', description: 'Mine', description_ar: null }, yt),
    { title_edited: false, title_ar_edited: false, description_edited: true, description_ar_edited: false }
  )
  assert.deepEqual(
    flagsOnCreate(EPISODE_TEXT_FIELDS, { title: 'Typed', title_ar: 'مكتوب', description: 'Typed', description_ar: '' }, null),
    { title_edited: true, title_ar_edited: true, description_edited: true, description_ar_edited: false }
  )
})

test('flagsOnUpdate: only changed fields in the patch; trim and empty count as the same; a stored flag is never cleared', () => {
  const row = stored({ title_ar_edited: true })
  assert.deepEqual(flagsOnUpdate(EPISODE_TEXT_FIELDS, { title: 'Renamed' }, row, null), { title_edited: true })
  assert.deepEqual(flagsOnUpdate(EPISODE_TEXT_FIELDS, { title: ' YouTube title ' }, row, null), {})
  assert.deepEqual(flagsOnUpdate(EPISODE_TEXT_FIELDS, { description_ar: '' }, row, null), {})
  // Already edited: nothing to add, and nothing ever sets it back to false.
  assert.deepEqual(flagsOnUpdate(EPISODE_TEXT_FIELDS, { title_ar: 'x' }, row, null), {})
  // A new verified video whose text the admin fetched: not an edit.
  const yt = episodeTextFromYouTube(meta({ title: 'Other video' }))
  assert.deepEqual(flagsOnUpdate(EPISODE_TEXT_FIELDS, { title: 'Other video' }, row, yt), {})
  assert.deepEqual(flagsOnUpdate(EPISODE_TEXT_FIELDS, { title: 'Typed' }, row, yt), { title_edited: true })
})

// ---------------------------------------------------------------------------
// Episode cores
// ---------------------------------------------------------------------------

test('updateEpisodeCore: changing a field sets its flag in the same write; saving the same value does not', async () => {
  for (const f of EPISODE_TEXT_FIELDS) {
    const w = world(stored({ title_ar: 'عنوان', description_ar: 'وصف' }))
    const value = f.endsWith('_ar') ? 'نص جديد' : 'New text'
    const res = await updateEpisodeCore(w.client, deps(w), E1, { [f]: value }, V0)
    assert.equal(res.success, true, res.error)
    assert.equal(ep(w)[f], value)
    assert.equal(ep(w)[`${f}_edited`], true, `${f}_edited set`)
    assert.equal(lastPatch(w)[`${f}_edited`], true, 'flag travels with the text')
    for (const other of EPISODE_TEXT_FIELDS.filter((o) => o !== f)) {
      assert.equal(ep(w)[`${other}_edited`], false, `${other}_edited untouched`)
    }
  }

  const same = world()
  const res = await updateEpisodeCore(same.client, deps(same), E1, {
    title: 'YouTube title',
    description: ' YouTube text ',
    status: 'published',
  }, V0)
  assert.equal(res.success, true, res.error)
  for (const f of EPISODE_TEXT_FIELDS) assert.equal(ep(same)[`${f}_edited`], false)
  assert.equal(Object.keys(lastPatch(same)).some((k) => k.endsWith('_edited')), false)
})

test('updateEpisodeCore: a failed write rolls the flag back with the text', async () => {
  const w = world()
  w.failOn({ table: 'admin_audit_log', op: 'insert', nth: 1 })
  const res = await updateEpisodeCore(w.client, deps(w), E1, { title: 'Renamed' }, V0)
  assert.equal(res.success, false)
  assert.equal(ep(w).title, 'YouTube title')
  assert.equal(ep(w).title_edited, false)
})

test('updateEpisodeCore: once edited stays edited, even when the text goes back to YouTube\'s', async () => {
  const w = world(stored({ title: 'Mine', title_edited: true }))
  const res = await updateEpisodeCore(w.client, deps(w), E1, { title: 'YouTube title' }, V0)
  assert.equal(res.success, true, res.error)
  assert.equal(ep(w).title_edited, true)
})

test('createEpisodeCore (single link): an admin-changed title sets title_edited; fetched text stays unedited', async () => {
  const w = world()
  const res = await createEpisodeCore(w.client, deps(w, () => ({ ok: true, meta: meta() })), {
    show_id: S1,
    season_id: SE1,
    title: 'My own title',
    description: 'YouTube text',
    episode_number: 2,
    status: 'draft',
    youtube_video_id: 'newVideo001',
  })
  assert.equal(res.success, true, res.error)
  const created = ep(w, (res.data!.episode as Row).id)
  assert.equal(created.title_edited, true)
  assert.equal(created.description_edited, false)
  assert.equal(created.title_ar_edited, false)
  assert.equal(created.description_ar_edited, false)
  // Flags came from the verified video's text, so the daily check skips the
  // baseline for this row (PR #27 re-review, note 1).
  assert.equal(typeof created.youtube_text_baseline_at, 'string')
  assert.ok(Number.isFinite(Date.parse(created.youtube_text_baseline_at as string)))
})

test('createEpisodeCore: Arabic YouTube title routed like the import; an English title typed over the mirror is edited', async () => {
  const w = world()
  const res = await createEpisodeCore(
    w.client,
    deps(w, () => ({ ok: true, meta: meta({ title: 'عنوان عربي', description: 'نص عربي' }) })),
    {
      show_id: S1,
      season_id: SE1,
      title: 'English title',
      title_ar: 'عنوان عربي',
      description: 'English text',
      description_ar: 'نص عربي',
      episode_number: 2,
      status: 'draft',
      youtube_video_id: 'newVideo001',
    }
  )
  assert.equal(res.success, true, res.error)
  const created = ep(w, (res.data!.episode as Row).id)
  assert.equal(created.title_edited, true)
  assert.equal(created.title_ar_edited, false)
  assert.equal(created.description_edited, true)
  assert.equal(created.description_ar_edited, false)
})

test('createEpisodeCore: no verified video -> every non-empty text field is edited', async () => {
  const w = world()
  const res = await createEpisodeCore(w.client, deps(w), {
    show_id: S1,
    season_id: SE1,
    title: 'Typed',
    description: 'Typed text',
    episode_number: 2,
    status: 'draft',
  })
  assert.equal(res.success, true, res.error)
  const created = ep(w, (res.data!.episode as Row).id)
  assert.equal(created.title_edited, true)
  assert.equal(created.description_edited, true)
  assert.equal(created.title_ar_edited, false)
  assert.equal(created.description_ar_edited, false)
  // No verified video: the baseline waits for the first ok daily check.
  assert.equal(created.youtube_text_baseline_at ?? null, null)
})

// ---------------------------------------------------------------------------
// Shorts (rules through the helpers; wiring through source guards)
// ---------------------------------------------------------------------------

test('shorts: create against the verified video, update against the stored value', () => {
  const yt = shortTextFromYouTube(meta({ title: 'Short on YouTube', channelTitle: 'Ch' }))
  assert.deepEqual(flagsOnCreate(SHORT_TEXT_FIELDS, { title: 'Short on YouTube', channel_name: 'Ch' }, yt), {
    title_edited: false,
    channel_name_edited: false,
  })
  assert.deepEqual(flagsOnCreate(SHORT_TEXT_FIELDS, { title: 'Renamed', channel_name: 'Ch' }, yt), {
    title_edited: true,
    channel_name_edited: false,
  })
  const row = { title: 'Short on YouTube', channel_name: 'Ch', title_edited: false, channel_name_edited: false }
  assert.deepEqual(flagsOnUpdate(SHORT_TEXT_FIELDS, { title: 'Short on YouTube', channel_name: 'Other' }, row, null), {
    channel_name_edited: true,
  })
  assert.deepEqual(flagsOnUpdate(SHORT_TEXT_FIELDS, { title: 'Short on YouTube', channel_name: 'Ch' }, row, null), {})
})

test('source guard: createShort and updateShort set the flags in their own write', () => {
  const src = readFileSync('src/app/[locale]/admin/actions.ts', 'utf8')
  const body = (name: string) => {
    const start = src.indexOf(`export async function ${name}(`)
    assert.ok(start > -1, name)
    return src.slice(start, src.indexOf('\nexport async function ', start + 1))
  }
  const create = body('createShort')
  assert.match(create, /const edited = flagsOnCreate\(\s*SHORT_TEXT_FIELDS,\s*parsed,\s*video\.meta \? shortTextFromYouTube\(video\.meta\) : null\s*\)/)
  assert.match(create, /\.insert\(\{ \.\.\.parsed, \.\.\.edited, sort_order:/)
  const update = body('updateShort')
  // updated_at too: a stale drawer is refused before the YouTube call (review item 8, PR #29).
  assert.match(update, /\.select\('youtube_video_id, title, channel_name, title_edited, channel_name_edited, updated_at'\)/)
  assert.match(update, /const edited = flagsOnUpdate\(\s*SHORT_TEXT_FIELDS,\s*parsed,\s*current,\s*video\.meta \? shortTextFromYouTube\(video\.meta\) : null\s*\)/)
  // The flags ride in the same compare-and-swap UPDATE (updateIfUnchanged, review item 8, PR #29).
  assert.match(update, /updateIfUnchanged\(\s*admin,\s*'shorts',\s*id,\s*\{ \.\.\.parsed, \.\.\.edited \},/)
  // Clients cannot send a flag: the shorts schema has none.
  const schema = src.slice(src.indexOf('const shortSchema = z.object({'), src.indexOf('})', src.indexOf('const shortSchema = z.object({')))
  assert.doesNotMatch(schema, /_edited/)
})

test('source guard: the episode schemas reject a client-sent flag (strict update schema, no flag keys)', () => {
  const schemas = readFileSync('src/lib/admin/schemas.ts', 'utf8')
  assert.doesNotMatch(schemas, /_edited/)
  assert.match(schemas, /export const episodeUpdateSchema = episodeSchema\.partial\(\)\.strict\(\)/)
})
