import Link from 'next/link'
import Image from 'next/image'
import { Search, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AuthSection } from './auth-section'
import { NavLinks } from './nav-links'

export function Navbar() {
  return (
    <nav
      aria-label="Main navigation"
      className="fixed top-0 right-0 left-0 z-50 flex h-16 items-center justify-between border-b border-white/[0.06] bg-[rgba(10,10,15,0.75)] px-6 backdrop-blur-lg backdrop-saturate-[1.2] md:px-12"
      style={{ WebkitBackdropFilter: 'blur(16px) saturate(1.2)' }}
    >
      <Link href="/" aria-label="Clickit Story home">
        <Image
          src="/brand/Clickit_final_logo.svg"
          alt="Clickit Story"
          width={120}
          height={32}
          priority
          className="h-8 w-auto"
        />
      </Link>
      <NavLinks />
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" aria-label="Search" className="text-muted-foreground hover:text-foreground">
          <Search className="size-5" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="text-muted-foreground hover:text-foreground">
          <Bell className="size-5" />
        </Button>
      </div>
      <AuthSection />
    </nav>
  )
}
