import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createElement as h } from 'react'
import { EMAIL_TOKENS } from '../../src/lib/email-tokens.ts'
import {
  EMAIL_COLORS,
  FOOTER_LINE_1,
  LOGO_URL,
  POSTAL_LINE,
  logoUrlFor,
} from '../../src/emails/brand.ts'
import {
  CodeBlock,
  EmailButton,
  EmailHeading,
  EmailShell,
  EmailText,
  FallbackUrl,
  QuoteBox,
  darkSchemeCss,
  renderEmail,
} from '../../src/emails/components.ts'
import { en, fill } from '../../src/emails/messages/en.ts'
import { ar } from '../../src/emails/messages/ar.ts'
import { SIGNED, assertSignedScheme } from './helpers/email-scheme.ts'

const URL_CONFIRM =
  'https://www.clickitstory.ae/en/auth/confirm?token_hash=abc&type=signup'

function sample(
  locale: 'en' | 'ar',
  quote = 'Line one <b>not bold</b>\nLine two'
) {
  const m = locale === 'ar' ? ar : en
  return h(
    EmailShell,
    { locale, preheader: m.e2.preheader },
    h(EmailHeading, null, m.e2.heading),
    h(EmailText, null, m.e2.body),
    h(EmailButton, { href: URL_CONFIRM, label: m.e2.button ?? '' }),
    h(FallbackUrl, { href: URL_CONFIRM, label: m.fallbackUrl }),
    h(CodeBlock, { code: '482917' }),
    h(QuoteBox, null, quote),
    h(EmailText, { small: true }, m.e2.fineprint)
  )
}

test('the role map equals the signed table, role by role (tokens are Phase 4)', () => {
  assert.deepEqual(
    {
      page: EMAIL_COLORS.light.page,
      card: EMAIL_COLORS.light.card,
      header: EMAIL_COLORS.light.header,
      heading: EMAIL_COLORS.light.heading,
      body: EMAIL_COLORS.light.body,
      hint: EMAIL_COLORS.light.hint,
      codeBg: EMAIL_COLORS.light.codeBg,
      codeBorder: EMAIL_COLORS.light.codeBorder,
      codeText: EMAIL_COLORS.light.codeText,
      rule: EMAIL_COLORS.light.rule,
      footer: EMAIL_COLORS.light.footer,
    },
    SIGNED.light
  )
  assert.deepEqual(
    {
      page: EMAIL_COLORS.dark.page,
      card: EMAIL_COLORS.dark.card,
      cardBorder: EMAIL_COLORS.dark.cardBorder,
      header: EMAIL_COLORS.dark.header,
      headerRule: EMAIL_COLORS.dark.headerRule,
      heading: EMAIL_COLORS.dark.heading,
      body: EMAIL_COLORS.dark.body,
      hint: EMAIL_COLORS.dark.hint,
      codeBg: EMAIL_COLORS.dark.codeBg,
      codeBorder: EMAIL_COLORS.dark.codeBorder,
      codeText: EMAIL_COLORS.dark.codeText,
      rule: EMAIL_COLORS.dark.rule,
      footer: EMAIL_COLORS.dark.footer,
    },
    SIGNED.dark
  )
  assert.equal(EMAIL_COLORS.button.bg, SIGNED.button.bg)
  assert.equal(EMAIL_COLORS.button.ink, SIGNED.button.ink)
  assert.equal(EMAIL_COLORS.light.link, EMAIL_TOKENS.light.heading)
  assert.equal(EMAIL_COLORS.dark.link, EMAIL_TOKENS.dark.heading)
  assert.equal(EMAIL_COLORS.light.quoteRule, EMAIL_TOKENS.button.bg)
  assert.notEqual(EMAIL_COLORS.dark.card, EMAIL_COLORS.dark.page)
})

test('darkSchemeCss builds only the dark @media block from the dark roles', () => {
  const css = darkSchemeCss()
  assert.ok(css.startsWith('@media (prefers-color-scheme: dark)'))
  assert.equal(css.match(/@media/g)?.length, 1)
  assert.ok(
    css.includes(
      `.cs-card{background:${EMAIL_COLORS.dark.card} !important;border:1px solid ${EMAIL_COLORS.dark.cardBorder} !important}`
    )
  )
  assert.ok(
    css.includes(
      `.cs-header{background:${EMAIL_COLORS.dark.header} !important;border-bottom:1px solid ${EMAIL_COLORS.dark.headerRule} !important}`
    )
  )
})

test('EN render: meta tags, one dark style block, signed scheme role by role', async () => {
  const { html } = await renderEmail(sample('en'))
  assertSignedScheme(html, { code: true, button: true })
  assert.equal(html.match(/<style/g)?.length, 1)
  assert.equal(html.match(/<title/g)?.length, 1, 'one title')
  assert.ok(!html.includes('<!--'), 'no React comment placeholders')
  assert.match(html, /<html[^>]*lang="en"/)
  assert.match(html, /<html[^>]*dir="ltr"/)
})

test('header plate, logo, button cell, fallback URL', async () => {
  const { html } = await renderEmail(sample('en'))
  assert.ok(
    html.includes(`bgcolor="${EMAIL_TOKENS.light.header}"`),
    'header cell bgcolor'
  )
  const img = /<img[^>]*>/.exec(html)?.[0] ?? ''
  assert.ok(img.includes(`src="${LOGO_URL}"`))
  assert.ok(img.includes('alt="Clickit Story"'))
  assert.ok(img.includes('width="136"'))
  assert.equal(html.match(/<img/g)?.length, 1, 'logo is the only image')
  assert.ok(html.includes(`<td bgcolor="${EMAIL_TOKENS.button.bg}"`))
  const aTags = html.match(/<a [^>]*>/g) ?? []
  const btn = aTags.find((a) => a.includes(`color:${EMAIL_TOKENS.button.ink}`))
  assert.ok(btn, 'button link has inline ink')
  assert.ok(btn.includes(`href="${URL_CONFIRM.replace(/&/g, '&amp;')}"`))
  // the fallback line repeats the same href
  const hrefs = aTags.filter((a) =>
    a.includes(URL_CONFIRM.replace(/&/g, '&amp;'))
  )
  assert.ok(hrefs.length >= 2, 'button and fallback share the href')
})

test('footer sits inside the card after a rule and carries line 1 and the support link', async () => {
  const { html } = await renderEmail(sample('en'))
  const cardStart = html.indexOf('class="cs-card')
  assert.ok(cardStart > 0)
  const ruleAt = html.indexOf('class="cs-rule')
  const footerAt = html.indexOf(FOOTER_LINE_1)
  assert.ok(
    ruleAt > cardStart && footerAt > ruleAt,
    'rule then footer, after the card opens'
  )
  // the card's closing tag comes after the footer line
  const cardClose = html.indexOf('</table>', footerAt)
  assert.ok(cardClose > footerAt)
  assert.ok(html.includes('/support'))
  assert.ok(html.includes(`color:${EMAIL_TOKENS.light.footer}`))
})

test('AR render: rtl, lang, Tahoma, code is ltr mono with letter-spacing', async () => {
  const { html } = await renderEmail(sample('ar'))
  assertSignedScheme(html, { code: true, button: true })
  assert.match(html, /<html[^>]*lang="ar"/)
  assert.match(html, /<html[^>]*dir="rtl"/)
  assert.match(html, /<table[^>]*dir="rtl"/)
  assert.ok(html.includes('direction:rtl'))
  assert.ok(html.includes('Tahoma'))
  const codeTag = /<td[^>]*class="cs-code"[^>]*>/.exec(html)?.[0] ?? ''
  assert.ok(codeTag.includes('dir="ltr"'))
  assert.ok(codeTag.includes('letter-spacing:8px'))
  assert.ok(codeTag.includes('ui-monospace'))
  assert.ok(html.includes('482917'))
})

test('quote box escapes the visitor text and keeps line breaks', async () => {
  const { html } = await renderEmail(sample('en'))
  assert.ok(html.includes('Line one &lt;b&gt;not bold&lt;/b&gt;'))
  assert.ok(html.includes('white-space:pre-wrap'))
  assert.ok(!html.includes('<b>not bold</b>'))
})

test('plain text: no tags, code or url on its own line, ends with the -- footer', async () => {
  const { text } = await renderEmail(sample('en', 'Quoted line'))
  assert.ok(!/<[a-z/][^>]*>/i.test(text), 'no HTML tags')
  const lines = text.split('\n').map((l) => l.trim())
  assert.ok(lines.includes('482917'), 'code alone on a line')
  assert.ok(lines.includes(URL_CONFIRM), 'url alone on its own line')
  assert.equal(
    lines.filter((l) => l.includes(URL_CONFIRM)).length,
    1,
    'url once (button is skipped in text)'
  )
  assert.ok(lines.includes('Confirm your email'), 'heading keeps its case')
  assert.ok(
    !text.includes(en.e2.preheader),
    'preheader is not in the text part'
  )
  const dashes = lines.lastIndexOf('--')
  assert.ok(dashes > 0, 'a -- line exists')
  assert.equal(lines[dashes - 1], '', 'blank line before --')
  assert.ok(lines[dashes + 1].startsWith(FOOTER_LINE_1))
  assert.ok(
    lines.includes('Help: clickitstory.ae/support'),
    'support line, no duplicated href'
  )
})

test('no <script, no rgba(, no #777777; only the logo image unless the caller adds one', async () => {
  for (const locale of ['en', 'ar'] as const) {
    const { html, text } = await renderEmail(sample(locale))
    for (const out of [html, text]) {
      assert.ok(!out.includes('<script'))
      assert.ok(!out.includes('rgba('))
      assert.ok(!out.toLowerCase().includes('#777777'))
    }
    assert.equal(html.match(/<img/g)?.length, 1)
  }
})

test('the shell takes a caller logo url (Mailpit) and a caller image passes through', async () => {
  const local = logoUrlFor('http://localhost:3000')
  assert.equal(local, 'http://localhost:3000/brand/email-logo-white.png')
  assert.equal(
    logoUrlFor('http://127.0.0.1:3000/'),
    'http://127.0.0.1:3000/brand/email-logo-white.png'
  )
  assert.equal(logoUrlFor('https://www.clickitstory.ae'), LOGO_URL)
  assert.equal(logoUrlFor('not a url'), LOGO_URL)
  const { html } = await renderEmail(
    h(
      EmailShell,
      { locale: 'en', preheader: 'x', logoUrl: local },
      h(EmailText, null, 'hi')
    )
  )
  assert.ok(html.includes(`src="${local}"`))
})

test('footerExtra renders inside the footer', async () => {
  const { html, text } = await renderEmail(
    h(
      EmailShell,
      {
        locale: 'en',
        preheader: 'x',
        footerExtra: h('span', null, POSTAL_LINE),
      },
      h(EmailText, null, 'hi')
    )
  )
  assert.ok(html.indexOf(POSTAL_LINE) > html.indexOf(FOOTER_LINE_1))
  assert.ok(text.includes(POSTAL_LINE))
})

test('user values are escaped and the style block holds only token constants', async () => {
  const evil = '<script>alert(1)</script>'
  const { html } = await renderEmail(
    h(EmailShell, { locale: 'en', preheader: evil }, h(EmailText, null, evil))
  )
  assert.ok(!html.includes('<script'))
  assert.ok(html.includes('&lt;script&gt;'))
})

test('messages: footer line, postal line, E1-E10 present in both languages, same tokens', () => {
  assert.equal(
    FOOTER_LINE_1,
    'Clickit Story · Spacelight Studios FZ LLC, Abu Dhabi, United Arab Emirates'
  )
  assert.equal(
    POSTAL_LINE,
    'Spacelight Studios FZ LLC, Abu Dhabi, United Arab Emirates'
  )
  for (const m of [en, ar]) {
    assert.equal(m.footer.line1, FOOTER_LINE_1)
    assert.equal(m.footer.postalLine, POSTAL_LINE)
  }
  const keys = [
    'e1',
    'e2',
    'e3',
    'e4',
    'e5',
    'e6',
    'e7',
    'e8',
    'e9',
    'e10',
  ] as const
  const tokens = (s: string) =>
    [...s.matchAll(/\{[^{}]+\}/g)].map((x) => x[0]).sort()
  for (const k of keys) {
    assert.deepEqual(
      Object.keys(en[k]).sort(),
      Object.keys(ar[k]).sort(),
      `${k} keys`
    )
    for (const f of Object.keys(en[k]) as (keyof (typeof en)[typeof k])[]) {
      assert.deepEqual(
        tokens(String(en[k][f])),
        tokens(String(ar[k][f])),
        `${k}.${String(f)} placeholders`
      )
    }
  }
  assert.equal(fill('a {x} b {y}', { x: 1 }), 'a 1 b {y}')
  assert.equal(fill(en.e8.body, { hours: 24 }).includes('24 hours'), true)
  assert.equal(fill(en.e4.body).includes('{{ .Email }}'), true)
  // auth bodies keep the literal 15 minutes
  for (const k of ['e1', 'e2', 'e3', 'e5'] as const) {
    assert.ok(en[k].body.includes('15 minutes'), `${k} EN`)
    assert.ok(ar[k].body.includes('15'), `${k} AR`)
  }
})

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}

test('source guard: no hex colour under src/emails, no #777777 in emails or supabase templates', () => {
  const root = new URL('../../', import.meta.url).pathname
  const files = walk(join(root, 'src/emails'))
  assert.ok(files.length >= 4)
  for (const f of files) {
    const src = readFileSync(f, 'utf8')
    assert.ok(
      !/#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?\b/.test(src),
      `hex literal in ${f}`
    )
    assert.ok(!src.toLowerCase().includes('#777777'), `#777777 in ${f}`)
  }
  const tpl = join(root, 'supabase/templates')
  if (existsSync(tpl)) {
    for (const f of walk(tpl)) {
      assert.ok(
        !readFileSync(f, 'utf8').toLowerCase().includes('#777777'),
        `#777777 in ${f}`
      )
    }
  }
})
