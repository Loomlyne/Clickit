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
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  hasSavedValue: boolean
  placeholder?: string
  disabled?: boolean
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
          disabled={disabled}
          className="text-muted-foreground font-mono"
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setReplacing(true)
            onChange('')
          }}
          className="inline-flex min-h-11 shrink-0 items-center px-2 text-xs font-medium tracking-wider text-[var(--text-dim)] uppercase underline-offset-4 hover:text-[var(--text)] hover:underline disabled:pointer-events-none disabled:opacity-40"
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
        disabled={disabled}
        className="font-mono"
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => setReveal((r) => !r)}
        className="inline-flex size-11 shrink-0 items-center justify-center text-[var(--text-dim)] hover:text-[var(--text)] disabled:pointer-events-none disabled:opacity-40"
        aria-label={reveal ? t('hideValue') : t('revealValue')}
      >
        {reveal ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}
