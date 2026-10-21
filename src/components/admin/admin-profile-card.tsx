import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { User, Settings } from 'lucide-react'
import { stripStorageCacheBust } from '@/lib/supabase-media'

interface AdminProfileCardProps {
  email: string
  displayName: string | null
  avatarUrl: string | null
}

export function AdminProfileCard({
  email,
  displayName,
  avatarUrl,
}: AdminProfileCardProps) {
  const t = useTranslations('admin.profileCard')
  const tNav = useTranslations('nav')
  const resolvedAvatarUrl = stripStorageCacheBust(avatarUrl) ?? avatarUrl
  return (
    <div className="flex items-center gap-3 rounded-card border border-[var(--line)] bg-[var(--bg-1)] px-4 py-2.5">
      {resolvedAvatarUrl ? (
        <img
          src={resolvedAvatarUrl}
          alt=""
          className="size-9 rounded-full object-cover"
        />
      ) : (
        <div className="flex size-9 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-foreground)]">
          <User className="size-4" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-medium">
          {displayName || t('fallbackName')}
        </div>
        <div className="truncate text-[12px] text-[var(--text-mute)]">
          {email}
        </div>
      </div>
      <Link
        href="/profile"
        className="relative inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--line)] px-3.5 text-[13px] text-[var(--text-dim)] transition-colors after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] hover:bg-[var(--bg-2)] hover:text-[var(--text)] max-md:h-11"
      >
        <Settings className="size-3.5" />
        {tNav('profile')}
      </Link>
    </div>
  )
}
