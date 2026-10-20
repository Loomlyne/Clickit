// Pure validation for admin server actions. Imports only zod and the pure YouTube id regexes so node --test can load it.
import { z } from 'zod'
import { PLAYLIST_ID_RE, VIDEO_ID_RE } from '../../server/youtube/urls.ts'

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string }

export const idSchema = z.uuid()
export function parseId(value: unknown, label: string): ParseResult<string> {
  const r = idSchema.safeParse(value)
  return r.success ? { ok: true, value: r.data } : { ok: false, error: `Invalid ${label} id.` }
}

export const directionSchema = z.enum(['up', 'down'])
export function parseDirection(value: unknown): ParseResult<'up' | 'down'> {
  const r = directionSchema.safeParse(value)
  return r.success ? { ok: true, value: r.data } : { ok: false, error: 'Invalid direction.' }
}

export const heroVariantSchema = z.enum(['desktop', 'mobile'])
export type HeroVariant = z.infer<typeof heroVariantSchema>
export function parseHeroVariant(value: unknown): ParseResult<HeroVariant> {
  if (value === undefined) return { ok: true, value: 'desktop' }
  const r = heroVariantSchema.safeParse(value)
  return r.success ? { ok: true, value: r.data } : { ok: false, error: 'Invalid hero variant.' }
}

export const episodeFixSchema = z.strictObject({
  episodeId: z.uuid(),
  newEpisodeNumber: z.number().int().positive().max(100000),
})
export const episodeFixesSchema = z
  .array(episodeFixSchema)
  .max(500)
  .refine((fixes) => new Set(fixes.map((f) => f.episodeId)).size === fixes.length, {
    message: 'Each episode can be renumbered only once.',
  })

export const restoreRenameSchema = z.strictObject({
  title: z.string().trim().min(1).max(200).optional(),
  slug: z.string().trim().min(1).max(60).optional(),
  episodeFixes: episodeFixesSchema.optional(),
})

export const seasonSchema = z.object({
  show_id: z.uuid(),
  title: z.string().min(1, 'Title is required'),
  title_ar: z.string().optional().nullable(),
  season_number: z.number().int().positive(),
})

export const episodeSchema = z.object({
  show_id: z.uuid(),
  season_id: z.uuid(),
  title: z.string().min(1, 'Title is required'),
  title_ar: z.string().optional().nullable(),
  description: z.string().min(1, 'Description is required'),
  description_ar: z.string().optional().nullable(),
  episode_number: z.number().int().positive(),
  youtube_video_id: z.string().optional().nullable(),
  duration: z.number().int().positive().optional().nullable(),
  status: z.enum(['draft', 'coming-soon', 'published']),
  // Scheduled publish time (UTC ISO). Only meaningful for coming-soon episodes.
  publish_at: z.string().datetime({ offset: true }).optional().nullable(),
})

// Strict partials: unknown columns (archived, id, counters) are rejected.
// show_id / season_id stay allowed because the admin UI sends them.
export const seasonUpdateSchema = seasonSchema.partial().strict()
export const episodeUpdateSchema = episodeSchema.partial().strict()

export const categoryOrderSchema = z
  .array(z.uuid())
  .min(1)
  .max(500)
  .refine((ids) => new Set(ids).size === ids.length, { message: 'Duplicate category ids.' })

// ---------------------------------------------------------------------------
// YouTube import (Phase 6, RESEARCH Pattern 1 bounds)
// ---------------------------------------------------------------------------

export const videoIdSchema = z.string().regex(VIDEO_ID_RE, 'Invalid YouTube video id.')
export const playlistIdSchema = z.string().regex(PLAYLIST_ID_RE, 'Invalid YouTube playlist id.')

/** One preview page. Page 0..3 caps the preview at 200 items (4 pages of 50). */
export const previewPageSchema = z.strictObject({
  showId: z.uuid(),
  url: z.string().max(2048).optional(),
  playlistId: playlistIdSchema.optional(),
  pageToken: z.string().max(200).optional(),
  page: z.number().int().min(0).max(3),
})

/** Commit takes ids only; titles and statuses are re-fetched on the server. */
export const commitImportSchema = z.strictObject({
  showId: z.uuid(),
  playlistId: playlistIdSchema,
  videoIds: z
    .array(videoIdSchema)
    .min(1)
    .max(200)
    .refine((ids) => new Set(ids).size === ids.length, { message: 'Duplicate video ids.' }),
  target: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('new'), seasonTitle: z.string().trim().min(1).max(120) }),
    z.strictObject({ kind: z.literal('existing'), seasonId: z.uuid() }),
  ]),
})

export function formatZodError(error: z.ZodError): string {
  const issue = error.issues[0]
  if (!issue) return 'Invalid input.'
  const path = issue.path.join('.')
  return path ? `${path}: ${issue.message}` : issue.message
}
