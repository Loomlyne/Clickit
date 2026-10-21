import type { Metadata } from 'next'
import Link from 'next/link'

// Spike (a): nested static segment under /spike-probe/a (plan 02.1-01, deleted in 02.1-06).
export const dynamic = 'force-static'
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default function SpikeProbeAB() {
  return (
    <main>
      <h1>spike probe a/b</h1>
      <p>nested static probe page</p>
      <ul>
        <li>segment a</li>
        <li>segment b</li>
      </ul>
      <Link href="/spike-probe/a">to a</Link>
    </main>
  )
}
