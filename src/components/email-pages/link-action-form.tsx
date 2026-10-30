'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'

import { AuthCardPage } from '@/components/auth/auth-card-page'
import { AuthAlert } from '@/components/auth/auth-alert'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'

export type LinkPanel = {
  icon: React.ReactNode
  title: string
  body?: string
  cta?: { label: string; href: string }
}

/**
 * The one-button state machine behind /unsubscribe and /newsletter/confirm
 * (UI-SPEC 6.10, 6.11). The server page decides the first panel (idle, done,
 * expired, invalid). While idle, pressing the button runs the server action with
 * the token; the action answers with an outcome key that selects a panel from
 * `outcomes`. An unknown answer or a thrown action shows the error alert and the
 * button stays enabled.
 */
export function LinkActionForm({
  token,
  action,
  idle,
  initial,
  outcomes,
  errorText,
}: {
  token: string
  action: (token: string) => Promise<string>
  /** The button panel. Omit when the page opens straight on an outcome. */
  idle?: LinkPanel & {
    button: string
    pending: string
    secondary?: { label: string; href: string }
  }
  /** Outcome key to open on (done, expired, invalid...); omit to open on `idle`. */
  initial?: string
  outcomes: Record<string, LinkPanel>
  errorText: string
}) {
  const [outcome, setOutcome] = useState<string | null>(initial ?? null)
  const [failed, setFailed] = useState(false)
  const [pending, startTransition] = useTransition()
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    buttonRef.current?.focus()
  }, [])

  function run() {
    setFailed(false)
    startTransition(async () => {
      try {
        const next = await action(token)
        if (next in outcomes) setOutcome(next)
        else setFailed(true)
      } catch {
        setFailed(true)
      }
    })
  }

  const done = outcome ? outcomes[outcome] : null
  if (done) {
    return (
      <AuthCardPage icon={done.icon} title={done.title} subline={done.body}>
        {done.cta && (
          <Button asChild size="lg" className="w-full">
            <Link href={done.cta.href}>{done.cta.label}</Link>
          </Button>
        )}
      </AuthCardPage>
    )
  }

  if (!idle) return null

  return (
    <AuthCardPage icon={idle.icon} title={idle.title} subline={idle.body}>
      <div className="flex flex-col gap-3">
        {failed && <AuthAlert variant="error">{errorText}</AuthAlert>}
        <Button
          ref={buttonRef}
          type="button"
          size="lg"
          className="w-full"
          disabled={pending}
          aria-busy={pending}
          onClick={run}
        >
          {pending && <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />}
          {pending ? idle.pending : idle.button}
        </Button>
        {idle.secondary && (
          <Button asChild variant="link" size="lg" className="w-full">
            <Link href={idle.secondary.href}>{idle.secondary.label}</Link>
          </Button>
        )}
      </div>
    </AuthCardPage>
  )
}
