import type { Metadata } from 'next'
import Link from 'next/link'

// Spike (a): a static route with a nested child, so real RSC, prefetch and
// segment payloads exist for the byte diff (plan 02.1-01, deleted in 02.1-06).
export const dynamic = 'force-static'
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default function SpikeProbeA() {
  return (
    <main>
      <h1>spike probe a</h1>
      <p>static probe page</p>
      <ul>
        <li>segment a</li>
        <li>force-static</li>
      </ul>
      <Link href="/spike-probe/a/b">to b</Link>
    </main>
  )
}
