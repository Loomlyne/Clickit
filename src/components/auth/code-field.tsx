'use client'

import { useEffect, useId, useRef, useState } from 'react'

import { Label } from '@/components/ui/label'
import { CODE_LENGTH, normalizeCode } from '@/lib/auth-code'
import { cn } from '@/lib/utils'

const DIGIT_GLYPH = /[0-9٠-٩۰-۹]/

type CodeFieldProps = {
  label: string
  /** Normalised value (0-9 only, at most six digits). The parent owns it. */
  value: string
  onChange: (value: string) => void
  /** Fires once per distinct six-digit value. */
  onComplete?: (value: string) => void
  /**
   * Translated error text. When it changes to a value the field clears itself
   * (calls onChange('')) and takes focus back. The parent must clear the
   * error only when the user types again, not on that clearing call.
   */
  error?: string
  /** Optional helper line under the cells (id is part of aria-describedby). */
  helper?: React.ReactNode
  disabled?: boolean
  autoFocus?: boolean
  id?: string
}

/**
 * One real input over six presentation cells (UI-SPEC 5.2). The input is the
 * only focusable element, so paste, iOS/Android one-time-code autofill and
 * Arabic-Indic digits arrive whole. The cells show the digits as typed; the
 * parent only ever receives the normalised 0-9 string.
 */
export function CodeField({
  label,
  value,
  onChange,
  onComplete,
  error,
  helper,
  disabled,
  autoFocus,
  id,
}: CodeFieldProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const helperId = `${inputId}-help`
  const errorId = `${inputId}-error`

  const inputRef = useRef<HTMLInputElement>(null)
  const lastCompleted = useRef<string | null>(null)
  const previousError = useRef<string | undefined>(undefined)
  const onChangeRef = useRef(onChange)
  const [raw, setRaw] = useState(value)
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    onChangeRef.current = onChange
  })

  // Display the digits as typed, but only while they still stand for the
  // parent's value. If the parent clears or replaces it, show its value.
  const display = normalizeCode(raw) === value ? raw : value
  const digits = Array.from(display)
    .filter((ch) => DIGIT_GLYPH.test(ch))
    .slice(0, CODE_LENGTH)
  const activeIndex = Math.min(digits.length, CODE_LENGTH - 1)

  useEffect(() => {
    if (error && error !== previousError.current) {
      lastCompleted.current = null
      onChangeRef.current('')
      inputRef.current?.focus()
    }
    previousError.current = error
  }, [error])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Keep only the digit glyphs as typed (drops spaces, hyphens, bidi marks).
    const typed = Array.from(e.target.value)
      .filter((ch) => DIGIT_GLYPH.test(ch))
      .slice(0, CODE_LENGTH)
      .join('')
    const next = normalizeCode(typed)
    setRaw(typed)
    onChange(next)
    if (next.length < CODE_LENGTH) {
      lastCompleted.current = null
    } else if (next !== lastCompleted.current) {
      lastCompleted.current = next
      onComplete?.(next)
    }
  }

  function keepCaretAtEnd(el: HTMLInputElement) {
    const end = el.value.length
    if (el.selectionStart !== end || el.selectionEnd !== end) {
      el.setSelectionRange(end, end)
    }
  }

  const describedBy =
    [helper ? helperId : null, error ? errorId : null]
      .filter(Boolean)
      .join(' ') || undefined

  return (
    <div>
      <Label htmlFor={inputId} className="text-sm leading-normal font-normal">
        {label}
      </Label>
      <div dir="ltr" className="relative mt-2">
        <div className="grid grid-cols-6 gap-2" aria-hidden>
          {Array.from({ length: CODE_LENGTH }, (_, i) => {
            const isActive = focused && !disabled && i === activeIndex
            return (
              <div
                key={i}
                className={cn(
                  'flex h-11 items-center justify-center rounded-field border bg-[var(--bg-2)] text-[24px] font-bold text-[var(--text)]',
                  error
                    ? 'border-[var(--color-brand-red-safe)]'
                    : isActive
                      ? 'border-2 border-[var(--primary)]'
                      : 'border-[var(--line-2)]',
                  disabled && 'opacity-60'
                )}
              >
                {digits[i] ??
                  (isActive ? (
                    <span className="code-caret h-6 border-s-2 border-[var(--primary)]" />
                  ) : null)}
              </div>
            )
          })}
        </div>
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          dir="ltr"
          value={display}
          onChange={handleChange}
          onFocus={(e) => {
            setFocused(true)
            keepCaretAtEnd(e.currentTarget)
          }}
          onBlur={() => setFocused(false)}
          onSelect={(e) => keepCaretAtEnd(e.currentTarget)}
          disabled={disabled}
          autoFocus={autoFocus}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9٠-٩۰-۹]*"
          spellCheck={false}
          enterKeyHint="go"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="absolute inset-0 h-11 w-full bg-transparent text-[24px] text-transparent caret-transparent outline-none selection:bg-transparent"
        />
      </div>
      {helper && (
        <p id={helperId} className="mt-2 text-sm text-[var(--text-dim)]">
          {helper}
        </p>
      )}
      {error && (
        <p
          id={errorId}
          role="alert"
          className="mt-2 text-sm text-[var(--color-brand-red-safe)]"
        >
          {error}
        </p>
      )}
    </div>
  )
}
