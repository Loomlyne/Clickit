'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'

/**
 * Masked text input for API keys / secrets.
 *
 * UX model:
 * - If `hasSavedValue` is true, we render a placeholder of "••••••••" and
 *   the user must click "Replace" (which clears the field) to set a new one.
 *   We NEVER receive the saved value from the server — only a boolean that
 *   one exists. This is the defense-in-depth boundary: the secret lives
 *   behind a column-level REVOKE and can only be read by the service role.
 * - If empty, user can type freely.
 * - Reveal toggle lets the admin peek at what they've just typed before saving.
 */
export function SecretField({
  value,
  onChange,
  hasSavedValue,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  hasSavedValue: boolean
  placeholder?: string
}) {
  const [reveal, setReveal] = useState(false)
  const [replacing, setReplacing] = useState(!hasSavedValue)
  const t = useTranslations('admin.settings')

  if (hasSavedValue && !replacing) {
    return (
      <div className="flex items-center gap-2">
        <Input
          value="••••••••••••••••"
          readOnly
          className="font-mono text-muted-foreground"
        />
        <button
          type="button"
          onClick={() => {
            setReplacing(true)
            onChange('')
          }}
          className="shrink-0 text-xs font-medium uppercase tracking-wider text-white/60 underline-offset-4 hover:text-white hover:underline"
        >
          {t('replace')}
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        type={reveal ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        className="font-mono"
      />
      <button
        type="button"
        onClick={() => setReveal((r) => !r)}
        className="shrink-0 text-white/60 hover:text-white"
        aria-label={reveal ? t('hideValue') : t('revealValue')}
      >
        {reveal ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}
