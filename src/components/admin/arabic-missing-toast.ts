'use client'

import { useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { arabicMissingOf } from '@/lib/admin/arabic-missing'

/**
 * After a successful admin save: when some Arabic fields could not be auto-filled
 * (they stay empty), show the warning and return true so the caller skips its
 * plain success toast. Returns false otherwise.
 */
export function useArabicMissingToast(): (result: unknown) => boolean {
  const t = useTranslations('admin.common')
  return useCallback(
    (result: unknown) => {
      const count = arabicMissingOf(result)
      if (count === 0) return false
      toast.warning(t('arabicAutoFillMissing', { count }))
      return true
    },
    [t]
  )
}
