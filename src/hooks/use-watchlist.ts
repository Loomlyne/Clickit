'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from '@/i18n/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

interface UseWatchlistReturn {
  isInList: boolean
  toggle: () => void
  isLoading: boolean
}

export function useWatchlist(
  showId: string,
  initialSaved: boolean,
  userId: string | null
): UseWatchlistReturn {
  const [isInList, setIsInList] = useState(initialSaved)
  const [isLoading, setIsLoading] = useState(false)
  const busyRef = useRef(false)
  const router = useRouter()

  const toggle = useCallback(async () => {
    if (!userId || busyRef.current) {
      if (!userId) router.push(`/auth?next=${encodeURIComponent(window.location.pathname)}`)
      return
    }

    busyRef.current = true
    const prev = isInList
    setIsInList(!prev)
    setIsLoading(true)

    try {
      const supabase = createClient()

      // No getUser() preflight. The session was already validated server-side
      // when the page loaded; if it expired mid-session the RLS-backed mutation
      // below will fail with a clear auth error. The preflight was adding
      // ~50-100ms to every toggle click for a safety net RLS already provides.
      const { error } = prev
        ? await supabase.from('watchlist').delete().eq('user_id', userId).eq('show_id', showId)
        : await supabase.from('watchlist').insert({ user_id: userId, show_id: showId })

      if (error) {
        console.error('Watchlist mutation error:', error.message, error.code)
        setIsInList(prev)
        // Auth errors (RLS reject after session expiry) land here too. Common
        // Postgrest codes for unauthorized writes: 42501 (permission denied),
        // PGRST301 (JWT expired). Redirect to auth in those cases.
        if (error.code === '42501' || error.code === 'PGRST301') {
          router.push(`/auth?next=${encodeURIComponent(window.location.pathname)}`)
          return
        }
        toast.error(prev ? 'Failed to remove from list' : 'Failed to add to list')
      }
    } catch (err) {
      console.error('Watchlist network error:', err)
      setIsInList(prev)
      toast.error('Network error — please try again')
    } finally {
      setIsLoading(false)
      busyRef.current = false
    }
  }, [showId, userId, isInList, router])

  return { isInList, toggle, isLoading }
}
