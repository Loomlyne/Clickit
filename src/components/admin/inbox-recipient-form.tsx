'use client'

import { adminPanelClass } from '@/components/admin/admin-shell'
import { useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'

import { updateContactRecipient } from '@/app/[locale]/admin/actions'
import { useRowVersion } from '@/components/admin/row-version'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type InboxRecipientFormProps = {
  initialEmail: string
  /** app_config.updated_at read with initialEmail; the save is checked against it. */
  updatedAt: string
  title: string
  description: string
  label: string
  fallbackLabel: string
  saveLabel: string
  savedMessage: string
  failedMessage: string
}

export function InboxRecipientForm({
  initialEmail,
  updatedAt,
  title,
  description,
  label,
  fallbackLabel,
  saveLabel,
  savedMessage,
  failedMessage,
}: InboxRecipientFormProps) {
  const [email, setEmail] = useState(initialEmail)
  const [saving, setSaving] = useState(false)
  const version = useRowVersion(updatedAt)

  async function onSave(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    const expected = version.expected()
    const result = await updateContactRecipient(
      { contactEmail: email },
      expected
    )
    setSaving(false)

    if (result.success) {
      version.saved(expected, result.updatedAt)
      toast.success(savedMessage)
    } else toast.error(result.error ?? failedMessage)
  }

  return (
    <section className={`${adminPanelClass} p-4`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <h2 className="text-[16px] font-semibold">{title}</h2>
          <p className="mt-0.5 text-[14px] leading-6 text-[var(--text-dim)]">
            {description}
          </p>
        </div>
        <form
          onSubmit={onSave}
          className="grid w-full gap-2 sm:grid-cols-[minmax(0,1fr)_auto] lg:max-w-xl"
        >
          <label className="sr-only" htmlFor="notification-recipient">
            {label}
          </label>
          <Input
            id="notification-recipient"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="contact@clickitstory.com"
            aria-describedby="notification-recipient-help"
          />
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save />}
            {saveLabel}
          </Button>
          <p
            id="notification-recipient-help"
            className="text-muted-foreground text-xs sm:col-span-2"
          >
            {email.trim() ? label : fallbackLabel}
          </p>
        </form>
      </div>
    </section>
  )
}
