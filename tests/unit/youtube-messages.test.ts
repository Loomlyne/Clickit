import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { YOUTUBE_ERROR_MESSAGE_KEYS } from '../../src/lib/youtube-errors.ts'

// Phase 6 (06-05): every string the UI-SPEC copywriting contract lists exists in
// both locales with the same placeholders, and the digit rule holds.

const en = JSON.parse(
  readFileSync(new URL('../../src/messages/en.json', import.meta.url), 'utf8'),
)
const ar = JSON.parse(
  readFileSync(new URL('../../src/messages/ar.json', import.meta.url), 'utf8'),
)

const NEW_KEYS: string[] = [
  'admin.youtubeImport.openButton',
  'admin.youtubeImport.title',
  'admin.youtubeImport.description',
  'admin.youtubeImport.linkLabel',
  'admin.youtubeImport.linkPlaceholder',
  'admin.youtubeImport.targetLabel',
  'admin.youtubeImport.targetNewSeason',
  'admin.youtubeImport.targetExistingSeason',
  'admin.youtubeImport.seasonTitleLabel',
  'admin.youtubeImport.seasonTitlePlaceholder',
  'admin.youtubeImport.seasonTitleRequired',
  'admin.youtubeImport.appendNote',
  'admin.youtubeImport.appendNoteEmpty',
  'admin.youtubeImport.summaryReady',
  'admin.youtubeImport.summaryCantPlay',
  'admin.youtubeImport.summaryAlready',
  'admin.youtubeImport.readMeta',
  'admin.youtubeImport.reading',
  'admin.youtubeImport.capNote',
  'admin.youtubeImport.numberingNote',
  'admin.youtubeImport.titleColumn',
  'admin.youtubeImport.timeColumn',
  'admin.youtubeImport.statusColumn',
  'admin.youtubeImport.selectAllAria',
  'admin.youtubeImport.rowSelectAria',
  'admin.youtubeImport.visibilityPublic',
  'admin.youtubeImport.visibilityUnlisted',
  'admin.youtubeImport.arabicTitle',
  'admin.youtubeImport.reason.private',
  'admin.youtubeImport.reason.removed',
  'admin.youtubeImport.reason.notEmbeddable',
  'admin.youtubeImport.reason.blockedUae',
  'admin.youtubeImport.reason.processing',
  'admin.youtubeImport.reason.premieres',
  'admin.youtubeImport.reason.alreadyOnClickit',
  'admin.youtubeImport.emptyBeforeLink',
  'admin.youtubeImport.allAlreadyHeading',
  'admin.youtubeImport.allAlreadyBody',
  'admin.youtubeImport.noneImportable',
  'admin.youtubeImport.importButton',
  'admin.youtubeImport.importing',
  'admin.youtubeImport.successHeading',
  'admin.youtubeImport.successBody',
  'admin.youtubeImport.successNeedsEnglish',
  'admin.youtubeImport.scheduleButton',
  'admin.youtubeImport.done',
  'admin.youtubeStatus.ready',
  'admin.youtubeStatus.private',
  'admin.youtubeStatus.removed',
  'admin.youtubeStatus.notEmbeddable',
  'admin.youtubeStatus.blockedUae',
  'admin.youtubeStatus.notReady',
  'admin.youtubeStatus.alreadyOnClickit',
  'admin.youtubeStatus.needsEnglishTitle',
  'admin.youtubeErrors.notAPlaylistLink',
  'admin.youtubeErrors.videoLinkInImport',
  'admin.youtubeErrors.playlistPrivate',
  'admin.youtubeErrors.emptyPlaylist',
  'admin.youtubeErrors.quota',
  'admin.youtubeErrors.keyMissing',
  'admin.youtubeErrors.keyRejected',
  'admin.youtubeErrors.network',
  'admin.youtubeErrors.importFailed',
  'admin.youtubeErrors.retry',
  'admin.youtubeErrors.openSettings',
  'admin.youtubeErrors.notAVideoLink',
  'admin.youtubeErrors.playlistLinkInForm',
  'admin.youtubeErrors.videoNotFound',
  'admin.youtubeErrors.videoPrivate',
  'admin.youtubeErrors.videoNotEmbeddable',
  'admin.youtubeErrors.videoBlockedUae',
  'admin.youtubeErrors.videoNotReady',
  'admin.youtubeErrors.videoDuplicate',
  'admin.youtubeErrors.rateLimited',
  'admin.youtubeErrors.seasonChanged',
  'admin.episodeForm.needsEnglishTitleHint',
  'admin.episodeForm.notSavedToast',
  'admin.episodesTable.moved',
  'admin.episodesTable.moveFailed',
  'admin.episodesTable.renumberButton',
  'admin.episodesTable.gapsHint',
  'admin.episodesTable.renumberTitle',
  'admin.episodesTable.renumberDescription',
  'admin.episodesTable.renumberChange',
  'admin.episodesTable.renumberMore',
  'admin.episodesTable.renumberConfirm',
  'admin.episodesTable.renumberDone',
  'admin.episodesTable.renumberFailed',
  'admin.episodesTable.cantPlayBadge',
  'admin.episodesTable.cantPlayReason',
  'admin.episodesTable.cantPlayViewerReport',
  'admin.dashboard.youtubeCheckTitle',
  'admin.dashboard.lastCheck',
  'admin.dashboard.allPlay',
  'admin.dashboard.allPlayBody',
  'admin.dashboard.cantPlayCount',
  'admin.dashboard.cantPlayMore',
  'admin.dashboard.notCheckedChip',
  'admin.dashboard.notCheckedBody',
  'admin.dashboard.checkOverdue',
  'admin.settings.youtubeKeyTitle',
  'admin.settings.keySet',
  'admin.settings.keyMissing',
  'admin.settings.testFailed',
  'admin.settings.keyHelp',
  'admin.settings.keyLabel',
  'admin.settings.keyPlaceholder',
  'admin.settings.keySavedMasked',
  'admin.settings.changeKey',
  'admin.settings.cancelChange',
  'admin.settings.saveKey',
  'admin.settings.savingKey',
  'admin.settings.keySavedJust',
  'admin.settings.keySaveFailed',
  'admin.settings.formatInvalid',
  'admin.settings.missingBody',
  'admin.settings.notTested',
  'admin.settings.lastTestOk',
  'admin.settings.lastTestFailed',
  'admin.settings.testKey',
  'admin.settings.testingButton',
  'admin.settings.testing',
  'admin.settings.testReason.rejected',
  'admin.settings.testReason.apiNotAllowed',
  'admin.settings.testReason.quota',
  'admin.settings.testReason.network',
  'player.seasonEpisodeLong',
  'player.seasonLabel',
  'player.episodeOfTotal',
  'player.resumedAt',
  'player.startFromBeginning',
  'player.startOver',
  'player.finished',
  'player.upNextEyebrow',
  'player.upNextAnnounce',
  'player.upNextCancel',
  'player.upNextBarTitle',
  'player.watchAgain',
  'player.upNextDoneEyebrow',
  'player.seriesEndHeading',
  'player.seriesEndBody',
  'player.errorTitle',
  'player.errorReasonRemoved',
  'player.errorReasonPrivate',
  'player.errorReasonNotEmbeddable',
  'player.errorReasonUnavailable',
  'player.errorReasonUae',
  'player.errorReasonBadLink',
  'player.errorReasonPlayback',
  'player.errorReasonGeneric',
  'player.errorReasonSite',
  'player.errorReported',
  'player.playNextEpisode',
  'player.tryAgain',
  'watch.episodesHeading',
  'watch.nowPlaying',
  'watch.watched',
  'watch.minutesLeft',
  'watch.notOutYet',
  'admin.episodeForm.toastNoYoutubeKeyDescription',
]

// Argument names that must be formatted as numbers (Typography digit rule).
const NUMBER_ARGS = new Set([
  'count',
  'number',
  'first',
  'last',
  'season',
  'episode',
  'page',
  'videos',
  'pages',
  'from',
  'to',
  'current',
  'total',
  'seconds',
  'minutes',
  'max',
])

// Arguments that are names (wrapped in <bdi>), not numbers, despite sharing a word.
const NAME_ARGS: Record<string, string[]> = {
  'admin.youtubeImport.successBody': ['season'],
}

// Keys that may carry a digit in literal text.
const DIGIT_ALLOWED = new Set(['admin.settings.testReason.apiNotAllowed'])

type Arg = { name: string; type: 'simple' | 'number' | 'plural' | 'select' }
type Parsed = { args: Arg[]; text: string; bdi: number }

// Small ICU subset parser: {x}, {x, number}, {x, plural, =0 {..} one {..} other {..}}.
function parseIcu(message: string): Parsed {
  const args: Arg[] = []
  let text = ''
  let i = 0

  function parseMessage(): void {
    while (i < message.length) {
      const ch = message[i]
      if (ch === '}') return
      if (ch === '{') {
        i++
        parseArg()
      } else {
        text += ch
        i++
      }
    }
  }

  function readUntil(stops: string): string {
    let out = ''
    while (i < message.length && !stops.includes(message[i])) {
      out += message[i]
      i++
    }
    return out.trim()
  }

  function parseArg(): void {
    const name = readUntil(',}')
    if (message[i] === '}') {
      i++
      args.push({ name, type: 'simple' })
      return
    }
    i++ // comma
    const type = readUntil(',}')
    if (type === 'number') {
      args.push({ name, type: 'number' })
      assert.equal(message[i], '}', `unterminated number arg in: ${message}`)
      i++
      return
    }
    assert.ok(
      type === 'plural' || type === 'select',
      `unsupported arg type ${type} in: ${message}`,
    )
    args.push({ name, type })
    i++ // comma
    while (i < message.length && message[i] !== '}') {
      readUntil('{}')
      if (message[i] === '{') {
        i++
        parseMessage()
        assert.equal(message[i], '}', `unterminated branch in: ${message}`)
        i++
      }
    }
    assert.equal(message[i], '}', `unterminated plural in: ${message}`)
    i++
  }

  parseMessage()
  assert.equal(i, message.length, `unbalanced braces in: ${message}`)
  return { args, text, bdi: (message.match(/<bdi>/g) ?? []).length }
}

function get(obj: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (o, p) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[p] : undefined),
      obj,
    )
}

test('every new key is a non-empty string in both en and ar', () => {
  for (const key of NEW_KEYS) {
    for (const [name, m] of [['en', en], ['ar', ar]] as const) {
      const v = get(m, key)
      assert.equal(typeof v, 'string', `${name}: missing ${key}`)
      assert.ok((v as string).length > 0, `${name}: empty ${key}`)
    }
  }
})

test('placeholder names and <bdi> counts match between en and ar', () => {
  for (const key of NEW_KEYS) {
    const e = parseIcu(get(en, key) as string)
    const a = parseIcu(get(ar, key) as string)
    const names = (p: Parsed) => [...new Set(p.args.map((x) => x.name))].sort()
    assert.deepEqual(names(a), names(e), `placeholders differ: ${key}`)
    assert.equal(a.bdi, e.bdi, `<bdi> count differs: ${key}`)
    assert.equal(
      (get(en, key) as string).match(/<\/bdi>/g)?.length ?? 0,
      e.bdi,
      `unbalanced <bdi>: ${key}`,
    )
  }
})

test('number arguments are {x, number} or plural; no literal digits', () => {
  for (const key of NEW_KEYS) {
    for (const [name, m] of [['en', en], ['ar', ar]] as const) {
      const parsed = parseIcu(get(m, key) as string)
      for (const arg of parsed.args) {
        if (NUMBER_ARGS.has(arg.name) && !NAME_ARGS[key]?.includes(arg.name)) {
          assert.ok(
            arg.type === 'number' || arg.type === 'plural',
            `${name}: ${key} formats {${arg.name}} as ${arg.type}`,
          )
        }
      }
      if (!DIGIT_ALLOWED.has(key)) {
        assert.doesNotMatch(
          parsed.text,
          /[0-9٠-٩۰-۹]/,
          `${name}: ${key} has a literal digit`,
        )
      }
    }
  }
})

test('every YOUTUBE_ERROR_MESSAGE_KEYS value exists under admin.youtubeErrors in en and ar', () => {
  for (const [code, key] of Object.entries(YOUTUBE_ERROR_MESSAGE_KEYS)) {
    for (const [name, m] of [['en', en], ['ar', ar]] as const) {
      const v = get(m, `admin.youtubeErrors.${key}`)
      assert.equal(typeof v, 'string', `${name}: ${code} -> ${key} missing`)
      assert.ok((v as string).length > 0, `${name}: ${code} -> ${key} empty`)
    }
  }
})

test('the viewer-report label says viewers, not one viewer', () => {
  assert.equal(get(en, 'admin.episodesTable.cantPlayViewerReport'), 'Reported by viewers')
  assert.equal(get(ar, 'admin.episodesTable.cantPlayViewerReport'), 'أبلغ عنها مشاهدون')
})

test('season-changed copy is the agreed wording in en and ar', () => {
  assert.equal(get(en, 'admin.youtubeErrors.seasonChanged'), 'Season changed while you were importing. Try again.')
  assert.equal(get(ar, 'admin.youtubeErrors.seasonChanged'), 'تغيّر الموسم أثناء الاستيراد. حاول مرة أخرى.')
})

test('rate limit copy is the agreed wording in en and ar', () => {
  assert.equal(get(en, 'admin.youtubeErrors.rateLimited'), 'Too many requests. Wait a few minutes and try again.')
  assert.equal(get(ar, 'admin.youtubeErrors.rateLimited'), 'طلبات كثيرة جدًا. انتظر بضع دقائق ثم حاول مرة أخرى.')
})

test('quota messages carry {time}; the old "tomorrow" text is gone', () => {
  for (const key of [
    'admin.youtubeErrors.quota',
    'admin.settings.testReason.quota',
    'player.resumedAt',
  ]) {
    for (const m of [en, ar]) {
      assert.match(get(m, key) as string, /\{time\}/, key)
    }
  }
  assert.doesNotMatch(JSON.stringify(en), /Try again tomorrow/)
})

test('settings key block: editable field copy exists, storedInCloudflare is not added', () => {
  for (const m of [en, ar]) {
    const s = (m as typeof en).admin.settings
    assert.equal(s.storedInCloudflare, undefined)
    for (const k of ['saveKey', 'keySavedMasked', 'formatInvalid', 'keyHelp', 'keySaveFailed']) {
      assert.equal(typeof s[k], 'string', k)
    }
    assert.equal(typeof (m as typeof en).player.upNextBarTitle, 'string')
  }
  // The generic saveFailed stays for its existing callers.
  assert.equal(typeof en.admin.settings.saveFailed, 'string')
})

test('YouTubeStatusChip: tone classes, 11px text, logical properties only', () => {
  const src = readFileSync(
    new URL('../../src/components/admin/youtube-status-chip.tsx', import.meta.url),
    'utf8',
  )
  // Phase 4 status tones (04-P6-ADDENDUM): same colours, status-* names.
  assert.doesNotMatch(src, /TODO\(phase-4\)|brand-(?:green|red|orange)-safe/)
  assert.match(src, /border-status-success\/35 bg-status-success\/8 text-status-success/)
  assert.match(src, /border-status-danger\/35 bg-status-danger\/8 text-status-danger/)
  assert.match(src, /border-status-warning\/35 bg-status-warning\/8 text-status-warning/)
  assert.match(src, /border-status-neutral-line bg-transparent text-status-neutral/)
  assert.match(src, /text-\[11px\]/)
  assert.doesNotMatch(src, /text-\[(?:[0-9]|10)px\]/)
  assert.doesNotMatch(src, /\b(?:left|right)-/)
  for (const status of [
    'ok', 'private', 'removed', 'not_embeddable', 'blocked_ae', 'not_ready', 'already', 'needs_english',
  ]) {
    assert.ok(src.includes(`'${status}'`), `status ${status}`)
  }
})
