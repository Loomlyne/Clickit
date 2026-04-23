'use client'

import { useRef, useState } from 'react'
import { useLocale } from 'next-intl'
import { Camera } from 'lucide-react'
import { toast } from 'sonner'
import { uploadAvatar } from '@/app/[locale]/(viewer)/profile/actions'

interface AvatarUploadProps {
  currentUrl: string | null
  fallbackInitial: string
}

export function AvatarUpload({ currentUrl, fallbackInitial }: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const objectUrlRef = useRef<string | null>(null)
  const [preview, setPreview] = useState<string | null>(currentUrl)
  const [uploading, setUploading] = useState(false)
  const locale = useLocale()
  const isArabic = locale === 'ar'

  async function handleFile(file: File) {
    if (file.size > 2 * 1024 * 1024) {
      toast.error(isArabic ? 'يجب أن تكون الصورة أقل من 2 م.ب.' : 'Image must be under 2MB')
      return
    }

    // Revoke previous blob URL to avoid memory leak
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)

    // Show instant preview
    const objectUrl = URL.createObjectURL(file)
    objectUrlRef.current = objectUrl
    setPreview(objectUrl)
    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('avatar', file)
      const result = await uploadAvatar(formData)
      URL.revokeObjectURL(objectUrl)
      objectUrlRef.current = null
      setPreview(result.avatarUrl)
      toast.success(isArabic ? 'تم تحديث الصورة الشخصية' : 'Profile picture updated')
    } catch (err) {
      setPreview(currentUrl) // revert on failure
      console.error('[avatar-upload] upload failed:', err instanceof Error ? err.message : err)
      toast.error(isArabic ? 'فشل الرفع' : (err instanceof Error ? err.message : 'Upload failed'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      disabled={uploading}
      className="group relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 shadow-[0_18px_48px_rgba(0,0,0,0.28)] transition-all hover:border-white/20"
      style={{ background: preview ? undefined : 'linear-gradient(135deg, rgba(96,115,255,0.85), rgba(46,57,121,0.92))' }}
    >
      {preview ? (
        <img src={preview} alt="Profile" className="size-full object-cover" />
      ) : (
        <span className="text-3xl font-semibold text-white">{fallbackInitial}</span>
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
        {uploading ? (
          <div className="size-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        ) : (
          <Camera className="size-5 text-white" />
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
          e.target.value = '' // allow re-selecting same file
        }}
      />
    </button>
  )
}
