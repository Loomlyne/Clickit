// D-15 / Q6 = A (05-26): when the silent language sync runs. Dependency-free so
// node --test covers it and the client component stays small.

/** The one sessionStorage key: the last locale the server accepted. */
export const LOCALE_SYNC_KEY = 'clickit:locale-last-synced'

/**
 * True when the language in use differs from the last one synced (or none was
 * synced yet in this tab), so en -> ar -> en syncs three times and a reload in
 * the same language syncs zero times.
 */
export function shouldSyncLocale(current: string, lastSynced: string | null): boolean {
  return lastSynced === null || lastSynced !== current
}
