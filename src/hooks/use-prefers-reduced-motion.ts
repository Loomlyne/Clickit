'use client'

import { useSyncExternalStore } from 'react'

function subscribe(onChange: () => void) {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

function getSnapshot() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function getServerSnapshot() {
  return true
}

/** SSR-safe `prefers-reduced-motion: reduce` (conservative on server). */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
