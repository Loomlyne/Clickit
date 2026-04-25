import { Link } from '@/i18n/navigation'
import { User, Settings } from 'lucide-react'

interface AdminProfileCardProps {
  email: string
  displayName: string | null
  avatarUrl: string | null
}

export function AdminProfileCard({ email, displayName, avatarUrl }: AdminProfileCardProps) {
  return (
    <div className="rounded-[6px] border border-[var(--line)] bg-[var(--bg-2)] p-5">
      <div className="flex items-center gap-4">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            className="h-12 w-12 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-foreground)]">
            <User className="size-5" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">
            {displayName || 'Admin'}
          </div>
          <div className="mono text-[11px] text-muted-foreground truncate">{email}</div>
        </div>
        <Link
          href="/profile"
          className="flex items-center gap-1.5 rounded-[4px] border border-[var(--line)] px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <Settings className="size-3" />
          Profile
        </Link>
      </div>
    </div>
  )
}
