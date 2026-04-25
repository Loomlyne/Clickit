'use client'

import { Pencil } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import type { Database } from '@/lib/database.types'

type Show = Database['public']['Tables']['shows']['Row']

export function EditShowButton({ show }: { show: Show }) {
  return (
    <Link href={`/admin/shows/${show.id}/edit`}>
      <Button variant="outline" size="sm">
        <Pencil className="me-1.5 size-3.5" />
        Edit Show Details
      </Button>
    </Link>
  )
}
