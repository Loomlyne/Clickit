'use client'

import { useState, useCallback } from 'react'
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
  const router = useRouter()

  const toggle = useCallback(() => {
    if (!userId) {
      router.push(`/auth?next=${encodeURIComponent(window.location.pathname)}`)
      return
    }

    const prev = isLiked
    setIsLiked(!prev)
    setIsLoading(true)

    const supabase = createClient()
    const mutation = prev
      ? supabase.from('likes').delete().eq('user_id', userId).eq('show_id', showId)
      : supabase.from('likes').insert({ user_id: userId, show_id: showId })

    mutation.then(({ error }) => {
      if (error) {
        setIsLiked(prev)
        toast.error(prev ? 'Failed to unlike' : 'Failed to like')
      }
      setIsLoading(false)
    })
  }, [showId, userId, isLiked, router])

  return { isLiked, toggle, isLoading }
}
