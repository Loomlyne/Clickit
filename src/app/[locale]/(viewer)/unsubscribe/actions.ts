'use server'

import { getLinkSecret } from '@/server/email/link-secret'
import { unsubscribeRequest } from '@/server/email/public-links-core'
import { createUnsubscribeStore } from '@/server/email/public-links-store'

export type UnsubscribeOutcome = 'done' | 'invalid' | 'error'

/**
 * The button on /unsubscribe. Same decision as the one-click POST route; the page
 * itself never writes. Logs the outcome only (no token, no address).
 */
export async function confirmUnsubscribe(token: string): Promise<UnsubscribeOutcome> {
  if (typeof token !== 'string') return 'invalid'
  try {
    const result = await unsubscribeRequest({
      token,
      secret: await getLinkSecret(),
      now: Math.floor(Date.now() / 1000),
      store: createUnsubscribeStore(),
    })
    if (result.ok) {
      console.info('[email/unsubscribe] action outcome=ok')
      return 'done'
    }
    console.warn(`[email/unsubscribe] action outcome=${result.reason}`)
    return result.reason === 'invalid' ? 'invalid' : 'error'
  } catch {
    console.error('[email/unsubscribe] action outcome=error')
    return 'error'
  }
}
