import type { Metadata } from 'next'
import { unstable_rethrow } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'

import {
  AdminPageHeader,
  AdminPanel,
  AdminTableShell,
} from '@/components/admin/admin-shell'
import { YouTubeStatusChip as StatusChip } from '@/components/admin/youtube-status-chip'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { redirect } from '@/i18n/navigation'
import { cn } from '@/lib/utils'
import { type AdminDirectoryRow, listAdmins } from '@/server/admin-directory'
import { AdminAccessError, requireAdmin } from '@/server/auth-guards'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.admins')
  return { title: `${t('title')} | Clickit Admin` }
}

export const dynamic = 'force-dynamic'

// Read-only list (D-22, Q11 = A; UI-SPEC 6.8). Admins are added or removed only
// by the owner's reviewed SQL step: this page has no add, edit, remove or reset
// control and calls no write path.

function lastSignIn(
  iso: string | null,
  locale: string
): { text: string | null; title?: string } {
  if (!iso) return { text: null }
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return { text: null }
  const text = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-AE' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Dubai',
  }).format(date)
  return { text, title: date.toISOString() }
}

export default async function AdminsPage() {
  const locale = await getLocale()

  // The layout already gates /admin; the page re-checks (T-05-27-01) and needs
  // the signed-in admin's id for the "You" chip.
  let me: string
  try {
    me = (await requireAdmin()).id
  } catch (e) {
    unstable_rethrow(e)
    if (
      e instanceof AdminAccessError &&
      (e.code === 'needs_enrol' || e.code === 'needs_code')
    ) {
      return redirect({
        href: { pathname: '/auth/mfa', query: { next: '/admin/admins' } },
        locale,
      })
    }
    return redirect({ href: '/watch', locale })
  }

  const t = await getTranslations('admin.admins')

  let admins: AdminDirectoryRow[] | null = null
  try {
    admins = await listAdmins()
  } catch (e) {
    unstable_rethrow(e)
    console.error('[admin/admins] load failed', e)
  }

  const authenticatorChip = (admin: AdminDirectoryRow) => (
    <StatusChip tone={admin.hasTotp ? 'ok' : 'warn'}>
      {admin.hasTotp ? t('setUp') : t('notSetUp')}
    </StatusChip>
  )

  const youChip = (admin: AdminDirectoryRow) =>
    admin.userId === me ? (
      <StatusChip tone="neutral" className="ms-2">
        {t('you')}
      </StatusChip>
    ) : null

  const signIn = (admin: AdminDirectoryRow) => {
    const s = lastSignIn(admin.lastSignInAt, locale)
    return s.text ? (
      <time dateTime={s.title} title={s.title}>
        {s.text}
      </time>
    ) : (
      t('never')
    )
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader title={t('title')} description={t('description')} />

      {admins === null ? (
        <AdminPanel className="text-[14px] text-[var(--text-dim)]">
          <p role="alert">{t('loadError')}</p>
        </AdminPanel>
      ) : (
        <>
          <AdminTableShell className="max-md:hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('nameColumn')}</TableHead>
                  <TableHead>{t('emailColumn')}</TableHead>
                  <TableHead>{t('authenticatorColumn')}</TableHead>
                  <TableHead>{t('lastSignInColumn')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((admin) => (
                  <TableRow
                    key={admin.userId}
                    className={cn(admin.userId === me && 'bg-[var(--bg-2)]')}
                  >
                    <TableCell className="text-[14px] font-bold text-[var(--text)]">
                      <bdi>{admin.displayName}</bdi>
                      {youChip(admin)}
                    </TableCell>
                    <TableCell className="text-[14px] break-all whitespace-normal text-[var(--text-dim)]">
                      <span dir="ltr">{admin.email ?? '—'}</span>
                    </TableCell>
                    <TableCell>{authenticatorChip(admin)}</TableCell>
                    <TableCell className="text-[14px] text-[var(--text-dim)]">
                      {signIn(admin)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AdminTableShell>

          <ul className="flex flex-col gap-3 md:hidden">
            {admins.map((admin) => (
              <li
                key={admin.userId}
                className={cn(
                  'rounded-card flex flex-col gap-2 border border-[var(--line)] bg-[var(--bg-1)] p-4',
                  admin.userId === me && 'bg-[var(--bg-2)]'
                )}
              >
                <div className="text-[14px] font-bold text-[var(--text)]">
                  <bdi>{admin.displayName}</bdi>
                  {youChip(admin)}
                </div>
                <div className="text-[14px] break-all text-[var(--text-dim)]">
                  <span dir="ltr">{admin.email ?? '—'}</span>
                </div>
                <div>{authenticatorChip(admin)}</div>
                <div className="text-[14px] text-[var(--text-dim)]">
                  <span className="text-[var(--text-mute)]">
                    {t('lastSignInColumn')}:{' '}
                  </span>
                  {signIn(admin)}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <AdminPanel>
        <p className="text-[14px] text-[var(--text-mute)]">{t('ownerNote')}</p>
      </AdminPanel>
    </div>
  )
}
