// The five app emails through the Worker fill path, renderAppEmail (Phase 5, plan 05-11,
// Task 3; MAIL-03..06, D-27, D-31, D-35, D-39). The direct React path is compared in
// app-email-parity.test.ts.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FOOTER_LINE_1, LOGO_URL, POSTAL_LINE, logoUrlFor } from '../../src/emails/brand.ts'
import { SUPPORT_REPLY_HOURS as FROM_CONSTANTS } from '../../src/lib/email-constants.ts'
import {
  APP_EMAIL_KINDS,
  SUPPORT_REPLY_HOURS,
  renderAppEmail,
} from '../../src/emails/render-app.ts'
import type { AppEmailCtx, AppEmailRow } from '../../src/emails/app/model.ts'
import { assertSignedScheme } from './helpers/email-scheme.ts'

const ORIGIN = 'https://www.clickitstory.ae'
const UNSUB = 'https://www.clickitstory.ae/en/unsubscribe?t=unsub-token.sig'
const CONFIRM = 'https://www.clickitstory.ae/en/newsletter/confirm?t=confirm-token.sig'

function ctx(siteOrigin = ORIGIN): AppEmailCtx {
  return {
    siteOrigin,
    links: {
      unsubscribe: async () => UNSUB,
      newsletterConfirm: async () => CONFIRM,
    },
  }
}

function ep(id: string, s: number, e: number, title: string, title_ar: string | null = null) {
  return { id, season_number: s, episode_number: e, title, title_ar }
}

function show(n: number, extra: Record<string, unknown> = {}) {
  return {
    title: `Show ${n}`,
    title_ar: `برنامج ${n}`,
    slug: `show-${n}`,
    image_url: `https://media.clickitstory.ae/shows/${n}.jpg`,
    episodes: [ep(`ep-${n}-1`, 1, 1, `Pilot ${n}`, `الحلقة الأولى ${n}`), ep(`ep-${n}-2`, 1, 2, `Second ${n}`)],
    ...extra,
  }
}

const ADMIN = {
  message_id: '7a0c3b52-1111-4c2a-9a55-0d6f3f0e0001',
  name: 'Sara Ali',
  email: 'sara@visitor.example',
  subject: 'Question about Season 2',
  message: 'Hello,\nwhen does season 2 start?',
}

const PAYLOADS: Record<string, unknown> = {
  welcome: {},
  digest: { shows: [show(1), show(2)], total_shows: 2 },
  support_ack: {},
  support_admin: ADMIN,
  newsletter_confirm: { subscriber_id: 'sub-1' },
}

function row(kind: string, locale: string, payload: unknown = PAYLOADS[kind], extra: Partial<AppEmailRow> = {}): AppEmailRow {
  return { kind, locale, payload, idempotency_key: `${kind}:${locale}`, to_user: 'user-1', ...extra }
}

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1
}

const LOCALES = ['en', 'ar'] as const

test('render-app re-exports the kinds and SUPPORT_REPLY_HOURS from email-constants', () => {
  assert.deepEqual([...APP_EMAIL_KINDS], ['welcome', 'digest', 'support_ack', 'support_admin', 'newsletter_confirm'])
  assert.equal(SUPPORT_REPLY_HOURS, FROM_CONSTANTS)
  assert.equal(SUPPORT_REPLY_HOURS, 48)
})

test('every kind x locale renders subject, html and text; AR is rtl; text has no tags', async () => {
  for (const kind of APP_EMAIL_KINDS) {
    for (const locale of LOCALES) {
      const out = await renderAppEmail(row(kind, locale), ctx())
      assert.ok(out.subject.length > 0, `${kind} ${locale} subject`)
      assert.ok(out.html.length > 0 && out.text.length > 0, `${kind} ${locale} body`)
      assert.ok(!/<[a-z/][^>]*>/i.test(out.text), `${kind} ${locale}: text has no tags`)
      assert.ok(!out.html.includes('__clk_') && !out.text.includes('__clk_') && !out.subject.includes('__clk_'))
      if (locale === 'ar') {
        assert.match(out.html, /<html(?=[^>]*\slang="ar")(?=[^>]*\sdir="rtl")[^>]*>/)
        assert.match(out.html, /<table(?=[^>]*\slang="ar")(?=[^>]*\sdir="rtl")[^>]*>/)
      } else {
        assert.match(out.html, /<html(?=[^>]*\slang="en")(?=[^>]*\sdir="ltr")[^>]*>/)
      }
    }
  }
})

test('support_ack is static: no visitor text, and the 48-hour line', async () => {
  for (const locale of LOCALES) {
    const out = await renderAppEmail(row('support_ack', locale, { ...ADMIN }), ctx())
    for (const value of Object.values(ADMIN)) {
      for (const piece of value.split('\n')) {
        assert.ok(!out.html.includes(piece), `${locale}: html echoes ${piece}`)
        assert.ok(!out.text.includes(piece), `${locale}: text echoes ${piece}`)
      }
    }
    const phrase = locale === 'en' ? `within ${SUPPORT_REPLY_HOURS} hours` : `خلال ${SUPPORT_REPLY_HOURS} ساعة`
    assert.ok(out.html.includes(phrase) && out.text.includes(phrase), phrase)
    assert.equal(out.replyTo, undefined)
  }
})

test('support_admin escapes the visitor text, strips CR/LF from Reply-To and the subject, caps the subject', async () => {
  const subject = `Refund\r\nBcc: evil@x.example ${'z'.repeat(140)}`
  const out = await renderAppEmail(
    row('support_admin', 'en', {
      ...ADMIN,
      name: 'A<script>',
      email: 'sara@visitor.example\r\nBcc: evil@x.example',
      subject,
      message: 'x\r\nBcc: y',
    }),
    ctx()
  )
  assert.ok(!out.html.toLowerCase().includes('<script'))
  assert.ok(out.html.includes('A&lt;script&gt;'))
  assert.equal(out.replyTo, 'sara@visitor.exampleBcc: evil@x.example')
  assert.ok(!/[\r\n]/.test(out.replyTo ?? ''))
  const stripped = subject.replace(/[\r\n]/g, '')
  assert.equal(out.subject, `[Clickit support] ${stripped.slice(0, 100)}`)
  assert.ok(out.subject.length <= 118)
  assert.ok(!/[\r\n]/.test(out.subject))
  assert.ok(out.html.includes(`href="${ORIGIN}/en/admin/inbox/${ADMIN.message_id}"`))
})

test('digest with 5 shows: 3 rows, See all, episode, unsubscribe and Profile links, postal line', async () => {
  for (const locale of LOCALES) {
    const payload = { shows: [1, 2, 3, 4, 5].map((n) => show(n)), total_shows: 5 }
    const out = await renderAppEmail(row('digest', locale, payload), ctx())
    const titles = [1, 2, 3, 4, 5].map((n) => (locale === 'ar' ? `برنامج ${n}` : `Show ${n}`))
    for (const t of titles.slice(0, 3)) assert.equal(count(out.html, `<bdi>${t}</bdi>`), 1, t)
    for (const t of titles.slice(3)) assert.ok(!out.html.includes(t), t)
    assert.ok(out.html.includes(`href="${ORIGIN}/${locale}/my-list"`), 'See all link')
    const seeAll = locale === 'en' ? 'See all on Clickit Story' : 'شاهد الكل على Clickit Story'
    assert.ok(out.html.includes(seeAll) && out.text.includes(seeAll))
    for (const n of [1, 2, 3]) {
      assert.ok(out.html.includes(`href="${ORIGIN}/${locale}/watch/ep-${n}-1"`))
      assert.ok(out.text.includes(`${ORIGIN}/${locale}/watch/ep-${n}-2`))
    }
    assert.ok(out.html.includes(`href="${UNSUB}"`) && out.text.includes(UNSUB))
    assert.ok(out.html.includes(`href="${ORIGIN}/${locale}/profile"`))
    assert.ok(out.html.includes(POSTAL_LINE) && out.text.includes(POSTAL_LINE))
  }
})

test('digest with 2 shows has no See all; AR uses title_ar when present, else title', async () => {
  const base = await renderAppEmail(row('digest', 'en'), ctx())
  assert.ok(!base.html.includes('/en/my-list'))
  assert.ok(!base.html.includes('See all'))
  const payload = {
    shows: [show(1), show(2, { title_ar: null })],
    total_shows: 2,
  }
  const out = await renderAppEmail(row('digest', 'ar', payload), ctx())
  assert.ok(out.html.includes('<bdi>برنامج 1</bdi>'))
  assert.ok(out.html.includes('<bdi>Show 2</bdi>'), 'falls back to title')
  assert.ok(out.html.includes('<bdi>الموسم 1 الحلقة 1 - الحلقة الأولى 1</bdi>'))
  assert.ok(out.html.includes('<bdi>الموسم 1 الحلقة 2 - Second 1</bdi>'))
})

test('digest: unusable image_url values drop the thumbnail, never the show', async () => {
  const payload = {
    shows: [
      show(1, { image_url: null }),
      show(2, { image_url: '' }),
      show(3, { image_url: '/relative.jpg' }),
      show(4, { image_url: 'http://evil.example/x.jpg' }),
    ],
    total_shows: 4,
  }
  const out = await renderAppEmail(row('digest', 'en', payload), ctx())
  const imgs = [...out.html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0])
  assert.equal(imgs.length, 1, 'only the logo')
  assert.ok(imgs[0].includes(`src="${LOGO_URL}"`))
  for (const n of [1, 2, 3]) {
    assert.ok(out.html.includes(`<bdi>Show ${n}</bdi>`))
    assert.ok(out.html.includes(`/en/watch/ep-${n}-1`))
  }
  assert.ok(!out.html.includes('evil.example') && !out.html.includes('/relative.jpg'))

  const mixed = await renderAppEmail(
    row('digest', 'en', { shows: [show(1), show(2, { image_url: null })], total_shows: 2 }),
    ctx()
  )
  const thumbs = [...mixed.html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0])
  assert.equal(thumbs.length, 2)
  assert.ok(thumbs[1].includes('src="https://media.clickitstory.ae/shows/1.jpg"'))
  assert.ok(thumbs[1].includes('alt="Show 1"') && thumbs[1].includes('width="128"') && thumbs[1].includes('height="72"'))
})

test('newsletter_confirm: signed link, postal line, 7 days; welcome: button to Browse then the fallback line', async () => {
  for (const locale of LOCALES) {
    const nl = await renderAppEmail(row('newsletter_confirm', locale), ctx())
    assert.ok(nl.html.includes(`href="${CONFIRM}"`))
    assert.ok(nl.text.includes(CONFIRM))
    assert.ok(nl.html.includes(POSTAL_LINE))
    assert.ok(nl.html.includes(locale === 'en' ? '7 days' : '7 أيام'))

    const w = await renderAppEmail(row('welcome', locale), ctx())
    const browse = `${ORIGIN}/${locale}/browse`
    const label = locale === 'en' ? 'Start watching' : 'ابدأ المشاهدة'
    const btn = w.html.indexOf(`>${label}</a>`)
    assert.ok(btn > 0, 'button label')
    assert.ok(w.html.lastIndexOf(`href="${browse}"`, btn) > 0, 'button href')
    const fallback = w.html.indexOf(`>${browse}</a>`, btn)
    assert.ok(fallback > btn, 'fallback URL line after the button')
    assert.equal(count(w.text, browse), 1, 'URL alone once in text')
  }
})

test('unknown kind and an empty support_admin name throw', async () => {
  await assert.rejects(renderAppEmail(row('promo', 'en', {}), ctx()), /unknown email kind/)
  await assert.rejects(
    renderAppEmail(row('support_admin', 'en', { ...ADMIN, name: '   ' }), ctx()),
    /bad payload support_admin/
  )
})

test('signed scheme, logo, meta tags, footers and support link on every kind x locale', async () => {
  for (const origin of [ORIGIN, 'http://localhost:3000']) {
    for (const kind of APP_EMAIL_KINDS) {
      for (const locale of LOCALES) {
        const out = await renderAppEmail(row(kind, locale), ctx(origin))
        const html = out.html
        assertSignedScheme(html, {
          button: kind === 'welcome' || kind === 'support_admin' || kind === 'newsletter_confirm',
        })
        const logo = logoUrlFor(origin)
        assert.equal(logo, origin === ORIGIN ? LOGO_URL : `${origin}/brand/email-logo-white.png`)
        assert.ok(html.includes(`<img src="${logo}"`), `${kind} ${locale} logo`)
        assert.match(html, /<meta name="color-scheme" content="light dark"\/?>/)
        assert.match(html, /<meta name="supported-color-schemes" content="light dark"\/?>/)
        assert.ok(html.includes('@media (prefers-color-scheme: dark)'))
        assert.ok(!html.toLowerCase().includes('#777777'))
        assert.ok(html.includes(FOOTER_LINE_1) && out.text.includes(FOOTER_LINE_1))
        assert.ok(html.includes(`href="${origin}/support"`), `${kind} ${locale} support link`)
        if (kind === 'digest' || kind === 'newsletter_confirm') {
          assert.ok(html.includes(`>${POSTAL_LINE}</p>`), `${kind} ${locale} postal line`)
        } else {
          assert.ok(!html.includes(`>${POSTAL_LINE}</p>`), `${kind} ${locale} no postal line`)
        }
      }
    }
  }
})
