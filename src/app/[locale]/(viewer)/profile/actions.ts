'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function updateProfile(data: { display_name: string }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const file = formData.get('avatar') as File | null
  if (!file || file.size === 0) throw new Error('No file provided')

  if (file.size > 2 * 1024 * 1024) throw new Error('File must be under 2MB')

  const allowed = ['image/webp', 'image/png', 'image/jpeg']
  if (!allowed.includes(file.type)) throw new Error('Only WebP, PNG, or JPEG images allowed')

  const ext = file.type.split('/')[1] === 'jpeg' ? 'jpg' : file.type.split('/')[1]
  const path = `${user.id}/avatar.${ext}`

  // Upload (upsert replaces existing)
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true })

  if (uploadError) throw new Error(uploadError.message)

  // Get public URL
  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)

  // Add cache-bust param so browsers refetch after update
  const avatarUrl = `${urlData.publicUrl}?v=${Date.now()}`

  // Update profile row
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  if (profileError) throw new Error(profileError.message)

  revalidatePath('/profile')
  revalidatePath('/', 'layout') // refresh navbar avatar
  return { avatarUrl }
}
