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
          'flex size-9 items-center justify-center rounded-full overflow-hidden',
          'bg-secondary text-sm font-bold text-foreground',
          'transition-colors hover:bg-border',
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
