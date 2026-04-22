'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ShowFormDrawer } from '@/components/admin/show-form-drawer'
import { updateShow } from '@/app/[locale]/admin/actions'
import type { Database } from '@/lib/database.types'

type Show = Database['public']['Tables']['shows']['Row']

export function EditShowButton({ show }: { show: Show }) {
  const [open, setOpen] = useState(false)
  const t = useTranslations('admin.showForm')
  const locale = useLocale()
  const isArabic = locale === 'ar'

  async function handleSave(data: Parameters<typeof updateShow>[1] & { id?: string }) {
    const result = await updateShow(show.id, data)
    if (result.success) toast.success(t('showUpdated'))
    return result
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="me-1.5 size-3.5" />
        {isArabic ? 'تعديل تفاصيل البرنامج' : 'Edit Show Details'}
      </Button>
      <ShowFormDrawer open={open} onOpenChange={setOpen} show={show} onSave={handleSave} />
    </>
  )
}
