// Shared app email fixtures (Phase 5, plan 05-11): the parity test and
// scripts/email-parity-shots.mjs render the same rows. Realistic data plus the hostile
// support name; synthetic only (no real people).
import type { AppEmailCtx, AppEmailRow } from '../../../src/emails/app/model.ts'

export const PARITY_ORIGIN = 'https://www.clickitstory.ae'

export const PARITY_CTX: AppEmailCtx = {
  siteOrigin: PARITY_ORIGIN,
  links: {
    unsubscribe: async (userId: string) =>
      `${PARITY_ORIGIN}/en/unsubscribe?t=dW5zdWJfZGlnZXN0LnVzZXI.${userId}-sig`,
    newsletterConfirm: async (id: string) =>
      `${PARITY_ORIGIN}/en/newsletter/confirm?t=bmV3c2xldHRlci5jb25maXJt.${id}-sig`,
  },
}

export const HOSTILE_NAME = `Zoë "Q" O'Neil & <script>alert(1)</script> نور`

type Locale = 'en' | 'ar'

function ep(
  id: string,
  season: number,
  episode: number,
  title: string,
  title_ar: string | null
) {
  return { id, season_number: season, episode_number: episode, title, title_ar }
}

const SHOWS = [
  {
    title: 'Desert Kitchens',
    title_ar: 'مطابخ الصحراء',
    slug: 'desert-kitchens',
    image_url: 'https://media.clickitstory.ae/shows/desert-kitchens/card.jpg',
    episodes: [
      ep('0b9d6c1e-0001-4a51-9b7e-1d1a2b3c4d01', 2, 4, 'Saffron & smoke', 'الزعفران والدخان'),
      ep('0b9d6c1e-0002-4a51-9b7e-1d1a2b3c4d02', 2, 5, 'The bread of Liwa', null),
      ep('0b9d6c1e-0003-4a51-9b7e-1d1a2b3c4d03', 2, 6, 'Night market', 'سوق الليل'),
      ep('0b9d6c1e-0004-4a51-9b7e-1d1a2b3c4d04', 2, 7, 'Not shown (4th)', null),
    ],
  },
  {
    title: 'Pearl Divers',
    title_ar: 'غواصو اللؤلؤ',
    slug: 'pearl-divers',
    image_url: null,
    episodes: [ep('0b9d6c1e-0011-4a51-9b7e-1d1a2b3c4d11', 1, 3, 'Into the blue', 'نحو الأزرق')],
  },
  {
    title: 'Street Football Abu Dhabi',
    title_ar: null,
    slug: 'street-football',
    image_url: 'https://media.clickitstory.ae/shows/street-football/card.jpg',
    episodes: [ep('0b9d6c1e-0021-4a51-9b7e-1d1a2b3c4d21', 1, 1, 'Kick-off', null)],
  },
  {
    title: 'Falcon Season',
    title_ar: 'موسم الصقور',
    slug: 'falcon-season',
    image_url: 'https://media.clickitstory.ae/shows/falcon-season/card.jpg',
    episodes: [ep('0b9d6c1e-0031-4a51-9b7e-1d1a2b3c4d31', 3, 1, 'First flight', 'التحليق الأول')],
  },
  {
    title: 'Old Town Stories',
    title_ar: 'حكايات المدينة القديمة',
    slug: 'old-town-stories',
    image_url: 'https://media.clickitstory.ae/shows/old-town-stories/card.jpg',
    episodes: [ep('0b9d6c1e-0041-4a51-9b7e-1d1a2b3c4d41', 1, 9, 'The last door', 'الباب الأخير')],
  },
]

/** The 5-show digest (variant more; the second show has no thumbnail, the third no title_ar). */
export function digestFiveShows(locale: Locale): AppEmailRow {
  return {
    kind: 'digest',
    locale,
    payload: { shows: SHOWS, total_shows: 5 },
    idempotency_key: `digest:2026-10-21:user-1:${locale}`,
    to_user: '5f1e2d3c-0000-4b4b-8c8c-9d9d9d9d0001',
  }
}

function digestTwoShows(locale: Locale): AppEmailRow {
  return {
    kind: 'digest',
    locale,
    payload: {
      shows: [SHOWS[0], { ...SHOWS[3], image_url: '' }],
      total_shows: 2,
    },
    idempotency_key: `digest:2026-10-21:user-2:${locale}`,
    to_user: '5f1e2d3c-0000-4b4b-8c8c-9d9d9d9d0002',
  }
}

function plain(kind: string, locale: Locale, payload: unknown): AppEmailRow {
  return {
    kind,
    locale,
    payload,
    idempotency_key: `${kind}:fixture:${locale}`,
    to_user: kind === 'support_admin' ? null : '5f1e2d3c-0000-4b4b-8c8c-9d9d9d9d0003',
  }
}

export function parityFixtures(): { label: string; row: AppEmailRow }[] {
  const out: { label: string; row: AppEmailRow }[] = []
  for (const locale of ['en', 'ar'] as const) {
    out.push({ label: `digest more ${locale}`, row: digestFiveShows(locale) })
    out.push({ label: `digest base ${locale}`, row: digestTwoShows(locale) })
    out.push({ label: `welcome ${locale}`, row: plain('welcome', locale, {}) })
    out.push({ label: `support_ack ${locale}`, row: plain('support_ack', locale, {}) })
    out.push({
      label: `support_admin ${locale}`,
      row: plain('support_admin', locale, {
        message_id: '9c2b7d10-5555-4e3e-a1a1-000000000001',
        name: HOSTILE_NAME,
        email: 'zoe.oneil@visitor.example',
        subject: 'Can\'t play S2 E4 & "Night market"',
        message: 'Hi team,\r\nthe episode stops after 2 minutes.\n\n<b>Thanks</b> & regards\n  — Zoë',
      }),
    })
    out.push({
      label: `newsletter_confirm ${locale}`,
      row: plain('newsletter_confirm', locale, { subscriber_id: '3e4f5a6b-7777-4c4c-9e9e-000000000001' }),
    })
  }
  return out
}
