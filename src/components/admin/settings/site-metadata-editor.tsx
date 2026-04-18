'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { updateSiteMetadata } from '@/app/admin/actions'
import { SettingsCard, SettingsField } from './settings-card'

type Values = {
  site_title: string
  site_description: string
  site_tagline: string
}

export function SiteMetadataEditor({ initial }: { initial: Values }) {
  const [values, setValues] = useState<Values>(initial)
  const [saving, setSaving] = useState(false)

  const dirty =
    values.site_title !== initial.site_title ||
    values.site_description !== initial.site_description ||
    values.site_tagline !== initial.site_tagline

  async function onSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const result = await updateSiteMetadata({
      site_title: values.site_title,
      site_description: values.site_description || null,
      site_tagline: values.site_tagline,
    })
    setSaving(false)
    if (result.success) toast.success('Site metadata saved')
    else toast.error(result.error ?? 'Failed to save')
  }

  return (
    <SettingsCard
      title="Site metadata"
      description="Controls the browser tab title, search-engine description, and the tagline under the logo."
    >
      <form onSubmit={onSave} className="grid gap-4 md:grid-cols-2">
        <SettingsField label="Site title" hint="Shown in <title> and browser tabs.">
          <Input
            value={values.site_title}
            onChange={(e) => setValues((v) => ({ ...v, site_title: e.target.value }))}
            placeholder="Clickit Story"
            maxLength={120}
          />
        </SettingsField>

        <SettingsField label="Site tagline" hint="Short hook shown next to the logo.">
          <Input
            value={values.site_tagline}
            onChange={(e) => setValues((v) => ({ ...v, site_tagline: e.target.value }))}
            placeholder="Every Story Clicks."
            maxLength={120}
          />
        </SettingsField>

        <SettingsField
          label="SEO description"
          hint="Used in meta description + Open Graph preview (150-300 chars ideal)."
        >
          <Textarea
            value={values.site_description}
            onChange={(e) => setValues((v) => ({ ...v, site_description: e.target.value }))}
            placeholder="A streaming home for original series from Abu Dhabi…"
            maxLength={300}
            rows={3}
            className="md:col-span-2"
          />
        </SettingsField>

        <div className="flex items-center justify-end md:col-span-2">
          <Button type="submit" disabled={!dirty || saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : 'Save metadata'}
          </Button>
        </div>
      </form>
    </SettingsCard>
  )
}
