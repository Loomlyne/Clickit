'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { UserAvatar } from './user-avatar'
import { UserDropdown } from './user-dropdown'

export function AuthSection() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  if (!isAuthenticated) {
    return (
      <Button
        variant="ghost"
        size="sm"
        asChild
      >
        <Link href="/auth">Sign In</Link>
      </Button>
    )
  }

  return (
    <UserDropdown onSignOut={() => setIsAuthenticated(false)} isAdmin={false}>
      <UserAvatar name="Demo User" />
    </UserDropdown>
  )
}
