// Turnstile widget options (PLAT-05). Encodes only the placement Koss signed
// on 2026-10-20 (mockups/DECISIONS.md, option turnstile-A): a Managed widget,
// dark theme, full form width, between the last field and the submit button on
// sign-in, sign-up, reset request and contact. The footer newsletter uses
// "interaction-only", so its row is unchanged unless Cloudflare needs a click.
// "resend" (05-22, UI-SPEC 5.5 item 9) is the second instance on the code and
// check-your-email screens: interaction-only, so those screens stay uncluttered.
// Pure on purpose: no React, no env reads.

export type TurnstileForm = 'sign-in' | 'sign-up' | 'reset' | 'contact' | 'newsletter' | 'resend'

export type TurnstileWidgetOptions = {
  theme: 'dark'
  appearance: 'always' | 'interaction-only'
  size: 'flexible'
  language: 'en' | 'ar'
}

// The only signed wording (mockups/DECISIONS.md). Shown under the widget.
export const CAPTCHA_FAILED_MESSAGE = 'Security check failed. Please try again.'

export function turnstileWidgetOptions(input: {
  form: TurnstileForm
  locale: string
}): TurnstileWidgetOptions {
  return {
    theme: 'dark',
    appearance:
      input.form === 'newsletter' || input.form === 'resend' ? 'interaction-only' : 'always',
    size: 'flexible',
    language: input.locale === 'ar' ? 'ar' : 'en',
  }
}

export function isTurnstileConfigured(siteKey: string | null | undefined): boolean {
  return typeof siteKey === 'string' && siteKey.trim() !== ''
}

// True for the server's captcha refusal (form-guard) and for Supabase Auth's
// captcha errors. Used to show the signed line under the widget.
export function isCaptchaFailure(message: string | null | undefined): boolean {
  if (typeof message !== 'string') return false
  return message === CAPTCHA_FAILED_MESSAGE || /captcha/i.test(message)
}
