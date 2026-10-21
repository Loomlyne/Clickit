'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { finalizeImageUploadCore, type ImageUploadPorts } from '@/lib/admin/image-upload'
import { getPublicMediaOrigin } from '@/lib/supabase-media'
import { requireSignedInUser } from '@/server/auth-guards'
import { getWorkerEnv } from '@/server/cloudflare'
import { MEDIA_SAVE_CONFLICT, readMediaReferenceUrls, type ReferenceDb } from '@/server/media-references'
import { liveKeysForUrl, r2KeysForUrl } from '@/server/r2-keys'
import { finalizeUploadedObject, type FinalizeBucket } from '@/server/upload-finalize'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function updateProfile(data: { display_name: string }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('profiles')
    .update({
      display_name: data.display_name,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) throw new Error(error.message)

  revalidatePath('/profile')
  return { success: true }
}

const finalizeAvatarSchema = z.object({
  key: z.string().min(1).max(300),
  variantKeys: z.array(z.string().max(400)).max(3).default([]),
})

/**
 * Direct-to-R2 avatar finalize (plan 02-15). The browser has PUT the object; this
 * takes only the key. The signed-in user's own id is the owner: finalize refuses a
 * key that is not under avatars/<that id>/, and only that user's profile row is
 * written. No admin audit row (a user's own avatar). The old FormData uploadAvatar was
 * removed in plan 02-19.
 */
export async function finalizeAvatarUpload(
  input: z.input<typeof finalizeAvatarSchema>
): Promise<{ success: boolean; error?: string; data?: string; mediaCleanupFailed?: boolean }> {
  try {
    const userId = await requireSignedInUser()
    const parsed = finalizeAvatarSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: 'Invalid upload' }
    const supabase = await createClient()
    const bucket = (await getWorkerEnv()).MEDIA as unknown as FinalizeBucket
    const mediaOrigin = getPublicMediaOrigin()

    // Compare-and-swap (deferred item 23): only while avatar_url still holds what was read
    // (two tabs saving at once); 0 rows is a conflict and nothing that was live is deleted.
    const writeAvatar = async (url: string | null, expected: string | null) => {
      const q = supabase
        .from('profiles')
        .update({ avatar_url: url, updated_at: new Date().toISOString() })
        .eq('id', userId)
      const { data, error } = await (expected === null
        ? q.is('avatar_url', null)
        : q.eq('avatar_url', expected)
      ).select('id')
      if (error) return error.message
      return Array.isArray(data) && data.length > 0 ? null : MEDIA_SAVE_CONFLICT
    }

    const ports: ImageUploadPorts = {
      finalize: (i) =>
        finalizeUploadedObject({
          kind: 'avatar',
          userId: i.userId,
          key: i.key,
          variantKeys: i.variantKeys,
          liveKeys: i.liveKeys,
          bucket,
        }),
      db: {
        // The only place this user's avatar is live (Phase 01.1 review guard).
        readLive: async () => {
          const { data, error } = await supabase
            .from('profiles')
            .select('avatar_url')
            .eq('id', userId)
            .single()
          if (error || !data) return { urls: [], error: error?.message ?? 'Could not load profile' }
          return { urls: [data.avatar_url ?? null], error: null }
        },
        readCurrent: async () => {
          const { data, error } = await supabase
            .from('profiles')
            .select('avatar_url')
            .eq('id', userId)
            .single()
          if (error || !data) return { url: null, error: error?.message ?? 'Could not load profile' }
          return { url: data.avatar_url ?? null, error: null }
        },
        write: (_target, url, expected) => writeAvatar(url, expected),
        restore: (_target, previous, expected) => writeAvatar(previous, expected),
      },
      media: { delete: (keys) => bucket.delete(keys) },
      audit: null,
      mediaOrigin,
      previousR2Keys: (url) => r2KeysForUrl(url, mediaOrigin),
      liveKeys: (url) => liveKeysForUrl(url, mediaOrigin),
      // Read-only, service client: an avatar file may also be used by a show or the site, and
      // only the service client sees every row. Nothing is written with it; created lazily so
      // a failure counts as an unreadable reference (fail closed: nothing deleted).
      references: async () => readMediaReferenceUrls(createAdminClient() as unknown as ReferenceDb),
    }

    const result = await finalizeImageUploadCore(ports, {
      kind: 'avatar',
      slot: null,
      showId: null,
      key: parsed.data.key,
      variantKeys: parsed.data.variantKeys,
      userId,
      target: { type: 'profile', userId },
      live: { type: 'profile', userId },
    })
    if (result.success || result.wrote) {
      revalidatePath('/profile')
      revalidatePath('/', 'layout') // refresh navbar avatar
    }
    return result
  } catch (err) {
    console.error('[finalizeAvatarUpload] failed', err)
    return { success: false, error: err instanceof Error ? err.message : 'Upload failed' }
  }
}
