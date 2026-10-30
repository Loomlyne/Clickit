// Shared model of an app email (Phase 5, plan 05-11): payload guards, locale fallback,
// links and every slot value, computed once from the outbox row. The direct React path
// (direct.ts, build and test only) and the Worker fill path (render-app.ts) both render
// from this model, so the parity test compares rendering only.
//
// Dependency-light on purpose: 05-16's enqueue-core imports APP_EMAIL_KINDS from here, and
// the Worker bundle must not pull React, messages or the templates JSON through this file.
// Relative .ts imports only; no zod (plain type guards keep the Worker small).
import { logoUrlFor } from '../brand.ts'
import { safeUrl } from './template-fill.ts'
import type { SlotValue, SlotValues } from './template-fill.ts'

export const APP_EMAIL_KINDS = [
  'welcome',
  'digest',
  'support_ack',
  'support_admin',
  'newsletter_confirm',
] as const
export type AppEmailKind = (typeof APP_EMAIL_KINDS)[number]
export type AppLocale = 'en' | 'ar'

/** The claimed outbox row (05-08 ClaimedRow is assignable to this). */
export type AppEmailRow = {
  kind: string
  locale: string | null
  payload: unknown
  idempotency_key?: string
  to_user?: string | null
}

/** Signing happens in 05-16/05-19 with EMAIL_LINK_SECRET. */
export type AppEmailCtx = {
  siteOrigin: string
  links: {
    unsubscribe(userId: string): Promise<string>
    newsletterConfirm(subscriberId: string): Promise<string>
  }
}

/** The two message strings the model needs, for the row's locale. */
export type ModelStrings = { episodeLine: string; e9Preheader: string }

export type ShowModel = {
  row: 'show' | 'shownoimage'
  values: SlotValues
  episodes: { values: SlotValues }[]
}

export type AppEmailModel = {
  kind: AppEmailKind
  locale: AppLocale
  variant: 'base' | 'more'
  values: SlotValues
  shows?: ShowModel[]
  replyTo?: string
}

export const DIGEST_MAX_SHOWS = 3
export const DIGEST_MAX_EPISODES = 3
export const SUBJECT_MAX = 100

export function stripCrlf(value: string): string {
  return value.replace(/[\r\n]/g, '')
}

/** {word} tokens, one pass (same rule as messages/en.ts fill; inserted text is not rescanned). */
function fillWords(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : whole
  )
}

const txt = (value: string): SlotValue => ({ type: 'txt', value })
const url = (value: string): SlotValue => ({ type: 'url', value: safeUrl(value) })
const pre = (value: string): SlotValue => ({ type: 'pre', value })

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function filled(v: unknown): v is string {
  return typeof v === 'string' && v.trim() !== ''
}

function bad(kind: string): Error {
  return new Error(`bad payload ${kind}`)
}

function requireStrings(
  kind: string,
  payload: Record<string, unknown>,
  keys: string[]
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const key of keys) {
    const v = payload[key]
    if (!filled(v)) throw bad(kind)
    out[key] = v
  }
  return out
}

function pickTitle(
  locale: AppLocale,
  title: string,
  titleAr: unknown
): string {
  return locale === 'ar' && filled(titleAr) ? titleAr : title
}

function usableImage(v: unknown): string | null {
  if (typeof v !== 'string' || v.trim() === '') return null
  try {
    return safeUrl(v)
  } catch {
    return null
  }
}

type EpisodeIn = {
  id: string
  season: number
  episode: number
  title: string
  titleAr: unknown
}
type ShowIn = {
  title: string
  titleAr: unknown
  image: string | null
  episodes: EpisodeIn[]
}

function parseDigest(payload: unknown): {
  shows: ShowIn[]
  total: number
} {
  if (!isRecord(payload) || !Array.isArray(payload.shows)) throw bad('digest')
  if (payload.shows.length === 0) throw bad('digest')
  const total = payload.total_shows
  if (
    total !== undefined &&
    total !== null &&
    (typeof total !== 'number' || !Number.isFinite(total))
  ) {
    throw bad('digest')
  }
  const shows: ShowIn[] = payload.shows.map((s: unknown) => {
    if (!isRecord(s) || !filled(s.title)) throw bad('digest')
    if (s.title_ar != null && typeof s.title_ar !== 'string') throw bad('digest')
    if (!Array.isArray(s.episodes) || s.episodes.length === 0) {
      throw bad('digest')
    }
    const episodes: EpisodeIn[] = s.episodes.map((e: unknown) => {
      if (!isRecord(e) || !filled(e.id)) throw bad('digest')
      if (
        !Number.isInteger(e.season_number) ||
        !Number.isInteger(e.episode_number)
      ) {
        throw bad('digest')
      }
      if (typeof e.title !== 'string') throw bad('digest')
      if (e.title_ar != null && typeof e.title_ar !== 'string') {
        throw bad('digest')
      }
      return {
        id: e.id,
        season: e.season_number as number,
        episode: e.episode_number as number,
        title: e.title,
        titleAr: e.title_ar,
      }
    })
    return {
      title: s.title,
      titleAr: s.title_ar,
      image: usableImage(s.image_url),
      episodes,
    }
  })
  return { shows, total: typeof total === 'number' ? total : shows.length }
}

function isKind(kind: unknown): kind is AppEmailKind {
  return (
    typeof kind === 'string' &&
    (APP_EMAIL_KINDS as readonly string[]).includes(kind)
  )
}

/**
 * Builds the model of one outbox row. Throws 'unknown email kind', 'bad payload <kind>',
 * 'digest needs to_user' or 'unsafe url'; the consumer records the row as failed/retrying.
 */
export async function buildAppEmailModel(
  row: AppEmailRow,
  ctx: AppEmailCtx,
  strings: ModelStrings
): Promise<AppEmailModel> {
  const kind = row.kind
  if (!isKind(kind)) throw new Error('unknown email kind')
  const locale: AppLocale = row.locale === 'ar' ? 'ar' : 'en'
  const origin = safeUrl(String(ctx.siteOrigin ?? '').replace(/\/+$/, ''))
  const base = `${origin}/${locale}`
  const common: SlotValues = {
    logo: url(logoUrlFor(origin)),
    origin: url(origin),
  }
  const payload = row.payload

  switch (kind) {
    case 'welcome': {
      if (!isRecord(payload)) throw bad(kind)
      return {
        kind,
        locale,
        variant: 'base',
        values: { ...common, browse: url(`${base}/browse`) },
      }
    }
    case 'support_ack': {
      // Static (D-39, F17): nothing from the payload is ever used.
      if (!isRecord(payload)) throw bad(kind)
      return { kind, locale, variant: 'base', values: { ...common } }
    }
    case 'support_admin': {
      if (!isRecord(payload)) throw bad(kind)
      const p = requireStrings(kind, payload, [
        'message_id',
        'name',
        'email',
        'subject',
        'message',
      ])
      return {
        kind,
        locale,
        variant: 'base',
        values: {
          ...common,
          name: txt(p.name),
          email: txt(p.email),
          subject: txt(stripCrlf(p.subject).slice(0, SUBJECT_MAX)),
          message: txt(p.message),
          preheader: pre(fillWords(strings.e9Preheader, { name: p.name })),
          admin: url(`${base}/admin/inbox/${encodeURIComponent(p.message_id)}`),
        },
        replyTo: stripCrlf(p.email),
      }
    }
    case 'newsletter_confirm': {
      if (!isRecord(payload)) throw bad(kind)
      const p = requireStrings(kind, payload, ['subscriber_id'])
      const confirm = await ctx.links.newsletterConfirm(p.subscriber_id)
      return {
        kind,
        locale,
        variant: 'base',
        values: { ...common, confirm: url(confirm) },
      }
    }
    case 'digest': {
      const { shows, total } = parseDigest(payload)
      const toUser = row.to_user
      if (typeof toUser !== 'string' || toUser.trim() === '') {
        throw new Error('digest needs to_user')
      }
      const more = total > DIGEST_MAX_SHOWS || shows.length > DIGEST_MAX_SHOWS
      const unsubscribe = await ctx.links.unsubscribe(toUser)
      const values: SlotValues = {
        ...common,
        profile: url(`${base}/profile`),
        unsubscribe: url(unsubscribe),
      }
      if (more) values.seeall = url(`${base}/my-list`)
      const showModels: ShowModel[] = shows
        .slice(0, DIGEST_MAX_SHOWS)
        .map((s) => {
          const title = pickTitle(locale, s.title, s.titleAr)
          const showValues: SlotValues = { title: txt(title) }
          if (s.image) showValues.image = url(s.image)
          return {
            row: s.image ? 'show' : 'shownoimage',
            values: showValues,
            episodes: s.episodes.slice(0, DIGEST_MAX_EPISODES).map((e) => ({
              values: {
                line: txt(
                  fillWords(strings.episodeLine, {
                    season: String(e.season),
                    episode: String(e.episode),
                    title: pickTitle(locale, e.title, e.titleAr),
                  })
                ),
                watch: url(`${base}/watch/${encodeURIComponent(e.id)}`),
              },
            })),
          }
        })
      return {
        kind,
        locale,
        variant: more ? 'more' : 'base',
        values,
        shows: showModels,
      }
    }
  }
}
