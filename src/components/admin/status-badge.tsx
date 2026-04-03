import { Badge } from '@/components/ui/badge'

const statusConfig: Record<string, { label: string; className: string }> = {
  'now-streaming': { label: 'Now Streaming', className: 'bg-[#50A258] text-white hover:bg-[#50A258]' },
  'coming-soon':   { label: 'Coming Soon',   className: 'bg-[#EA8C2E] text-black hover:bg-[#EA8C2E]' },
  'draft':         { label: 'Draft',          className: 'bg-secondary text-muted-foreground hover:bg-secondary' },
  'published':     { label: 'Published',      className: 'bg-[#50A258] text-white hover:bg-[#50A258]' },
  'archived':      { label: 'Archived',       className: 'bg-destructive text-white hover:bg-destructive' },
}

export function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] ?? statusConfig['draft']
  return (
    <Badge className={config.className} aria-label={`Status: ${config.label}`}>
      {config.label}
    </Badge>
  )
}
