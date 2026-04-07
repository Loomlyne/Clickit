'use client'

import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface UserAvatarProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  name: string
  avatarUrl?: string | null
}

export const UserAvatar = forwardRef<HTMLButtonElement, UserAvatarProps>(
  function UserAvatar({ name, avatarUrl, className, ...props }, ref) {
    return (
      <button
        ref={ref}
        aria-label="User menu"
        className={cn(
          'flex size-11 items-center justify-center overflow-hidden rounded-[16px] border border-white/10',
          'bg-white/[0.05] text-sm font-semibold text-foreground shadow-[0_10px_24px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.04)]',
          'transition-colors hover:bg-white/[0.08]',
          'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          className
        )}
        {...props}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} className="size-full object-cover" />
        ) : (
          name.charAt(0).toUpperCase()
        )}
      </button>
    )
  }
)
