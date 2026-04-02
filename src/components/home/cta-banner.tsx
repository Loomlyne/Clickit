import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ScrollReveal } from '@/components/primitives/scroll-reveal'

const BRAND_COLORS = ['#2C3569', '#9F54A0', '#50A258', '#DB3F34', '#EA8C2E', '#F8C623']

export function CtaBanner() {
  return (
    <ScrollReveal>
      <div className="relative bg-black overflow-hidden py-20 md:py-28 px-6 md:px-12">
        {/* Brand color strip at top */}
        <div className="absolute top-0 left-0 right-0 h-1 flex" aria-hidden="true">
          {BRAND_COLORS.map((color) => (
            <div key={color} className="flex-1" style={{ background: color }} />
          ))}
        </div>

        {/* Subtle radial glow */}
        <div
          className="absolute inset-0"
          aria-hidden="true"
          style={{
            background: 'radial-gradient(ellipse 60% 50% at 50% 100%, rgba(44,53,105,0.3), transparent)',
          }}
        />

        <div className="relative text-center max-w-3xl mx-auto">
          <h2
            className="font-display font-bold text-white leading-tight mb-4"
            style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)' }}
          >
            Stream Original Content<br />from the UAE
          </h2>
          <p className="text-white/60 text-lg mb-8 max-w-xl mx-auto">
            15 original programs. Travel, health, music, comedy, cooking, and more — produced from Abu Dhabi.
          </p>
          <Button
            size="lg"
            className="text-white font-semibold px-8 py-3 rounded-xl"
            style={{ background: 'linear-gradient(135deg, #2C3569, #9F54A0)' }}
            asChild
          >
            <Link href="/auth">Start Watching Free</Link>
          </Button>
        </div>

        {/* Brand color strip at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-1 flex" aria-hidden="true">
          {BRAND_COLORS.map((color) => (
            <div key={color} className="flex-1" style={{ background: color }} />
          ))}
        </div>
      </div>
    </ScrollReveal>
  )
}
