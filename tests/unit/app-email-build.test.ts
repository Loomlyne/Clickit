// Build-time app email templates (Phase 5, plan 05-11, Task 2): builder assertions and
// the drift gate for the checked-in src/generated/app-email-templates.json.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SLOT, buildAppTemplates } from '../../scripts/build-app-templates.mjs'
import { slotsOf } from '../../src/emails/app/template-fill.ts'
import type { AppTemplateFile } from '../../src/emails/app/template-fill.ts'
import { en } from '../../src/emails/messages/en.ts'
import { ar } from '../../src/emails/messages/ar.ts'

const REBUILD =
  'run: node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/build-app-templates.mjs'

const built: Promise<AppTemplateFile> = buildAppTemplates()

const LOCALES = ['en', 'ar'] as const

const EXPECTED: Record<string, string[]> = {
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

const ROW_EXPECTED: Record<string, string[]> = {
  show: ['txt:title', 'url:image', 'blk:episodes'],
  shownoimage: ['txt:title', 'blk:episodes'],
  episode: ['txt:line', 'url:watch'],
}

function slotSet(...parts: string[]): string[] {
  return [...new Set(parts.flatMap((p) => slotsOf(p).map((s) => `${s.type}:${s.name}`)))].sort()
}

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1
}

test('SLOT builds lowercase sentinels', () => {
  assert.equal(SLOT.txt('name'), '__clk_txt_name__')
  assert.equal(SLOT.url('logo'), '__clk_url_logo__')
  assert.equal(SLOT.pre('preheader'), '__clk_pre_preheader__')
  assert.equal(SLOT.blk('shows'), '__clk_blk_shows__')
})

test('12 templates, 3 row templates per locale and the two model strings', async () => {
  const file = await built
  assert.equal(typeof file.generatedBy, 'string')
  const keys = Object.keys(file.templates).sort()
  const want = LOCALES.flatMap((l) => Object.keys(EXPECTED).map((k) => `${k}:${l}`)).sort()
  assert.deepEqual(keys, want)
  assert.equal(keys.length, 12)
  for (const l of LOCALES) {
    assert.deepEqual(Object.keys(file.rows[l]).sort(), ['episode', 'show', 'shownoimage'])
    const m = l === 'ar' ? ar : en
    assert.deepEqual(file.strings[l], { episodeLine: m.e7.episodeLine, e9Preheader: m.e9.preheader })
  }
})

test('each template has exactly the slot set of its kind; seeall only in digest:more', async () => {
  const file = await built
  for (const [key, t] of Object.entries(file.templates)) {
    const kindVariant = key.split(':').slice(0, 2).join(':')
    assert.deepEqual(slotSet(t.html, t.text, t.subject), [...EXPECTED[kindVariant]].sort(), key)
    if (!key.startsWith('digest:more')) assert.ok(!t.html.includes('__clk_url_seeall__'), key)
  }
  for (const l of LOCALES) {
    for (const [row, t] of Object.entries(file.rows[l])) {
      assert.deepEqual(slotSet(t.html, t.text), [...ROW_EXPECTED[row]].sort(), `${l} ${row}`)
    }
  }
})

test('blk slots: shows once in each digest template, episodes once in each show row, nowhere else', async () => {
  const file = await built
  for (const [key, t] of Object.entries(file.templates)) {
    const blks = [...slotsOf(t.html), ...slotsOf(t.text), ...slotsOf(t.subject)].filter((s) => s.type === 'blk')
    if (key.startsWith('digest:')) {
      assert.equal(count(t.html, '__clk_blk_shows__'), 1, key)
      assert.equal(count(t.text, '__clk_blk_shows__'), 1, key)
      assert.ok(blks.every((s) => s.name === 'shows'), key)
    } else {
      assert.equal(blks.length, 0, key)
    }
  }
  for (const l of LOCALES) {
    for (const row of ['show', 'shownoimage'] as const) {
      const t = file.rows[l][row]
      assert.equal(count(t.html, '__clk_blk_episodes__'), 1)
      assert.equal(count(t.text, '__clk_blk_episodes__'), 1)
      assert.ok([...slotsOf(t.html), ...slotsOf(t.text)].filter((s) => s.type === 'blk').every((s) => s.name === 'episodes'))
    }
    const ep = file.rows[l].episode
    assert.equal([...slotsOf(ep.html), ...slotsOf(ep.text)].filter((s) => s.type === 'blk').length, 0)
  }
})

test('text parts: no upper-cased sentinel, no pre slot; html: no script, no #777777, no dangerouslySetInnerHTML', async () => {
  const file = await built
  const all = [
    ...Object.values(file.templates),
    ...LOCALES.flatMap((l) => Object.values(file.rows[l]).map((r) => ({ ...r, subject: '' }))),
  ]
  for (const t of all) {
    assert.ok(!t.text.includes('__CLK_'))
    assert.ok(!slotsOf(t.text).some((s) => s.type === 'pre'))
    assert.ok(!/<[a-z]/i.test(t.text), 'text part has no tags')
    const lower = t.html.toLowerCase()
    assert.ok(!lower.includes('<script'))
    assert.ok(!lower.includes('#777777'))
    assert.ok(!t.html.includes('dangerouslySetInnerHTML'))
  }
})

test('the 48-hour and 7-day lines are baked in; no {hours} / {days} token remains', async () => {
  const file = await built
  const ackEn = file.templates['support_ack:base:en']
  const ackAr = file.templates['support_ack:base:ar']
  const nlEn = file.templates['newsletter_confirm:base:en']
  const nlAr = file.templates['newsletter_confirm:base:ar']
  assert.ok(ackEn.html.includes('within 48 hours') && ackEn.text.includes('within 48 hours'))
  assert.ok(ackAr.html.includes('خلال 48 ساعة') && ackAr.text.includes('خلال 48 ساعة'))
  assert.ok(nlEn.html.includes('7 days') && nlEn.text.includes('7 days'))
  assert.ok(nlAr.html.includes('7 أيام') && nlAr.text.includes('7 أيام'))
  for (const t of Object.values(file.templates)) {
    for (const part of [t.html, t.text, t.subject]) {
      assert.ok(!part.includes('{hours}') && !part.includes('{days}'))
    }
  }
})

test('support_admin: the name sits in <bdi> everywhere in the visible body; the preheader is the pre slot', async () => {
  const file = await built
  for (const l of LOCALES) {
    const html = file.templates[`support_admin:base:${l}`].html
    const hidden = html.indexOf('__clk_pre_preheader__')
    assert.ok(hidden > 0, 'preheader slot present')
    assert.equal(count(html, '__clk_pre_preheader__'), 1)
    // the hidden div holds only the slot (the padding is added at fill time)
    assert.match(html, /data-skip-in-text="true">__clk_pre_preheader__<\/div>/)
    const names = count(html, '__clk_txt_name__')
    assert.ok(names >= 2, `${l}: name in From row and reply hint`)
    assert.equal(count(html, '<bdi>__clk_txt_name__</bdi>'), names, `${l}: every name inside <bdi>`)
    assert.equal(file.templates[`support_admin:base:${l}`].subject, '[Clickit support] __clk_txt_subject__')
  }
})

test('drift: the committed JSON equals a fresh build', async () => {
  const file = await built
  const path = new URL('../../src/generated/app-email-templates.json', import.meta.url)
  let committed: unknown
  try {
    committed = JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    assert.fail(`src/generated/app-email-templates.json missing or unreadable; ${REBUILD}`)
  }
  assert.deepEqual(committed, file, `app email templates drifted; ${REBUILD}`)
})
