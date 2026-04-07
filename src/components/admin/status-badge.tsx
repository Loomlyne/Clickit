import { Badge } from '@/components/ui/badge'

const statusConfig: Record<string, { label: string; className: string }> = {
  'now-streaming': { label: 'Now Streaming', className: 'border-emerald-400/25 bg-emerald-500/14 text-emerald-200 hover:bg-emerald-500/14' },
  'coming-soon': { label: 'Coming Soon', className: 'border-amber-400/25 bg-amber-500/14 text-amber-100 hover:bg-amber-500/14' },
  'draft': { label: 'Draft', className: 'border-white/10 bg-white/[0.05] text-muted-foreground hover:bg-white/[0.05]' },
  'published': { label: 'Published', className: 'border-sky-400/25 bg-sky-500/14 text-sky-100 hover:bg-sky-500/14' },
  'archived': { label: 'Archived', className: 'border-red-400/25 bg-red-500/14 text-red-100 hover:bg-red-500/14' },
}

export function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] ?? statusConfig['draft']
  return (
    <Badge className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${config.className}`} aria-label={`Status: ${config.label}`}>
      {config.label}
    </Badge>
  )
}
