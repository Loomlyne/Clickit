import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { format } from 'date-fns'

import { AdminBackLink, AdminPanel } from '@/components/admin/admin-shell'
import { createClient } from '@/lib/supabase/server'

type AdminInboxMessagePageProps = {
  params: Promise<{ id: string }>
}

export default async function AdminInboxMessagePage({
  params,
}: AdminInboxMessagePageProps) {
  const [{ id }, supabase, t] = await Promise.all([
    params,
    createClient(),
    getTranslations('admin.inboxPage'),
  ])

  const { data: message, error } = await supabase
    .from('support_messages')
    .select(
      'id, name, email, phone, subject, message, status, notification_status, notification_error, created_at'
    )
    .eq('id', id)
    .maybeSingle()

  if (error || !message) notFound()

  return (
    <div className="space-y-5">
      <AdminBackLink href="/admin/inbox">{t('backToInbox')}</AdminBackLink>

      <AdminPanel className="p-0">
        <div className="border-b border-[var(--line)] px-5 py-4 md:px-6">
          <p className="text-[12px] text-[var(--text-mute)]">
            {format(new Date(message.created_at), 'PPp')}
          </p>
          <h1 className="mt-1 text-[24px] leading-8 font-semibold tracking-tight text-[var(--text)]">
            {message.subject}
          </h1>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[14px] text-[var(--text-dim)]">
            <span>
              {t('detailFrom')}: {message.name}
            </span>
            <a
              className="text-[var(--primary)] transition-colors hover:underline"
              href={`mailto:${message.email}`}
            >
              {message.email}
            </a>
            {message.phone && <span>{message.phone}</span>}
          </div>
        </div>

        <div className="grid gap-5 p-5 md:p-6 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.12em] text-[var(--text-mute)] uppercase">
              {t('messageBody')}
            </p>
            <div className="mt-2 rounded-lg border border-[var(--line)] bg-[var(--bg-0)] p-4 text-[15px] leading-7 whitespace-pre-wrap text-[var(--text)]">
              {message.message}
            </div>
          </div>

          <aside className="space-y-3 self-start rounded-lg border border-[var(--line)] bg-[var(--bg-2)] p-4">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.12em] text-[var(--text-mute)] uppercase">
                {t('colStatus')}
              </p>
              <p className="mt-1 text-[14px] text-[var(--text)]">
                {message.status} / {message.notification_status}
              </p>
            </div>
            {message.notification_error && (
              <div>
                <p className="text-[11px] font-semibold tracking-[0.12em] text-[var(--text-mute)] uppercase">
                  {t('notificationError')}
                </p>
                <p className="text-brand-red-safe mt-1 text-[14px] break-words">
                  {message.notification_error}
                </p>
              </div>
            )}
          </aside>
        </div>
      </AdminPanel>
    </div>
  )
}
