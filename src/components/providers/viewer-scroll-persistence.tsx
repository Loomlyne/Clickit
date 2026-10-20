'use client'

import { useCallback, useEffect, useRef } from 'react'
import { usePathname } from '@/i18n/navigation'
import { markProgrammaticScroll } from '@/lib/nav-scroll'

const STORAGE_PREFIX = 'cit:viewer-scroll:'

type Payload = {
  y: number
  episodeId?: string
}

function storageKey(pathname: string): string {
  return `${STORAGE_PREFIX}${pathname}`
}

/** Full URL path from the browser, e.g. /en/watch/<uuid> */
function isEpisodeWatchPathname(pathname: string): boolean {
  return /^\/(en|ar)\/watch\/[^/]+$/.test(pathname)
}

function episodeIdFromWatchPath(pathname: string): string | undefined {
  const m = pathname.match(/^\/(en|ar)\/watch\/([^/]+)$/)
  return m?.[2]
}

function clampScrollY(y: number): number {
  if (!Number.isFinite(y) || y < 0) return 0
  const max = Math.max(
    0,
    document.documentElement.scrollHeight - window.innerHeight
  )
  return Math.min(y, max)
}

function readPayload(raw: string): Payload | null {
  try {
    const p = JSON.parse(raw) as Payload
    if (!p || typeof p.y !== 'number' || !Number.isFinite(p.y)) return null
    return p
  } catch {
    return null
  }
}

export function ViewerScrollPersistence() {
  const pathname = usePathname()
  const pathnameRef = useRef(pathname)
  // Keep the "latest value" ref in sync after each render (declared first so it
  // is current before the effects below run).
  useEffect(() => {
    pathnameRef.current = pathname
  })

  const restoreScrollForPath = useCallback((path: string) => {
    if (typeof window === 'undefined') return
    const key = storageKey(path)
    const raw = sessionStorage.getItem(key)
    if (!raw) return

    const payload = readPayload(raw)
    if (!payload) {
      sessionStorage.removeItem(key)
      return
    }

    const applyScroll = () => {
      // Clamp at apply time, after two frames, so the restored page has height.
      // Not a user scroll, so the navbar keeps its state.
      markProgrammaticScroll()
      window.scrollTo(0, clampScrollY(payload.y))

      if (payload.episodeId) {
        requestAnimationFrame(() => {
          const el = document.getElementById(`episode-${payload.episodeId}`)
          if (el) markProgrammaticScroll()
          el?.scrollIntoView({ block: 'nearest', behavior: 'auto' })
        })
      }
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(applyScroll)
    })

    sessionStorage.removeItem(key)
  }, [])

  useEffect(() => {
    restoreScrollForPath(pathname)
  }, [pathname, restoreScrollForPath])

  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return
      const path = pathnameRef.current
      if (sessionStorage.getItem(storageKey(path))) {
        restoreScrollForPath(path)
      }
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [restoreScrollForPath])

  useEffect(() => {
    const onCaptureClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return
      const el = e.target
      if (!(el instanceof Node)) return

      const anchor = el instanceof Element ? el.closest('a[href]') : null
      if (!(anchor instanceof HTMLAnchorElement)) return

      const hrefAttr = anchor.getAttribute('href')
      if (!hrefAttr || hrefAttr.startsWith('#')) return

      let url: URL
      try {
        url = new URL(anchor.href, window.location.origin)
      } catch {
        return
      }

      if (url.origin !== window.location.origin) return
      if (!isEpisodeWatchPathname(url.pathname)) return

      const fromPath = pathnameRef.current
      const episodeId = episodeIdFromWatchPath(url.pathname)

      const y = window.scrollY

      const payload: Payload = {
        y,
        ...(episodeId ? { episodeId } : {}),
      }

      try {
        sessionStorage.setItem(storageKey(fromPath), JSON.stringify(payload))
      } catch {
        /* quota / private mode */
      }
    }

    document.addEventListener('click', onCaptureClick, true)
    return () => document.removeEventListener('click', onCaptureClick, true)
  }, [])

  return null
}
