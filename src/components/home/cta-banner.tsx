import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function CtaBanner() {
  return (
    <section className="px-6 md:px-12">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-blue/20 via-surface-2 to-brand-purple/20 p-8 md:p-12">
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="max-w-lg">
            <h2 className="text-3xl font-bold text-foreground">Start Watching for Free</h2>
            <p className="mt-3 text-base text-muted-foreground">
              Stream original shows from the UAE. No credit card required.
            </p>
            <Button variant="default" size="lg" className="mt-6 px-8" asChild>
              <Link href="/auth">Get Started</Link>
            </Button>
          </div>
          <div className="hidden grid-cols-3 gap-2 md:grid" aria-hidden="true">
            {['bg-brand-blue', 'bg-brand-purple', 'bg-brand-green', 'bg-brand-red', 'bg-brand-orange', 'bg-brand-yellow'].map((c) => (
              <div key={c} className={`h-16 w-16 rounded-md ${c} opacity-40`} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
