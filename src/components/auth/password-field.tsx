'use client'

import { useId, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { passwordScore, passwordStrength } from './password-rules'

type PasswordFieldProps = Omit<React.ComponentProps<'input'>, 'type'> & {
  label: string
  /** Translated error text shown under the field. */
  error?: string
  /**
   * Pass the current value to show the strength meter. Leave undefined for no
   * meter (sign-in, confirm fields).
   */
  strengthOf?: string
}

/**
 * The one password input of the product: label, right-side show/hide eye
 * (44x44, keyboard reachable, logical `end` so it mirrors in Arabic),
 * optional strength meter and inline error. Works uncontrolled through
 * react-hook-form's `register` (ref + onChange come in on ...props) and
 * controlled with value/onChange.
 */
export function PasswordField({
  label,
  error,
  strengthOf,
  id,
  className,
  ...props
}: PasswordFieldProps) {
  const t = useTranslations('auth')
  const [shown, setShown] = useState(false)
  const autoId = useId()
  const inputId = id ?? autoId
  const errorId = `${inputId}-error`
  const strengthId = `${inputId}-strength`
  const score = strengthOf === undefined ? 0 : passwordScore(strengthOf)
  const level = passwordStrength(score)

  return (
    <div>
      <Label htmlFor={inputId}>{label}</Label>
      <div className="relative mt-1.5">
        <Input
          {...props}
          id={inputId}
          type={shown ? 'text' : 'password'}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            [error ? errorId : null, strengthOf !== undefined ? strengthId : null]
              .filter(Boolean)
              .join(' ') || undefined
          }
          className={cn('pe-12', className)}
        />
        <button
          type="button"
          onClick={() => setShown((v) => !v)}
          aria-label={shown ? t('hidePassword') : t('showPassword')}
          aria-pressed={shown}
          className="absolute end-0 top-0 flex size-11 items-center justify-center rounded-lg text-[var(--text-mute)] transition-colors outline-none hover:text-[var(--text)] focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
        >
          {shown ? (
            <EyeOff className="size-[18px]" aria-hidden />
          ) : (
            <Eye className="size-[18px]" aria-hidden />
          )}
        </button>
      </div>

      {strengthOf !== undefined && (
        <>
          <div className="mt-2 grid grid-cols-4 gap-1.5" aria-hidden>
            {[1, 2, 3, 4].map((step) => (
              <span
                key={step}
                className={cn(
                  'h-1 rounded-full',
                  score >= step ? 'bg-[var(--primary)]' : 'bg-[var(--bg-3)]'
                )}
              />
            ))}
          </div>
          <p
            id={strengthId}
            className="mt-1.5 text-xs text-[var(--text-mute)]"
          >
            {t('strengthLabel', {
              level: t(
                level === 'weak'
                  ? 'strengthWeak'
                  : level === 'good'
                    ? 'strengthGood'
                    : 'strengthStrong'
              ),
            })}
          </p>
        </>
      )}

      {error && (
        <p id={errorId} className="mt-1 text-[13px] text-[var(--color-brand-red-safe)]">
          {error}
        </p>
      )}
    </div>
  )
}
