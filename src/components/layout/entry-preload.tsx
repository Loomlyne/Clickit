'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { resolvePreloaderVideoUrl } from '@/lib/supabase-media'

type PreloadPhase = 'entering' | 'playing' | 'exiting' | 'done'
type MediaType = 'video' | 'image'

const entryPreloadConfig = {
  mediaType: 'video' as MediaType,
  imageAlt: 'Clickit',
  imageHoldMs: 1400,
  imageFallbackSrc: '/brand/Clickit_final_logo.svg',
}

const enterDuration = 0.9
const exitDuration = 0.9
const playRetryMs = 250
const enterFallbackMs = 1100
const startupFallbackMs = 1100
const hardReleaseMs = 3000

let hasShownEntryPreloadThisDocument = false
const SESSION_PRELOAD_KEY = 'cit-entry-preload-shown'

function shouldShowEntryPreload(): boolean {
  if (hasShownEntryPreloadThisDocument) return false
  try {
    if (sessionStorage.getItem(SESSION_PRELOAD_KEY) === '1') return false
  } catch {
    // Private mode / blocked storage — fall back to per-document dedup only.
  }
  return true
}

export function EntryPreload({
  videoUrl,
}: {
  videoUrl?: string | null
}) {
  const defaultSrc = resolvePreloaderVideoUrl(videoUrl)
  const videoRef = useRef<HTMLVideoElement>(null)
  const hasStartedVideoRef = useRef(false)
  // Client-only: sessionStorage differs from server, so never render the splash
  // until after mount — avoids hydration mismatch + parentNode errors.
  const [active, setActive] = useState(false)
  const [phase, setPhase] = useState<PreloadPhase>('playing')
  const [videoStarted, setVideoStarted] = useState(false)
  const [mediaType, setMediaType] = useState<MediaType>(
    entryPreloadConfig.mediaType
  )
  const [mediaSrc, setMediaSrc] = useState(defaultSrc)

  useEffect(() => {
    document.getElementById('preload-cover')?.remove()

    if (!shouldShowEntryPreload()) {
      return
    }

    hasShownEntryPreloadThisDocument = true
    try {
      sessionStorage.setItem(SESSION_PRELOAD_KEY, '1')
    } catch {
      // Ignore — per-document dedup still applies.
    }
    // Mount-only flag: must flip after hydration (sessionStorage is client-only), so it cannot be derived in render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActive(true)
  }, [])

  useEffect(() => {
    if (!active || phase === 'done') {
      return
    }

    const previousBodyOverflow = document.body.style.overflow
    const previousHtmlOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousHtmlOverflow
    }
  }, [active, phase])

  useEffect(() => {
    if (!active) return

    const enterTimer = window.setTimeout(() => {
      setPhase((currentPhase) =>
        currentPhase === 'entering' ? 'playing' : currentPhase
      )
    }, enterFallbackMs)
    const releaseTimer = window.setTimeout(() => {
      setPhase((currentPhase) =>
        currentPhase === 'done' ? currentPhase : 'exiting'
      )
    }, hardReleaseMs)

    return () => {
      window.clearTimeout(enterTimer)
      window.clearTimeout(releaseTimer)
    }
  }, [active])

  useEffect(() => {
    if (!active || phase !== 'playing' || mediaType !== 'image') {
      return
    }

    const exitTimer = window.setTimeout(() => {
      setPhase('exiting')
    }, entryPreloadConfig.imageHoldMs)

    return () => window.clearTimeout(exitTimer)
  }, [active, mediaType, phase])

  useEffect(() => {
    if (!active || phase !== 'playing' || mediaType !== 'video') {
      return
    }

    const video = videoRef.current
    if (!video) {
      return
    }

    hasStartedVideoRef.current = false
    video.currentTime = 0

    const switchToImageFallback = () => {
      if (!entryPreloadConfig.imageFallbackSrc) {
        return
      }

      setMediaType('image')
      setMediaSrc(entryPreloadConfig.imageFallbackSrc)
    }

    const playVideo = () => {
      if (hasStartedVideoRef.current) {
        return
      }

      void video
        .play()
        .then(() => {
          hasStartedVideoRef.current = true
          setVideoStarted(true)
        })
        .catch(() => {})
    }

    playVideo()
    const retryTimer = window.setInterval(playVideo, playRetryMs)
    const fallbackTimer = window.setTimeout(() => {
      if (!hasStartedVideoRef.current) {
        switchToImageFallback()
      }
    }, startupFallbackMs)

    return () => {
      window.clearInterval(retryTimer)
      window.clearTimeout(fallbackTimer)
    }
  }, [active, mediaSrc, mediaType, phase])

  if (!active || phase === 'done') {
    return null
  }

  const handleAnimationComplete = () => {
    if (phase === 'entering') {
      setPhase('playing')
      return
    }

    if (phase === 'exiting') {
      setPhase('done')
    }
  }

  const handleVideoError = () => {
    if (!entryPreloadConfig.imageFallbackSrc) {
      return
    }

    setMediaType('image')
    setMediaSrc(entryPreloadConfig.imageFallbackSrc)
  }

  return (
    <motion.div
      aria-hidden="true"
      className="fixed inset-0 z-[1000] flex items-center justify-center overflow-hidden bg-black"
      initial={{ y: '0%' }}
      animate={{ y: phase === 'exiting' ? '-100%' : '0%' }}
      transition={{
        duration: phase === 'exiting' ? exitDuration : enterDuration,
        ease: [0.83, 0, 0.17, 1],
      }}
      onAnimationComplete={handleAnimationComplete}
    >
      {mediaType === 'video' ? (
        <>
          <video
            ref={videoRef}
            className={`pointer-events-none h-auto max-h-[70svh] w-[70vw] max-w-[70vw] object-contain transition-opacity duration-200 ${
              phase === 'entering' ? 'opacity-0' : 'opacity-100'
            }`}
            src={mediaSrc}
            muted
            playsInline
            autoPlay={false}
            controls={false}
            disablePictureInPicture
            preload="metadata"
            tabIndex={-1}
            onPlaying={() => {
              hasStartedVideoRef.current = true
              setVideoStarted(true)
            }}
            onTimeUpdate={(event) => {
              if (event.currentTarget.currentTime > 0) {
                hasStartedVideoRef.current = true
                setVideoStarted(true)
              }
            }}
            onEnded={() => setPhase('exiting')}
            onError={handleVideoError}
          />
          {!videoStarted && phase !== 'entering' ? (
            <PreloadImage src={entryPreloadConfig.imageFallbackSrc} />
          ) : null}
        </>
      ) : (
        <PreloadImage src={mediaSrc} />
      )}
    </motion.div>
  )
}

function PreloadImage({ src }: { src: string }) {
  return (
    <div className="absolute top-1/2 left-1/2 aspect-video w-[70vw] max-w-[70vw] -translate-x-1/2 -translate-y-1/2">
      <Image
        src={src}
        alt={entryPreloadConfig.imageAlt ?? ''}
        fill
        priority
        sizes="70vw"
        className="object-contain"
      />
    </div>
  )
}
