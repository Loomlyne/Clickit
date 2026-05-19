'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { useRouter } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { UserAvatar } from './user-avatar'
import { UserDropdown } from './user-dropdown'
import { createClient } from '@/lib/supabase/client'
import { User, LogOut, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'

interface UserState {
  email: string
  id: string
  displayName: string | null
  avatarUrl: string | null
}

interface AuthSectionProps {
  initialUser?: { id: string; email: string } | null
  isLanding?: boolean
  layout?: 'default' | 'sheet'
}

export function AuthSection({
  initialUser,
  isLanding,
  layout = 'default',
}: AuthSectionProps) {
  const t = useTranslations('common')
  const tNav = useTranslations('nav')
  const tAuth = useTranslations('auth')
  const router = useRouter()
  const [user, setUser] = useState<UserState | null>(
    initialUser
      ? {
          id: initialUser.id,
          email: initialUser.email,
          displayName: null,
          avatarUrl: null,
        }
      : null
  )
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    async function loadUser(userId: string, email: string) {
      const [profileRes, configRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('display_name, avatar_url')
          .eq('id', userId)
          .single(),
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

    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (u) loadUser(u.id, u.email ?? '')
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadUser(session.user.id, session.user.email ?? '')
      } else {
        setUser(null)
        setIsAdmin(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
    setIsAdmin(false)
    router.replace('/watch')
    router.refresh()
  }

  if (!user) {
    if (layout === 'sheet') {
      return (
        <Button
          size="default"
          variant="outline"
          className="h-11 w-full rounded-full text-[14px]"
          asChild
        >
          <Link href="/auth">{t('signIn')}</Link>
        </Button>
      )
    }
    if (isLanding) {
      return (
        <>
          <Link
            href="/auth"
            className="inline-flex items-center justify-center rounded-full border border-[var(--line-2)] px-3 py-[7px] text-[12.5px] font-medium text-[var(--text)] transition-all duration-150 hover:bg-white/[0.04]"
          >
            {t('signIn')}
          </Link>
          <Link
            href="/auth"
            className="inline-flex items-center justify-center rounded-full bg-[var(--primary)] px-3 py-[7px] text-[12.5px] font-medium text-[var(--primary-foreground)] transition-all duration-150 hover:bg-white"
          >
            {tAuth('landingStartFree')}
          </Link>
        </>
      )
    }
    return (
      <Button
        size="sm"
        variant="outline"
        className="h-10 rounded-full px-5 text-sm"
        asChild
      >
        <Link href="/auth">{t('signIn')}</Link>
      </Button>
    )
  }

  if (layout === 'sheet') {
    return (
      <div className="flex w-full flex-col gap-3">
        <p
          className="text-muted-foreground truncate px-0.5 text-xs"
          title={user.email}
        >
          {user.email}
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button
            variant="outline"
            className="h-11 justify-center gap-2 rounded-full"
            asChild
          >
            <Link href="/profile" onClick={() => router.refresh()}>
              <User className="size-4" />
              {tNav('profile')}
            </Link>
          </Button>
          {isAdmin && (
            <Button
              variant="outline"
              className="h-11 justify-center gap-2 rounded-full"
              asChild
            >
              <Link href="/admin">
                <Shield className="size-4" />
                {tNav('admin')}
              </Link>
            </Button>
          )}
          <Button
            variant="outline"
            className={cn(
              'border-brand-red-safe/40 text-brand-red-safe hover:bg-brand-red-safe/10 hover:text-brand-red-safe h-11 justify-center gap-2 rounded-full',
              isAdmin ? 'sm:col-span-2' : ''
            )}
            type="button"
            onClick={() => {
              void signOut()
            }}
          >
            <LogOut className="size-4" />
            {t('signOut')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <UserDropdown email={user.email} isAdmin={isAdmin} onSignOut={signOut}>
      <button
        type="button"
        className="flex items-center gap-2.5"
        aria-label={tNav('userMenu')}
      >
        <UserAvatar
          name={user.displayName || user.email}
          avatarUrl={user.avatarUrl}
        />
      </button>
    </UserDropdown>
  )
}
