import { createClient } from '@/lib/supabase/server'
import { AdminPanel, AdminTableShell, AdminToolbar } from '@/components/admin/admin-shell'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export default async function AdminInboxPage() {
  const supabase = await createClient()

  const [{ data: supportMessages }, { data: newsletterSubscribers }] = await Promise.all([
    supabase
      .from('support_messages')
      .select('id, name, email, subject, status, notification_status, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('newsletter_subscribers')
      .select('id, email, source, status, notification_status, interests, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  return (
    <div className="space-y-8">
      <AdminPanel className="p-0">
        <div className="p-5 md:p-6">
          <AdminToolbar eyebrow="Inbox" title="Support messages" />
        </div>
        <AdminTableShell className="rounded-none border-x-0 border-b-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>From</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Email</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(supportMessages ?? []).map((message) => (
                <TableRow key={message.id}>
                  <TableCell className="text-foreground">{message.name}</TableCell>
                  <TableCell className="text-muted-foreground">{message.subject}</TableCell>
                  <TableCell className="text-muted-foreground">{message.status} / {message.notification_status}</TableCell>
                  <TableCell className="text-muted-foreground">{message.email}</TableCell>
                </TableRow>
              ))}
              {(supportMessages ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                    No support messages yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </AdminTableShell>
      </AdminPanel>

      <AdminPanel className="p-0">
        <div className="p-5 md:p-6">
          <AdminToolbar eyebrow="Inbox" title="Newsletter subscribers" />
        </div>
        <AdminTableShell className="rounded-none border-x-0 border-b-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Interests</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(newsletterSubscribers ?? []).map((subscriber) => (
                <TableRow key={subscriber.id}>
                  <TableCell className="text-foreground">{subscriber.email}</TableCell>
                  <TableCell className="text-muted-foreground">{subscriber.source}</TableCell>
                  <TableCell className="text-muted-foreground">{subscriber.status} / {subscriber.notification_status}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {Array.isArray(subscriber.interests) && subscriber.interests.length > 0
                      ? subscriber.interests.map((item) => {
                        if (typeof item !== 'object' || item === null) return null
                        const title = 'title' in item && typeof item.title === 'string' ? item.title : null
                        const slug = 'slug' in item && typeof item.slug === 'string' ? item.slug : null
                        return title || slug
                      }).filter(Boolean).join(', ')
                      : 'General newsletter'}
                  </TableCell>
                </TableRow>
              ))}
              {(newsletterSubscribers ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                    No newsletter subscribers yet.
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
