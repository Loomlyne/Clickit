import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CAPTCHA_FAILED_MESSAGE,
  isCaptchaFailure,
  isTurnstileConfigured,
  turnstileWidgetOptions,
  type TurnstileForm,
} from '../../src/lib/turnstile-widget.ts'

// Signed option turnstile-A (mockups/DECISIONS.md, 2026-10-20): Managed widget,
// dark theme, full form width on sign-in, sign-up, reset and contact; the
// footer newsletter uses interaction-only.

test('newsletter uses interaction-only, dark, in the active locale (ar)', () => {
  const options = turnstileWidgetOptions({ form: 'newsletter', locale: 'ar' })
  assert.equal(options.appearance, 'interaction-only')
  assert.equal(options.theme, 'dark')
  assert.equal(options.language, 'ar')
})

test('sign-in shows the box always, dark, full width', () => {
  const options = turnstileWidgetOptions({ form: 'sign-in', locale: 'en' })
  assert.equal(options.appearance, 'always')
  assert.equal(options.theme, 'dark')
  assert.equal(options.size, 'flexible')
  assert.equal(options.language, 'en')
})

test('every form except the newsletter shows the box always', () => {
  const forms: TurnstileForm[] = ['sign-in', 'sign-up', 'reset', 'contact']
  for (const form of forms) {
    assert.equal(turnstileWidgetOptions({ form, locale: 'en' }).appearance, 'always', form)
  }
})

test('an unknown locale falls back to English', () => {
  assert.equal(turnstileWidgetOptions({ form: 'contact', locale: 'fr' }).language, 'en')
})

test('isTurnstileConfigured needs a non-blank site key', () => {
  assert.equal(isTurnstileConfigured(''), false)
  assert.equal(isTurnstileConfigured('   '), false)
  assert.equal(isTurnstileConfigured(undefined), false)
  assert.equal(isTurnstileConfigured(null), false)
  assert.equal(isTurnstileConfigured('0x4AAAAAAAexample'), true)
})

test('isCaptchaFailure matches the signed line and Supabase captcha errors only', () => {
  assert.equal(CAPTCHA_FAILED_MESSAGE, 'Security check failed. Please try again.')
  assert.equal(isCaptchaFailure(CAPTCHA_FAILED_MESSAGE), true)
  assert.equal(isCaptchaFailure('captcha verification process failed'), true)
  assert.equal(isCaptchaFailure('Captcha protection: request disallowed'), true)
  assert.equal(isCaptchaFailure('Too many requests. Please try again in a little while.'), false)
  assert.equal(isCaptchaFailure('Invalid login credentials'), false)
  assert.equal(isCaptchaFailure(undefined), false)
})
