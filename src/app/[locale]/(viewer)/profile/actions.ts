'use server'

import { revalidatePath } from 'next/cache'
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
