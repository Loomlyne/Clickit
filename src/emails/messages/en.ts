// Email strings, English (Phase 5, plan 05-07; UI-SPEC 7.3). Pure: no React, no
// next-intl. Email copy lives here and in ar.ts, never in the app catalogs.
//
// {name} tokens are filled by fill(); values are escaped by React at render time.
// Go template placeholders such as {{ .Email }} are left alone (they contain
// spaces and dots, so they never match a {word} token). Auth emails keep the
// literal "15 minutes"; plan 05-10 asserts it equals AUTH_LINK_MINUTES.
import { FOOTER_LINE_1, POSTAL_LINE } from '../brand.ts'

export function fill(
  template: string,
  values: Record<string, string | number> = {}
): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key)
      ? String(values[key])
      : whole
  )
}

export interface AuthEmailMessage {
  subject: string
  preheader: string
  heading: string
  body: string
  button?: string
  fineprint: string
}

export interface AppEmailMessage {
  subject: string
  preheader: string
  heading: string
  body: string
  button?: string
  fineprint?: string
}

export interface EmailMessages {
  /** E1 sign-in code (Magic Link) */
  e1: AuthEmailMessage
  /** E2 confirm signup (button and code) */
  e2: AuthEmailMessage
  /** E3 reset password */
  e3: AuthEmailMessage
  /** E4 email change */
  e4: AuthEmailMessage
  /** E5 reauthentication */
  e5: AuthEmailMessage
  /** E6 welcome */
  e6: AppEmailMessage
  /** E7 new-episodes digest */
  e7: AppEmailMessage & {
    watchEpisode: string
    seeAll: string
    episodeLine: string
  }
  /** E8 support auto-reply (static, never echoes the visitor's text) */
  e8: AppEmailMessage
  /** E9 support admin copy */
  e9: AppEmailMessage & {
    from: string
    email: string
    subjectLabel: string
    replyHint: string
  }
  /** E10 newsletter confirm */
  e10: AppEmailMessage
  footer: {
    line1: string
    help: string
    helpLink: string
    unsubscribe: string
    manage: string
    digestReason: string
    postalLine: string
  }
  fallbackUrl: string
  /** Visible label of the logo when images are off. */
  logoAlt: string
}

export const en: EmailMessages = {
  e1: {
    subject: 'Your Clickit Story sign-in code',
    preheader: 'Your code works for 15 minutes.',
    heading: 'Your sign-in code',
    body: 'Enter this code on Clickit Story. It works for 15 minutes.',
    fineprint:
      "Didn't ask for it? Ignore this email; nobody can sign in without the code.",
  },
  e2: {
    subject: 'Confirm your Clickit Story email',
    preheader: 'Both the button and the code work for 15 minutes.',
    heading: 'Confirm your email',
    body: 'Press the button to confirm your email, or enter the code below on Clickit Story. Both work for 15 minutes.',
    button: 'Confirm email',
    fineprint: "Didn't sign up? Ignore this email.",
  },
  e3: {
    subject: 'Reset your Clickit Story password',
    preheader: 'The link works for 15 minutes.',
    heading: 'Reset your password',
    body: 'Press the button to choose a new password. The link works for 15 minutes and opens on any device.',
    button: 'Choose a new password',
    fineprint: "Didn't ask? Ignore this email; your password stays the same.",
  },
  e4: {
    subject: 'Confirm your new Clickit Story email',
    preheader: 'Both addresses must be confirmed.',
    heading: 'Confirm your new email',
    body: 'You asked to change your Clickit Story email from {{ .Email }} to {{ .NewEmail }}. Press the button to confirm. We also sent a link to your other address; both must be confirmed.',
    button: 'Confirm new email',
    fineprint: "Didn't ask? Ignore this email and your address stays the same.",
  },
  e5: {
    subject: 'Your Clickit Story security code: {{ .Token }}',
    preheader: 'Your code works for 15 minutes.',
    heading: "Confirm it's you",
    body: 'Enter this code to confirm your password change. It works for 15 minutes.',
    fineprint:
      "Didn't ask for it? Someone may know your password. Sign in and change it now.",
  },
  e6: {
    subject: 'Welcome to Clickit Story',
    preheader: 'Your account is ready.',
    heading: 'Welcome to Clickit Story',
    body: "Your account is ready. Pick a show, press play, and we'll remember where you stopped.",
    button: 'Start watching',
  },
  e7: {
    subject: 'New on your Clickit Story list',
    preheader: 'New episodes are ready from your My List.',
    heading: 'New on your list',
    body: 'New episodes are ready from shows on your My List.',
    watchEpisode: 'Watch episode',
    seeAll: 'See all on Clickit Story',
    episodeLine: 'S{season} E{episode} - {title}',
  },
  e8: {
    subject: 'We got your message',
    preheader: 'We reply by email.',
    heading: 'We got your message',
    body: "Thanks for writing to Clickit Story. We reply by email within {hours} hours. This is an automatic message; you don't need to answer it.",
  },
  e9: {
    subject: '[Clickit support] {subject}',
    preheader: 'New message from {name}.',
    heading: 'New support message',
    body: 'Press Reply to answer {name} directly.',
    button: 'Open in admin',
    from: 'From',
    email: 'Email',
    subjectLabel: 'Subject',
    replyHint: 'Press Reply to answer {name} directly.',
  },
  e10: {
    subject: 'Confirm your Clickit Story subscription',
    preheader: 'The link works for {days} days.',
    heading: 'Confirm your subscription',
    body: 'Press the button to confirm that you want news from Clickit Story by email. The link works for {days} days.',
    button: 'Confirm subscription',
    fineprint: "Didn't sign up? Ignore this email and you won't be subscribed.",
  },
  footer: {
    line1: FOOTER_LINE_1,
    help: 'Help:',
    helpLink: 'clickitstory.ae/support',
    unsubscribe: 'Unsubscribe',
    manage: 'Manage in Profile',
    digestReason:
      'You get this because a show on your My List has new episodes.',
    postalLine: POSTAL_LINE,
  },
  fallbackUrl: 'Or open:',
  logoAlt: 'Clickit Story',
}
