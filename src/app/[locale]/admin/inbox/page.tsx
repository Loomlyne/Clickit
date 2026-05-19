import { getTranslations } from 'next-intl/server'
import { MailOpen } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { AdminPanel, AdminTableShell } from '@/components/admin/admin-shell'
import { InboxRecipientForm } from '@/components/admin/inbox-recipient-form'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Link } from '@/i18n/navigation'
import { getAppConfig } from '@/lib/config'

export default async function AdminInboxPage() {
  const [supabase, tDash, t, config] = await Promise.all([
    createClient(),
    getTranslations('admin.dashboard'),
    getTranslations('admin.inboxPage'),
    getAppConfig(),
  ])

  const [{ data: supportMessages }, { data: newsletterSubscribers }] =
    await Promise.all([
      supabase
        .from('support_messages')
        .select(
          'id, name, email, subject, status, notification_status, created_at'
        )
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('newsletter_subscribers')
        .select(
          'id, email, source, status, notification_status, interests, created_at'
        )
        .order('created_at', { ascending: false })
        .limit(50),
    ])

  return (
    <div className="space-y-8">
      <InboxRecipientForm
        initialEmail={config.footer.contactEmail}
        title={t('receiverTitle')}
        description={t('receiverDescription')}
        label={t('receiverLabel')}
        fallbackLabel={t('receiverFallback')}
        saveLabel={t('saveReceiver')}
        savedMessage={t('receiverSaved')}
        failedMessage={t('receiverSaveFailed')}
      />

      <AdminPanel className="p-0">
        <div className="flex flex-col gap-1 border-b border-white/8 px-4 py-3 sm:px-5 sm:py-4 md:px-6">
          <h2 className="text-foreground text-lg font-semibold tracking-tight sm:text-xl">
            {tDash('inbox')}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t('supportSubtitle')}
          </p>
        </div>
        <AdminTableShell className="rounded-none border-x-0 border-b-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('colFrom')}</TableHead>
                <TableHead>{t('colSubject')}</TableHead>
                <TableHead>{t('colStatus')}</TableHead>
                <TableHead>{t('colEmail')}</TableHead>
                <TableHead className="text-right">{t('colActions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(supportMessages ?? []).map((message) => (
                <TableRow key={message.id}>
                  <TableCell className="text-foreground">
                    {message.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {message.subject}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {message.status} / {message.notification_status}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {message.email}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/admin/inbox/${message.id}`}>
                        <MailOpen className="size-4" />
                        {t('openMessage')}
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(supportMessages ?? []).length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-muted-foreground py-10 text-center"
                  >
                    {t('emptySupport')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </AdminTableShell>
      </AdminPanel>

      <AdminPanel className="p-0">
        <div className="flex flex-col gap-1 border-b border-white/8 px-4 py-3 sm:px-5 sm:py-4 md:px-6">
          <h2 className="text-foreground text-lg font-semibold tracking-tight sm:text-xl">
            {tDash('inbox')}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t('newsletterSubtitle')}
          </p>
        </div>
        <AdminTableShell className="rounded-none border-x-0 border-b-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('colEmail')}</TableHead>
                <TableHead>{t('colSource')}</TableHead>
                <TableHead>{t('colStatus')}</TableHead>
                <TableHead>{t('colInterests')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(newsletterSubscribers ?? []).map((subscriber) => (
                <TableRow key={subscriber.id}>
                  <TableCell className="text-foreground">
                    {subscriber.email}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {subscriber.source}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {subscriber.status} / {subscriber.notification_status}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {Array.isArray(subscriber.interests) &&
                    subscriber.interests.length > 0
                      ? subscriber.interests
                          .map((item) => {
                            if (typeof item !== 'object' || item === null)
                              return null
                            const title =
                              'title' in item && typeof item.title === 'string'
                                ? item.title
                                : null
                            const slug =
                              'slug' in item && typeof item.slug === 'string'
                                ? item.slug
                                : null
                            return title || slug
                          })
                          .filter(Boolean)
                          .join(', ')
                      : t('generalNewsletter')}
                  </TableCell>
                </TableRow>
              ))}
              {(newsletterSubscribers ?? []).length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-muted-foreground py-10 text-center"
                  >
                    {t('emptyNewsletter')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </AdminTableShell>
      </AdminPanel>
    </div>
  )
}
