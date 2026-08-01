'use client'

import { useState, useEffect } from 'react'
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
  // Determine if initial value is a bare video ID (11 chars, no slashes)
  const isVideoId = value && value.length === 11 && !value.includes('/')
  const [rawUrl, setRawUrl] = useState(isVideoId ? '' : value)
  const [extractedId, setExtractedId] = useState<string | null>(
    isVideoId ? value : value ? extractYouTubeId(value) : null
  )
  const [validationError, setValidationError] = useState<string | null>(null)

  // Sync when value prop changes externally (e.g., form reset)
  useEffect(() => {
    const isId = value && value.length === 11 && !value.includes('/')
    if (isId) {
      setExtractedId(value)
      setRawUrl('')
      setValidationError(null)
    } else if (value) {
      setRawUrl(value)
      const id = extractYouTubeId(value)
      setExtractedId(id)
      setValidationError(id ? null : t('extractError'))
    } else {
      setRawUrl('')
      setExtractedId(null)
      setValidationError(null)
    }
  }, [value, t])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const url = e.target.value
    setRawUrl(url)

    if (!url) {
      setExtractedId(null)
      setValidationError(null)
      onChange(null, '')
      return
    }

    const id = extractYouTubeId(url)
    setExtractedId(id)

    if (id) {
      setValidationError(null)
      onChange(id, url)
    } else {
      setValidationError(t('extractError'))
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
