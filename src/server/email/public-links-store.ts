import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { getLinkSecret } from './link-secret'
import {
  previewNewsletterConfirm,
  previewUnsubscribe,
  type NewsletterPreview,
  type NewsletterStore,
  type UnsubscribePreview,
  type UnsubscribeStore,
} from './public-links-core'

// Service-role stores for the login-free email links. Each call touches one row by
// the id carried in an already verified token. No address is selected or returned.

export function createUnsubscribeStore(): UnsubscribeStore {
  const admin = createAdminClient()
  return {
    async setNotify(userId, value) {
      const { error } = await admin
        .from('profiles')
        .update({ notify_new_episodes: value })
        .eq('id', userId)
      if (error) throw new Error('profiles update failed')
    },
    async getNotify(userId) {
      const { data, error } = await admin
        .from('profiles')
        .select('notify_new_episodes')
        .eq('id', userId)
        .maybeSingle()
      if (error) throw new Error('profiles read failed')
      return data ? data.notify_new_episodes : null
    },
  }
}

export function createNewsletterStore(): NewsletterStore {
  const admin = createAdminClient()
  return {
    async confirm(subscriberId) {
      const { data, error } = await admin
        .from('newsletter_subscribers')
        .update({ confirmed_at: new Date().toISOString(), status: 'active' })
        .eq('id', subscriberId)
        .is('confirmed_at', null)
        .select('id')
      if (error) throw new Error('newsletter confirm failed')
      return data && data.length > 0 ? 'confirmed' : 'already'
    },
    async isConfirmed(subscriberId) {
      const { data, error } = await admin
        .from('newsletter_subscribers')
        .select('confirmed_at')
        .eq('id', subscriberId)
        .maybeSingle()
      if (error) throw new Error('newsletter read failed')
      return Boolean(data?.confirmed_at)
    },
  }
}

/** Locale of a viewer for the GET redirect: profiles.locale if en/ar, else null. */
export async function readProfileLocale(userId: string): Promise<'en' | 'ar' | null> {
  try {
    const { data } = await createAdminClient()
      .from('profiles')
      .select('locale')
      .eq('id', userId)
      .maybeSingle()
    return data?.locale === 'en' || data?.locale === 'ar' ? data.locale : null
  } catch {
    return null
  }
}

const nowSec = () => Math.floor(Date.now() / 1000)

/** Read-only state for the /unsubscribe page. Never writes. */
export async function unsubscribePagePreview(token: string): Promise<UnsubscribePreview> {
  if (!token) return 'invalid'
  try {
    return await previewUnsubscribe({
      token,
      secret: await getLinkSecret(),
      now: nowSec(),
      store: createUnsubscribeStore(),
    })
  } catch {
    return 'unavailable'
  }
}

/** Read-only state for the /newsletter/confirm page. Never writes. */
export async function newsletterPagePreview(token: string): Promise<NewsletterPreview> {
  if (!token) return 'invalid'
  try {
    return await previewNewsletterConfirm({
      token,
      secret: await getLinkSecret(),
      now: nowSec(),
      store: createNewsletterStore(),
    })
  } catch {
    return 'unavailable'
  }
}
