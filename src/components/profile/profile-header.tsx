'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { Shield, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { AvatarUpload } from './avatar-upload'

interface ProfileHeaderProps {
  displayName: string
  email: string
  avatarUrl: string | null
  isAdmin: boolean
  signOutRedirect?: string
}

export function ProfileHeader({
  displayName,
  email,
  avatarUrl,
  isAdmin,
  signOutRedirect = '/watch',
}: ProfileHeaderProps) {
  const router = useRouter()
  const locale = useLocale()
  const tNav = useTranslations('nav')
  const tCommon = useTranslations('common')
  const tProfile = useTranslations('profile')
  const [signingOut, setSigningOut] = useState(false)

  const initial = (displayName || email || '?').charAt(0).toUpperCase()

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace(signOutRedirect)
    router.refresh()
  }

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6">
      <AvatarUpload currentUrl={avatarUrl} fallbackInitial={initial} />

      <div className="flex min-w-0 flex-col items-center gap-1 text-center sm:flex-1 sm:items-start sm:text-start">
        <p className="text-xs tracking-[0.2em] text-[var(--text-mute)] uppercase">
          {tProfile('accountEyebrow')}
        </p>
        <h1 className="font-display text-[32px] leading-[1.2] font-semibold tracking-[-0.02em] text-[var(--text)]">
          {displayName || tProfile('yourAccount')}
        </h1>
        <p className="max-w-full truncate text-sm text-[var(--text-dim)]">
          {email}
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-end">
        {isAdmin && (
          <Button asChild variant="outline">
            <a href={`/${locale}/admin`}>
              <Shield aria-hidden />
              {tNav('admin')}
            </a>
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={handleSignOut}
          disabled={signingOut}
          className="border-destructive/40 text-[var(--color-brand-red-safe)] hover:bg-destructive/10"
        >
          <LogOut aria-hidden />
          {signingOut ? tProfile('signingOut') : tCommon('signOut')}
        </Button>
      </div>
    </div>
  )
}
