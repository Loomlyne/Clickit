'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'

type PreloadPhase = 'entering' | 'playing' | 'exiting' | 'done'
type MediaType = 'video' | 'image'

const entryPreloadConfig = {
  mediaType: 'video' as MediaType,
  src: '/brand/clickit-preloader.mp4',
  imageAlt: 'Clickit',
  imageHoldMs: 5000,
  imageFallbackSrc: '/brand/Clickit_final_logo.svg',
}

const enterDuration = 0.9
const exitDuration = 0.9
const playRetryMs = 250

export function EntryPreload() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hasStartedVideoRef = useRef(false)
  const [phase, setPhase] = useState<PreloadPhase>('entering')
  const [mediaType, setMediaType] = useState<MediaType>(
    entryPreloadConfig.mediaType
  )
  const [mediaSrc, setMediaSrc] = useState(entryPreloadConfig.src)

  useEffect(() => {
    if (phase === 'done') {
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
  }, [phase])

  useEffect(() => {
    if (phase !== 'playing' || mediaType !== 'image') {
      return
    }

    const exitTimer = window.setTimeout(() => {
      setPhase('exiting')
    }, entryPreloadConfig.imageHoldMs)

    return () => window.clearTimeout(exitTimer)
  }, [mediaType, phase])

  useEffect(() => {
    if (phase !== 'playing' || mediaType !== 'video') {
      return
    }

    const video = videoRef.current
    if (!video) {
      return
    }

    hasStartedVideoRef.current = false
    video.currentTime = 0

    const playVideo = () => {
      if (hasStartedVideoRef.current) {
        return
      }

      void video
        .play()
        .then(() => {
          hasStartedVideoRef.current = true
        })
        .catch(() => {})
    }

    playVideo()
    const retryTimer = window.setInterval(playVideo, playRetryMs)

    return () => window.clearInterval(retryTimer)
  }, [mediaSrc, mediaType, phase])

  if (phase === 'done') {
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
      initial={{ y: '100%' }}
      animate={{ y: phase === 'exiting' ? '-100%' : '0%' }}
      transition={{
        duration: phase === 'exiting' ? exitDuration : enterDuration,
        ease: [0.83, 0, 0.17, 1],
      }}
      onAnimationComplete={handleAnimationComplete}
    >
      {phase !== 'entering' &&
        (mediaType === 'video' ? (
          <video
            ref={videoRef}
            className="pointer-events-none h-full w-full object-cover"
            src={mediaSrc}
            muted
            playsInline
            autoPlay={false}
            controls={false}
            disablePictureInPicture
            preload="auto"
            tabIndex={-1}
            onEnded={() => setPhase('exiting')}
            onError={handleVideoError}
          />
        ) : (
          <div className="relative h-28 w-72 sm:h-36 sm:w-96">
            <Image
              src={mediaSrc}
              alt={entryPreloadConfig.imageAlt ?? ''}
              fill
              priority
              sizes="(min-width: 640px) 384px, 288px"
              className="object-contain"
            />
          </div>
        ))}
    </motion.div>
  )
}
