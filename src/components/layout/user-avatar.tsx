'use client'

import { cn } from '@/lib/utils'

interface UserAvatarProps {
  name: string
  className?: string
}

export function UserAvatar({ name, className }: UserAvatarProps) {
  return (
    <button
      aria-label="User menu"
      className={cn(
        'flex size-9 items-center justify-center rounded-full',
        'bg-secondary text-sm font-bold text-foreground',
        'transition-colors hover:bg-border',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        className
      )}
    >
      {name.charAt(0).toUpperCase()}
    </button>
  )
}
