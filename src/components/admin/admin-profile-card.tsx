import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { User, Settings } from 'lucide-react'
import { AdminPanel } from '@/components/admin/admin-shell'
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
    <AdminPanel className="p-5">
      <div className="flex items-center gap-4">
        {resolvedAvatarUrl ? (
          <img
            src={resolvedAvatarUrl}
            alt=""
            className="h-12 w-12 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-foreground)]">
            <User className="size-5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">
            {displayName || t('fallbackName')}
          </div>
          <div className="mono text-muted-foreground truncate text-[11px]">
            {email}
          </div>
        </div>
        <Link
          href="/profile"
          className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-full border border-white/8 px-3 py-1.5 text-xs transition-colors"
        >
          <Settings className="size-3" />
          {tNav('profile')}
        </Link>
      </div>
    </AdminPanel>
  )
}
