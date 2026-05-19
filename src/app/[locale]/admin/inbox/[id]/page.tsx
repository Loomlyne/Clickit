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
    <div className="space-y-6">
      <AdminBackLink href="/admin/inbox">{t('backToInbox')}</AdminBackLink>

      <AdminPanel className="p-0">
        <div className="border-b border-white/8 px-4 py-4 sm:px-6 md:px-8 md:py-6">
          <p className="text-muted-foreground text-xs tracking-[0.18em] uppercase">
            {format(new Date(message.created_at), 'PPp')}
          </p>
          <h1 className="text-foreground mt-3 text-2xl font-semibold tracking-tight md:text-3xl">
            {message.subject}
          </h1>
          <div className="text-muted-foreground mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <span>
              {t('detailFrom')}: {message.name}
            </span>
            <a
              className="text-foreground hover:text-primary transition-colors"
              href={`mailto:${message.email}`}
            >
              {message.email}
            </a>
            {message.phone && <span>{message.phone}</span>}
          </div>
        </div>

        <div className="grid gap-6 p-4 sm:p-6 md:p-8 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div>
            <p className="text-muted-foreground text-xs tracking-[0.18em] uppercase">
              {t('messageBody')}
            </p>
            <div className="text-foreground mt-4 whitespace-pre-wrap rounded-lg border border-white/8 bg-black/20 p-4 text-sm leading-7 md:p-5 md:text-base">
              {message.message}
            </div>
          </div>

          <aside className="space-y-4 rounded-lg border border-white/8 bg-white/[0.03] p-4">
            <div>
              <p className="text-muted-foreground text-xs tracking-[0.16em] uppercase">
                {t('colStatus')}
              </p>
              <p className="text-foreground mt-2 text-sm">
                {message.status} / {message.notification_status}
              </p>
            </div>
            {message.notification_error && (
              <div>
                <p className="text-muted-foreground text-xs tracking-[0.16em] uppercase">
                  {t('notificationError')}
                </p>
                <p className="text-brand-red-safe mt-2 text-sm break-words">
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
