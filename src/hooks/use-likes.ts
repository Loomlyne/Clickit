'use client'

import { useState, useCallback, useRef } from 'react'
import { useLocale } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
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
  const locale = useLocale()
  const isArabic = locale === 'ar'

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

      // See use-watchlist for why we don't run a getUser() preflight here —
      // RLS rejects expired sessions, and we redirect on the specific error
      // codes rather than paying the latency tax on every healthy click.
      const { error } = prev
        ? await supabase.from('likes').delete().eq('user_id', userId).eq('show_id', showId)
        : await supabase.from('likes').insert({ user_id: userId, show_id: showId })

      if (error) {
        console.error('Like mutation error:', error.message, error.code)
        setIsLiked(prev)
        if (error.code === '42501' || error.code === 'PGRST301') {
          router.push(`/auth?next=${encodeURIComponent(window.location.pathname)}`)
          return
        }
        toast.error(prev
          ? (isArabic ? 'تعذّر إلغاء الإعجاب' : 'Failed to unlike')
          : (isArabic ? 'تعذّر الإعجاب' : 'Failed to like'))
      }
    } catch (err) {
      console.error('Like network error:', err)
      setIsLiked(prev)
      toast.error(isArabic ? 'خطأ في الشبكة — حاول مجدداً' : 'Network error — please try again')
    } finally {
      setIsLoading(false)
      busyRef.current = false
    }
  }, [showId, userId, isLiked, router, isArabic])

  return { isLiked, toggle, isLoading }
}
