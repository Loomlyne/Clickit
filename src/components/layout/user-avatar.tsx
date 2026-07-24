// User avatar — matches handoff .avatar (30px circle, gradient bg, mono initial)
'use client'

import { forwardRef } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { stripStorageCacheBust } from '@/lib/supabase-media'

interface UserAvatarProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  name: string
  avatarUrl?: string | null
}

export const UserAvatar = forwardRef<HTMLButtonElement, UserAvatarProps>(
  function UserAvatar({ name, avatarUrl, className, ...props }, ref) {
    const t = useTranslations('nav')
    const resolvedAvatarUrl = stripStorageCacheBust(avatarUrl) ?? avatarUrl
    return (
      <button
        ref={ref}
        aria-label={t('userMenu')}
        className={cn(
          'flex size-[30px] items-center justify-center overflow-hidden rounded-full',
          'border border-[var(--line-2)] bg-gradient-to-br from-[#c8a04a] to-[#d97757]',
          'font-[family-name:var(--font-mono)] text-[12px] font-medium text-[#0a0a0a]',
          'flex-shrink-0 cursor-pointer transition-transform duration-150 hover:scale-105',
          'focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2',
          className
        )}
        {...props}
      >
        {resolvedAvatarUrl ? (
          <img src={resolvedAvatarUrl} alt={name} className="size-full object-cover" />
        ) : (
          name.charAt(0).toUpperCase()
        )}
      </button>
    )
  }
)
