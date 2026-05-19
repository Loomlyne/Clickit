'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { Link } from '@/i18n/navigation'
import { Shield, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { AvatarUpload } from './avatar-upload'

interface ProfileHeaderProps {
  displayName: string
  email: string
  avatarUrl: string | null
  isAdmin: boolean
}

export function ProfileHeader({
  displayName,
  email,
  avatarUrl,
  isAdmin,
}: ProfileHeaderProps) {
  const router = useRouter()
  const tNav = useTranslations('nav')
  const tCommon = useTranslations('common')
  const tProfile = useTranslations('profile')
  const [signingOut, setSigningOut] = useState(false)

  const initial = (displayName || email || '?').charAt(0).toUpperCase()

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/watch')
    router.refresh()
  }

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6">
      <AvatarUpload currentUrl={avatarUrl} fallbackInitial={initial} />

      <div className="flex flex-col items-center gap-1 sm:flex-1 sm:items-start">
        <p className="font-mono text-[11px] tracking-[0.26em] text-[var(--text-mute)] uppercase">
          {tProfile('accountEyebrow')}
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-[-0.04em] text-white">
          {displayName || tProfile('yourAccount')}
        </h1>
        <p className="text-sm text-[var(--text-dim)]">{email}</p>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-end">
        {isAdmin && (
          <Link
            href="/admin"
            className="flex items-center gap-2 rounded-full border border-[var(--line-2)] bg-[var(--bg-2)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--bg-3)]"
          >
            <Shield className="size-4" />
            {tNav('admin')}
          </Link>
        )}
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-5 py-2.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50"
        >
          <LogOut className="size-4" />
          {signingOut ? tProfile('signingOut') : tCommon('signOut')}
        </button>
      </div>
    </div>
  )
}
