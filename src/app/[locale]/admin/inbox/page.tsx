import { createClient } from '@/lib/supabase/server'

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
      <section className="rounded-[6px] border border-[var(--line)] bg-[var(--bg-1)]">
        <div className="border-b border-[var(--line)] px-6 py-4">
          <h2 className="font-display text-[26px] tracking-[-0.03em] text-[var(--text)]">Support messages</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--bg-2)] text-[var(--text-mute)]">
              <tr>
                <th className="px-6 py-3 font-medium">From</th>
                <th className="px-6 py-3 font-medium">Subject</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Email</th>
              </tr>
            </thead>
            <tbody>
              {(supportMessages ?? []).map((message) => (
                <tr key={message.id} className="border-t border-[var(--line)]">
                  <td className="px-6 py-4 text-[var(--text)]">{message.name}</td>
                  <td className="px-6 py-4 text-[var(--text-dim)]">{message.subject}</td>
                  <td className="px-6 py-4 text-[var(--text-dim)]">{message.status} / {message.notification_status}</td>
                  <td className="px-6 py-4 text-[var(--text-dim)]">{message.email}</td>
                </tr>
              ))}
              {(supportMessages ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-[var(--text-mute)]">
                    No support messages yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-[6px] border border-[var(--line)] bg-[var(--bg-1)]">
        <div className="border-b border-[var(--line)] px-6 py-4">
          <h2 className="font-display text-[26px] tracking-[-0.03em] text-[var(--text)]">Newsletter subscribers</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--bg-2)] text-[var(--text-mute)]">
              <tr>
                <th className="px-6 py-3 font-medium">Email</th>
                <th className="px-6 py-3 font-medium">Source</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Interests</th>
              </tr>
            </thead>
            <tbody>
              {(newsletterSubscribers ?? []).map((subscriber) => (
                <tr key={subscriber.id} className="border-t border-[var(--line)]">
                  <td className="px-6 py-4 text-[var(--text)]">{subscriber.email}</td>
                  <td className="px-6 py-4 text-[var(--text-dim)]">{subscriber.source}</td>
                  <td className="px-6 py-4 text-[var(--text-dim)]">{subscriber.status} / {subscriber.notification_status}</td>
                  <td className="px-6 py-4 text-[var(--text-dim)]">
                    {Array.isArray(subscriber.interests) && subscriber.interests.length > 0
                      ? subscriber.interests.map((item) => {
                        if (typeof item !== 'object' || item === null) return null
                        const title = 'title' in item && typeof item.title === 'string' ? item.title : null
                        const slug = 'slug' in item && typeof item.slug === 'string' ? item.slug : null
                        return title || slug
                      }).filter(Boolean).join(', ')
                      : 'General newsletter'}
                  </td>
                </tr>
              ))}
              {(newsletterSubscribers ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-[var(--text-mute)]">
                    No newsletter subscribers yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
