'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { finalizeImageUploadCore, type ImageUploadPorts } from '@/lib/admin/image-upload'
import { getPublicMediaOrigin } from '@/lib/supabase-media'
import { requireSignedInUser } from '@/server/auth-guards'
import { getWorkerEnv } from '@/server/cloudflare'
import { r2KeysForUrl } from '@/server/r2-keys'
import { finalizeUploadedObject, type FinalizeBucket } from '@/server/upload-finalize'
import {
  assertPublicMediaWriteReady,
  mirrorPublicMediaObject,
  prepareMirroredPublicMediaDeletion,
  R2MediaRollbackError,
} from '@/lib/r2-media'
import { createClient } from '@/lib/supabase/server'
import { stripStorageCacheBust } from '@/lib/supabase-media'

function getAvatarStoragePath(url: string | null | undefined) {
  if (!url) return null
  try {
    const parsed = new URL(url)
    const prefix = '/storage/v1/object/public/avatars/'
    if (!parsed.pathname.startsWith(prefix)) return null
    const path = decodeURIComponent(parsed.pathname.slice(prefix.length))
    return path && !path.startsWith('/') && !path.split('/').includes('..')
      ? path
      : null
  } catch {
    return null
  }
}

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

export async function uploadAvatar(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const file = formData.get('avatar') as File | null
  if (!file || file.size === 0) throw new Error('No file provided')

  if (file.size > 2 * 1024 * 1024) throw new Error('File must be under 2MB')

  const allowed = ['image/webp', 'image/png', 'image/jpeg']
  if (!allowed.includes(file.type))
    throw new Error('Only WebP, PNG, or JPEG images allowed')

  const { data: previousProfile, error: previousProfileError } = await supabase
    .from('profiles')
    .select('avatar_url')
    .eq('id', user.id)
    .single()
  if (previousProfileError || !previousProfile) {
    throw new Error(previousProfileError?.message ?? 'Could not load profile')
  }

  const cleanupAvatarMedia = async (targetPath: string) => {
    try {
      const deletion = await prepareMirroredPublicMediaDeletion('avatars', [
        targetPath,
      ])
      const { error } = await supabase.storage
        .from('avatars')
        .remove([targetPath])
      if (error) {
        await deletion.rollback()
        console.error('[uploadAvatar] media cleanup failed', error)
        return
      }
      if (!(await deletion.commit())) {
        console.error('[uploadAvatar] media cleanup failed')
      }
    } catch (error) {
      console.error('[uploadAvatar] media cleanup failed', error)
    }
  }

  const ext =
    file.type.split('/')[1] === 'jpeg' ? 'jpg' : file.type.split('/')[1]
  const path = `${user.id}/avatar-${Date.now()}.${ext}`

  assertPublicMediaWriteReady()

  // Upload (upsert replaces existing)
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true })

  if (uploadError) throw new Error(uploadError.message)

  try {
    await mirrorPublicMediaObject({
      bucket: 'avatars',
      key: path,
      body: file,
      contentType: file.type,
    })
  } catch (error) {
    if (error instanceof R2MediaRollbackError) throw error
    const { error: removeError } = await supabase.storage
      .from('avatars')
      .remove([path])
    if (removeError) {
      console.error('[uploadAvatar] source cleanup failed', removeError)
    }
    throw error
  }

  // Get public URL
  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)

  // Add cache-bust param so browsers refetch after update
  const storedAvatarUrl = `${urlData.publicUrl}?v=${Date.now()}`

  // Update profile row
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ avatar_url: storedAvatarUrl, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  if (profileError) {
    await cleanupAvatarMedia(path)
    throw new Error(profileError.message)
  }

  const previousPath = getAvatarStoragePath(previousProfile.avatar_url)
  if (previousPath && previousPath !== path) {
    await cleanupAvatarMedia(previousPath)
  }

  revalidatePath('/profile')
  revalidatePath('/', 'layout') // refresh navbar avatar
  return {
    avatarUrl:
      stripStorageCacheBust(storedAvatarUrl) ?? storedAvatarUrl,
  }
}

const finalizeAvatarSchema = z.object({
  key: z.string().min(1).max(300),
  variantKeys: z.array(z.string().max(400)).max(3).default([]),
})

/**
 * Direct-to-R2 avatar finalize (plan 02-15). The browser has PUT the object; this
 * takes only the key. The signed-in user's own id is the owner: finalize refuses a
 * key that is not under avatars/<that id>/, and only that user's profile row is
 * written. No admin audit row (a user's own avatar). The old uploadAvatar above
 * stays until plan 02-19.
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

    const writeAvatar = async (url: string | null) => {
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: url, updated_at: new Date().toISOString() })
        .eq('id', userId)
      return error ? error.message : null
    }

    const ports: ImageUploadPorts = {
      finalize: (i) =>
        finalizeUploadedObject({
          kind: 'avatar',
          userId: i.userId,
          key: i.key,
          variantKeys: i.variantKeys,
          bucket,
        }),
      db: {
        readCurrent: async () => {
          const { data, error } = await supabase
            .from('profiles')
            .select('avatar_url')
            .eq('id', userId)
            .single()
          if (error || !data) return { url: null, error: error?.message ?? 'Could not load profile' }
          return { url: data.avatar_url ?? null, error: null }
        },
        write: (_target, url) => writeAvatar(url),
        restore: (_target, previous) => writeAvatar(previous),
      },
      media: { delete: (keys) => bucket.delete(keys) },
      audit: null,
      mediaOrigin,
      previousR2Keys: (url) => r2KeysForUrl(url, mediaOrigin),
    }

    const result = await finalizeImageUploadCore(ports, {
      kind: 'avatar',
      slot: null,
      showId: null,
      key: parsed.data.key,
      variantKeys: parsed.data.variantKeys,
      userId,
      target: { type: 'profile', userId },
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
