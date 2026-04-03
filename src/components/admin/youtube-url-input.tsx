'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { extractYouTubeId, getYouTubeThumbnailUrl } from '@/lib/youtube'

interface YouTubeUrlInputProps {
  value: string
  onChange: (videoId: string | null, rawUrl: string) => void
  error?: string
}

export function YouTubeUrlInput({ value, onChange, error }: YouTubeUrlInputProps) {
  // Determine if initial value is a bare video ID (11 chars, no slashes)
  const isVideoId = value && value.length === 11 && !value.includes('/')
  const [rawUrl, setRawUrl] = useState(isVideoId ? '' : value)
  const [extractedId, setExtractedId] = useState<string | null>(
    isVideoId ? value : (value ? extractYouTubeId(value) : null)
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
      setValidationError(id ? null : 'Could not extract video ID from this URL')
    } else {
      setRawUrl('')
      setExtractedId(null)
      setValidationError(null)
    }
  }, [value])

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
      setValidationError('Could not extract video ID from this URL')
      onChange(null, url)
    }
  }

  return (
    <div className="space-y-2">
      <Input
        value={rawUrl}
        onChange={handleChange}
        placeholder="Paste YouTube URL (e.g., youtube.com/watch?v=...)"
        aria-invalid={!!(error || validationError)}
      />
      {(error || validationError) && (
        <p className="text-sm text-destructive">{error || validationError}</p>
      )}
      {extractedId && (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getYouTubeThumbnailUrl(extractedId)}
            alt="Video thumbnail"
            width={120}
            height={68}
            className="rounded border border-border"
          />
          <span className="text-sm text-muted-foreground">
            ID: {extractedId}
          </span>
        </div>
      )}
    </div>
  )
}
