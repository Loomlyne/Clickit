'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { useRouter } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { UserAvatar } from './user-avatar'
import { UserDropdown } from './user-dropdown'
import { createClient } from '@/lib/supabase/client'

interface UserState {
  email: string
  id: string
  displayName: string | null
  avatarUrl: string | null
}

interface AuthSectionProps {
  initialUser?: { id: string; email: string } | null
  isLanding?: boolean
}

export function AuthSection({ initialUser, isLanding }: AuthSectionProps) {
  const t = useTranslations('common')
  const router = useRouter()
  const [user, setUser] = useState<UserState | null>(
    initialUser
      ? { id: initialUser.id, email: initialUser.email, displayName: null, avatarUrl: null }
      : null
  )
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    async function loadUser(userId: string, email: string) {
      // Fetch profile + admin check in parallel
      const [profileRes, configRes] = await Promise.all([
        supabase.from('profiles').select('display_name, avatar_url').eq('id', userId).single(),
        supabase.from('app_config').select('admin_user_id').single(),
      ])

      setUser({
        id: userId,
        email,
        displayName: profileRes.data?.display_name ?? null,
        avatarUrl: profileRes.data?.avatar_url ?? null,
      })
      setIsAdmin(configRes.data?.admin_user_id === userId)
    }

    // Get initial session
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (u) loadUser(u.id, u.email ?? '')
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadUser(session.user.id, session.user.email ?? '')
      } else {
        setUser(null)
        setIsAdmin(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  if (!user) {
    if (isLanding) {
      return (
        <>
          <Link
            href="/auth"
            className="inline-flex items-center justify-center rounded px-3 py-[7px] text-[12.5px] font-medium border border-[var(--line-2)] text-[var(--text)] transition-all duration-150 hover:bg-white/[0.04]"
          >
            Sign in
          </Link>
          <Link
            href="/auth"
            className="inline-flex items-center justify-center rounded px-3 py-[7px] text-[12.5px] font-medium bg-[var(--primary)] text-[var(--primary-foreground)] transition-all duration-150 hover:bg-white"
          >
            Start free
          </Link>
        </>
      )
    }
    return (
      <Button
        size="sm"
        variant="outline"
        className="h-10 rounded px-5 text-sm"
        asChild
      >
        <Link href="/auth">{t('signIn')}</Link>
      </Button>
    )
  }

  return (
    <UserDropdown
      email={user.email}
      isAdmin={isAdmin}
      onSignOut={async () => {
        const supabase = createClient()
        await supabase.auth.signOut()
        setUser(null)
        setIsAdmin(false)
        router.push('/browse')
        router.refresh()
      }}
    >
      <UserAvatar
        name={user.displayName || user.email}
        avatarUrl={user.avatarUrl}
      />
    </UserDropdown>
  )
}
