'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { Volume2, VolumeX } from 'lucide-react'

/**
 * Trusted DOM events that grant "user activation" for unmuting media.
 * Scroll/wheel do NOT count — listening to them never unlocks audio.
 */
const USER_ACTIVATION_EVENTS = [
  'pointerdown',
  'touchstart',
  'click',
  'keydown',
] as const

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
 * Hero background video player.
 *
 * When the admin enables audio we:
 * 1. Attempt unmuted autoplay immediately (works for returning visitors /
 *    browsers with a high media-engagement score).
 * 2. If blocked, keep muted autoplay so the hero still plays. A small
 *    speaker button (top-right, below the navbar) lets the visitor unmute
 *    with one tap — this IS the required user gesture browsers need.
 * 3. After unlock the user can re-mute / unmute via the same button.
 *
 * YouTube always starts muted in the embed URL (required for autoplay) and is
 * unmuted via the IFrame API once audio is unlocked.
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
  /**
   * When true the source clip is 9:16 (vertical). MP4 covers via object-cover
   * regardless, but the YouTube iframe needs portrait cover sizing so a vertical
   * clip fills a portrait viewport instead of being letterboxed.
   */
  vertical?: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const ytReadyRef = useRef(false)
  const pendingYtUnmuteRef = useRef(false)
  // audioUnlocked: browser has granted audio (gesture received or high MEI auto-play)
  const [audioUnlocked, setAudioUnlocked] = useState(false)
  // manualMute: user re-muted after unlock — they can toggle freely from here
  const [manualMute, setManualMute] = useState(false)

  const isAudioPlaying = !muted && audioUnlocked && !manualMute

  const unlockAudio = useCallback(() => {
    if (muted || audioUnlocked) return
    setAudioUnlocked(true)

    const video = videoRef.current
    if (video) {
      video.muted = false
      video.volume = 1
      // play() must run in the same user-gesture turn on iOS Safari.
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
  }, [muted, audioUnlocked])

  const handleMuteToggle = useCallback(() => {
    if (!audioUnlocked) {
      // Button click IS the user gesture — unlock audio immediately.
      unlockAudio()
      return
    }
    const next = !manualMute
    setManualMute(next)

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
  }, [audioUnlocked, manualMute, unlockAudio])

  const flushPendingYouTubeUnmute = useCallback(() => {
    if (!pendingYtUnmuteRef.current || muted) return
    const iframe = iframeRef.current
    if (!iframe || !ytReadyRef.current) return
    pendingYtUnmuteRef.current = false
    sendYouTubeCommand(iframe, 'unMute')
    sendYouTubeCommand(iframe, 'setVolume', [100])
    sendYouTubeCommand(iframe, 'playVideo')
  }, [muted])

  // YouTube IFrame API handshake: listen for onReady, then honour any queued unmute.
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
          const iframe = iframeRef.current
          if (!muted && iframe) {
            // High media-engagement browsers may allow unmute without a gesture.
            sendYouTubeCommand(iframe, 'unMute')
            sendYouTubeCommand(iframe, 'setVolume', [100])
            sendYouTubeCommand(iframe, 'playVideo')
          }
          flushPendingYouTubeUnmute()
        }
      } catch {
        // Non-JSON postMessages from the embed are expected noise.
      }
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [ytId, muted, flushPendingYouTubeUnmute])

  // MP4: try unmuted autoplay first; fall back to muted autoplay if blocked.
  useEffect(() => {
    if (muted || !mp4Url) return
    const video = videoRef.current
    if (!video) return

    video.muted = false
    video.volume = 1
    void video
      .play()
      .then(() => {
        setAudioUnlocked(true)
      })
      .catch(() => {
        video.muted = true
        void video.play().catch(() => {})
      })
  }, [muted, mp4Url])

  // Global gesture listener — unlocks audio on any interaction while still locked.
  useEffect(() => {
    if (muted || audioUnlocked) return

    const onUserActivation = () => unlockAudio()

    const opts: AddEventListenerOptions = { capture: true, passive: true }
    for (const event of USER_ACTIVATION_EVENTS) {
      document.addEventListener(event, onUserActivation, opts)
    }
    return () => {
      for (const event of USER_ACTIVATION_EVENTS) {
        document.removeEventListener(event, onUserActivation, opts)
      }
    }
  }, [muted, audioUnlocked, unlockAudio])

  const handleIframeLoad = useCallback(() => {
    const iframe = iframeRef.current
    if (!iframe?.contentWindow) return
    // Required before the embed accepts postMessage commands.
    iframe.contentWindow.postMessage(
      JSON.stringify({ event: 'listening' }),
      '*'
    )
    if (!muted && audioUnlocked && !manualMute) {
      sendYouTubeCommand(iframe, 'unMute')
      sendYouTubeCommand(iframe, 'setVolume', [100])
    }
  }, [muted, audioUnlocked, manualMute])

  // Small speaker button — only shown when admin has audio enabled.
  // Positioned top-right below the navbar so it's visible but unobtrusive.
  const muteButton = !muted ? (
    <button
      onClick={handleMuteToggle}
      aria-label={isAudioPlaying ? 'Mute' : 'Unmute'}
      className="absolute top-[calc(var(--nav-h)+0.75rem)] right-4 z-20 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
    >
      {isAudioPlaying ? (
        <Volume2 className="h-[15px] w-[15px]" />
      ) : (
        <VolumeX className="h-[15px] w-[15px]" />
      )}
    </button>
  ) : null

  if (mp4Url) {
    return (
      <>
        <video
          ref={videoRef}
          src={mp4Url}
          autoPlay
          muted={muted || !audioUnlocked || manualMute}
          loop
          playsInline
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
        {muteButton}
      </>
    )
  }

  if (ytId) {
    const origin =
      typeof window !== 'undefined' ? encodeURIComponent(window.location.origin) : ''
    // mute=1 is required for autoplay; unMute is sent once audio is unlocked.
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
