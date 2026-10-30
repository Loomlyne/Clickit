'use server'

import { getLinkSecret } from '@/server/email/link-secret'
import { newsletterConfirmRequest } from '@/server/email/public-links-core'
import { createNewsletterStore } from '@/server/email/public-links-store'

export type NewsletterConfirmOutcome = 'done' | 'already' | 'expired' | 'invalid' | 'error'

/**
 * The Confirm button on /newsletter/confirm. The only place (besides tests) that
 * sets confirmed_at; the page itself never writes, so a link scanner cannot consent
 * for the person. Logs the outcome only (no token, no address).
 */
export async function confirmNewsletter(token: string): Promise<NewsletterConfirmOutcome> {
  if (typeof token !== 'string') return 'invalid'
  try {
    const result = await newsletterConfirmRequest({
      token,
      secret: await getLinkSecret(),
      now: Math.floor(Date.now() / 1000),
      store: createNewsletterStore(),
    })
    console.info(`[email/newsletter] confirm action outcome=${result}`)
    if (result === 'confirmed') return 'done'
    if (result === 'unavailable') return 'error'
    return result
  } catch {
    console.error('[email/newsletter] confirm action outcome=error')
    return 'error'
  }
}
