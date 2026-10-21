import type { Metadata } from 'next'

// Spike (d): ISR through the DO queue. The stamp is taken at render time, so
// it advances only when a revalidation re-renders the page (plan 02.1-01,
// deleted in 02.1-06).
export const revalidate = 60
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default function SpikeProbeIsr() {
  const renderedAt = new Date().toISOString()
  return (
    <main>
      <h1>spike probe isr</h1>
      <p>
        rendered at <time id="spike-render-stamp">{renderedAt}</time>
      </p>
    </main>
  )
}
