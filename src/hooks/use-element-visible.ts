'use client'

import {
  useEffect,
  useState,
  useSyncExternalStore,
  type RefObject,
} from 'react'

import { isVisibleEnough } from '@/lib/watch/ended-state'

function subscribeTabVisibility(onChange: () => void) {
  document.addEventListener('visibilitychange', onChange)
  return () => document.removeEventListener('visibilitychange', onChange)
}

function tabIsVisible() {
  return document.visibilityState === 'visible'
}

/**
 * True while at least half of the element is in view AND the tab is visible.
 * Gates the up-next auto-advance (YouTube RMF autoplay rule, T-06-43). The
 * server and the first client render say false, so nothing advances before the
 * browser has actually reported visibility.
 */
export function useElementVisible(ref: RefObject<Element | null>): boolean {
  const [inView, setInView] = useState(false)
  const tabVisible = useSyncExternalStore(
    subscribeTabVisibility,
    tabIsVisible,
    () => false
  )

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1]
        if (entry) setInView(isVisibleEnough(entry.intersectionRatio))
      },
      { threshold: [0, 0.5, 1] }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])

  return inView && tabVisible
}
