'use client'

// Carries a row's updated_at from the page that loaded a form back to the server with every
// save (deferred item 23, residual b). No UI. A form keeps the updated_at its values were
// loaded with; our own successful saves link old -> new in a shared chain, so a second save
// from the same page (another section of the one app_config row, or the same drawer) sends the
// value our first save produced instead of falsely conflicting. A refreshed page prop never
// moves an already-loaded form forward: its values may predate another admin's save.
import { createContext, useContext, useState, type ReactNode } from 'react'
import {
  createRowVersionChains,
  createVersionChain,
  type VersionChain,
} from '@/lib/admin/version-chain'

type Shared = { chain: VersionChain; updatedAt: string }

const RowVersionContext = createContext<Shared | null>(null)

export type RowVersion = {
  /** The updated_at to send with the next save. */
  expected(): string
  /** Record a save that expected `from` and returned `next` (no-op when it returned none). */
  saved(from: string, next: string | null | undefined): void
}

function handle(chain: VersionChain, base: string): RowVersion {
  return {
    expected: () => chain.resolve(base),
    saved: (from, next) => {
      if (next) chain.link(from, next)
    },
  }
}

/** One chain for every form on a page that edits the same row (the settings tabs). */
export function RowVersionProvider({
  updatedAt,
  children,
}: {
  updatedAt: string
  children: ReactNode
}) {
  const [chain] = useState(createVersionChain)
  return (
    <RowVersionContext.Provider value={{ chain, updatedAt }}>
      {children}
    </RowVersionContext.Provider>
  )
}

/** For a form inside RowVersionProvider: its base is the page's updated_at when it mounted. */
export function useSharedRowVersion(): RowVersion {
  const shared = useContext(RowVersionContext)
  const [base] = useState(() => shared?.updatedAt ?? '')
  if (!shared)
    throw new Error(
      'useSharedRowVersion must be used inside RowVersionProvider'
    )
  return handle(shared.chain, base)
}

/** For a form that is alone on its page (the show drawer, the inbox recipient). */
export function useRowVersion(updatedAt: string): RowVersion {
  const [chain] = useState(createVersionChain)
  const [base] = useState(updatedAt)
  return handle(chain, base)
}

export type RowVersions = {
  /** The updated_at to send for row `id`, whose editor opened with `base`. */
  expected(id: string, base: string): string
  /** Record a save of row `id` that expected `from` and returned `next`. */
  saved(id: string, from: string, next: string | null | undefined): void
}

/** For a list editor: one chain per row id (legal pages, FAQs, categories, shorts, seasons, episodes). */
export function useRowVersions(): RowVersions {
  const [chains] = useState(createRowVersionChains)
  return {
    expected: (id, base) => chains.resolve(id, base),
    saved: (id, from, next) => {
      if (next) chains.link(id, from, next)
    },
  }
}
