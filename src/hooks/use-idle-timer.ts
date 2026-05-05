'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface UseIdleTimerReturn {
  isIdle: boolean
  resetTimer: () => void
}

export function useIdleTimer(delay: number): UseIdleTimerReturn {
  const [isIdle, setIsIdle] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resetTimer = useCallback(() => {
    setIsIdle(false)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setIsIdle(true), delay)
  }, [delay])

  useEffect(() => {
    resetTimer()
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [resetTimer])

  return { isIdle, resetTimer }
}
