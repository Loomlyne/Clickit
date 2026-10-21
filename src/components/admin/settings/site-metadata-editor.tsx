'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { useArabicMissingToast } from '@/components/admin/arabic-missing-toast'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { updateSiteMetadata } from '@/app/[locale]/admin/actions'
import { SettingsCard, SettingsField } from './settings-card'
import { useSharedRowVersion } from '@/components/admin/row-version'

type Values = {
  site_title: string
  site_description: string
  site_description_ar: string
  site_tagline: string
  site_tagline_ar: string
}

export function SiteMetadataEditor({ initial }: { initial: Values }) {
  const [values, setValues] = useState<Values>(initial)
  const [saving, setSaving] = useState(false)
  const t = useTranslations('admin.settings')
  const warnArabicMissing = useArabicMissingToast()
  const version = useSharedRowVersion()

  const dirty =
    values.site_title !== initial.site_title ||
    values.site_description !== initial.site_description ||
    values.site_description_ar !== initial.site_description_ar ||
    values.site_tagline !== initial.site_tagline ||
    values.site_tagline_ar !== initial.site_tagline_ar

  async function onSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const expected = version.expected()
    const result = await updateSiteMetadata(
      {
        site_title: values.site_title,
        site_description: values.site_description || null,
        site_description_ar: values.site_description_ar || null,
        site_tagline: values.site_tagline,
        site_tagline_ar: values.site_tagline_ar || null,
      },
      expected
    )
    setSaving(false)
    if (result.success) {
      version.saved(expected, result.updatedAt)
      if (!warnArabicMissing(result)) toast.success(t('siteMetadataSaved'))
    } else toast.error(result.error ?? t('saveFailed'))
  }

  return (
    <SettingsCard
      title={t('siteMetadataTitle')}
      description={t('siteMetadataDescription')}
    >
      <form onSubmit={onSave} className="grid gap-4 md:grid-cols-2">
        <SettingsField label={t('siteTitleLabel')} hint={t('siteTitleHint')}>
          <Input
            value={values.site_title}
            onChange={(e) =>
              setValues((v) => ({ ...v, site_title: e.target.value }))
            }
            placeholder={t('siteTitlePlaceholder')}
            maxLength={120}
          />
        </SettingsField>

        <SettingsField
          label={t('siteTaglineLabel')}
          hint={t('siteTaglineHint')}
        >
          <Input
            value={values.site_tagline}
            onChange={(e) =>
              setValues((v) => ({ ...v, site_tagline: e.target.value }))
            }
            placeholder={t('siteTaglinePlaceholder')}
            maxLength={120}
          />
        </SettingsField>

        <SettingsField
          label={t('siteTaglineArLabel')}
          hint={t('siteTaglineArHint')}
        >
          <Input
            dir="rtl"
            value={values.site_tagline_ar}
            onChange={(e) =>
              setValues((v) => ({ ...v, site_tagline_ar: e.target.value }))
            }
            placeholder="كل قصة تنقر"
            maxLength={120}
          />
        </SettingsField>

        <SettingsField
          label={t('seoDescriptionLabel')}
          hint={t('seoDescriptionHint')}
        >
          <Textarea
            value={values.site_description}
            onChange={(e) =>
              setValues((v) => ({ ...v, site_description: e.target.value }))
            }
            placeholder={t('seoDescriptionPlaceholder')}
            maxLength={300}
            rows={3}
            className="rounded-lg md:col-span-2"
          />
        </SettingsField>

        <SettingsField
          label={t('seoDescriptionArLabel')}
          hint={t('seoDescriptionArHint')}
        >
          <Textarea
            dir="rtl"
            value={values.site_description_ar}
            onChange={(e) =>
              setValues((v) => ({ ...v, site_description_ar: e.target.value }))
            }
            placeholder="عروض أصلية من الإمارات — تُبث الآن"
            maxLength={300}
            rows={3}
            className="rounded-lg md:col-span-2"
          />
        </SettingsField>

        <div className="flex items-center justify-end md:col-span-2">
          <Button type="submit" disabled={!dirty || saving}>
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              t('saveMetadata')
            )}
          </Button>
        </div>
      </form>
    </SettingsCard>
  )
}
