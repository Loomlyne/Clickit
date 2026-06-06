'use client'

import { useTranslations, useLocale } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { User, LogOut, Shield } from 'lucide-react'

interface UserDropdownProps {
  children: React.ReactNode
  onSignOut: () => void
  isAdmin?: boolean
  email?: string
}

export function UserDropdown({
  children,
  onSignOut,
  isAdmin = false,
  email,
}: UserDropdownProps) {
  const tNav = useTranslations('nav')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const router = useRouter()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-[200px]">
        <DropdownMenuLabel className="text-muted-foreground font-normal">
          {email ?? tNav('profile')}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="focus:text-[var(--primary)] data-[highlighted]:text-[var(--primary)] focus:[&_svg]:text-[var(--primary)] data-[highlighted]:[&_svg]:text-[var(--primary)]"
          onSelect={() => router.push('/profile')}
        >
          <User className="me-2 size-4 text-current" />
          {tNav('profile')}
        </DropdownMenuItem>
        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="focus:text-[var(--primary)] data-[highlighted]:text-[var(--primary)] focus:[&_svg]:text-[var(--primary)] data-[highlighted]:[&_svg]:text-[var(--primary)]"
              onSelect={() => window.location.assign(`/${locale}/admin`)}
            >
              <Shield className="me-2 size-4 text-current" />
              {tNav('admin')}
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-brand-red-safe focus:text-brand-red-safe"
          onSelect={() => onSignOut()}
        >
          <LogOut className="me-2 size-4" />
          {tCommon('signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
