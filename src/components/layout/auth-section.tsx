'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { UserAvatar } from './user-avatar'
import { UserDropdown } from './user-dropdown'
import { createClient } from '@/lib/supabase/client'

export function AuthSection() {
  const router = useRouter()
  const [user, setUser] = useState<{ email: string; id: string } | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    // Get initial session
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (u) {
        setUser({ email: u.email ?? '', id: u.id })
        // Check if admin
        supabase.from('app_config').select('admin_user_id').single().then(({ data }) => {
          setIsAdmin(data?.admin_user_id === u.id)
        })
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({ email: session.user.email ?? '', id: session.user.id })
        supabase.from('app_config').select('admin_user_id').single().then(({ data }) => {
          setIsAdmin(data?.admin_user_id === session.user.id)
        })
      } else {
        setUser(null)
        setIsAdmin(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  if (!user) {
    return (
      <Button variant="ghost" size="sm" asChild>
        <Link href="/auth">Sign In</Link>
      </Button>
    )
  }

  return (
    <UserDropdown
      email={user.email}
      onSignOut={async () => {
        const supabase = createClient()
        await supabase.auth.signOut()
        setUser(null)
        setIsAdmin(false)
        router.push('/')
        router.refresh()
      }}
      isAdmin={isAdmin}
    >
      <UserAvatar name={user.email} />
    </UserDropdown>
  )
}
