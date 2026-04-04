'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'

export function NavbarSearch() {
  const router = useRouter()
  const [query, setQuery] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = query.trim()
    if (trimmed.length > 0) {
      router.push(`/search?q=${encodeURIComponent(trimmed)}`)
    } else {
      router.push('/search')
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setQuery('')
      e.currentTarget.blur()
    }
  }

  return (
    <>
      {/* Desktop: full input */}
      <div className="hidden sm:block">
        <form onSubmit={handleSubmit} className="relative">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45"
            aria-hidden="true"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search shows and episodes..."
            className="h-10 w-[240px] rounded-full bg-white/[0.06] border border-white/[0.08] pl-10 pr-4 text-sm text-white placeholder:text-white/35 transition-colors focus:bg-white/[0.09] focus:border-white/[0.14] focus:outline-none xl:w-[320px]"
            style={{ boxShadow: 'none' }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow =
                '0 0 0 1px rgba(91,127,255,.25)'
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = 'none'
            }}
          />
        </form>
      </div>

      {/* Mobile: icon-only button */}
      <button
        className="p-2 text-white/60 transition-colors hover:text-white sm:hidden"
        onClick={() => router.push('/search')}
        aria-label="Search"
      >
        <Search className="h-5 w-5" />
      </button>
    </>
  )
}
