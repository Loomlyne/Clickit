'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { extractYouTubeId, getYouTubeThumbnailUrl } from '@/lib/youtube'

interface YouTubeUrlInputProps {
  value: string
  onChange: (videoId: string | null, rawUrl: string) => void
  error?: string
}

export function YouTubeUrlInput({
  value,
  onChange,
  error,
}: YouTubeUrlInputProps) {
  const t = useTranslations('admin.youtubeInput')
  // Derive local input state from the value prop (bare video ID or full URL)
  const derive = (v: string) => {
    const isId = !!v && v.length === 11 && !v.includes('/')
    if (isId) return { rawUrl: '', extractedId: v as string | null, invalid: false }
    if (v) {
      const id = extractYouTubeId(v)
      return { rawUrl: v, extractedId: id, invalid: !id }
    }
    return { rawUrl: '', extractedId: null as string | null, invalid: false }
  }
  const [rawUrl, setRawUrl] = useState(() => derive(value).rawUrl)
  const [extractedId, setExtractedId] = useState<string | null>(
    () => derive(value).extractedId
  )
  const [invalid, setInvalid] = useState(() => derive(value).invalid)
  const validationError = invalid ? t('extractError') : null

  // Sync when value prop changes externally (e.g., form reset), during render
  const [prevValue, setPrevValue] = useState(value)
  if (prevValue !== value) {
    setPrevValue(value)
    const d = derive(value)
    setRawUrl(d.rawUrl)
    setExtractedId(d.extractedId)
    setInvalid(d.invalid)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const url = e.target.value
    setRawUrl(url)

    if (!url) {
      setExtractedId(null)
      setInvalid(false)
      onChange(null, '')
      return
    }

    const id = extractYouTubeId(url)
    setExtractedId(id)

    if (id) {
      setInvalid(false)
      onChange(id, url)
    } else {
      setInvalid(true)
      onChange(null, url)
    }
  }

  return (
    <div className="space-y-2">
      <Input
        value={rawUrl}
        onChange={handleChange}
        placeholder={t('placeholder')}
        aria-invalid={!!(error || validationError)}
      />
      {(error || validationError) && (
        <p className="text-destructive text-sm">{error || validationError}</p>
      )}
      {extractedId && (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getYouTubeThumbnailUrl(extractedId)}
            alt={t('thumbnailAlt')}
            width={120}
            height={68}
            className="border-border rounded border"
          />
          <span className="text-muted-foreground text-sm">
            {t('idLabel')} {extractedId}
          </span>
        </div>
      )}
    </div>
  )
}
