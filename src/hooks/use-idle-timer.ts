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

  useEffect(() => {
    if (disabled) {
      setIsIdle(false)
      if (timerRef.current) clearTimeout(timerRef.current)
      return
    }
    if (startOnMount) resetTimer()
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [disabled, resetTimer, startOnMount])

  return { isIdle, resetTimer }
}
