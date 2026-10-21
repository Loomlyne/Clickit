import type { Metadata } from 'next'
import { SpikePurgeForm } from './purge-form'

// Spike (e): invalidate and purge the tag spike-a from a server action
// (plan 02.1-01, deleted in 02.1-06). Rendered per request: the action
// result is shown by the client form below.
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default function SpikeProbePurge() {
  return (
    <main>
      <h1>spike probe purge</h1>
      <SpikePurgeForm />
    </main>
  )
}
