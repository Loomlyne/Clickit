'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { extractYouTubeId } from '@/lib/youtube'
import { resolveSupabaseVideoUrl } from '@/lib/supabase-media'
import {
  resumeMp4OutsideGesture,
  sendYouTubeCommand,
  syncMp4Playback,
} from '@/lib/media-audio'

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
  const wantSoundRef = useRef(false)
  const [audioUnlocked, setAudioUnlocked] = useState(false)
  const [buttonMuted, setButtonMuted] = useState(true)
  const [ytIframeReady, setYtIframeReady] = useState(false)

  const isAudioPlaying = audioUnlocked && !buttonMuted
  const ytId =
    !reducedMotion && type === 'youtube' ? extractYouTubeId(url) : null
  const mp4Src =
    !reducedMotion && type === 'mp4' ? resolveSupabaseVideoUrl(url) : null

  // Defer creating the YouTube iframe (~500KB of YouTube JS) until just after
  // the initial paint, so it doesn't compete with critical page load. The
  // `timeout` bounds the worst case so the hero never feels sluggish to start.
  useEffect(() => {
    if (!ytId) return
    const hasIdleCallback = typeof window.requestIdleCallback === 'function'
    if (hasIdleCallback) {
      const id = window.requestIdleCallback(() => setYtIframeReady(true), {
        timeout: 300,
      })
      return () => window.cancelIdleCallback(id)
    }
    const id = window.setTimeout(() => setYtIframeReady(true), 300)
    return () => window.clearTimeout(id)
  }, [ytId])

  const applyYouTubeMute = useCallback((shouldMute: boolean) => {
    const iframe = iframeRef.current
    if (!iframe || !ytReadyRef.current) return
    if (shouldMute) {
      sendYouTubeCommand(iframe, 'mute')
    } else {
      sendYouTubeCommand(iframe, 'unMute')
      sendYouTubeCommand(iframe, 'setVolume', [100])
      sendYouTubeCommand(iframe, 'playVideo')
    }
  }, [])

  const handleMuteToggle = useCallback(() => {
    const video = videoRef.current

    if (!audioUnlocked) {
      if (video) syncMp4Playback(video, false)

      const iframe = iframeRef.current
      if (iframe) {
        if (ytReadyRef.current) {
          applyYouTubeMute(false)
        } else {
          pendingYtUnmuteRef.current = true
        }
      }

      wantSoundRef.current = true
      setAudioUnlocked(true)
      setButtonMuted(false)
      return
    }

    const next = !buttonMuted
    wantSoundRef.current = !next
    if (video) syncMp4Playback(video, next)
    applyYouTubeMute(next)
    setButtonMuted(next)
  }, [audioUnlocked, buttonMuted, applyYouTubeMute])

  const flushPendingYouTubeUnmute = useCallback(() => {
    if (!pendingYtUnmuteRef.current) return
    const iframe = iframeRef.current
    if (!iframe || !ytReadyRef.current) return
    pendingYtUnmuteRef.current = false
    applyYouTubeMute(false)
  }, [applyYouTubeMute])

  useEffect(() => {
    if (type !== 'mp4' || reducedMotion) return
    const video = videoRef.current
    if (!video) return

    const ensurePlaying = () => {
      if (!video.paused) return
      void resumeMp4OutsideGesture(video, wantSoundRef.current).then(
        (soundOn) => {
          if (!soundOn && wantSoundRef.current) {
            wantSoundRef.current = false
            setButtonMuted(true)
          }
        }
      )
    }

    ensurePlaying()
    video.addEventListener('loadeddata', ensurePlaying)
    video.addEventListener('canplay', ensurePlaying)
    video.addEventListener('stalled', ensurePlaying)
    return () => {
      video.removeEventListener('loadeddata', ensurePlaying)
      video.removeEventListener('canplay', ensurePlaying)
      video.removeEventListener('stalled', ensurePlaying)
    }
  }, [type, mp4Src, url, reducedMotion])

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
      applyYouTubeMute(false)
    }
  }, [audioUnlocked, buttonMuted, applyYouTubeMute])

  if (reducedMotion) return null

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
          autoPlay
          muted={!audioUnlocked || buttonMuted}
          loop
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
    typeof window !== 'undefined'
      ? encodeURIComponent(window.location.origin)
      : ''
  const src = `https://www.youtube-nocookie.com/embed/${ytId}?autoplay=${autoplayFlag}&mute=1&loop=${loopFlag}&playlist=${ytId}&controls=0&rel=0&showinfo=0&iv_load_policy=3&modestbranding=1&playsinline=1&enablejsapi=1&origin=${origin}`

  return (
    <>
      {ytIframeReady && (
        <iframe
          ref={iframeRef}
          src={src}
          allow="autoplay; encrypted-media"
          title={title}
          className={className}
          aria-hidden
          onLoad={handleIframeLoad}
        />
      )}
      {muteButton}
    </>
  )
}
