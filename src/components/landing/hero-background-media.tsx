'use client'

import { useEffect, useRef, type CSSProperties } from 'react'

/**
 * Hero background video player.
 *
 * Browsers block autoplay WITH sound — a video/iframe can only autostart while
 * muted. So we always start muted (so the hero plays at all), and when the
 * admin has opted into audio (`muted={false}`) we unmute on the visitor's first
 * interaction with the page (pointer/keyboard/touch/scroll). This is the only
 * reliable cross-browser way to honour "play audio alongside the video".
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

  useEffect(() => {
    // Admin chose muted → nothing to unmute; the muted autoplay is the final state.
    if (muted) return

    let done = false
    const unmute = () => {
      if (done) return
      done = true

      const video = videoRef.current
      if (video) {
        video.muted = false
        video.volume = 1
        // A play() nudge in case the browser paused on the muted→unmuted flip.
        void video.play().catch(() => {})
      }

      const iframe = iframeRef.current
      if (iframe?.contentWindow) {
        const send = (func: string, args: unknown[] = []) =>
          iframe.contentWindow!.postMessage(
            JSON.stringify({ event: 'command', func, args }),
            '*'
          )
        send('unMute')
        send('setVolume', [100])
        send('playVideo')
      }

      cleanup()
    }

    const events: (keyof WindowEventMap)[] = [
      'pointerdown',
      'keydown',
      'touchstart',
      'scroll',
      'wheel',
    ]
    const opts: AddEventListenerOptions = { once: false, passive: true }
    const cleanup = () =>
      events.forEach((e) => window.removeEventListener(e, unmute, opts))

    events.forEach((e) => window.addEventListener(e, unmute, opts))
    return cleanup
  }, [muted])

  if (mp4Url) {
    return (
      <video
        ref={videoRef}
        src={mp4Url}
        autoPlay
        // Always start muted so autoplay is allowed; unmuted on first interaction.
        muted
        loop
        playsInline
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
    )
  }

  if (ytId) {
    // enablejsapi=1 lets us postMessage unMute/setVolume after a user gesture.
    // mute=1 in the URL is required for the iframe to autoplay at all.
    const src = `https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&mute=1&loop=1&playlist=${ytId}&controls=0&showinfo=0&rel=0&modestbranding=1&iv_load_policy=3&playsinline=1&disablekb=1&fs=0&cc_load_policy=0&enablejsapi=1`
    // Cover sizing: keep the 16:9 (landscape) or 9:16 (portrait) source aspect
    // while overflowing the viewport in both axes so there's never a letterbox.
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
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <iframe
          ref={iframeRef}
          src={src}
          allow="autoplay; encrypted-media"
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          style={coverStyle}
          title={title}
        />
      </div>
    )
  }

  return null
}
