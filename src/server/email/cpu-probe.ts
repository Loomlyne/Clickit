// Email consumer CPU probe (Phase 5, plan 05-19, controller condition 2). Test-only and
// off by default. It lets the controller measure one real queue() batch on workers.dev
// (wrangler tail cpuTime) before cutover without the live outbox, the live database or
// a real send:
//   - only messages tagged { probe: PROBE_TAG } are taken; every other message goes on to
//     the real consumer untouched
//   - with the flag off (the default; EMAIL_CPU_PROBE unset or anything but a valid
//     `until:<UTC time>` at most 24 h ahead) probe messages are acked and dropped
//   - with the flag on they run through the real processBatch and buildEmailDeps, but on
//     fixed fake env values and a canned in-process fetch: claim, finish and the Resend
//     call are answered here, nothing leaves the Worker (0 subrequests), no real secret is
//     read and no email is sent
// The Node harness (scripts/email-batch-cpu.mjs) uses the same fixtures and stub, so the
// Mac figure and the Worker figure measure the same batch.
// Pure: relative imports only, no server-only, no "@/" alias.

import { processBatch } from './consumer.ts'
import type { ClaimedRow, MessageLike } from './consumer.ts'
import { buildEmailDeps } from './deps.ts'
import type { EmailDepsEnv } from './deps.ts'

export const PROBE_TAG = 'email-cpu-v1'
export const PROBE_FLAG = 'EMAIL_CPU_PROBE'
export const PROBE_MAX_WINDOW_MS = 24 * 60 * 60 * 1000
const LOG_PREFIX = '[email/cpu-probe]'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const RUN_RE = /^[A-Za-z0-9-]{1,40}$/

const PROBE_SUPABASE = 'https://email-cpu-probe.invalid'
export const PROBE_CLAIM_URL = `${PROBE_SUPABASE}/rest/v1/rpc/claim_outbox`
export const PROBE_FINISH_URL = `${PROBE_SUPABASE}/rest/v1/rpc/finish_outbox`
export const PROBE_RESEND_URL = 'https://api.resend.com/emails'

/** Fixed fake values; the probe never reads the Worker's own secrets or vars. */
export const PROBE_ENV: EmailDepsEnv = {
  CLICKIT_RUNTIME: 'workers',
  SUPABASE_URL: PROBE_SUPABASE,
  SUPABASE_SERVICE_ROLE_KEY: 'probe-not-a-key',
  EMAIL_LINK_SECRET: 'probe-not-a-secret-0123456789abcdef',
  RESEND_API_KEY: 'probe-not-a-key',
  SITE_ORIGIN: 'https://www.clickitstory.ae',
  EMAIL_FROM: 'Clickit Story <no-reply@clickitstory.ae>',
}

// ---------------------------------------------------------------------------
// Fixtures (synthetic, same shape as 05-07 Task 3): digest EN with 5 shows (the
// first three shown, 3 x 3 episodes, the second without image_url, See all),
// digest AR, support_admin AR with the hostile name, welcome EN, newsletter_confirm AR.
// ---------------------------------------------------------------------------

const HOSTILE_NAME = `Zoë "Q" O'Neil & <script>alert(1)</script> نور`

function ep(n: number, season: number, episode: number, title: string, titleAr: string | null) {
  return {
    id: `0b9d6c1e-0000-4a51-9b7e-${String(n).padStart(12, '0')}`,
    season_number: season,
    episode_number: episode,
    title,
    title_ar: titleAr,
  }
}

const SHOWS = [
  {
    title: 'Desert Kitchens',
    title_ar: 'مطابخ الصحراء',
    slug: 'desert-kitchens',
    image_url: 'https://media.clickitstory.ae/shows/desert-kitchens/card.jpg',
    episodes: [
      ep(1, 2, 4, 'Saffron & smoke', 'الزعفران والدخان'),
      ep(2, 2, 5, 'The bread of Liwa', null),
      ep(3, 2, 6, 'Night market', 'سوق الليل'),
    ],
  },
  {
    title: 'Pearl Divers',
    title_ar: 'غواصو اللؤلؤ',
    slug: 'pearl-divers',
    image_url: null,
    episodes: [
      ep(4, 1, 3, 'Into the blue', 'نحو الأزرق'),
      ep(5, 1, 4, 'Salt and rope', 'الملح والحبل'),
      ep(6, 1, 5, 'Homecoming', 'العودة'),
    ],
  },
  {
    title: 'Street Football Abu Dhabi',
    title_ar: 'كرة الشارع أبوظبي',
    slug: 'street-football',
    image_url: 'https://media.clickitstory.ae/shows/street-football/card.jpg',
    episodes: [
      ep(7, 1, 1, 'Kick-off', 'ضربة البداية'),
      ep(8, 1, 2, 'Second half', 'الشوط الثاني'),
      ep(9, 1, 3, 'Penalties', 'ركلات الترجيح'),
    ],
  },
  {
    title: 'Falcon Season',
    title_ar: 'موسم الصقور',
    slug: 'falcon-season',
    image_url: 'https://media.clickitstory.ae/shows/falcon-season/card.jpg',
    episodes: [ep(10, 3, 1, 'First flight', 'التحليق الأول')],
  },
  {
    title: 'Old Town Stories',
    title_ar: 'حكايات المدينة القديمة',
    slug: 'old-town-stories',
    image_url: 'https://media.clickitstory.ae/shows/old-town-stories/card.jpg',
    episodes: [ep(11, 1, 9, 'The last door', 'الباب الأخير')],
  },
]

type Fixture = { kind: string; locale: 'en' | 'ar'; payload: unknown; reply_to?: string }

export const PROBE_FIXTURES: readonly Fixture[] = [
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

/** The claimed row for fixture `index` (attempts and first_attempt_at are set at claim time). */
export function probeRow(outboxId: string, index: number): Omit<ClaimedRow, 'attempts' | 'first_attempt_at'> {
  const f = PROBE_FIXTURES[index]
  if (!f) throw new Error('probe fixture out of range')
  return {
    id: outboxId,
    kind: f.kind,
    idempotency_key: `${f.kind}:probe:${outboxId}`,
    to_address: `viewer${index}@probe.invalid`,
    reply_to: f.reply_to ?? null,
    locale: f.locale,
    payload: f.payload,
    to_user: `5f1e2d3c-0000-4b4b-8c8c-00000000000${index}`,
  }
}

export type ProbeCounter = { sends: number }

function json(value: unknown): Response {
  return new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

/**
 * Canned fetch: claim_outbox returns the rows for the requested ids, finish_outbox
 * returns null, the Resend endpoint returns a fake id and counts the call. Any other
 * request throws, so nothing can reach the network.
 */
export function makeProbeFetch(
  rows: Map<string, Omit<ClaimedRow, 'attempts' | 'first_attempt_at'>>,
  counter: ProbeCounter,
): typeof fetch {
  const stub = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const target = String(input)
    if (init?.method === 'POST' && target === PROBE_CLAIM_URL) {
      const { p_ids: ids } = JSON.parse(String(init.body)) as { p_ids: string[] }
      const nowIso = new Date().toISOString()
      const out: ClaimedRow[] = []
      for (const id of ids) {
        const row = rows.get(id.toLowerCase())
        if (row) out.push({ ...row, attempts: 1, first_attempt_at: nowIso })
      }
      return json(out)
    }
    if (init?.method === 'POST' && target === PROBE_FINISH_URL) return json(null)
    if (init?.method === 'POST' && target === PROBE_RESEND_URL) {
      counter.sends += 1
      return json({ id: `probe-${counter.sends}` })
    }
    throw new Error(`unexpected fetch ${target}`)
  }
  return stub as typeof fetch
}

/** On only for `until:<YYYY-MM-DDTHH:MM[:SS]Z>` in the future and at most 24 h ahead. */
export function probeEnabled(flag: string | undefined, nowMs: number): boolean {
  const m = /^until:(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?Z)$/.exec(typeof flag === 'string' ? flag : '')
  if (!m) return false
  const until = Date.parse(m[1]!)
  return Number.isFinite(until) && nowMs < until && until - nowMs <= PROBE_MAX_WINDOW_MS
}

export function isProbeBody(body: unknown): boolean {
  return !!body && typeof body === 'object' && !Array.isArray(body) && (body as { probe?: unknown }).probe === PROBE_TAG
}

function parseProbeBody(body: unknown): { outboxId: string; fixture: number; run: string } | null {
  const b = body as { outboxId?: unknown; fixture?: unknown; run?: unknown }
  if (typeof b.outboxId !== 'string' || !UUID_RE.test(b.outboxId)) return null
  if (typeof b.fixture !== 'number' || !Number.isInteger(b.fixture) || !PROBE_FIXTURES[b.fixture]) return null
  if (typeof b.run !== 'string' || !RUN_RE.test(b.run)) return null
  return { outboxId: b.outboxId, fixture: b.fixture, run: b.run }
}

/**
 * Takes the probe messages out of a batch and returns the rest for the real consumer
 * (the same batch object when there are none). Probe messages are always acked.
 */
export async function takeEmailCpuProbe<M extends MessageLike>(
  batch: { messages: M[] },
  flag: string | undefined,
  nowMs: number = Date.now(),
  log: (line: string) => void = (line) => console.log(line),
): Promise<{ messages: M[] }> {
  const probe: M[] = []
  const rest: M[] = []
  for (const message of batch.messages) (isProbeBody(message.body) ? probe : rest).push(message)
  if (probe.length === 0) return batch

  if (!probeEnabled(flag, nowMs)) {
    for (const message of probe) message.ack()
    log(`${LOG_PREFIX} refused n=${probe.length}`)
    return { messages: rest }
  }

  const rows = new Map<string, Omit<ClaimedRow, 'attempts' | 'first_attempt_at'>>()
  const valid: M[] = []
  let run = '-'
  for (const message of probe) {
    const parsed = parseProbeBody(message.body)
    if (!parsed) {
      message.ack()
      continue
    }
    run = parsed.run
    rows.set(parsed.outboxId.toLowerCase(), probeRow(parsed.outboxId, parsed.fixture))
    valid.push(message)
  }
  const counter: ProbeCounter = { sends: 0 }
  if (valid.length > 0) {
    await processBatch({ messages: valid }, { ...buildEmailDeps(PROBE_ENV, makeProbeFetch(rows, counter)), log: () => {} })
  }
  log(`${LOG_PREFIX} run=${run} n=${valid.length} bad=${probe.length - valid.length} sends=${counter.sends}`)
  return { messages: rest }
}
