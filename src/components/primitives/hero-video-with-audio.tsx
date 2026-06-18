'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { extractYouTubeId } from '@/lib/youtube'
import { resolveSupabaseVideoUrl } from '@/lib/supabase-media'

function sendYouTubeCommand(
  iframe: HTMLIFrameElement,
  func: string,
  args: unknown[] = []
) {
  iframe.contentWindow?.postMessage(
    JSON.stringify({ event: 'command', func, args }),
    '*'
  )
}

/**
 * Watch/browse hero video with a visitor-controlled mute toggle.
 * Starts muted for autoplay; first button click unlocks audio.
 */
export function HeroVideoWithAudio({
  url,
  type,
  className,
  reducedMotion,
  poster,
  title = 'Hero background',
}: {
  url: string
  type: 'mp4' | 'youtube'
  className: string
  reducedMotion?: boolean
  poster?: string
  title?: string
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const ytReadyRef = useRef(false)
  const pendingYtUnmuteRef = useRef(false)
  const [audioUnlocked, setAudioUnlocked] = useState(false)
  const [buttonMuted, setButtonMuted] = useState(true)

  const isAudioPlaying = audioUnlocked && !buttonMuted
  const ytId = type === 'youtube' ? extractYouTubeId(url) : null
  const mp4Src = type === 'mp4' ? resolveSupabaseVideoUrl(url) : null

  const forceUnlock = useCallback(() => {
    setAudioUnlocked(true)
    setButtonMuted(false)

    const video = videoRef.current
    if (video) {
      video.muted = false
      video.volume = 1
      void video.play().catch(() => {})
    }

    const iframe = iframeRef.current
    if (iframe) {
      if (ytReadyRef.current) {
        sendYouTubeCommand(iframe, 'unMute')
        sendYouTubeCommand(iframe, 'setVolume', [100])
        sendYouTubeCommand(iframe, 'playVideo')
      } else {
        pendingYtUnmuteRef.current = true
      }
    }
  }, [])

  const handleMuteToggle = useCallback(() => {
    if (!audioUnlocked) {
      forceUnlock()
      return
    }
    const next = !buttonMuted
    setButtonMuted(next)

    const video = videoRef.current
    if (video) video.muted = next

    const iframe = iframeRef.current
    if (iframe && ytReadyRef.current) {
      if (next) {
        sendYouTubeCommand(iframe, 'mute')
      } else {
        sendYouTubeCommand(iframe, 'unMute')
        sendYouTubeCommand(iframe, 'setVolume', [100])
      }
    }
  }, [audioUnlocked, buttonMuted, forceUnlock])

  const flushPendingYouTubeUnmute = useCallback(() => {
    if (!pendingYtUnmuteRef.current) return
    const iframe = iframeRef.current
    if (!iframe || !ytReadyRef.current) return
    pendingYtUnmuteRef.current = false
    sendYouTubeCommand(iframe, 'unMute')
    sendYouTubeCommand(iframe, 'setVolume', [100])
    sendYouTubeCommand(iframe, 'playVideo')
  }, [])

  useEffect(() => {
    if (!ytId) return

    const onMessage = (event: MessageEvent) => {
      if (
        typeof event.origin !== 'string' ||
        !event.origin.includes('youtube')
      ) {
        return
      }
      try {
        const data =
          typeof event.data === 'string' ? JSON.parse(event.data) : event.data
        if (data?.event === 'onReady') {
          ytReadyRef.current = true
          flushPendingYouTubeUnmute()
        }
      } catch {
        // Non-JSON postMessages from the embed are expected noise.
      }
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [ytId, flushPendingYouTubeUnmute])

  const handleIframeLoad = useCallback(() => {
    const iframe = iframeRef.current
    if (!iframe?.contentWindow) return
    iframe.contentWindow.postMessage(
      JSON.stringify({ event: 'listening' }),
      '*'
    )
    if (audioUnlocked && !buttonMuted) {
      sendYouTubeCommand(iframe, 'unMute')
      sendYouTubeCommand(iframe, 'setVolume', [100])
    }
  }, [audioUnlocked, buttonMuted])

  const muteButton = (
    <button
      type="button"
      onClick={handleMuteToggle}
      aria-label={isAudioPlaying ? 'Mute' : 'Unmute'}
      className="pointer-events-auto absolute top-[calc(var(--nav-h)+0.75rem)] right-4 z-20 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
    >
      {isAudioPlaying ? (
        <Volume2 className="h-[15px] w-[15px]" />
      ) : (
        <VolumeX className="h-[15px] w-[15px]" />
      )}
    </button>
  )

  if (type === 'mp4') {
    return (
      <>
        <video
          ref={videoRef}
          src={mp4Src ?? url}
          autoPlay={!reducedMotion}
          muted={!audioUnlocked || buttonMuted}
          loop={!reducedMotion}
          playsInline
          preload="metadata"
          poster={poster}
          className={className}
          aria-hidden
        />
        {muteButton}
      </>
    )
  }

  if (!ytId) return null

  const autoplayFlag = reducedMotion ? '0' : '1'
  const loopFlag = reducedMotion ? '0' : '1'
  const origin =
    typeof window !== 'undefined' ? encodeURIComponent(window.location.origin) : ''
  const src = `https://www.youtube-nocookie.com/embed/${ytId}?autoplay=${autoplayFlag}&mute=1&loop=${loopFlag}&playlist=${ytId}&controls=0&rel=0&showinfo=0&iv_load_policy=3&modestbranding=1&playsinline=1&enablejsapi=1&origin=${origin}`

  return (
    <>
      <iframe
        ref={iframeRef}
        src={src}
        allow="autoplay; encrypted-media"
        title={title}
        className={className}
        aria-hidden
        onLoad={handleIframeLoad}
      />
      {muteButton}
    </>
  )
}
