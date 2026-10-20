'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Masked field for an API key (UI-SPEC §6, G6 pictures).
 *
 * - Editing: a password input with the show/hide eye inside the field on the
 *   end side, so the admin can check what was pasted before saving.
 * - Saved (`saved` set): a read-only field showing only "•••• last4" plus
 *   Change key. The browser never receives the stored key, only its last 4.
 *   Change clears the field and focuses it; Esc or Keep current key returns
 *   to the saved state.
 * - `actions` (Save key / Test key) sit on the same row, after the field.
 */
export function SecretField({
  value,
  onChange,
  saved,
  onChangeRequested,
  onCancelChange,
  label,
  placeholder,
  disabled,
  readOnly,
  actions,
}: {
  value: string
  onChange: (v: string) => void
  /** Set when a key is stored and the admin is not changing it. */
  saved: { last4: string } | null
  onChangeRequested: () => void
  /** Present while changing a stored key: Esc and Keep current key call it. */
  onCancelChange?: () => void
  label: string
  placeholder?: string
  disabled?: boolean
  readOnly?: boolean
  actions?: ReactNode
}) {
  const t = useTranslations('admin.settings')
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [reveal, setReveal] = useState(false)
  const focusOnEdit = useRef(false)

  // Focus the empty field once it replaces the saved view.
  useEffect(() => {
    if (focusOnEdit.current && !saved) {
      inputRef.current?.focus()
      focusOnEdit.current = false
    }
  }, [saved])

  const labelEl = (
    <Label
      htmlFor={id}
      className="mb-1.5 text-[11px] font-semibold tracking-[0.12em] text-[var(--text-mute)] uppercase"
    >
      {label}
    </Label>
  )

  if (saved) {
    return (
      <div className="flex min-w-0 flex-col">
        {labelEl}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            id={id}
            value={t('keySavedMasked', { last4: saved.last4 })}
            readOnly
            disabled={disabled}
            dir="ltr"
            className="h-11 flex-1 rounded-[8px] font-mono text-sm text-[var(--text-dim)]"
          />
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={() => {
              onChange('')
              setReveal(false)
              focusOnEdit.current = true
              onChangeRequested()
            }}
            className="min-h-11 w-full px-6 py-2 text-sm font-bold sm:w-auto"
          >
            {t('changeKey')}
          </Button>
          {actions}
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-col">
      {labelEl}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Input
            ref={inputRef}
            id={id}
            type={reveal ? 'text' : 'password'}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && onCancelChange) {
                e.preventDefault()
                onChange('')
                setReveal(false)
                onCancelChange()
              }
            }}
            placeholder={placeholder}
            autoComplete="off"
            spellCheck={false}
            disabled={disabled}
            readOnly={readOnly}
            dir="ltr"
            className="h-11 rounded-[8px] pe-12 font-mono text-sm"
          />
          <button
            type="button"
            disabled={disabled}
            onClick={() => setReveal((r) => !r)}
            aria-pressed={reveal}
            aria-label={reveal ? t('hideValue') : t('revealValue')}
            className="absolute end-0 top-0 size-11 inline-flex items-center justify-center rounded-[8px] text-[var(--text-dim)] outline-none hover:text-[var(--text)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:pointer-events-none disabled:opacity-40"
          >
            {reveal ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {onCancelChange && (
          <Button
            type="button"
            variant="link"
            disabled={disabled || readOnly}
            onClick={() => {
              onChange('')
              setReveal(false)
              onCancelChange()
            }}
            className="min-h-11 w-full px-3 py-2 text-sm font-bold text-[var(--text-dim)] hover:text-[var(--text)] hover:no-underline sm:w-auto"
          >
            {t('cancelChange')}
          </Button>
        )}
        {actions}
      </div>
    </div>
  )
}
