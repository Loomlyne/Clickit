import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { LOGO_URL } from '../../src/emails/brand.ts'
import { en } from '../../src/emails/messages/en.ts'
import { ar } from '../../src/emails/messages/ar.ts'
import { AUTH_LINK_MINUTES } from '../../src/lib/auth-code.ts'
import {
  SENTINELS,
  buildAuthTemplates,
} from '../../scripts/build-auth-templates.mjs'
import { assertSignedScheme } from './helpers/email-scheme.ts'

const ROOT = join(import.meta.dirname, '..', '..')
const TEMPLATES = join(ROOT, 'supabase', 'templates')
const LOCAL_LOGO = 'http://localhost:3000/brand/email-logo-white.png'
const NAMES = [
  'confirmation',
  'magic_link',
  'recovery',
  'email_change',
  'reauthentication',
]
const IF_AR = '{{ if eq .Data.locale "ar" }}'

type Built = { name: string; html: string; subject: string }

const set = (await buildAuthTemplates({ logoUrl: LOGO_URL })) as Built[]
const byName = Object.fromEntries(set.map((t) => [t.name, t]))

/** Splits a generated file at {{ else }} into the AR part and the EN part. */
function parts(html: string): { ar: string; en: string } {
  const start = html.indexOf(IF_AR)
  const mid = html.indexOf('{{ else }}')
  const end = html.lastIndexOf('{{ end }}')
  assert.ok(start === 0 && mid > start && end > mid, 'branch layout')
  return {
    ar: html.slice(start + IF_AR.length, mid),
    en: html.slice(mid + '{{ else }}'.length, end),
  }
}

test('returns the five templates in order, each with the locale branch', () => {
  assert.deepEqual(
    set.map((t) => t.name),
    NAMES
  )
  for (const t of set) {
    assert.ok(t.html.includes(IF_AR), `${t.name}: if`)
    assert.ok(t.html.includes('{{ else }}'), `${t.name}: else`)
    assert.ok(t.html.trimEnd().endsWith('{{ end }}'), `${t.name}: ends`)
    const ifs = t.html.match(/\{\{ if /g) ?? []
    const ends = t.html.match(/\{\{ end \}\}/g) ?? []
    assert.equal(ifs.length, ends.length, `${t.name}: if/end balanced`)
    assert.equal(ifs.length, 1, `${t.name}: one branch`)
  }
})

test('only the allowed Go actions appear', () => {
  const allowed = new Set([
    IF_AR,
    '{{ else }}',
    '{{ end }}',
    '{{ .Token }}',
    '{{ .TokenHash }}',
    '{{ .RedirectTo }}',
    '{{ .Email }}',
    '{{ .NewEmail }}',
  ])
  for (const t of set) {
    for (const m of t.html.matchAll(/\{\{[^}]*\}\}/g)) {
      assert.ok(allowed.has(m[0]), `${t.name}: unexpected action ${m[0]}`)
    }
    const stripped = t.html.replace(/\{\{[^}]*\}\}/g, '')
    assert.ok(!stripped.includes('{{'), `${t.name}: stray {{`)
    assert.ok(!/\{\{[^}]*&quot;/.test(t.html), `${t.name}: &quot; in action`)
  }
})

test('codes and links per template', () => {
  assert.ok(byName.magic_link.html.includes('{{ .Token }}'))
  assert.ok(byName.confirmation.html.includes('{{ .Token }}'))
  const link = '{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type='
  assert.ok(byName.confirmation.html.includes(`${link}signup`))
  assert.ok(byName.recovery.html.includes(`${link}recovery`))
  assert.ok(byName.email_change.html.includes(`${link}email_change`))
  for (const n of ['confirmation', 'recovery', 'email_change']) {
    assert.ok(
      !byName[n].html.includes('{{ .RedirectTo }}&amp;token_hash'),
      `${n}: no escaped ampersand in the link`
    )
    assert.ok(!byName[n].html.includes('&amp;type='), `${n}: no &amp;type`)
    // href and the visible fallback line carry the same link
    const n_links = byName[n].html.split(link).length - 1
    assert.ok(n_links >= 4, `${n}: href + fallback text in both locales`)
  }
  assert.ok(byName.email_change.html.includes('{{ .Email }}'))
  assert.ok(byName.email_change.html.includes('{{ .NewEmail }}'))
  assert.ok(!byName.magic_link.html.includes('TokenHash'))
  assert.ok(!byName.magic_link.html.includes('RedirectTo'))
  const re = byName.reauthentication.html
  assert.ok(re.includes('{{ .Token }}'))
  assert.ok(!re.includes('.TokenHash'))
  assert.ok(!re.includes('.RedirectTo'))
})

test('E1 has no button; E2 to E4 have a button followed by the fallback url', () => {
  for (const n of ['magic_link', 'reauthentication']) {
    for (const p of Object.values(parts(byName[n].html))) {
      assert.ok(!/<table[^>]*data-skip-in-text/.test(p), `${n}: no button`)
      assert.ok(!/bgcolor="#ffcc00"/i.test(p), `${n}: no button cell`)
    }
  }
  for (const n of ['confirmation', 'recovery', 'email_change']) {
    for (const p of Object.values(parts(byName[n].html))) {
      assert.ok(/bgcolor="#ffcc00"/i.test(p), `${n}: button cell`)
      assert.ok(p.includes(en.fallbackUrl) || p.includes(ar.fallbackUrl))
    }
  }
})

test('no sentinel, script, SiteURL or oversize file', () => {
  for (const t of set) {
    for (const s of Object.values(SENTINELS)) {
      assert.ok(!t.html.includes(s as string), `${t.name}: sentinel ${s}`)
    }
    assert.ok(!/__[A-Z_]+__/.test(t.html), `${t.name}: sentinel shape`)
    assert.ok(!t.html.includes('<script'), `${t.name}: script`)
    assert.ok(!t.html.includes('.SiteURL'), `${t.name}: SiteURL`)
    assert.ok(Buffer.byteLength(t.html) <= 90 * 1024, `${t.name}: size`)
  }
})

test('15 minutes literal matches AUTH_LINK_MINUTES; AR minutes text present', () => {
  assert.equal(AUTH_LINK_MINUTES, 15)
  // E4 (email change) copy has no validity time in the signed contract.
  for (const n of ['confirmation', 'magic_link', 'recovery', 'reauthentication']) {
    const p = parts(byName[n].html)
    assert.ok(p.en.includes(`${AUTH_LINK_MINUTES} minutes`), `${n}: EN minutes`)
    assert.ok(p.ar.includes('15 دقيقة'), `${n}: AR minutes`)
  }
  assert.ok(en.e2.body.includes('15 minutes') && ar.e2.body.includes('15 دقيقة'))
})

test('AR branch is RTL, codes stay LTR', () => {
  for (const t of set) {
    const p = parts(t.html)
    assert.ok(p.ar.includes('dir="rtl"'), `${t.name}: rtl`)
    assert.ok(p.ar.includes('lang="ar"'), `${t.name}: lang`)
    assert.ok(p.en.includes('lang="en"'), `${t.name}: en lang`)
  }
  for (const n of ['confirmation', 'magic_link', 'reauthentication']) {
    const p = parts(byName[n].html)
    assert.match(p.ar, /<td[^>]*dir="ltr"[^>]*>\{\{ \.Token \}\}<\/td>/)
  }
  const ec = parts(byName.email_change.html).ar
  assert.match(ec, /<span dir="ltr">\{\{ \.Email \}\}<\/span>/)
  assert.match(ec, /<span dir="ltr">\{\{ \.NewEmail \}\}<\/span>/)
})

test('each locale part matches the signed scheme on its own', () => {
  for (const t of set) {
    const p = parts(t.html)
    const needCode = ['confirmation', 'magic_link', 'reauthentication'].includes(
      t.name
    )
    const needButton = ['confirmation', 'recovery', 'email_change'].includes(
      t.name
    )
    for (const [loc, part] of Object.entries(p)) {
      assertSignedScheme(part, { code: needCode, button: needButton })
      assert.ok(part.includes('#101010') && part.includes('#222222'), loc)
    }
  }
})

test('head survives per branch; no #777777 anywhere', () => {
  for (const t of set) {
    for (const part of Object.values(parts(t.html))) {
      assert.equal(
        (part.match(/<meta name="color-scheme" content="light dark"\/?>/g) ?? [])
          .length,
        1
      )
      assert.equal(
        (
          part.match(
            /<meta name="supported-color-schemes" content="light dark"\/?>/g
          ) ?? []
        ).length,
        1
      )
      assert.equal(
        (part.match(/@media \(prefers-color-scheme: dark\)/g) ?? []).length,
        1
      )
    }
  }
  for (const dir of [TEMPLATES, join(TEMPLATES, 'local')]) {
    for (const f of readdirSync(dir)) {
      if (!/\.(html|json)$/.test(f)) continue
      const text = readFileSync(join(dir, f), 'utf8').toLowerCase()
      assert.ok(!text.includes('#777777'), `${f}: #777777`)
    }
  }
})

test('no hex literal in the template source or the builder', () => {
  for (const f of [
    'src/emails/auth/templates.ts',
    'scripts/build-auth-templates.mjs',
  ]) {
    const text = readFileSync(join(ROOT, f), 'utf8')
    assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(text), `${f}: hex literal`)
  }
})

test('subjects: neutral for code and confirm mails, code in reauthentication', () => {
  for (const t of set) {
    assert.ok(t.subject.startsWith(IF_AR), `${t.name}: branch`)
    assert.ok(t.subject.includes('{{ else }}'), `${t.name}: else`)
    assert.ok(t.subject.endsWith('{{ end }}'), `${t.name}: end`)
  }
  assert.ok(!byName.magic_link.subject.includes('{{ .Token }}'))
  assert.ok(!byName.confirmation.subject.includes('{{ .Token }}'))
  assert.ok(byName.reauthentication.subject.includes('{{ .Token }}'))
  assert.ok(byName.magic_link.subject.includes(en.e1.subject))
  assert.ok(byName.magic_link.subject.includes(ar.e1.subject))
  assert.ok(byName.confirmation.subject.includes(en.e2.subject))
  assert.ok(byName.recovery.subject.includes(en.e3.subject))
  assert.ok(byName.email_change.subject.includes(en.e4.subject))
  for (const t of set) {
    assert.ok(!t.subject.includes('{{ .Email }}'), `${t.name}: no address`)
    assert.ok(!t.subject.includes('{{ .Data.name'), `${t.name}: no name`)
  }
})

test('logoUrl option reaches the header image', async () => {
  const local = (await buildAuthTemplates({ logoUrl: LOCAL_LOGO })) as Built[]
  for (const t of local) {
    assert.equal(t.html.split(`src="${LOCAL_LOGO}"`).length - 1, 2, t.name)
    assert.ok(!t.html.includes(LOGO_URL), `${t.name}: no media host`)
  }
  for (const t of set) {
    assert.equal(t.html.split(`src="${LOGO_URL}"`).length - 1, 2, t.name)
    assert.ok(!t.html.includes(LOCAL_LOGO))
  }
  // the two sets differ only in that URL
  for (let i = 0; i < set.length; i++) {
    assert.equal(
      local[i].html.split(LOCAL_LOGO).join(LOGO_URL),
      set[i].html,
      set[i].name
    )
    assert.equal(local[i].subject, set[i].subject)
  }
})

test('committed files equal a fresh build (drift check)', async () => {
  const local = (await buildAuthTemplates({ logoUrl: LOCAL_LOGO })) as Built[]
  for (const t of set) {
    assert.equal(
      readFileSync(join(TEMPLATES, `${t.name}.html`), 'utf8'),
      t.html,
      `${t.name}.html drifted; run npm run emails:build:auth`
    )
  }
  for (const t of local) {
    assert.equal(
      readFileSync(join(TEMPLATES, 'local', `${t.name}.html`), 'utf8'),
      t.html,
      `local/${t.name}.html drifted; run npm run emails:build:auth`
    )
  }
  const subjects = JSON.parse(
    readFileSync(join(TEMPLATES, 'subjects.json'), 'utf8')
  )
  assert.deepEqual(
    subjects,
    Object.fromEntries(set.map((t) => [t.name, t.subject]))
  )
})
