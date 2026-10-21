// App email builders E6-E10 (Phase 5, plan 05-11; UI-SPEC 7.3, MAIL-03..06, D-27, D-39).
//
// BUILD AND TEST ONLY. The Worker never imports this file: scripts/build-app-templates.mjs
// renders these builders with slot sentinels into src/generated/app-email-templates.json,
// and src/emails/render-app.ts only fills that JSON. direct.ts renders the same builders
// with real values so the parity test can prove both paths give the same HTML.
//
// A view holds one string per slot: real values (direct path) or sentinels (build). Rules:
// - user and data values (names, emails, subjects, show titles, episode lines) sit in <bdi>;
//   a sentence holding {name} is split so the name is a <bdi> inside it; the hidden
//   preheader (Preview takes a plain string) is the one exception;
// - every value is the only child of its element (no adjacent text, so React writes no
//   <!-- --> markers that would differ between the two paths);
// - values never sit inside h2-h6 (html-to-text upper-cases those);
// - every EmailButton is followed by FallbackUrl (05-07 rule); E7 has no button;
// - colours only through EMAIL_COLORS (Phase 4 tokens); no colour literal here.
import { createElement as h, Fragment } from 'react'
import type { ReactElement, ReactNode } from 'react'
import {
  EmailButton,
  EmailHeading,
  EmailLink,
  EmailShell,
  EmailText,
  FallbackUrl,
  QuoteBox,
} from '../components.ts'
import type { EmailLocale } from '../components.ts'
import { EMAIL_COLORS } from '../brand.ts'
import { en, fill } from '../messages/en.ts'
import type { EmailMessages } from '../messages/en.ts'
import { ar } from '../messages/ar.ts'
import { SUPPORT_REPLY_HOURS } from '../../lib/email-constants.ts'
import { NEWSLETTER_CONFIRM_TTL_DAYS } from '../../server/email/links.ts'
import type { AppEmailKind } from './model.ts'

const L = EMAIL_COLORS.light

export type CommonView = { locale: EmailLocale; logo: string; origin: string }
export type EpisodeView = { line: string; watch: string }
export type ShowView = {
  row: 'show' | 'shownoimage'
  title: string
  image?: string
  /** Episode views, or the block sentinel at build time. */
  episodes: EpisodeView[] | string
}
export type WelcomeView = CommonView & { browse: string }
export type DigestView = CommonView & {
  profile: string
  unsubscribe: string
  seeall?: string
  /** Show views, or the block sentinel at build time. */
  shows: ShowView[] | string
}
export type SupportAckView = CommonView
export type SupportAdminView = CommonView & {
  name: string
  email: string
  subject: string
  message: string
  preheader: string
  admin: string
}
export type NewsletterConfirmView = CommonView & { confirm: string }

export type AppView =
  | ({ kind: 'welcome' } & WelcomeView)
  | ({ kind: 'digest' } & DigestView)
  | ({ kind: 'support_ack' } & SupportAckView)
  | ({ kind: 'support_admin' } & SupportAdminView)
  | ({ kind: 'newsletter_confirm' } & NewsletterConfirmView)

function messagesFor(locale: EmailLocale): EmailMessages {
  return locale === 'ar' ? ar : en
}

function shell(
  view: CommonView,
  preheader: string,
  children: ReactNode[],
  footerExtra?: ReactNode
): ReactElement {
  return h(
    EmailShell,
    {
      locale: view.locale,
      preheader,
      logoUrl: view.logo,
      siteOrigin: view.origin,
      footerExtra,
    },
    ...children
  )
}

const footerLine = {
  margin: '8px 0 0',
  fontSize: '12px',
  lineHeight: 1.5,
  color: L.footer,
}

const footerLink = { color: L.footer, textDecoration: 'underline' }

function postalLine(m: EmailMessages, key = 'postal'): ReactElement {
  return h(
    'p',
    { key, className: 'cs-footer', style: footerLine },
    m.footer.postalLine
  )
}

/** Splits a sentence at {name} and puts the name in a <bdi> inside it. */
function withName(sentence: string, name: string): ReactNode[] {
  const at = sentence.indexOf('{name}')
  if (at < 0) return [sentence]
  const before = sentence.slice(0, at)
  const after = sentence.slice(at + '{name}'.length)
  const out: ReactNode[] = []
  if (before) out.push(before)
  out.push(h('bdi', { key: 'name' }, name))
  if (after) out.push(after)
  return out
}

/** E6 welcome (MAIL-03). */
export function welcome(view: WelcomeView): ReactElement {
  const m = messagesFor(view.locale)
  return shell(view, m.e6.preheader, [
    h(EmailHeading, { key: 'h' }, m.e6.heading),
    h(EmailText, { key: 'b' }, m.e6.body),
    h(EmailButton, { key: 'btn', href: view.browse, label: m.e6.button ?? '' }),
    h(FallbackUrl, { key: 'fb', href: view.browse, label: m.fallbackUrl }),
  ])
}

/** One episode line of the digest: "S1 E2 - title" and the Watch episode link. */
export function episodeRow(
  locale: EmailLocale,
  view: EpisodeView,
  key?: string | number
): ReactElement {
  const m = messagesFor(locale)
  return h(
    'p',
    {
      key,
      className: 'cs-text',
      style: { margin: '0 0 6px', fontSize: '12px', lineHeight: 1.5, color: L.body },
    },
    h('bdi', null, view.line),
    ' · ',
    h(EmailLink, { href: view.watch }, m.e7.watchEpisode)
  )
}

function episodesOf(locale: EmailLocale, episodes: EpisodeView[] | string): ReactNode {
  return typeof episodes === 'string'
    ? episodes
    : episodes.map((e, i) => episodeRow(locale, e, i))
}

function showContent(locale: EmailLocale, view: ShowView): ReactElement {
  return h(
    'td',
    { key: 'content', valign: 'top', style: { verticalAlign: 'top' } },
    h(
      'p',
      {
        className: 'cs-heading',
        style: {
          margin: '0 0 4px',
          fontSize: '16px',
          fontWeight: 700,
          lineHeight: 1.5,
          color: L.heading,
        },
      },
      h('bdi', null, view.title)
    ),
    h('div', null, episodesOf(locale, view.episodes))
  )
}

function showTable(key: string | number | undefined, cells: ReactNode[]): ReactElement {
  return h(
    'table',
    {
      key,
      role: 'presentation',
      width: '100%',
      border: 0,
      cellPadding: 0,
      cellSpacing: 0,
      style: { margin: '0 0 20px', borderCollapse: 'separate' },
    },
    h('tbody', null, h('tr', null, ...cells))
  )
}

/** A digest show with its thumbnail (row template `show`). */
export function showRow(
  locale: EmailLocale,
  view: ShowView,
  key?: string | number
): ReactElement {
  const rtl = locale === 'ar'
  const thumb = h(
    'td',
    {
      key: 'thumb',
      width: 128,
      valign: 'top',
      style: {
        width: '128px',
        verticalAlign: 'top',
        [rtl ? 'paddingLeft' : 'paddingRight']: '16px',
      },
    },
    h('img', {
      src: view.image,
      alt: view.title,
      width: 128,
      height: 72,
      style: { display: 'block', border: 0, borderRadius: '6px' },
    })
  )
  return showTable(key, [thumb, showContent(locale, view)])
}

/** The same show row without the thumbnail cell (row template `shownoimage`). */
export function showRowNoImage(
  locale: EmailLocale,
  view: ShowView,
  key?: string | number
): ReactElement {
  return showTable(key, [showContent(locale, view)])
}

/** E7 new-episodes digest (MAIL-04). No primary button: rows are text links. */
export function digest(view: DigestView): ReactElement {
  const m = messagesFor(view.locale)
  const shows =
    typeof view.shows === 'string'
      ? view.shows
      : view.shows.map((s, i) =>
          s.row === 'show'
            ? showRow(view.locale, s, i)
            : showRowNoImage(view.locale, s, i)
        )
  const footerExtra = h(
    Fragment,
    null,
    h('p', { className: 'cs-footer', style: footerLine }, m.footer.digestReason),
    h(
      'p',
      { className: 'cs-footer', style: { ...footerLine, margin: 0 } },
      h(
        'a',
        { href: view.unsubscribe, className: 'cs-footer', style: footerLink },
        m.footer.unsubscribe
      ),
      ' · ',
      h(
        'a',
        { href: view.profile, className: 'cs-footer', style: footerLink },
        m.footer.manage
      )
    ),
    postalLine(m)
  )
  return shell(
    view,
    m.e7.preheader,
    [
      h(EmailHeading, { key: 'h' }, m.e7.heading),
      h(EmailText, { key: 'b' }, m.e7.body),
      h('div', { key: 'shows' }, shows),
      view.seeall
        ? h(
            EmailText,
            { key: 'more' },
            h(EmailLink, { href: view.seeall }, m.e7.seeAll)
          )
        : null,
    ],
    footerExtra
  )
}

/** E8 support auto-reply (MAIL-05). Static: never any visitor text (D-39, F17). */
export function supportAck(view: SupportAckView): ReactElement {
  const m = messagesFor(view.locale)
  return shell(view, m.e8.preheader, [
    h(EmailHeading, { key: 'h' }, m.e8.heading),
    h(EmailText, { key: 'b' }, fill(m.e8.body, { hours: SUPPORT_REPLY_HOURS })),
  ])
}

/** E9 support admin copy (MAIL-05). Visitor text only as escaped values in <bdi>/QuoteBox. */
export function supportAdmin(view: SupportAdminView): ReactElement {
  const m = messagesFor(view.locale)
  const label = (text: string) => h('strong', null, `${text}:`)
  return shell(view, view.preheader, [
    h(EmailHeading, { key: 'h' }, m.e9.heading),
    h(
      EmailText,
      { key: 'rows' },
      label(m.e9.from),
      ' ',
      h('bdi', null, view.name),
      h('br'),
      label(m.e9.email),
      ' ',
      h('bdi', null, view.email),
      h('br'),
      label(m.e9.subjectLabel),
      ' ',
      h('bdi', null, view.subject)
    ),
    h(QuoteBox, { key: 'q' }, view.message),
    h(EmailText, { key: 'hint' }, ...withName(m.e9.replyHint, view.name)),
    h(EmailButton, { key: 'btn', href: view.admin, label: m.e9.button ?? '' }),
    h(FallbackUrl, { key: 'fb', href: view.admin, label: m.fallbackUrl }),
  ])
}

/** E10 newsletter confirm (MAIL-06). */
export function newsletterConfirm(view: NewsletterConfirmView): ReactElement {
  const m = messagesFor(view.locale)
  const days = { days: NEWSLETTER_CONFIRM_TTL_DAYS }
  return shell(
    view,
    fill(m.e10.preheader, days),
    [
      h(EmailHeading, { key: 'h' }, m.e10.heading),
      h(EmailText, { key: 'b' }, fill(m.e10.body, days)),
      h(EmailButton, { key: 'btn', href: view.confirm, label: m.e10.button ?? '' }),
      h(FallbackUrl, { key: 'fb', href: view.confirm, label: m.fallbackUrl }),
      h(EmailText, { key: 'fine', small: true }, m.e10.fineprint),
    ],
    postalLine(m)
  )
}

/** The element for any app email view. */
export function appEmailElement(view: AppView): ReactElement {
  switch (view.kind) {
    case 'welcome':
      return welcome(view)
    case 'digest':
      return digest(view)
    case 'support_ack':
      return supportAck(view)
    case 'support_admin':
      return supportAdmin(view)
    case 'newsletter_confirm':
      return newsletterConfirm(view)
  }
}

const SUBJECT_KEY: Record<AppEmailKind, 'e6' | 'e7' | 'e8' | 'e9' | 'e10'> = {
  welcome: 'e6',
  digest: 'e7',
  support_ack: 'e8',
  support_admin: 'e9',
  newsletter_confirm: 'e10',
}

/** Subject line; only support_admin carries a value ({subject}). */
export function appSubject(
  kind: AppEmailKind,
  locale: EmailLocale,
  subject = ''
): string {
  return fill(messagesFor(locale)[SUBJECT_KEY[kind]].subject, { subject })
}
