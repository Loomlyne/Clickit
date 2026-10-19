// Type-only module: shared ports and result types for admin cores.
// Only extensionless `import type` lines are allowed here (erased by strip-types).
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../database.types'
import type { AuditArgs } from '../audit'

export type AdminDb = SupabaseClient<Database>

export type AuditWriter = (entry: AuditArgs) => Promise<{ error: string | null }>

export type ActionResult<T = unknown> = {
  success: boolean
  error?: string
  data?: T
}

/** `wrote` is true when at least one write step ran, so the wrapper must revalidate even on failure. */
export type CoreResult<T = unknown> = ActionResult<T> & { wrote?: boolean }

export type EpisodeConflict = {
  episodeId: string
  episodeTitle: string
  episodeNumber: number
  seasonId: string
  seasonNumber: number
  conflictingEpisodeTitle: string
}

export type ShowRestoreConflict = {
  title: string
  slug: string
  titleConflictTitle?: string
  slugConflictTitle?: string
}

export type RestoreResult = ActionResult & {
  conflicts?: EpisodeConflict[]
  showConflict?: ShowRestoreConflict
}

export type ArabicFill = (
  en: string | null | undefined,
  ar: string | null | undefined
) => Promise<string | null>
