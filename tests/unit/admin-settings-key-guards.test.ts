// Source-scan guards for the editable YouTube key (06-16, G6, T-06-61..64):
// both key actions run through the one YouTube admin seam, the old plaintext
// write path is gone, Server Actions keep Next's same-origin check, and the
// key never travels back to the browser.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import test from 'node:test'

const actions = readFileSync('src/app/[locale]/admin/actions.ts', 'utf8')

// Same block parser as admin-actions-id-coverage.test.ts.
function block(name: string): string {
  const re = /export async function (\w+)\(/g
  const starts: Array<{ name: string; index: number }> = []
  let m: RegExpExecArray | null
  while ((m = re.exec(actions))) starts.push({ name: m[1]!, index: m.index })
  const i = starts.findIndex((s) => s.name === name)
  assert.ok(i !== -1, `${name} not found in actions.ts`)
  return actions.slice(starts[i]!.index, starts[i + 1]?.index ?? actions.length)
}

test('saveYouTubeApiKey and testYouTubeKey run through runAdminAction(youtubeAdminEnv)', () => {
  assert.match(actions, /export async function saveYouTubeApiKey\(/)
  assert.match(actions, /export async function testYouTubeKey\(/)
  const save = block('saveYouTubeApiKey')
  assert.ok(save.includes('runAdminAction(youtubeAdminEnv'), 'save lacks the seam')
  assert.ok(save.includes('saveYouTubeApiKeyCore('), 'save lacks its core')
  const testKey = block('testYouTubeKey')
  assert.ok(testKey.includes('runAdminAction(youtubeAdminEnv'), 'test lacks the seam')
  assert.ok(testKey.includes('testYouTubeKeyCore('), 'test lacks its core')
  assert.ok(testKey.includes('getServerYouTubeClient('), 'test does not read the key on this request')
})

test('no youtube_api_key anywhere in actions.ts (old plaintext write path removed)', () => {
  assert.equal(actions.includes('youtube_api_key'), false)
})

test('saveYouTubeApiKey logs nothing and its revalidate never mentions the input', () => {
  const save = block('saveYouTubeApiKey')
  assert.equal(save.includes('console.'), false)
  const param = save.match(/export async function saveYouTubeApiKey\(\s*(\w+)/)?.[1]
  assert.ok(param, 'saveYouTubeApiKey has no input parameter')
  const reval = save.slice(save.indexOf('revalidate:'))
  assert.ok(save.includes('revalidate:'), 'save does not revalidate')
  assert.equal(new RegExp(`\\b${param}\\b`).test(reval), false, 'revalidate mentions the input')
})

test('next.config adds no serverActions.allowedOrigins (same-origin check stays the CSRF guard)', () => {
  const configs = readdirSync('.').filter((f) => /^next\.config\./.test(f))
  assert.ok(configs.length > 0, 'no next.config found')
  for (const f of configs) {
    const text = readFileSync(f, 'utf8')
    assert.equal(text.includes('allowedOrigins'), false, `${f} widens allowedOrigins`)
  }
})

// ---------------------------------------------------------------------------
// Task 3: the editable key field (UI-SPEC §6, G6 pictures)
// ---------------------------------------------------------------------------

const secretField = readFileSync('src/components/admin/settings/secret-field.tsx', 'utf8')
const advanced = readFileSync('src/components/admin/settings/advanced-tab.tsx', 'utf8')
const page = readFileSync('src/app/[locale]/admin/settings/page.tsx', 'utf8')

test('SecretField: masked input with the eye inside the field at the end', () => {
  for (const needle of [
    "type={reveal ? 'text' : 'password'}",
    'autoComplete="off"',
    'spellCheck={false}',
    'pe-12',
    'absolute end-0 top-0 size-11',
    'aria-pressed',
    "t('revealValue')",
    "t('hideValue')",
  ]) {
    assert.ok(secretField.includes(needle), `secret-field.tsx lacks ${needle}`)
  }
  assert.ok(/<Eye\b/.test(secretField) && /<EyeOff\b/.test(secretField), 'Eye / EyeOff icons missing')
})

test('SecretField uses logical properties only (no left/right classes)', () => {
  assert.equal(/\b(left|right)-[0-9]|text-left|text-right/.test(secretField), false)
  assert.equal(/(?<![\w-])(left|right)-[\w[]/.test(secretField), false)
})

test('SecretField saved state shows only the masked last 4 and a Change key button', () => {
  assert.match(secretField, /t\('keySavedMasked', \{ last4: [\w.]+ \}\)/)
  assert.ok(secretField.includes("t('changeKey')"), 'no changeKey button')
  assert.ok(secretField.includes("t('cancelChange')"), 'no cancelChange')
  assert.match(secretField, /className="[^"]*\bpx-6\b[^"]*"[^>]*>\s*\{t\('changeKey'\)\}/)
  assert.ok(secretField.includes("'Escape'"), 'Esc does not return to the saved state')
  assert.equal(/hasSavedValue|'replace'/.test(secretField), false, 'old Replace model still present')
})

test('advanced tab: the key block is its own form and calls both key actions', () => {
  assert.ok(advanced.includes('saveYouTubeApiKey('), 'no saveYouTubeApiKey call')
  assert.ok(advanced.includes('testYouTubeKey('), 'no testYouTubeKey call')
  const forms = advanced.match(/<form\b/g) ?? []
  assert.equal(forms.length, 2, 'expected the integrations form and the key form')
  const start = advanced.indexOf('<form onSubmit={onSaveIntegrations}')
  assert.ok(start !== -1, 'integrations form not found')
  const integrations = advanced.slice(start, advanced.indexOf('</form>', start))
  for (const banned of ['SecretField', 'YouTubeKeyBlock', 'saveYouTubeApiKey', 'youtubeKey']) {
    assert.equal(integrations.includes(banned), false, `integrations form contains ${banned}`)
  }
  assert.match(advanced, /<form\s+onSubmit=\{onSaveKey\}/)
})

test('advanced tab: a rate-limited key test shows a toast and keeps the last-test line', () => {
  const at = advanced.indexOf("r.data?.code === 'rate_limited'")
  assert.ok(at !== -1, 'no rate_limited branch in onTestKey')
  const branch = advanced.slice(at, advanced.indexOf('} else {', at))
  assert.ok(branch.includes('toast.error(tYtErrors(YOUTUBE_ERROR_MESSAGE_KEYS.rate_limited))'))
  assert.ok(!branch.includes('setLastTest('), 'a rate limit must not record a failed test')
})

test('advanced tab: state copy from UI-SPEC §6', () => {
  for (const key of [
    'youtubeKeyTitle',
    'keyHelp',
    'keySet',
    'keyMissing',
    'testFailed',
    'formatInvalid',
    'keySavedJust',
    'keySaveFailed',
    'notTested',
    'lastTestOk',
    'lastTestFailed',
    'missingBody',
    'saveKey',
    'savingKey',
    'testKey',
    'testingButton',
    'testing',
  ]) {
    assert.ok(advanced.includes(`'${key}'`), `advanced-tab.tsx lacks ${key}`)
  }
  assert.ok(advanced.includes('formatQuotaReset('), 'quota reason lacks formatQuotaReset')
  assert.ok(advanced.includes('YouTubeStatusChip'), 'no status chip')
})

test('advanced tab: old YouTube row, link and Cloudflare copy are gone', () => {
  for (const banned of ['ExternalLink', 'youtube_api_key', 'storedInCloudflare', 'getKey', 'apiKeyHint', 'youtubeApiDescription']) {
    assert.equal(advanced.includes(banned), false, `advanced-tab.tsx still has ${banned}`)
  }
})

test('advanced tab: row 3 is aria-live and the green icon uses the Phase 4 status-success token', () => {
  assert.ok(advanced.includes('aria-live="polite"'), 'row 3 is not aria-live')
  assert.match(advanced, /const TEST_OK_ICON = 'text-status-success /)
  assert.equal(advanced.includes('TODO(phase-4)'), false, 'stale TODO(phase-4) left')
  assert.equal(advanced.includes('brand-green-safe'), false, 'old green class left')
})

test('settings page reads hasKey + last4 + last test only, never the key', () => {
  assert.ok(page.includes('readYouTubeKeyMeta()'), 'page does not call readYouTubeKeyMeta()')
  assert.ok(page.includes('readLastKeyTestCore('), 'page does not read the last test')
  assert.match(page, /hasKey: \w+\.hasKey,\s*last4: \w+\.last4,\s*lastTest\b/)
  for (const banned of ['getYouTubeApiKey', 'get_youtube_key', 'readYouTubeApiKey', 'getServerYouTubeClient', 'updatedAt']) {
    assert.equal(page.includes(banned), false, `settings page has ${banned}`)
  }
})
