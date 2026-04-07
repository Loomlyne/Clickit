'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

interface UseLikesReturn {
  isLiked: boolean
  toggle: () => void
  isLoading: boolean
}

export function useLikes(
  showId: string,
  initialLiked: boolean,
  userId: string | null
): UseLikesReturn {
  const [isLiked, setIsLiked] = useState(initialLiked)
  const [isLoading, setIsLoading] = useState(false)
  const busyRef = useRef(false)
  const router = useRouter()

  const toggle = useCallback(async () => {
    if (!userId || busyRef.current) {
      if (!userId) router.push(`/auth?next=${encodeURIComponent(window.location.pathname)}`)
      return
    }

    busyRef.current = true
    const prev = isLiked
    setIsLiked(!prev)
    setIsLoading(true)

    try {
      const supabase = createClient()

      // Verify session is still valid before mutating
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setIsLiked(prev)
        setIsLoading(false)
        busyRef.current = false
        router.push(`/auth?next=${encodeURIComponent(window.location.pathname)}`)
        return
      }

      const { error } = prev
        ? await supabase.from('likes').delete().eq('user_id', userId).eq('show_id', showId)
        : await supabase.from('likes').insert({ user_id: userId, show_id: showId })

      if (error) {
        console.error('Like mutation error:', error.message, error.code)
        setIsLiked(prev)
        toast.error(prev ? 'Failed to unlike' : 'Failed to like')
      }
    } catch (err) {
      console.error('Like network error:', err)
      setIsLiked(prev)
      toast.error('Network error — please try again')
    } finally {
      setIsLoading(false)
      busyRef.current = false
    }
  }, [showId, userId, isLiked, router])

  return { isLiked, toggle, isLoading }
}
