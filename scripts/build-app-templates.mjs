#!/usr/bin/env node

/**
 * Builds the pre-rendered app email templates (Phase 5, plan 05-11; MAIL-03..06).
 *
 *   node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/build-app-templates.mjs
 *
 * Writes src/generated/app-email-templates.json (checked in; the drift test in
 * tests/unit/app-email-build.test.ts fails when it differs from a fresh build). Rebuild and
 * commit it after any change to src/emails/** or the messages.
 *
 * React Email runs only here and in tests. Every kind x locale (digest twice: `base`
 * without and `more` with the See-all link) is rendered through the 05-07 shell with slot
 * sentinels `__clk_<type>_<name>__` in place of row data. The consumer
 * (src/emails/render-app.ts) only fills them, escaping every value (template-fill.ts).
 *
 * Post-processing:
 *  (a) the hidden preheader of support_admin: `__clk_pre_preheader__<div>pad</div>` becomes
 *      `__clk_pre_preheader__`; the fill adds the react-email padding for the real length;
 *  (b) digest row templates (show, shownoimage, episode) are cut out by prefix/suffix:
 *      render with the block sentinel as the container's only child (A) and with one
 *      sentinel row (B); B must start with A's prefix and end with A's suffix, the middle
 *      is the row. Exact by construction; the builder throws otherwise.
 * The 48-hour and 7-day lines are baked in here (SUPPORT_REPLY_HOURS,
 * NEWSLETTER_CONFIRM_TTL_DAYS); a unit test pins their plural category per locale.
 * No timestamp in the output, so a rebuild is drift-free.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { renderEmail } from '../src/emails/components.ts'
import { en } from '../src/emails/messages/en.ts'
import { ar } from '../src/emails/messages/ar.ts'
import {
  appEmailElement,
  appSubject,
} from '../src/emails/app/templates.ts'
import { PREVIEW_MAX, PREVIEW_PAD, slotsOf } from '../src/emails/app/template-fill.ts'

export const SLOT = {
  txt: (name) => `__clk_txt_${name}__`,
  url: (name) => `__clk_url_${name}__`,
  pre: (name) => `__clk_pre_${name}__`,
  blk: (name) => `__clk_blk_${name}__`,
}

export const OUTPUT = 'src/generated/app-email-templates.json'

const GENERATED_BY =
  'scripts/build-app-templates.mjs (plan 05-11). Generated file: do not edit; rebuild with node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/build-app-templates.mjs'

const LOCALES = ['en', 'ar']
const KINDS = ['welcome', 'digest', 'support_ack', 'support_admin', 'newsletter_confirm']

/** Expected slots per template (union of html, text and subject). */
const EXPECTED = {
  'welcome:base': ['url:logo', 'url:origin', 'url:browse'],
  'digest:base': ['url:logo', 'url:origin', 'url:profile', 'url:unsubscribe', 'blk:shows'],
  'digest:more': ['url:logo', 'url:origin', 'url:profile', 'url:unsubscribe', 'url:seeall', 'blk:shows'],
  'support_ack:base': ['url:logo', 'url:origin'],
  'support_admin:base': [
    'url:logo',
    'url:origin',
    'txt:name',
    'txt:email',
    'txt:subject',
    'txt:message',
    'pre:preheader',
    'url:admin',
  ],
  'newsletter_confirm:base': ['url:logo', 'url:origin', 'url:confirm'],
}
const ROW_EXPECTED = {
  show: ['txt:title', 'url:image', 'blk:episodes'],
  shownoimage: ['txt:title', 'blk:episodes'],
  episode: ['txt:line', 'url:watch'],
}

const root = fileURLToPath(new URL('..', import.meta.url))

function fail(message) {
  throw new Error(`build-app-templates: ${message}`)
}

function common(locale) {
  return { locale, logo: SLOT.url('logo'), origin: SLOT.url('origin') }
}

function digestView(locale, shows, more) {
  return {
    kind: 'digest',
    ...common(locale),
    profile: SLOT.url('profile'),
    unsubscribe: SLOT.url('unsubscribe'),
    ...(more ? { seeall: SLOT.url('seeall') } : {}),
    shows,
  }
}

function sentinelView(kind, locale) {
  switch (kind) {
    case 'welcome':
      return { kind, ...common(locale), browse: SLOT.url('browse') }
    case 'support_ack':
      return { kind, ...common(locale) }
    case 'support_admin':
      return {
        kind,
        ...common(locale),
        name: SLOT.txt('name'),
        email: SLOT.txt('email'),
        subject: SLOT.txt('subject'),
        message: SLOT.txt('message'),
        preheader: SLOT.pre('preheader'),
        admin: SLOT.url('admin'),
      }
    case 'newsletter_confirm':
      return { kind, ...common(locale), confirm: SLOT.url('confirm') }
    default:
      return fail(`no sentinel view for ${kind}`)
  }
}

/** (a) the fill path adds the Preview padding for the real preheader length. */
function collapsePreheader(html) {
  const token = SLOT.pre('preheader')
  const padded = `${token}<div>${PREVIEW_PAD.repeat(PREVIEW_MAX - token.length)}</div>`
  return html.split(padded).join(token)
}

/** (b) the middle of `whole` between the prefix and suffix of `outer` around `token`. */
function cut(outer, whole, token, label, { trim = false } = {}) {
  const at = outer.indexOf(token)
  if (at < 0 || outer.indexOf(token, at + token.length) >= 0) {
    fail(`${label}: ${token} must appear exactly once`)
  }
  let prefix = outer.slice(0, at)
  let suffix = outer.slice(at + token.length)
  if (trim) {
    prefix = prefix.trimEnd()
    suffix = suffix.trimStart()
  }
  if (!whole.startsWith(prefix) || !whole.endsWith(suffix)) {
    fail(`${label}: render does not keep the prefix/suffix around ${token}`)
  }
  if (whole.length < prefix.length + suffix.length) fail(`${label}: overlap`)
  const middle = whole.slice(prefix.length, whole.length - suffix.length)
  return trim ? middle.trim() : middle
}

async function render(view) {
  return renderEmail(appEmailElement(view))
}

async function rowTemplates(locale) {
  const episodesBlk = SLOT.blk('episodes')
  const showSentinel = {
    row: 'show',
    title: SLOT.txt('title'),
    image: SLOT.url('image'),
    episodes: episodesBlk,
  }
  const noImageSentinel = { row: 'shownoimage', title: SLOT.txt('title'), episodes: episodesBlk }
  const episodeSentinel = { line: SLOT.txt('line'), watch: SLOT.url('watch') }

  const a = await render(digestView(locale, SLOT.blk('shows'), false))
  const b = await render(digestView(locale, [showSentinel], false))
  const bn = await render(digestView(locale, [noImageSentinel], false))
  const c = await render(digestView(locale, [{ ...showSentinel, episodes: [episodeSentinel] }], false))

  const shows = SLOT.blk('shows')
  return {
    show: {
      html: cut(a.html, b.html, shows, `${locale} show html`),
      text: cut(a.text, b.text, shows, `${locale} show text`, { trim: true }),
    },
    shownoimage: {
      html: cut(a.html, bn.html, shows, `${locale} shownoimage html`),
      text: cut(a.text, bn.text, shows, `${locale} shownoimage text`, { trim: true }),
    },
    episode: {
      html: cut(b.html, c.html, episodesBlk, `${locale} episode html`),
      text: cut(b.text, c.text, episodesBlk, `${locale} episode text`, { trim: true }),
    },
  }
}

function slotSet(...parts) {
  return [...new Set(parts.flatMap((p) => slotsOf(p).map((s) => `${s.type}:${s.name}`)))].sort()
}

function count(haystack, needle) {
  return haystack.split(needle).length - 1
}

function assertCommon(label, t) {
  if (t.text.includes('__CLK_')) fail(`${label}: upper-cased sentinel in text`)
  if (slotsOf(t.text).some((s) => s.type === 'pre')) fail(`${label}: pre slot in text`)
  const lower = t.html.toLowerCase()
  if (lower.includes('<script')) fail(`${label}: <script in html`)
  if (lower.includes('#777777')) fail(`${label}: #777777 in html`)
  if (t.html.includes('dangerouslySetInnerHTML')) fail(`${label}: dangerouslySetInnerHTML`)
}

function assertTemplates(file) {
  for (const [key, t] of Object.entries(file.templates)) {
    const kv = key.split(':').slice(0, 2).join(':')
    const got = slotSet(t.html, t.text, t.subject)
    const want = [...EXPECTED[kv]].sort()
    if (JSON.stringify(got) !== JSON.stringify(want)) {
      fail(`${key}: slots ${got.join(',')} != ${want.join(',')}`)
    }
    assertCommon(key, t)
    const blks = [...slotsOf(t.html), ...slotsOf(t.text), ...slotsOf(t.subject)].filter(
      (s) => s.type === 'blk'
    )
    if (kv.startsWith('digest:')) {
      if (count(t.html, SLOT.blk('shows')) !== 1 || count(t.text, SLOT.blk('shows')) !== 1) {
        fail(`${key}: shows block must appear once in html and text`)
      }
      if (blks.some((s) => s.name !== 'shows')) fail(`${key}: unexpected block`)
    } else if (blks.length) {
      fail(`${key}: unexpected block`)
    }
    if (/\{(hours|days)\}/.test(t.html + t.text + t.subject)) fail(`${key}: unbaked token`)
  }
  for (const locale of LOCALES) {
    for (const [row, t] of Object.entries(file.rows[locale])) {
      const got = slotSet(t.html, t.text)
      const want = [...ROW_EXPECTED[row]].sort()
      if (JSON.stringify(got) !== JSON.stringify(want)) {
        fail(`${locale} ${row}: slots ${got.join(',')} != ${want.join(',')}`)
      }
      assertCommon(`${locale} ${row}`, t)
      const blks = [...slotsOf(t.html), ...slotsOf(t.text)].filter((s) => s.type === 'blk')
      if (row === 'episode' ? blks.length !== 0 : blks.length !== 2 || blks.some((s) => s.name !== 'episodes')) {
        fail(`${locale} ${row}: blocks ${blks.map((s) => s.name).join(',')}`)
      }
    }
    const admin = file.templates[`support_admin:base:${locale}`].html
    const name = SLOT.txt('name')
    const names = count(admin, name)
    if (names < 2 || count(admin, `<bdi>${name}</bdi>`) !== names) {
      fail(`support_admin ${locale}: name must sit in <bdi> everywhere (${names})`)
    }
    if (count(admin, SLOT.pre('preheader')) !== 1) fail(`support_admin ${locale}: preheader slot`)
  }
  const baked = [
    ['support_ack:base:en', 'within 48 hours'],
    ['support_ack:base:ar', 'خلال 48 ساعة'],
    ['newsletter_confirm:base:en', '7 days'],
    ['newsletter_confirm:base:ar', '7 أيام'],
  ]
  for (const [key, phrase] of baked) {
    const t = file.templates[key]
    if (!t.html.includes(phrase) || !t.text.includes(phrase)) fail(`${key}: missing "${phrase}"`)
  }
}

/** @returns {Promise<import('../src/emails/app/template-fill.ts').AppTemplateFile>} */
export async function buildAppTemplates() {
  const templates = {}
  for (const kind of KINDS) {
    for (const locale of LOCALES) {
      const variants = kind === 'digest' ? ['base', 'more'] : ['base']
      for (const variant of variants) {
        const view =
          kind === 'digest'
            ? digestView(locale, SLOT.blk('shows'), variant === 'more')
            : sentinelView(kind, locale)
        const { html, text } = await render(view)
        templates[`${kind}:${variant}:${locale}`] = {
          subject: appSubject(kind, locale, SLOT.txt('subject')),
          html: collapsePreheader(html),
          text,
        }
      }
    }
  }
  const sortedTemplates = Object.fromEntries(
    Object.keys(templates)
      .sort()
      .map((k) => [k, templates[k]])
  )
  const rows = {}
  for (const locale of LOCALES) rows[locale] = await rowTemplates(locale)
  const strings = {
    en: { episodeLine: en.e7.episodeLine, e9Preheader: en.e9.preheader },
    ar: { episodeLine: ar.e7.episodeLine, e9Preheader: ar.e9.preheader },
  }
  const file = { generatedBy: GENERATED_BY, templates: sortedTemplates, rows, strings }
  assertTemplates(file)
  return file
}

async function main() {
  const file = await buildAppTemplates()
  mkdirSync(`${root}src/generated`, { recursive: true })
  writeFileSync(`${root}${OUTPUT}`, `${JSON.stringify(file, null, 2)}\n`)
  console.log(
    `wrote ${Object.keys(file.templates).length} templates and ${LOCALES.length * 3} row templates to ${OUTPUT}`
  )
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
