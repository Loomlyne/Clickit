// Client side of the updated_at check (deferred item 23, residual b). Several settings forms
// edit the one app_config row. Each form keeps the updated_at its values were loaded with (its
// base). A save that lands proves the row went from `from` to `to` with nothing in between,
// so every form loaded at `from` may now send `to`. Only our own successful saves add a link:
// a page refresh that brings a newer value never moves an already-loaded form forward, because
// its values may predate another admin's save. Pure, no imports: node --test loads it.

/**
 * The version an editor sends for a row whose updated_at is NULL (only shorts.updated_at is
 * nullable). Distinct from a missing version, which every save refuses (PR #29 re-review
 * item 5). Not a timestamptz, so it can never be mistaken for one.
 */
export const NULL_UPDATED_AT = 'updated_at:null'

export type VersionChain = {
  /** The newest updated_at reachable from `base` through our own saves. */
  resolve(base: string): string
  /** Our save that expected `from` landed and produced `to`. */
  link(from: string, to: string): void
}

export function createVersionChain(): VersionChain {
  const next = new Map<string, string>()
  return {
    resolve(base) {
      let v = base
      // updated_at only grows, so links never loop; the cap is a belt and braces guard.
      for (let i = 0; i < 10_000 && next.has(v); i++) v = next.get(v)!
      return v
    },
    link(from, to) {
      if (from && to && from !== to) next.set(from, to)
    },
  }
}

/**
 * One chain per row id, for an editor that lists many rows (legal pages, FAQs, categories,
 * shorts, seasons, episodes; review item 8, PR #29). Rows can share an updated_at (seeded in
 * one statement), so one shared chain would move another row forward by mistake.
 */
export type RowVersionChains = {
  resolve(id: string, base: string): string
  link(id: string, from: string, to: string): void
}

export function createRowVersionChains(): RowVersionChains {
  const chains = new Map<string, VersionChain>()
  const chainFor = (id: string) => {
    let c = chains.get(id)
    if (!c) chains.set(id, (c = createVersionChain()))
    return c
  }
  return {
    resolve: (id, base) => (chains.get(id)?.resolve(base) ?? base),
    link: (id, from, to) => chainFor(id).link(from, to),
  }
}
