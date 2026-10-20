// Active show title/slug conflict lookup, moved out of actions.ts.
import type { AdminDb, ShowRestoreConflict } from './ports'

export function normalizeEnglishTitle(title: string) {
  return title.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function archiveSlugForShow(id: string) {
  return `archived-${id.slice(0, 8)}`
}

async function findActiveTitleConflict(
  admin: AdminDb,
  title: string,
  excludeId?: string
) {
  const normalized = normalizeEnglishTitle(title)
  const { data, error } = await admin
    .from('shows')
    .select('id, title, slug')
    .eq('archived', false)

  if (error) throw error

  return (data ?? []).find((show) => {
    return (
      show.id !== excludeId && normalizeEnglishTitle(show.title) === normalized
    )
  })
}

async function findActiveSlugConflict(
  admin: AdminDb,
  slug: string,
  excludeId?: string
) {
  const { data, error } = await admin
    .from('shows')
    .select('id, title, slug')
    .eq('archived', false)
    .eq('slug', slug)

  if (error) throw error

  return (data ?? []).find((show) => show.id !== excludeId)
}

export async function getActiveShowNamespaceConflict(
  admin: AdminDb,
  input: { title: string; slug: string; excludeId?: string }
): Promise<ShowRestoreConflict | null> {
  const [titleConflict, slugConflict] = await Promise.all([
    findActiveTitleConflict(admin, input.title, input.excludeId),
    findActiveSlugConflict(admin, input.slug, input.excludeId),
  ])

  if (!titleConflict && !slugConflict) return null

  return {
    title: input.title,
    slug: input.slug,
    titleConflictTitle: titleConflict?.title,
    slugConflictTitle: slugConflict?.title,
  }
}
