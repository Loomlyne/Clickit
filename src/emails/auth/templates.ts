// Auth email source (Phase 5, plan 05-10; MAIL-01, D-25, D-26, UI-SPEC 7.3 rows E1-E5).
//
// One element per template and locale, built on the 05-07 shell (colours come from the
// shell, never from here). Go template values are not written as Go text: they are
// sentinel strings that scripts/build-auth-templates.mjs swaps for the real placeholders
// AFTER React has rendered, so React's escaper never touches a Go action.
//
// Supabase fills the placeholders itself (research F16, F18). Reauthentication has no
// TokenHash or RedirectTo. Links never verify on GET: they open the button page (05-23).
import { createElement as h, Fragment } from 'react'
import type { ReactElement, ReactNode } from 'react'
import {
  CodeBlock,
  EmailButton,
  EmailHeading,
  EmailShell,
  EmailText,
  FallbackUrl,
} from '../components.ts'
import type { EmailLocale } from '../components.ts'
import { LOGO_URL } from '../brand.ts'
import { ar } from '../messages/ar.ts'
import { en } from '../messages/en.ts'
import type { AuthEmailMessage } from '../messages/en.ts'

export const SENTINELS = {
  token: '__TOKEN__',
  tokenHash: '__TOKEN_HASH__',
  redirect: '__REDIRECT__',
  email: '__EMAIL__',
  newEmail: '__NEW_EMAIL__',
} as const

/** Supabase template names, in the order the files and subjects are written. */
export const AUTH_TEMPLATE_NAMES = [
  'confirmation',
  'magic_link',
  'recovery',
  'email_change',
  'reauthentication',
] as const
export type AuthTemplateName = (typeof AUTH_TEMPLATE_NAMES)[number]

type MessageKey = 'e1' | 'e2' | 'e3' | 'e4' | 'e5'

const MESSAGE_KEY: Record<AuthTemplateName, MessageKey> = {
  confirmation: 'e2',
  magic_link: 'e1',
  recovery: 'e3',
  email_change: 'e4',
  reauthentication: 'e5',
}

/** token_hash type each link template verifies with (never verified on GET). */
const LINK_TYPE: Partial<Record<AuthTemplateName, string>> = {
  confirmation: 'signup',
  recovery: 'recovery',
  email_change: 'email_change',
}

export function authMessage(
  name: AuthTemplateName,
  locale: EmailLocale
): AuthEmailMessage {
  const m = locale === 'ar' ? ar : en
  return m[MESSAGE_KEY[name]]
}

/** The sentinel link; the builder turns it into the Go link. */
export function authLink(name: AuthTemplateName): string {
  const type = LINK_TYPE[name]
  if (!type) throw new Error(`${name} has no link`)
  return `${SENTINELS.redirect}&token_hash=${SENTINELS.tokenHash}&type=${type}`
}

/** E4 body: the two addresses become LTR spans around their sentinels. */
function withAddresses(body: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let key = 0
  for (const m of body.matchAll(/\{\{ \.(Email|NewEmail) \}\}/g)) {
    const at = m.index ?? 0
    if (at > last) out.push(body.slice(last, at))
    out.push(
      h(
        'span',
        { dir: 'ltr', key: key++ },
        m[1] === 'Email' ? SENTINELS.email : SENTINELS.newEmail
      )
    )
    last = at + m[0].length
  }
  if (last < body.length) out.push(body.slice(last))
  return out
}

export function authTemplateElement(
  name: AuthTemplateName,
  locale: EmailLocale,
  options: { logoUrl?: string } = {}
): ReactElement {
  const msg = authMessage(name, locale)
  const fallback = (locale === 'ar' ? ar : en).fallbackUrl
  const hasLink = name in LINK_TYPE
  const hasCode =
    name === 'confirmation' ||
    name === 'magic_link' ||
    name === 'reauthentication'

  const body = name === 'email_change' ? withAddresses(msg.body) : msg.body

  return h(
    EmailShell,
    {
      locale,
      preheader: msg.preheader,
      logoUrl: options.logoUrl ?? LOGO_URL,
    },
    h(EmailHeading, null, msg.heading),
    h(EmailText, null, ...(Array.isArray(body) ? body : [body])),
    hasLink && msg.button
      ? h(
          Fragment,
          null,
          h(EmailButton, { href: authLink(name), label: msg.button }),
          h(FallbackUrl, { href: authLink(name), label: fallback })
        )
      : null,
    hasCode ? h(CodeBlock, { code: SENTINELS.token }) : null,
    h(EmailText, { small: true }, msg.fineprint)
  )
}
