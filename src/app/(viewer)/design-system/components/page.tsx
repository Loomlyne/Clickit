'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export default function ComponentsPage() {
  return (
    <div className="space-y-12">
      {/* Section A: Buttons */}
      <section>
        <h2 className="text-xl font-bold text-foreground">Buttons</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Four button variants for different interaction contexts.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <Button variant="default">Watch Now</Button>
          <Button variant="outline">Browse Shows</Button>
          <Button variant="destructive">Delete</Button>
          <Button variant="ghost">Ghost Action</Button>
        </div>
      </section>

      {/* Section B: Button States */}
      <section>
        <h2 className="text-xl font-bold text-foreground">Button States</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Interactive state demonstration per D-11.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <Button>Default</Button>
          <Button>Hover (hover me)</Button>
          <Button>Focus (tab to me)</Button>
          <Button disabled>Disabled</Button>
        </div>
      </section>

      {/* Section C: Status Badges */}
      <section>
        <h2 className="text-xl font-bold text-foreground">Status Badges</h2>
        <p className="mt-1 text-sm text-text-secondary">
          CIT show status indicators with brand colors.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <Badge className="border-0 bg-brand-green text-white">
            Now Streaming
          </Badge>
          <Badge className="border-0 bg-brand-orange text-black">
            Coming Soon
          </Badge>
          <Badge className="border-0 bg-brand-yellow text-black">New</Badge>
        </div>
      </section>

      {/* Section D: Empty State */}
      <section>
        <h2 className="text-xl font-bold text-foreground">Empty State</h2>
        <div className="mt-4 max-w-md rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-lg font-bold text-foreground">No Shows Yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Shows will appear here once content is added. Check back soon for
            new releases.
          </p>
        </div>
      </section>

      {/* Section E: Error State */}
      <section>
        <h2 className="text-xl font-bold text-foreground">Error State</h2>
        <div className="mt-4 max-w-md rounded-lg border border-destructive/30 bg-card p-8 text-center">
          <p className="text-sm text-brand-red-safe">
            Something went wrong. Refresh the page or try again in a moment.
          </p>
        </div>
      </section>
    </div>
  )
}
