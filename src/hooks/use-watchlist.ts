'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
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

      // Verify session is still valid before mutating
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setIsInList(prev)
        setIsLoading(false)
        busyRef.current = false
        router.push(`/auth?next=${encodeURIComponent(window.location.pathname)}`)
        return
      }

      const { error } = prev
        ? await supabase.from('watchlist').delete().eq('user_id', userId).eq('show_id', showId)
        : await supabase.from('watchlist').insert({ user_id: userId, show_id: showId })

      if (error) {
        console.error('Watchlist mutation error:', error.message, error.code)
        setIsInList(prev)
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
