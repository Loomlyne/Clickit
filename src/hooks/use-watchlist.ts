'use client'

import { useState, useCallback } from 'react'
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
  const router = useRouter()

  const toggle = useCallback(() => {
    if (!userId) {
      router.push(`/auth?next=${encodeURIComponent(window.location.pathname)}`)
      return
    }

    const prev = isInList
    setIsInList(!prev)
    setIsLoading(true)

    const supabase = createClient()
    const mutation = prev
      ? supabase.from('watchlist').delete().eq('user_id', userId).eq('show_id', showId)
      : supabase.from('watchlist').insert({ user_id: userId, show_id: showId })

    mutation.then(({ error }) => {
      if (error) {
        setIsInList(prev)
        toast.error(prev ? 'Failed to remove from list' : 'Failed to add to list')
      }
      setIsLoading(false)
    })
  }, [showId, userId, isInList, router])

  return { isInList, toggle, isLoading }
}
