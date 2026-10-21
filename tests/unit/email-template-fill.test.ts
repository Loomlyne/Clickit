// Single-pass escaping fill and the shared app-email model (Phase 5, plan 05-11, Task 1;
// controller condition 1). Every escape is checked against React's own output, so the
// pre-rendered path can never escape differently from the direct React path.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Preview } from 'react-email'
import {
  PREVIEW_MAX,
  PREVIEW_PAD,
  SLOT_SOURCE,
  TrustedBlock,
  escapeHtml,
  fillHtml,
  fillSubject,
  fillText,
  renderRows,
  safeUrl,
  slotsOf,
} from '../../src/emails/app/template-fill.ts'
import type { SlotValues } from '../../src/emails/app/template-fill.ts'
import {
  APP_EMAIL_KINDS,
  buildAppEmailModel,
  stripCrlf,
} from '../../src/emails/app/model.ts'
import type { AppEmailCtx, AppEmailRow } from '../../src/emails/app/model.ts'
import { SUPPORT_REPLY_HOURS } from '../../src/lib/email-constants.ts'
import { LOGO_URL } from '../../src/emails/brand.ts'

const HOSTILE = `Zoë "Q" O'Neil & <script>alert(1)</script> نور`

const txt = (value: string) => ({ type: 'txt' as const, value })
const url = (value: string) => ({ type: 'url' as const, value })
const pre = (value: string) => ({ type: 'pre' as const, value })

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1
}

// ---------------------------------------------------------------------------
// escapeHtml / safeUrl
// ---------------------------------------------------------------------------

test('escapeHtml equals React output as a text child and as an attribute value', () => {
  const asText = renderToStaticMarkup(h('span', null, HOSTILE))
  assert.equal(asText, `<span>${escapeHtml(HOSTILE)}</span>`)
  const asAttr = renderToStaticMarkup(h('a', { href: HOSTILE }))
  assert.equal(asAttr, `<a href="${escapeHtml(HOSTILE)}"></a>`)
  assert.equal(
    escapeHtml(`&<>"'`),
    '&amp;&lt;&gt;&quot;&#x27;',
    'the exact React map, & first (no double escape)'
  )
  assert.equal(escapeHtml('&amp;'), '&amp;amp;')
})

test('safeUrl returns https and localhost http URLs unchanged', () => {
  for (const v of [
    'https://www.clickitstory.ae',
    'https://WWW.ClickitStory.ae/EN/watch/abc/',
    'https://x.example/?a=1&b="2"',
    'http://localhost:3000/en/browse',
    'http://127.0.0.1/x',
    'https://media.clickitstory.ae/brand/email-logo-white.png',
  ]) {
    assert.equal(safeUrl(v), v, v)
  }
})

test('safeUrl throws unsafe url for scripts, data, plain http, relative and empty values', () => {
  for (const v of [
    'javascript:alert(1)',
    ' JavaScript:x',
    'data:text/html,x',
    'http://evil.example',
    '//evil.example',
    '/relative/path',
    '',
    'not a url',
    'https://x.example/a b',
    'https://x.example/\nBcc: y',
  ]) {
    assert.throws(() => safeUrl(v), /unsafe url/, JSON.stringify(v))
  }
  assert.throws(() => safeUrl(undefined as unknown as string), /unsafe url/)
})

// ---------------------------------------------------------------------------
// slotsOf / fillHtml / fillText / fillSubject
// ---------------------------------------------------------------------------

test('SLOT_SOURCE is a string and slotsOf uses a fresh regex per call', () => {
  assert.equal(typeof SLOT_SOURCE, 'string')
  const tpl = 'a __clk_txt_name__ b __clk_url_admin__ c __clk_blk_shows__ __clk_pre_preheader__'
  const first = slotsOf(tpl)
  const second = slotsOf(tpl)
  assert.deepEqual(first, second)
  assert.deepEqual(
    first.map((s) => `${s.type}:${s.name}`),
    ['txt:name', 'url:admin', 'blk:shows', 'pre:preheader']
  )
  assert.deepEqual(slotsOf('__CLK_TXT_NAME__ __clk_txt_Name__ __clk_txt_a_b__'), [])
})

test('fillHtml escapes a url slot as an attribute; fillText writes it plain', () => {
  const v = 'https://x.example/?a=1&b="2"'
  assert.equal(
    fillHtml('<a href="__clk_url_link__">x</a>', { link: url(v) }, {}),
    '<a href="https://x.example/?a=1&amp;b=&quot;2&quot;">x</a>'
  )
  assert.equal(fillText('Open: __clk_url_link__', { link: url(v) }, {}), `Open: ${v}`)
  assert.equal(
    fillHtml(
      '<a href="__clk_url_origin__/support">help</a>',
      { origin: url('https://www.clickitstory.ae') },
      {}
    ),
    '<a href="https://www.clickitstory.ae/support">help</a>'
  )
  assert.throws(
    () => fillHtml('<a href="__clk_url_link__">x</a>', { link: url('javascript:alert(1)') }, {}),
    /unsafe url/
  )
  assert.throws(
    () => fillText('__clk_url_link__', { link: url('http://evil.example') }, {}),
    /unsafe url/
  )
})

test('fillHtml escapes txt; fillText writes it unchanged; fillSubject strips CR/LF without escaping', () => {
  assert.equal(
    fillHtml('<p>__clk_txt_name__</p>', { name: txt(HOSTILE) }, {}),
    `<p>${escapeHtml(HOSTILE)}</p>`
  )
  assert.equal(fillText('From: __clk_txt_name__', { name: txt(HOSTILE) }, {}), `From: ${HOSTILE}`)
  assert.equal(
    fillSubject('[Clickit support] __clk_txt_subject__', { subject: txt('Hi & "bye"\r\nBcc: x') }),
    '[Clickit support] Hi & "bye"Bcc: x'
  )
})

test('a missing slot throws before anything is filled; extra values are ignored', () => {
  assert.throws(
    () => fillHtml('__clk_txt_a__ __clk_txt_b__', { a: txt('x') }, {}),
    /missing slot b/
  )
  assert.throws(() => fillText('__clk_txt_b__', {}, {}), /missing slot b/)
  assert.throws(() => fillSubject('__clk_txt_subject__', {}), /missing slot subject/)
  assert.throws(() => fillHtml('__clk_blk_shows__', {}, {}), /missing slot shows/)
  assert.equal(fillHtml('<p>__clk_txt_a__</p>', { a: txt('x'), zzz: txt('y') }, {}), '<p>x</p>')
})

test('a value of the wrong type for its slot throws', () => {
  assert.throws(
    () => fillHtml('__clk_url_a__', { a: txt('https://x.example') }, {}),
    /slot type mismatch a/
  )
})

test('condition 1: sentinel text in values is inert', () => {
  const tpl = '<p>__clk_txt_name__</p><p>__clk_txt_message__</p>'
  const values: SlotValues = {
    name: txt('__clk_txt_name__'),
    message: txt('x __clk_blk_shows__ __clk_pre_preheader__ y'),
  }
  const html = fillHtml(tpl, values, {})
  assert.equal(html, '<p>__clk_txt_name__</p><p>x __clk_blk_shows__ __clk_pre_preheader__ y</p>')
  assert.equal(count(html, '__clk_txt_name__'), 1)
  assert.equal(count(html, '__clk_blk_shows__'), 1)
  assert.equal(count(html, '__clk_pre_preheader__'), 1)
  const text = fillText('__clk_txt_name__ / __clk_txt_message__', values, {})
  assert.equal(text, '__clk_txt_name__ / x __clk_blk_shows__ __clk_pre_preheader__ y')
  assert.equal(fillSubject('S: __clk_txt_name__', values), 'S: __clk_txt_name__')

  // a row title that looks like a url sentinel is written once, never resolved
  const rows = {
    show: { html: '<b>__clk_txt_title__</b><img src="__clk_url_logo__">', text: '__clk_txt_title__' },
  }
  const block = renderRows(
    (r) => rows[r as 'show'],
    [{ row: 'show', values: { title: txt('__clk_url_logo__'), logo: url('https://x.example/l.png') } }]
  )
  assert.equal(block.html, '<b>__clk_url_logo__</b><img src="https://x.example/l.png">')
  const outer = fillHtml(
    '<img src="__clk_url_logo__">__clk_blk_shows__',
    { logo: url(LOGO_URL) },
    { shows: block }
  )
  assert.equal(count(outer, '__clk_url_logo__'), 1)
  assert.equal(count(outer, LOGO_URL), 1)
})

// ---------------------------------------------------------------------------
// TrustedBlock / renderRows
// ---------------------------------------------------------------------------

test('a blk slot takes only a TrustedBlock from renderRows', () => {
  assert.throws(
    () => fillHtml('__clk_blk_shows__', {}, { shows: escapeHtml('<b>x</b>') as unknown as TrustedBlock }),
    /trusted block required/
  )
  assert.throws(
    () => fillHtml('__clk_blk_shows__', {}, { shows: Object.create(TrustedBlock.prototype) }),
    /trusted block required/
  )
  const Ctor = TrustedBlock as unknown as new (k: symbol, html: string, text: string) => TrustedBlock
  assert.throws(() => new Ctor(Symbol('trusted'), '<b>x</b>', 'x'), /trusted block required/)
  const ok = renderRows(() => ({ html: '<i>__clk_txt_t__</i>', text: '__clk_txt_t__' }), [
    { row: 'r', values: { t: txt('a') } },
  ])
  assert.ok(ok instanceof TrustedBlock)
  assert.equal(fillHtml('<div>__clk_blk_shows__</div>', {}, { shows: ok }), '<div><i>a</i></div>')
  assert.equal(fillText('__clk_blk_shows__', {}, { shows: ok }), 'a')
})

test('renderRows picks the row template per item, nests episode blocks, joins html with nothing and text with a blank line', () => {
  const rows = {
    show: {
      html: '<table><img src="__clk_url_image__" alt="__clk_txt_title__"><b>__clk_txt_title__</b><div>__clk_blk_episodes__</div></table>',
      text: '__clk_txt_title__\n\n__clk_blk_episodes__',
    },
    shownoimage: {
      html: '<table><b>__clk_txt_title__</b><div>__clk_blk_episodes__</div></table>',
      text: '__clk_txt_title__\n\n__clk_blk_episodes__',
    },
    episode: { html: '<p>__clk_txt_line__ <a href="__clk_url_watch__">W</a></p>', text: '__clk_txt_line__ W __clk_url_watch__' },
  }
  const pick = (r: string) => rows[r as keyof typeof rows]
  const eps = (n: number) =>
    renderRows(
      pick,
      Array.from({ length: n }, (_, i) => ({
        row: 'episode',
        values: { line: txt(`S1 E${i + 1} - t`), watch: url(`https://x.example/w/${i + 1}`) },
      }))
    )
  const block = renderRows(pick, [
    {
      row: 'show',
      values: { title: txt('<img src=x onerror=alert(1)>'), image: url('https://x.example/i.jpg') },
      blocks: { episodes: eps(2) },
    },
    { row: 'shownoimage', values: { title: txt('B') }, blocks: { episodes: eps(1) } },
  ])
  assert.equal(
    block.html,
    '<table><img src="https://x.example/i.jpg" alt="&lt;img src=x onerror=alert(1)&gt;"><b>&lt;img src=x onerror=alert(1)&gt;</b><div><p>S1 E1 - t <a href="https://x.example/w/1">W</a></p><p>S1 E2 - t <a href="https://x.example/w/2">W</a></p></div></table>' +
      '<table><b>B</b><div><p>S1 E1 - t <a href="https://x.example/w/1">W</a></p></div></table>'
  )
  assert.equal(
    block.text,
    '<img src=x onerror=alert(1)>\n\nS1 E1 - t W https://x.example/w/1\n\nS1 E2 - t W https://x.example/w/2\n\nB\n\nS1 E1 - t W https://x.example/w/1'
  )
  assert.ok(!block.html.includes('<img src=x'))
})

// ---------------------------------------------------------------------------
// pre (hidden preheader) slot
// ---------------------------------------------------------------------------

function reactPreviewInner(v: string): string {
  const out = renderToStaticMarkup(h(Preview, { useTitleTag: false, children: v }))
  // strip the outer hidden <div ...> and its closing tag; the slot holds the inside
  return out.slice(out.indexOf('>') + 1, out.length - '</div>'.length)
}

test('a pre slot reproduces react-email Preview: escaped text cut at 200 plus the padding div', () => {
  assert.equal(PREVIEW_MAX, 200)
  assert.equal(PREVIEW_PAD.length, 7)
  const short = 'New "msg" from <Zoë>' // 20 characters
  assert.equal(short.length, 20)
  assert.equal(fillHtml('__clk_pre_p__', { p: pre(short) }, {}), reactPreviewInner(short))
  const long = `${'a&'.repeat(105)}` // 210 characters
  assert.equal(long.length, 210)
  assert.equal(fillHtml('__clk_pre_p__', { p: pre(long) }, {}), reactPreviewInner(long))
  assert.ok(!fillHtml('__clk_pre_p__', { p: pre(long) }, {}).includes('<div>'))
  assert.throws(() => fillText('__clk_pre_p__', { p: pre('x') }, {}), /pre slot/)
})

test('the Preview padding is written with \\u escapes in the source, not as invisible characters', () => {
  const src = readFileSync(new URL('../../src/emails/app/template-fill.ts', import.meta.url), 'utf8')
  assert.ok(!/[\u200B-\u200F\uFEFF\u00A0]/.test(src))
  assert.ok(src.includes('react-email 6.11.0'))
})

// ---------------------------------------------------------------------------
// buildAppEmailModel
// ---------------------------------------------------------------------------

const STRINGS = { episodeLine: 'S{season} E{episode} - {title}', e9Preheader: 'New message from {name}.' }
const STRINGS_AR = { episodeLine: 'الموسم {season} الحلقة {episode} - {title}', e9Preheader: 'رسالة جديدة من {name}.' }

function ctx(origin = 'https://www.clickitstory.ae/'): AppEmailCtx & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    siteOrigin: origin,
    links: {
      async unsubscribe(userId: string) {
        calls.push(`unsub:${userId}`)
        return `https://www.clickitstory.ae/en/unsubscribe?t=tok-${userId}`
      },
      async newsletterConfirm(id: string) {
        calls.push(`confirm:${id}`)
        return `https://www.clickitstory.ae/en/newsletter/confirm?t=tok-${id}`
      },
    },
  }
}

function ep(id: string, s = 1, e = 1, title = `Ep ${id}`, title_ar: string | null = null) {
  return { id, season_number: s, episode_number: e, title, title_ar }
}

function show(n: number, extra: Record<string, unknown> = {}) {
  return {
    title: `Show ${n}`,
    title_ar: `برنامج ${n}`,
    slug: `show-${n}`,
    image_url: `https://media.clickitstory.ae/shows/${n}.jpg`,
    episodes: [ep(`e${n}a`, 1, 1), ep(`e${n}b`, 1, 2), ep(`e${n}c`, 2, 1), ep(`e${n}d`, 2, 2)],
    ...extra,
  }
}

function row(kind: string, payload: unknown, extra: Partial<AppEmailRow> = {}): AppEmailRow {
  return { kind, locale: 'en', payload, idempotency_key: `k-${kind}`, to_user: 'user-1', ...extra }
}

const ADMIN = { message_id: 'msg-1', name: 'Zoë', email: 'zoe@b.example', subject: 'Hello', message: 'Hi there, a question.' }

test('model: unknown kind and bad payloads throw; the kinds list is fixed', async () => {
  assert.deepEqual([...APP_EMAIL_KINDS], ['welcome', 'digest', 'support_ack', 'support_admin', 'newsletter_confirm'])
  await assert.rejects(buildAppEmailModel(row('promo', {}), ctx(), STRINGS), /unknown email kind/)
  await assert.rejects(buildAppEmailModel(row('welcome', null), ctx(), STRINGS), /bad payload welcome/)
  for (const field of ['message_id', 'name', 'email', 'subject', 'message']) {
    await assert.rejects(
      buildAppEmailModel(row('support_admin', { ...ADMIN, [field]: '   ' }), ctx(), STRINGS),
      /bad payload support_admin/,
      field
    )
    const missing: Record<string, unknown> = { ...ADMIN }
    delete missing[field]
    await assert.rejects(buildAppEmailModel(row('support_admin', missing), ctx(), STRINGS), /bad payload support_admin/)
  }
  await assert.rejects(buildAppEmailModel(row('newsletter_confirm', { subscriber_id: ' ' }), ctx(), STRINGS), /bad payload newsletter_confirm/)
  await assert.rejects(buildAppEmailModel(row('digest', { shows: [], total_shows: 0 }), ctx(), STRINGS), /bad payload digest/)
  await assert.rejects(buildAppEmailModel(row('digest', { shows: [show(1, { title: ' ' })] }), ctx(), STRINGS), /bad payload digest/)
  await assert.rejects(
    buildAppEmailModel(row('digest', { shows: [show(1, { episodes: [ep(' ')] })] }), ctx(), STRINGS),
    /bad payload digest/
  )
  await assert.rejects(
    buildAppEmailModel(row('digest', { shows: [show(1, { episodes: [ep('x', 1.5, 1)] })] }), ctx(), STRINGS),
    /bad payload digest/
  )
  await assert.rejects(
    buildAppEmailModel(row('digest', { shows: [show(1, { episodes: [{ ...ep('x'), episode_number: '2' }] })] }), ctx(), STRINGS),
    /bad payload digest/
  )
})

test('model: locale other than ar becomes en; origin loses trailing slashes and must be safe', async () => {
  for (const locale of ['fr', '', null, 'AR']) {
    const m = await buildAppEmailModel(row('welcome', {}, { locale: locale as string }), ctx(), STRINGS)
    assert.equal(m.locale, 'en')
  }
  const ar = await buildAppEmailModel(row('welcome', {}, { locale: 'ar' }), ctx('https://www.clickitstory.ae///'), STRINGS_AR)
  assert.equal(ar.locale, 'ar')
  assert.deepEqual(ar.values.origin, url('https://www.clickitstory.ae'))
  assert.deepEqual(ar.values.browse, url('https://www.clickitstory.ae/ar/browse'))
  assert.deepEqual(ar.values.logo, url(LOGO_URL))
  const local = await buildAppEmailModel(row('welcome', {}), ctx('http://localhost:3000'), STRINGS)
  assert.deepEqual(local.values.logo, url('http://localhost:3000/brand/email-logo-white.png'))
  await assert.rejects(buildAppEmailModel(row('welcome', {}), ctx('javascript:alert(1)'), STRINGS), /unsafe url/)
  await assert.rejects(buildAppEmailModel(row('welcome', {}), ctx('http://evil.example'), STRINGS), /unsafe url/)
})

test('model: digest keeps 3 shows x 3 episodes, picks AR titles, builds links, variant and thumbnails', async () => {
  const c = ctx()
  const payload = {
    shows: [
      show(1, { title_ar: '  ' }),
      show(2, { image_url: null }),
      show(3, { image_url: '/relative.jpg' }),
      show(4),
      show(5),
    ],
    total_shows: 5,
  }
  const m = await buildAppEmailModel(row('digest', payload, { locale: 'ar', to_user: 'u-9' }), c, STRINGS_AR)
  assert.equal(m.variant, 'more')
  assert.equal(m.shows?.length, 3)
  assert.deepEqual(c.calls, ['unsub:u-9'])
  assert.deepEqual(m.values.unsubscribe, url('https://www.clickitstory.ae/en/unsubscribe?t=tok-u-9'))
  assert.deepEqual(m.values.profile, url('https://www.clickitstory.ae/ar/profile'))
  assert.deepEqual(m.values.seeall, url('https://www.clickitstory.ae/ar/my-list'))
  const [s1, s2, s3] = m.shows!
  assert.deepEqual(s1.values.title, txt('Show 1'), 'empty title_ar falls back to title')
  assert.deepEqual(s2.values.title, txt('برنامج 2'))
  assert.equal(s1.row, 'show')
  assert.deepEqual(s1.values.image, url('https://media.clickitstory.ae/shows/1.jpg'))
  assert.equal(s2.row, 'shownoimage')
  assert.equal(s2.values.image, undefined)
  assert.equal(s3.row, 'shownoimage')
  assert.equal(s1.episodes.length, 3)
  assert.deepEqual(s1.episodes[0].values.line, txt('الموسم 1 الحلقة 1 - Ep e1a'))
  assert.deepEqual(s1.episodes[2].values.watch, url('https://www.clickitstory.ae/ar/watch/e1c'))

  for (const bad of [null, '', '/x.jpg', 'http://evil.example/x.jpg', 'javascript:alert(1)', 42]) {
    const one = await buildAppEmailModel(row('digest', { shows: [show(1, { image_url: bad })], total_shows: 1 }), ctx(), STRINGS)
    assert.equal(one.shows![0].row, 'shownoimage', String(bad))
    assert.equal(one.variant, 'base')
  }
  const four = await buildAppEmailModel(row('digest', { shows: [show(1), show(2), show(3), show(4)] }), ctx(), STRINGS)
  assert.equal(four.variant, 'more', 'more than 3 shows given')
  const total = await buildAppEmailModel(row('digest', { shows: [show(1)], total_shows: 4 }), ctx(), STRINGS)
  assert.equal(total.variant, 'more', 'total_shows > 3')
  assert.equal(total.values.seeall?.value, 'https://www.clickitstory.ae/en/my-list')
  const en = await buildAppEmailModel(row('digest', { shows: [show(1)], total_shows: 1 }), ctx(), STRINGS)
  assert.deepEqual(en.shows![0].episodes[0].values.line, txt('S1 E1 - Ep e1a'))
  assert.equal(en.values.seeall, undefined)

  await assert.rejects(
    buildAppEmailModel(row('digest', { shows: [show(1)] }, { to_user: null }), ctx(), STRINGS),
    /digest needs to_user/
  )
})

test('model: support_admin, newsletter_confirm and welcome values', async () => {
  const admin = await buildAppEmailModel(
    row('support_admin', { ...ADMIN, name: '{name} Zoë', email: 'zoe@b.example\r\nBcc: x', subject: `Hi\r\n${'s'.repeat(150)}` }),
    ctx(),
    STRINGS
  )
  assert.equal(admin.replyTo, 'zoe@b.exampleBcc: x')
  assert.equal(admin.values.subject.value, `Hi${'s'.repeat(98)}`)
  assert.equal(admin.values.subject.value.length, 100)
  assert.deepEqual(admin.values.preheader, pre('New message from {name} Zoë.'))
  assert.deepEqual(admin.values.admin, url('https://www.clickitstory.ae/en/admin/inbox/msg-1'))
  assert.deepEqual(admin.values.name, txt('{name} Zoë'))
  assert.deepEqual(admin.values.message, txt('Hi there, a question.'))

  const c = ctx()
  const nl = await buildAppEmailModel(row('newsletter_confirm', { subscriber_id: 'sub-1' }), c, STRINGS)
  assert.deepEqual(nl.values.confirm, url('https://www.clickitstory.ae/en/newsletter/confirm?t=tok-sub-1'))
  assert.deepEqual(c.calls, ['confirm:sub-1'])

  const ack = await buildAppEmailModel(row('support_ack', {}), ctx(), STRINGS)
  assert.deepEqual(Object.keys(ack.values).sort(), ['logo', 'origin'])
  assert.equal(ack.replyTo, undefined)

  assert.equal(stripCrlf('a\r\nb\nc\rd'), 'abcd')
})

test('SUPPORT_REPLY_HOURS is 48 and email-constants.ts has no imports', () => {
  assert.equal(SUPPORT_REPLY_HOURS, 48)
  const src = readFileSync(new URL('../../src/lib/email-constants.ts', import.meta.url), 'utf8')
  assert.ok(!/^\s*import\b/m.test(src))
  assert.ok(!/\bfrom\s+['"]/.test(src))
})

// ---------------------------------------------------------------------------
// End to end through the Worker fill path (Task 3)
// ---------------------------------------------------------------------------

const E2E_CTX: AppEmailCtx = {
  siteOrigin: 'https://www.clickitstory.ae',
  links: {
    unsubscribe: async () => 'https://www.clickitstory.ae/en/unsubscribe?t=a.b',
    newsletterConfirm: async () => 'https://www.clickitstory.ae/en/newsletter/confirm?t=a.b',
  },
}

/** Splits the html at the end of the hidden preheader div (react-email Preview). */
function splitPreheader(html: string): { inner: string; visible: string } {
  const open = 'data-skip-in-text="true">'
  const start = html.indexOf(open)
  assert.ok(start > 0, 'hidden preheader div')
  const from = start + open.length
  const end = html.indexOf('</div></div>', from)
  assert.ok(end > from, 'padding div closes the preheader')
  return { inner: html.slice(from, end + '</div>'.length), visible: html.slice(end + '</div></div>'.length) }
}

test('condition 1: hostile support_admin name', async () => {
  const { renderAppEmail } = await import('../../src/emails/render-app.ts')
  const { en: EN, fill } = await import('../../src/emails/messages/en.ts')
  const { ar: AR } = await import('../../src/emails/messages/ar.ts')
  const escapedName = escapeHtml(HOSTILE)
  for (const locale of ['en', 'ar'] as const) {
    const out = await renderAppEmail(
      {
        kind: 'support_admin',
        locale,
        payload: { message_id: 'm-1', name: HOSTILE, email: 'a@b.example', subject: 'Hi & "bye"', message: 'Hello' },
        idempotency_key: 'k',
        to_user: null,
      },
      E2E_CTX
    )
    const html = out.html
    for (const piece of ['&lt;script&gt;', '&quot;Q&quot;', 'O&#x27;Neil', ' &amp; ', 'نور']) {
      assert.ok(html.includes(piece), `${locale}: ${piece}`)
    }
    assert.ok(!html.toLowerCase().includes('<script'), `${locale}: no <script`)

    const { inner, visible } = splitPreheader(html)
    const names = count(visible, escapedName)
    assert.ok(names >= 2, `${locale}: From row and reply hint (${names})`)
    assert.equal(count(visible, `<bdi>${escapedName}</bdi>`), names, `${locale}: every visible name in <bdi>`)

    const m = locale === 'ar' ? AR : EN
    const preText = fill(m.e9.preheader, { name: HOSTILE })
    assert.equal(
      inner,
      `${escapeHtml(preText)}<div>${PREVIEW_PAD.repeat(PREVIEW_MAX - preText.length)}</div>`,
      `${locale}: preheader is escaped plain text plus the padding div`
    )
    assert.ok(!/<(?!\/?div>)/.test(inner), `${locale}: no tag inside the preheader but the padding div`)

    if (locale === 'ar') {
      assert.match(html, /<html[^>]*lang="ar"[^>]*dir="rtl"/)
      assert.match(html, /<table[^>]*lang="ar"[^>]*dir="rtl"/)
    }
    assert.ok(out.text.includes(HOSTILE), `${locale}: text has the name as given`)
    for (const entity of ['&amp;', '&lt;', '&quot;']) {
      assert.ok(!out.text.includes(entity), `${locale}: text has no ${entity}`)
    }
  }
})

test('condition 1: sentinel text in values is inert end to end', async () => {
  const { renderAppEmail } = await import('../../src/emails/render-app.ts')
  const { renderAppEmailDirect } = await import('../../src/emails/app/direct.ts')
  const adminRow: AppEmailRow = {
    kind: 'support_admin',
    locale: 'en',
    payload: {
      message_id: 'm-1',
      name: '__clk_txt_name__',
      email: 'a@b.example',
      subject: 'Subject',
      message: '__clk_blk_shows__ __clk_pre_preheader__',
    },
    idempotency_key: 'k',
    to_user: null,
  }
  const digestRow: AppEmailRow = {
    kind: 'digest',
    locale: 'en',
    payload: {
      shows: [
        {
          title: '__clk_url_logo__',
          title_ar: null,
          slug: 's',
          image_url: 'https://media.clickitstory.ae/shows/1.jpg',
          episodes: [{ id: 'e1', season_number: 1, episode_number: 1, title: 'Pilot', title_ar: null }],
        },
      ],
      total_shows: 1,
    },
    idempotency_key: 'k2',
    to_user: 'u-1',
  }
  for (const r of [adminRow, digestRow]) {
    const fillOut = await renderAppEmail(r, E2E_CTX)
    const direct = await renderAppEmailDirect(r, E2E_CTX)
    for (const s of ['__clk_txt_name__', '__clk_blk_shows__', '__clk_pre_preheader__', '__clk_url_logo__']) {
      assert.equal(count(fillOut.html, s), count(direct.html, s), `${r.kind} html ${s}`)
      assert.equal(count(fillOut.text, s), count(direct.text, s), `${r.kind} text ${s}`)
    }
  }
  const admin = await renderAppEmail(adminRow, E2E_CTX)
  assert.ok(count(admin.html, '__clk_txt_name__') >= 3, 'preheader, From row, reply hint')
  assert.ok(admin.html.includes('__clk_blk_shows__ __clk_pre_preheader__'))
  assert.ok(admin.text.includes('__clk_blk_shows__ __clk_pre_preheader__'))
  const digest = await renderAppEmail(digestRow, E2E_CTX)
  assert.ok(digest.html.includes('<bdi>__clk_url_logo__</bdi>'))
  assert.ok(digest.text.includes('__clk_url_logo__'))
  assert.equal(count(digest.html, LOGO_URL), 1, 'the logo URL appears once')
  assert.equal(count(digest.html, `<img src="${LOGO_URL}"`), 1, 'and only in the logo src')
})
