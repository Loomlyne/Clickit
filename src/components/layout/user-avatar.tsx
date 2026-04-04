'use client'

import { cn } from '@/lib/utils'

interface UserAvatarProps {
  name: string
  avatarUrl?: string | null
  className?: string
}

export function UserAvatar({ name, avatarUrl, className }: UserAvatarProps) {
  return (
    <button
      aria-label="User menu"
      className={cn(
        'flex size-9 items-center justify-center rounded-full overflow-hidden',
        'bg-secondary text-sm font-bold text-foreground',
        'transition-colors hover:bg-border',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        className
      )}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt={name} className="size-full object-cover" />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </button>
  )
}
