// Database side of the admin image finalize (plan 02-15): read and write exactly one
// column or row per target. No next/*, server-only or '@/' imports: node --test loads
// this file, and the tests record every write against the fake Supabase.
import type { AdminDb } from './ports'
import type { ImageTarget, ImageUploadPorts } from './image-upload'

export async function writeAdminImageTarget(
  db: AdminDb,
  target: ImageTarget,
  url: string | null
): Promise<string | null> {
  if (target.type === 'show-artwork') {
    const { error } = await db
      .from('shows')
      .update({ [target.column]: url } as never)
      .eq('id', target.showId)
    return error ? error.message : null
  }
  if (target.type === 'app-config') {
    const { error } = await db
      .from('app_config')
      .update({ [target.column]: url } as never)
      .eq('id', 1)
    return error ? error.message : null
  }
  if (target.type === 'cast') {
    const { error } = await db
      .from('show_cast')
      .update({ image_url: url })
      .eq('id', target.castId)
      .eq('show_id', target.showId)
    return error ? error.message : null
  }
  return 'Unsupported image target'
}

/** Finalize core db port for the admin kinds (shows, app_config, show_cast). */
export function adminImageDb(db: AdminDb): ImageUploadPorts['db'] {
  return {
    async readCurrent(target) {
      if (target.type === 'show-artwork') {
        const { data, error } = await db
          .from('shows')
          .select(target.column)
          .eq('id', target.showId)
          .single()
        if (error || !data) return { url: null, error: error?.message ?? 'Show not found' }
        return {
          url: (data as unknown as Record<string, string | null>)[target.column] ?? null,
          error: null,
        }
      }
      if (target.type === 'app-config') {
        const { data, error } = await db
          .from('app_config')
          .select(target.column)
          .eq('id', 1)
          .single()
        if (error || !data) return { url: null, error: error?.message ?? 'Could not load site config' }
        return {
          url: (data as unknown as Record<string, string | null>)[target.column] ?? null,
          error: null,
        }
      }
      if (target.type === 'cast') {
        const { data, error } = await db
          .from('show_cast')
          .select('image_url')
          .eq('id', target.castId)
          .eq('show_id', target.showId)
          .single()
        if (error || !data) return { url: null, error: error?.message ?? 'Cast member not found' }
        return { url: data.image_url ?? null, error: null }
      }
      return { url: null, error: 'Unsupported image target' }
    },
    write: (target, url) => writeAdminImageTarget(db, target, url),
    restore: (target, previous) => writeAdminImageTarget(db, target, previous),
  }
}
