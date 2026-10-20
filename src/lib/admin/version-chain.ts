// Client side of the updated_at check (deferred item 23, residual b). Several settings forms
// edit the one app_config row. Each form keeps the updated_at its values were loaded with (its
// base). A save that lands proves the row went from `from` to `to` with nothing in between,
// so every form loaded at `from` may now send `to`. Only our own successful saves add a link:
// a page refresh that brings a newer value never moves an already-loaded form forward, because
// its values may predate another admin's save. Pure, no imports: node --test loads it.

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
