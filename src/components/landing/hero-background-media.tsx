'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import {
  kickMutedAutoplay,
  sendYouTubeCommand,
  syncMp4Playback,
} from '@/lib/media-audio'

/**
 * Hero background video player.
 *
 * MP4 starts muted for autoplay; the speaker button is the user gesture that
 * unlocks audio. YouTube embeds start muted in the URL and are unmuted via
 * postMessage once the visitor taps the button.
 *
 * Important: never mark the UI as "unmuted" unless unmuted play() actually
 * succeeded. Mobile browsers almost always reject unmuted autoplay — if we
 * claim unlock anyway, kickMutedAutoplay remutes the element while the button
 * still shows sound-on (broken on portrait phones).
 */
export function HeroBackgroundMedia({
  mp4Url,
  ytId,
  muted,
  title,
  vertical = false,
}: {
  mp4Url: string | null
  ytId: string | null
  muted: boolean
  title: string
  vertical?: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const ytReadyRef = useRef(false)
  const pendingYtUnmuteRef = useRef(false)
  const wantSoundRef = useRef(false)
  const [audioUnlocked, setAudioUnlocked] = useState(false)
  const [buttonMuted, setButtonMuted] = useState(true)

  const isAudioPlaying = audioUnlocked && !buttonMuted

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
      // Touch the element synchronously while the click gesture is still active.
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
          if (!muted) applyYouTubeMute(false)
          flushPendingYouTubeUnmute()
        }
      } catch {
        // Non-JSON postMessages from the embed are expected noise.
      }
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [ytId, muted, flushPendingYouTubeUnmute, applyYouTubeMute])

  // Keep autoplay alive — browsers often block the first attempt until data arrives.
  // After the visitor unlocks sound, resume unmuted; never remute behind their back.
  useEffect(() => {
    if (!mp4Url) return
    const video = videoRef.current
    if (!video) return

    const ensurePlaying = () => {
      if (!video.paused) return
      if (wantSoundRef.current) {
        syncMp4Playback(video, false)
      } else {
        kickMutedAutoplay(video)
      }
    }

    ensurePlaying()
    video.addEventListener('loadeddata', ensurePlaying)
    video.addEventListener('canplay', ensurePlaying)
    video.addEventListener('stalled', ensurePlaying)
    video.addEventListener('suspend', ensurePlaying)
    return () => {
      video.removeEventListener('loadeddata', ensurePlaying)
      video.removeEventListener('canplay', ensurePlaying)
      video.removeEventListener('stalled', ensurePlaying)
      video.removeEventListener('suspend', ensurePlaying)
    }
  }, [mp4Url])

  // When admin enables hero audio, try unmuted autoplay for high-MEI browsers.
  // Only flip the UI to "unmuted" if play() actually succeeds — mobile Safari /
  // Chrome reject this without a gesture and would otherwise desync the button.
  useEffect(() => {
    if (muted || !mp4Url) return
    const video = videoRef.current
    if (!video) return

    let cancelled = false
    video.muted = false
    video.volume = 1
    void video
      .play()
      .then(() => {
        if (cancelled || video.muted) return
        wantSoundRef.current = true
        setAudioUnlocked(true)
        setButtonMuted(false)
      })
      .catch(() => {
        if (cancelled) return
        wantSoundRef.current = false
        kickMutedAutoplay(video)
      })

    return () => {
      cancelled = true
    }
  }, [muted, mp4Url])

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

  const muteButton = (
    <button
      type="button"
      onClick={handleMuteToggle}
      aria-label={isAudioPlaying ? 'Mute' : 'Unmute'}
      className="pointer-events-auto absolute top-[calc(var(--nav-h)+0.75rem)] right-4 z-30 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
    >
      {isAudioPlaying ? (
        <Volume2 className="h-[15px] w-[15px]" />
      ) : (
        <VolumeX className="h-[15px] w-[15px]" />
      )}
    </button>
  )

  if (mp4Url) {
    return (
      <>
        <video
          ref={videoRef}
          src={mp4Url}
          autoPlay
          muted={!audioUnlocked || buttonMuted}
          loop
          playsInline
          preload="auto"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
        {muteButton}
      </>
    )
  }

  if (ytId) {
    const origin =
      typeof window !== 'undefined' ? encodeURIComponent(window.location.origin) : ''
    const src = `https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&mute=1&loop=1&playlist=${ytId}&controls=0&showinfo=0&rel=0&modestbranding=1&iv_load_policy=3&playsinline=1&disablekb=1&fs=0&cc_load_policy=0&enablejsapi=1&origin=${origin}`
    const coverStyle: CSSProperties = vertical
      ? {
          height: '177.78vw',
          minHeight: '100dvh',
          width: '56.25dvh',
          minWidth: '100vw',
        }
      : {
          width: '177.78dvh',
          minWidth: '100vw',
          height: '56.25vw',
          minHeight: '100dvh',
        }
    return (
      <>
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <iframe
            ref={iframeRef}
            src={src}
            allow="autoplay; encrypted-media"
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            style={coverStyle}
            title={title}
            onLoad={handleIframeLoad}
          />
        </div>
        {muteButton}
      </>
    )
  }

  return null
}
