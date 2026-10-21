import assert from 'node:assert/strict'

// The SIGNED role table (Koss, 2026-10-20 ~19:00 CET, mockups/05-q12-schemes.html,
// UI-SPEC 7.1; plan decision D-27 = Q12 C). Literals live in tests only: src/emails
// takes every colour from EMAIL_TOKENS and must equal this table.
export const SIGNED = {
  light: {
    page: '#F4F4F4',
    card: '#FFFFFF',
    header: '#090909',
    heading: '#111111',
    body: '#333333',
    hint: '#555555',
    codeBg: '#F6F6F6',
    codeBorder: '#E5E5E5',
    codeText: '#111111',
    rule: '#E5E5E5',
    footer: '#767676',
  },
  dark: {
    page: '#090909',
    card: '#101010',
    cardBorder: '#222222',
    header: '#101010',
    headerRule: '#222222',
    heading: '#F4F4F4',
    body: '#CCCCCC',
    hint: '#A1A1A1',
    codeBg: '#191919',
    codeBorder: '#2A2A2A',
    codeText: '#ffcc00',
    rule: '#222222',
    footer: '#A1A1A1',
  },
  button: { bg: '#ffcc00', ink: '#090909' },
} as const

/** Opening tags (as strings) that carry the class `cls`. */
export function tagsWithClass(html: string, cls: string): string[] {
  const out: string[] = []
  const re = /<[a-zA-Z0-9]+\s[^>]*>/g
  for (const m of html.matchAll(re)) {
    const tag = m[0]
    const c = /\sclass="([^"]*)"/.exec(tag)
    if (c && c[1].split(/\s+/).includes(cls)) out.push(tag)
  }
  return out
}

/** The declarations of each `.cs-*` rule inside the dark `@media` block, lower-cased. */
export function darkRules(html: string): Record<string, string> {
  const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
  assert.equal(styles.length, 1, 'exactly one <style> block')
  const css = styles[0][1]
  const start = css.indexOf('@media (prefers-color-scheme: dark)')
  assert.ok(start >= 0, 'dark @media block present')
  const inner = css.slice(css.indexOf('{', start) + 1, css.lastIndexOf('}'))
  const rules: Record<string, string> = {}
  for (const m of inner.matchAll(/\.(cs-[a-z]+)\{([^}]*)\}/g)) {
    rules[m[1]] = m[2].toLowerCase().replace(/\s+/g, ' ').trim()
  }
  return rules
}

function lc(s: string): string {
  return s.toLowerCase()
}

function hasDecl(rule: string | undefined, name: string, decl: string): void {
  assert.ok(rule, `rule exists for ${name}`)
  const want = lc(`${decl} !important`)
  const parts = rule!.split(';').map((p) => p.trim())
  assert.ok(
    parts.includes(want),
    `${name}: expected "${want}" in "${rule}"`,
  )
}

function eachTag(
  html: string,
  cls: string,
  check: (tag: string) => void,
  required = true,
): void {
  const tags = tagsWithClass(html, cls)
  if (required) assert.ok(tags.length > 0, `an element has class ${cls}`)
  for (const tag of tags) check(lc(tag))
}

/**
 * Asserts the rendered email equals the signed look role by role: both meta tags,
 * light values inline on the right elements, dark values inside the one @media block.
 * Elements that a given email may not have (code box, button, quote box) are checked
 * when present; pass `require` to demand them.
 */
export function assertSignedScheme(
  html: string,
  require: { code?: boolean; button?: boolean } = {},
): void {
  const L = SIGNED.light
  const D = SIGNED.dark
  const B = SIGNED.button

  assert.match(html, /<meta name="color-scheme" content="light dark"\/?>/)
  assert.match(html, /<meta name="supported-color-schemes" content="light dark"\/?>/)
  assert.ok(html.includes(':root{color-scheme:light dark}'), ':root color-scheme rule')

  // dark block, role by role
  const r = darkRules(html)
  hasDecl(r['cs-page'], 'cs-page', `background:${D.page}`)
  hasDecl(r['cs-card'], 'cs-card', `background:${D.card}`)
  hasDecl(r['cs-card'], 'cs-card', `border:1px solid ${D.cardBorder}`)
  hasDecl(r['cs-header'], 'cs-header', `background:${D.header}`)
  hasDecl(r['cs-header'], 'cs-header', `border-bottom:1px solid ${D.headerRule}`)
  hasDecl(r['cs-heading'], 'cs-heading', `color:${D.heading}`)
  hasDecl(r['cs-text'], 'cs-text', `color:${D.body}`)
  hasDecl(r['cs-hint'], 'cs-hint', `color:${D.hint}`)
  hasDecl(r['cs-code'], 'cs-code', `background:${D.codeBg}`)
  hasDecl(r['cs-code'], 'cs-code', `border:1px solid ${D.codeBorder}`)
  hasDecl(r['cs-code'], 'cs-code', `color:${D.codeText}`)
  hasDecl(r['cs-rule'], 'cs-rule', `border-top:1px solid ${D.rule}`)
  hasDecl(r['cs-footer'], 'cs-footer', `color:${D.footer}`)
  assert.notEqual(lc(D.card), lc(D.page), 'signed dark card is not the page colour')
  assert.ok(!r['cs-card'].includes(lc(D.page)), 'dark card never takes the page value')

  // light values inline, element by element
  eachTag(html, 'cs-page', (t) => assert.ok(t.includes(lc(`background-color:${L.page}`)), `page: ${t}`))
  eachTag(html, 'cs-card', (t) => assert.ok(t.includes(lc(`background-color:${L.card}`)), `card: ${t}`))
  eachTag(html, 'cs-header', (t) => {
    assert.ok(t.includes(lc(`bgcolor="${L.header}"`)), `header bgcolor: ${t}`)
    assert.ok(t.includes(lc(`background-color:${L.header}`)), `header bg: ${t}`)
  })
  eachTag(html, 'cs-heading', (t) => assert.ok(t.includes(lc(`color:${L.heading}`)), `heading: ${t}`))
  eachTag(html, 'cs-text', (t) => assert.ok(t.includes(lc(`color:${L.body}`)), `text: ${t}`))
  eachTag(html, 'cs-hint', (t) => assert.ok(t.includes(lc(`color:${L.hint}`)), `hint: ${t}`), false)
  eachTag(
    html,
    'cs-code',
    (t) => {
      assert.ok(t.includes(lc(`background-color:${L.codeBg}`)), `code bg: ${t}`)
      assert.ok(t.includes(lc(`border:1px solid ${L.codeBorder}`)), `code border: ${t}`)
      assert.ok(t.includes(lc(`color:${L.codeText}`)), `code colour: ${t}`)
    },
    require.code === true,
  )
  eachTag(html, 'cs-rule', (t) => assert.ok(t.includes(lc(`border-top:1px solid ${L.rule}`)), `rule: ${t}`))
  eachTag(html, 'cs-footer', (t) => assert.ok(t.includes(lc(`color:${L.footer}`)), `footer: ${t}`))

  // button: solid bgcolor cell with inline ink, the same in both schemes
  const lower = lc(html)
  const hasButton = lower.includes(`bgcolor="${lc(B.bg)}"`)
  if (require.button) assert.ok(hasButton, 'button cell with bgcolor')
  if (hasButton) {
    assert.ok(lower.includes(`color:${lc(B.ink)}`), 'button ink inline')
    assert.ok(!r['cs-button'], 'button colours are not overridden in dark mode')
  }

  // never present
  assert.ok(!lower.includes('#777777'), 'no #777777')
  assert.ok(!lower.includes('<script'), 'no <script')
  assert.ok(!lower.includes('rgba('), 'no rgba()')
}
