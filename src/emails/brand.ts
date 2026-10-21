// Email brand constants (Phase 5, plan 05-07; D-27 = Q12 C, Q19 = B).
//
// Colour values are owned by Phase 4 (src/lib/email-tokens.ts). This file only
// names the ROLES the signed picture mockups/05-q12-schemes uses and points each
// one at an EMAIL_TOKENS key. No colour literal belongs in src/emails/**.
//
// Relative import with an explicit .ts so node:test (strip-types) and the Worker
// bundle load it the same way.
import { EMAIL_TOKENS } from '../lib/email-tokens.ts'

const { light, dark, button } = EMAIL_TOKENS

export const EMAIL_COLORS = {
  light: {
    page: light.page,
    card: light.card,
    header: light.header,
    heading: light.heading,
    body: light.body,
    hint: light.hint,
    codeBg: light.codeBox,
    codeBorder: light.codeBorder,
    codeText: light.code,
    rule: light.rule,
    footer: light.footer,
    /** Links in body copy take the heading colour, underlined. */
    link: light.heading,
    /** The 3px start rule of the quote box takes the button colour. */
    quoteRule: button.bg,
  },
  dark: {
    page: dark.page,
    // The dark card is the card token, never the page token.
    card: dark.card,
    cardBorder: dark.cardBorder,
    header: dark.header,
    headerRule: dark.headerRule,
    heading: dark.heading,
    body: dark.body,
    hint: dark.hint,
    codeBg: dark.codeBox,
    codeBorder: dark.codeBorder,
    codeText: dark.code,
    rule: dark.rule,
    footer: dark.footer,
    link: dark.heading,
    quoteRule: button.bg,
  },
  button: {
    bg: button.bg,
    ink: button.ink,
    radius: button.radius,
  },
} as const

export const EMAIL_FONT_STACK =
  "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
export const EMAIL_FONT_STACK_AR =
  "-apple-system, 'Segoe UI', Roboto, Helvetica, Tahoma, Arial, sans-serif"
export const MONO_STACK =
  'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'

export const SITE_ORIGIN_DEFAULT = 'https://www.clickitstory.ae'

/**
 * The logo PNG (public/brand/email-logo-white.png, built by
 * scripts/build-email-logo.mjs) on the media host. The controller copies it
 * there (plan 05-35).
 */
export const LOGO_URL =
  'https://media.clickitstory.ae/brand/email-logo-white.png'

/**
 * Local mail (Mailpit) reads the logo from the dev server; everything else uses
 * the media host.
 */
export function logoUrlFor(siteOrigin: string): string {
  let host = ''
  try {
    host = new URL(siteOrigin).hostname
  } catch {
    return LOGO_URL
  }
  if (host === 'localhost' || host === '127.0.0.1') {
    return `${siteOrigin.replace(/\/+$/, '')}/brand/email-logo-white.png`
  }
  return LOGO_URL
}

export const SUPPORT_PATH = '/support'

/** Q19 = B, exact, no street. */
export const POSTAL_LINE =
  'Spacelight Studios FZ LLC, Abu Dhabi, United Arab Emirates'

/** Footer line 1, the same Latin line in both languages. */
export const FOOTER_LINE_1 =
  'Clickit Story · Spacelight Studios FZ LLC, Abu Dhabi, United Arab Emirates'
