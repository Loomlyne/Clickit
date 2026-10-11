'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface UseIdleTimerReturn {
  isIdle: boolean
  resetTimer: () => void
}

interface UseIdleTimerOptions {
  initialIdle?: boolean
  disabled?: boolean
  startOnMount?: boolean
}

export function useIdleTimer(delay: number, options: UseIdleTimerOptions = {}): UseIdleTimerReturn {
  const { initialIdle = false, disabled = false, startOnMount = true } = options
  const [isIdle, setIsIdle] = useState(initialIdle)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resetTimer = useCallback(() => {
    setIsIdle(false)
    if (timerRef.current) clearTimeout(timerRef.current)
    if (disabled) return
    timerRef.current = setTimeout(() => setIsIdle(true), delay)
  }, [delay, disabled])

  // While disabled, idle is forced off (adjusted during render, not in an effect)
  if (disabled && isIdle) setIsIdle(false)

  useEffect(() => {
    if (disabled) {
      if (timerRef.current) clearTimeout(timerRef.current)
      return
    }
    // resetTimer sets state, but only to clear idle when the timer (re)starts; no render-time equivalent.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (startOnMount) resetTimer()
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [disabled, resetTimer, startOnMount])

  return { isIdle, resetTimer }
}
