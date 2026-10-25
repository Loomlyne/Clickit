// Per-batch CPU harness of the pre-rendered email consumer path (Phase 5, plan 05-19,
// Task 3; controller condition 4 of the 05-11 revision). A measurement tool, not a test.
//
//   node --experimental-strip-types --disable-warning=ExperimentalWarning \
//     --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/email-batch-cpu.mjs <label>
//
// Runs the real processBatch with the real buildEmailDeps (claim/finish RPC requests,
// Resend mailer request, renderAppEmail fill with signed links, HMAC unsubscribe URL)
// against a canned fetch stub that answers only three known URLs and throws on any
// other, so nothing reaches the network. Only `log` is replaced (no-op). Fixed fake key
// strings; never reads .dev.vars or real secrets (T-05-19-05).
//
// Shape as 05-07 Task 3: 5 messages per batch (mixed EN/AR, digest included), one cold
// batch in a fresh process, then the mean of 50 warm batches. Every line starts with
// `run<label> `. Building the canned Response objects costs a little CPU that a real
// fetch also costs, and buildEmailDeps runs inside every timed batch (as in the Worker's
// queue()), so the figures are a slight upper bound. Node on the Mac is not Worker CPU;
// the live check is 05-36's consumer metrics.

import { loadavg } from 'node:os'
import { performance } from 'node:perf_hooks'

const label = process.argv[2] ?? 'X'
const say = (line) => console.log(`run${label} ${line}`)

const t0 = performance.now()
const { processBatch } = await import('../src/server/email/consumer.ts')
const { buildEmailDeps } = await import('../src/server/email/deps.ts')
say(`module_load_ms: ${(performance.now() - t0).toFixed(2)}`)

const SUPABASE = 'https://harness.supabase.co'
const CLAIM_URL = `${SUPABASE}/rest/v1/rpc/claim_outbox`
const FINISH_URL = `${SUPABASE}/rest/v1/rpc/finish_outbox`
const RESEND_URL = 'https://api.resend.com/emails'

const ENV = {
  CLICKIT_RUNTIME: 'workers',
  SUPABASE_URL: SUPABASE,
  SUPABASE_SERVICE_ROLE_KEY: 'harness-not-a-key',
  EMAIL_LINK_SECRET: 'harness-not-a-secret-0123456789abcdef',
  RESEND_API_KEY: 'harness-not-a-key',
  SITE_ORIGIN: 'https://www.clickitstory.ae',
  EMAIL_FROM: 'Clickit Story <no-reply@clickitstory.ae>',
}

// ---------------------------------------------------------------------------
// Fixtures (synthetic; same shape as 05-07 and the 05-11 fixtures)
// ---------------------------------------------------------------------------

const HOSTILE_NAME = `Zoë "Q" O'Neil & <script>alert(1)</script> نور`
let epSeq = 0
function ep(season, episode, title, titleAr) {
  epSeq += 1
  const n = String(epSeq).padStart(12, '0')
  return { id: `0b9d6c1e-0000-4a51-9b7e-${n}`, season_number: season, episode_number: episode, title, title_ar: titleAr }
}
// Five shows: the first three are shown (3 rows x 3 episodes), the second has no
// image_url, and total_shows 5 gives the "See all" variant.
const SHOWS = [
  {
    title: 'Desert Kitchens',
    title_ar: 'مطابخ الصحراء',
    slug: 'desert-kitchens',
    image_url: 'https://media.clickitstory.ae/shows/desert-kitchens/card.jpg',
    episodes: [ep(2, 4, 'Saffron & smoke', 'الزعفران والدخان'), ep(2, 5, 'The bread of Liwa', null), ep(2, 6, 'Night market', 'سوق الليل')],
  },
  {
    title: 'Pearl Divers',
    title_ar: 'غواصو اللؤلؤ',
    slug: 'pearl-divers',
    image_url: null,
    episodes: [ep(1, 3, 'Into the blue', 'نحو الأزرق'), ep(1, 4, 'Salt and rope', 'الملح والحبل'), ep(1, 5, 'Homecoming', 'العودة')],
  },
  {
    title: 'Street Football Abu Dhabi',
    title_ar: 'كرة الشارع أبوظبي',
    slug: 'street-football',
    image_url: 'https://media.clickitstory.ae/shows/street-football/card.jpg',
    episodes: [ep(1, 1, 'Kick-off', 'ضربة البداية'), ep(1, 2, 'Second half', 'الشوط الثاني'), ep(1, 3, 'Penalties', 'ركلات الترجيح')],
  },
  {
    title: 'Falcon Season',
    title_ar: 'موسم الصقور',
    slug: 'falcon-season',
    image_url: 'https://media.clickitstory.ae/shows/falcon-season/card.jpg',
    episodes: [ep(3, 1, 'First flight', 'التحليق الأول')],
  },
  {
    title: 'Old Town Stories',
    title_ar: 'حكايات المدينة القديمة',
    slug: 'old-town-stories',
    image_url: 'https://media.clickitstory.ae/shows/old-town-stories/card.jpg',
    episodes: [ep(1, 9, 'The last door', 'الباب الأخير')],
  },
]

const FIXTURES = [
  { kind: 'digest', locale: 'en', payload: { shows: SHOWS, total_shows: 5 } },
  { kind: 'digest', locale: 'ar', payload: { shows: SHOWS, total_shows: 5 } },
  {
    kind: 'support_admin',
    locale: 'ar',
    reply_to: 'zoe.oneil@visitor.example',
    payload: {
      message_id: '9c2b7d10-5555-4e3e-a1a1-000000000001',
      name: HOSTILE_NAME,
      email: 'zoe.oneil@visitor.example',
      subject: 'Can\'t play S2 E4 & "Night market"',
      message: 'Hi team,\r\nthe episode stops after 2 minutes.\n\n<b>Thanks</b> & regards\n  — Zoë',
    },
  },
  { kind: 'welcome', locale: 'en', payload: {} },
  { kind: 'newsletter_confirm', locale: 'ar', payload: { subscriber_id: '3e4f5a6b-7777-4c4c-9e9e-000000000001' } },
]

// ---------------------------------------------------------------------------
// Canned fetch stub
// ---------------------------------------------------------------------------

const rowsById = new Map()
let resendCalls = 0
const json = (value, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })

async function fetchStub(url, init) {
  const target = String(url)
  if (init?.method === 'POST' && target === CLAIM_URL) {
    const { p_ids: ids } = JSON.parse(init.body)
    const nowIso = new Date().toISOString()
    return json(
      ids.map((id) => ({ ...rowsById.get(id), attempts: 1, first_attempt_at: nowIso })),
    )
  }
  if (init?.method === 'POST' && target === FINISH_URL) return json(null)
  if (init?.method === 'POST' && target === RESEND_URL) {
    resendCalls += 1
    return json({ id: `harness-${resendCalls}` })
  }
  throw new Error(`unexpected fetch ${target}`)
}

function makeBatch() {
  let acked = 0
  let retried = 0
  const messages = FIXTURES.map((f, i) => {
    const id = crypto.randomUUID()
    rowsById.set(id, {
      id,
      kind: f.kind,
      idempotency_key: `${f.kind}:harness:${id}`,
      to_address: `viewer${i}@harness.example`,
      reply_to: f.reply_to ?? null,
      locale: f.locale,
      payload: f.payload,
      to_user: `5f1e2d3c-0000-4b4b-8c8c-00000000000${i}`,
    })
    return {
      body: { outboxId: id },
      attempts: 1,
      ack() {
        acked += 1
      },
      retry() {
        retried += 1
      },
    }
  })
  return { batch: { messages }, counts: () => ({ acked, retried }) }
}

const noop = () => {}

async function runBatch() {
  const { batch, counts } = makeBatch()
  const before = resendCalls
  const start = performance.now()
  await processBatch(batch, { ...buildEmailDeps(ENV, fetchStub), log: noop })
  const ms = performance.now() - start
  const sends = resendCalls - before
  const { acked, retried } = counts()
  for (const m of batch.messages) rowsById.delete(m.body.outboxId)
  if (sends !== 5 || acked !== 5 || retried !== 0) {
    say(`error: sends=${sends} acked=${acked} retried=${retried}`)
    process.exit(1)
  }
  return ms
}

const cold = await runBatch()
say(`batch_fill_ms_cold: ${cold.toFixed(2)}`)

const WARM = 50
let total = 0
for (let i = 0; i < WARM; i++) total += await runBatch()
say(`batch_fill_ms_mean: ${(total / WARM).toFixed(2)}`)
say(`loadavg: ${loadavg()[0].toFixed(2)}`)
