import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

type Json = string | number | boolean | null | Json[] | { [key: string]: Json }

function load(locale: string): Json {
  const url = new URL(`../../src/messages/${locale}.json`, import.meta.url)
  return JSON.parse(readFileSync(url, 'utf8')) as Json
}

/** Flatten to `a.b.c` -> string leaves. Arrays use numeric indexes. */
function flatten(node: Json, prefix = '', out: Record<string, string> = {}) {
  if (node !== null && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      flatten(value, prefix ? `${prefix}.${key}` : key, out)
    }
  } else if (typeof node === 'string') {
    out[prefix] = node
  }
  return out
}

const en = flatten(load('en'))
const ar = flatten(load('ar'))

/**
 * Phase 5 key paths. A path matches when it equals an entry or starts with
 * `entry + '.'`. Later phases extend this list.
 */
const PHASE5_KEYS: string[] = [
  // auth additions and the one updated key (05-06 Task 1)
  ...[
    'signInOrJoinTitle', 'signInOrJoinSub', 'signInTitle', 'signInPasswordSub',
    'createAccountTitle', 'sendCode', 'sending', 'usePassword', 'useCode',
    'noAccountYet', 'createWithPassword', 'codeSentTo', 'changeEmail',
    'codeLabel', 'codeHelp', 'verifyCode', 'verifying', 'resendIn',
    'resendCode', 'resendReady', 'codeSentAnnounce', 'signedIn', 'codeWrong',
    'codeExpired', 'codeSendFailed', 'tooManyTries', 'signupCheckEmailTitle',
    'signupCheckEmailBody', 'resendConfirmation', 'termsLine', 'pwLeaked',
    'sendResetLink', 'resetEmailDescription', 'welcomeTitle', 'welcomeSub',
    'nameLabel', 'startWatching', 'passwordLaterNote', 'stepOf', 'working',
    'finishSigningIn', 'chooseNewPassword', 'confirmNewEmail',
    'confirmSignupTitle', 'confirmSignupBody', 'confirmRecoveryTitle',
    'confirmRecoveryBody', 'confirmEmailChangeTitle', 'confirmEmailChangeBody',
    'pendingOtherTitle', 'pendingOtherBody', 'emailChangedTitle',
    'emailChangedBody', 'goToProfile', 'linkExpiredTitle', 'linkExpiredBody',
    'requestNewLink', 'mfaOverline', 'mfaEnrolTitle', 'mfaEnrolSub',
    'mfaQrAlt', 'mfaManualKey', 'copyKey', 'keyCopied', 'mfaNext',
    'mfaStepCodeTitle', 'mfaStepCodeSub', 'mfaVerifyContinue', 'mfaBack',
    'mfaCodeWrong', 'mfaTooMany', 'mfaEnrolFailed', 'mfaSecondTitle',
    'mfaSecondSub', 'mfaSecondAdd', 'mfaSecondSkip', 'mfaDoneTitle',
    'mfaDoneOpen', 'mfaVerifyTitle', 'mfaVerifySub', 'mfaStaleNote',
    'mfaLostPhone', 'hidePassword',
  ].map((k) => `auth.${k}`),
  // profile additions
  ...[
    'savePassword', 'saveEmail', 'discardChanges', 'confirmPasswordChange',
    'setPassword', 'changePassword', 'passwordNotSet', 'passwordSetHint',
    'passwordChanged', 'passwordAdded', 'reauthTitle', 'reauthSub',
    'emailPendingTitle', 'emailPendingBody', 'resendLinks', 'linksResent',
    'notifLabel', 'notifHelp', 'notifOn', 'notifOff', 'notifSaveFailed',
  ].map((k) => `profile.${k}`),
  'admin.admins',
  'admin.audit.adminColumn',
  'admin.audit.formerAdmin',
  'admin.audit.system',
  'admin.audit.actorOwnerScript',
  'emailPages',
  'newsletter.submitAria',
  'newsletter.statusPending',
  'newsletter.statusPendingRecent',
  'support.sentTitle',
  'support.sentBody',
  'support.sendAnother',
  'support.savedEmailFailedInline',
]

/**
 * Key paths that differ between en.json and ar.json before Phase 5 and are
 * not Phase 5 copy. Recorded on first run of 05-06 (none found).
 */
const KNOWN_PREEXISTING_GAPS: string[] = []

function isPhase5(path: string) {
  return PHASE5_KEYS.some((k) => path === k || path.startsWith(`${k}.`))
}

function icuArgs(value: string) {
  const names = new Set<string>()
  for (const match of value.matchAll(/\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*[,}]/g)) {
    names.add(match[1])
  }
  return names
}

function richTags(value: string) {
  const names = new Set<string>()
  for (const match of value.matchAll(/<\/?([A-Za-z][A-Za-z0-9]*)>/g)) {
    names.add(match[1])
  }
  return names
}

test('every Phase 5 key path exists in both locales', () => {
  const missing: string[] = []
  for (const entry of PHASE5_KEYS) {
    const inEn = Object.keys(en).some((p) => p === entry || p.startsWith(`${entry}.`))
    const inAr = Object.keys(ar).some((p) => p === entry || p.startsWith(`${entry}.`))
    if (!inEn) missing.push(`en: ${entry}`)
    if (!inAr) missing.push(`ar: ${entry}`)
  }
  assert.deepEqual(missing.slice(0, 20), [])
})

test('en.json and ar.json have the same leaf key paths for Phase 5 keys', () => {
  const enPaths = new Set(Object.keys(en))
  const arPaths = new Set(Object.keys(ar))
  const diff: string[] = []
  for (const path of enPaths) {
    if (!arPaths.has(path) && isPhase5(path)) diff.push(`only in en: ${path}`)
  }
  for (const path of arPaths) {
    if (!enPaths.has(path) && isPhase5(path)) diff.push(`only in ar: ${path}`)
  }
  assert.deepEqual(diff.slice(0, 20), [])
})

test('all other key path differences are the recorded pre-existing gaps', () => {
  const enPaths = new Set(Object.keys(en))
  const arPaths = new Set(Object.keys(ar))
  const gaps: string[] = []
  for (const path of enPaths) if (!arPaths.has(path) && !isPhase5(path)) gaps.push(path)
  for (const path of arPaths) if (!enPaths.has(path) && !isPhase5(path)) gaps.push(path)
  assert.deepEqual(gaps.sort().slice(0, 20), [...KNOWN_PREEXISTING_GAPS].sort())
})

test('every ICU argument and rich tag in an EN string also appears in its AR string', () => {
  const problems: string[] = []
  for (const [path, enValue] of Object.entries(en)) {
    const arValue = ar[path]
    if (arValue === undefined) continue
    if (!isPhase5(path) && KNOWN_PREEXISTING_GAPS.includes(path)) continue
    const arArgs = icuArgs(arValue)
    for (const name of icuArgs(enValue)) {
      if (!arArgs.has(name)) problems.push(`${path}: AR lacks {${name}}`)
    }
    const arTags = richTags(arValue)
    for (const name of richTags(enValue)) {
      if (!arTags.has(name)) problems.push(`${path}: AR lacks <${name}>`)
    }
  }
  assert.deepEqual(problems.slice(0, 20), [])
})

test('Phase 5 strings contain no literal digit outside ICU braces (1Password excepted)', () => {
  const offenders: string[] = []
  for (const [locale, catalog] of [['en', en], ['ar', ar]] as const) {
    for (const [path, value] of Object.entries(catalog)) {
      if (!isPhase5(path)) continue
      const stripped = value.replace(/\{[^}]*\}/g, '').replace(/1Password/g, '')
      if (/[0-9٠-٩۰-۹]/.test(stripped)) {
        offenders.push(`${locale}:${path}`)
      }
    }
  }
  assert.deepEqual(offenders.slice(0, 20), [])
})

test('the Q4 = B keys signInToWatch and showChip are not present', () => {
  for (const catalog of [en, ar]) {
    for (const path of Object.keys(catalog)) {
      assert.ok(!/(^|\.)(signInToWatch|showChip)$/.test(path), path)
    }
  }
})
