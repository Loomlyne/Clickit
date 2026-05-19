'use client'

import { useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'

import { updateContactRecipient } from '@/app/[locale]/admin/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type InboxRecipientFormProps = {
  initialEmail: string
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

  async function onSave(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    const result = await updateContactRecipient({ contactEmail: email })
    setSaving(false)

    if (result.success) toast.success(savedMessage)
    else toast.error(result.error ?? failedMessage)
  }

  return (
    <section className="rounded-lg border border-white/8 bg-[var(--bg-2)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <h2 className="text-foreground text-lg font-semibold tracking-tight">
            {title}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm leading-6">
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
            className="rounded-[12px]"
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
