'use client'

import { Pencil } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import type { Database } from '@/lib/database.types'

type Show = Database['public']['Tables']['shows']['Row']

export function EditShowButton({ show }: { show: Show }) {
  const t = useTranslations('admin.shows')

  return (
    <Button variant="outline" size="sm" asChild>
      <Link
        href={`/admin/shows/${show.id}/edit`}
        aria-label={t('editShowAria', { title: show.title })}
      >
        <Pencil className="me-1.5 size-3.5" />
        {t('editShowDetails')}
      </Link>
    </Button>
  )
}
