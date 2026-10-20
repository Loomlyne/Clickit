import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const episodeForm = readFileSync(
  new URL(
    '../../src/components/admin/episode-form-drawer.tsx',
    import.meta.url
  ),
  'utf8'
)

function count(src: string, re: RegExp): number {
  return (src.match(re) ?? []).length
}

test('episode form: no caller of the old GET route', () => {
  assert.equal(count(episodeForm, /api\/youtube-meta/g), 0)
})

test('episode form: metadata comes from the fetchYouTubeMeta Server Action', () => {
  assert.match(
    episodeForm,
    /import \{[^}]*\bfetchYouTubeMeta\b[^}]*\} from '@\/app\/\[locale\]\/admin\/actions'/
  )
  assert.ok(count(episodeForm, /fetchYouTubeMeta\(/g) >= 1)
})

test('episode form: refusals are translated from codes, not shown as raw server text', () => {
  assert.match(episodeForm, /YOUTUBE_ERROR_MESSAGE_KEYS/)
  assert.match(episodeForm, /youtubeError/)
  assert.match(episodeForm, /notSavedToast/)
})

test('episode form: refusal on save scrolls to and focuses the link field', () => {
  assert.match(episodeForm, /scrollIntoView/)
  assert.match(episodeForm, /\.focus\(\)/)
})

test('episode form: Needs English title hint uses the shared rule', () => {
  assert.ok(count(episodeForm, /needsEnglishTitle\(/g) >= 1)
  assert.equal(count(episodeForm, /needsEnglishTitleHint/g), 1)
  assert.match(episodeForm, /tone="warn"/)
})

test('episode form: Arabic-dominant text is routed to the Arabic fields (D-04)', () => {
  assert.match(episodeForm, /dominantScript\(/)
  assert.match(episodeForm, /setValue\(\s*'title_ar'/)
  assert.match(
    episodeForm,
    /dominantScript\(description\) === 'ar'\s*\?\s*'description_ar'/
  )
})

test('episode form: initialFocus prop focuses the title when the drawer opens', () => {
  assert.ok(count(episodeForm, /initialFocus/g) >= 2)
  assert.match(episodeForm, /setFocus\('title'\)/)
})

test('episode form: fetch button is a real Button with px-6 padding', () => {
  assert.match(
    episodeForm,
    /<Button[^>]*type="button"[^>]*variant="outline"[^>]*px-6/
  )
})
