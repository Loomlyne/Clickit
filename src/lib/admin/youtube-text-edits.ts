// "Refresh unless edited" (PR #27 review item 7, Koss 2026-10-20). The daily
// check refreshes YouTube-sourced text but skips any field an admin changed on
// Clickit; each such field has a <field>_edited flag. This module holds the
// one routing of YouTube text the check and the admin saves share, and the
// rules the saves use to set the flags. The check itself never decides a
// flag: record_youtube_checks / record_short_checks read them in SQL.
//
// Flags only ever turn true here (once edited stays edited).
// Framework-free and alias-free so node --test loads it directly.
import { routeYouTubeText } from '../../server/youtube/script.ts'
import type { YouTubeMeta } from './youtube-verify'

/** Episode text columns the check refreshes; thumbnails are built from the video id. */
export const EPISODE_TEXT_FIELDS = ['title', 'title_ar', 'description', 'description_ar'] as const
/**
 * Short fields an admin can type in the shorts form. thumbnail_url is not
 * here: the form has no thumbnail field, so the check always refreshes it.
 */
export const SHORT_TEXT_FIELDS = ['title', 'channel_name'] as const

export type EpisodeTextField = (typeof EPISODE_TEXT_FIELDS)[number]
export type ShortTextField = (typeof SHORT_TEXT_FIELDS)[number]
export type EditedFlag<F extends string> = `${F}_edited`
export type TextValues<F extends string> = Record<F, string | null>

/** Imported rows hold YouTube's own text: nothing is edited yet. */
export const UNEDITED_EPISODE_TEXT: Readonly<Record<EditedFlag<EpisodeTextField>, false>> = {
  title_edited: false,
  title_ar_edited: false,
  description_edited: false,
  description_ar_edited: false,
}

/** Trimmed text, or null when empty or not a string. */
export function normText(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t === '' ? null : t
}

/**
 * YouTube's text for an episode, routed by script exactly as the import does
 * (routeYouTubeText, D-04): Arabic-dominant text goes to the *_ar field and the
 * Arabic title is mirrored into the required `title`. Empty values are null.
 */
export function episodeTextFromYouTube(meta: Pick<YouTubeMeta, 'title' | 'description'>): TextValues<EpisodeTextField> {
  const r = routeYouTubeText({ title: meta.title, description: meta.description })
  return {
    title: normText(r.title),
    title_ar: normText(r.title_ar),
    description: normText(r.description),
    description_ar: normText(r.description_ar),
  }
}

/** YouTube's text for a short: what the shorts form's Fetch fills in. */
export function shortTextFromYouTube(
  meta: Pick<YouTubeMeta, 'title' | 'channelTitle' | 'thumbnailUrl'>
): TextValues<ShortTextField> & { thumbnail_url: string | null } {
  const thumb = normText(meta.thumbnailUrl)
  return {
    title: normText(meta.title),
    channel_name: normText(meta.channelTitle),
    thumbnail_url: thumb && thumb.startsWith('https://') ? thumb : null,
  }
}

const flagOf = <F extends string>(f: F) => `${f}_edited` as EditedFlag<F>

/**
 * Flags for a new row. With YouTube's text: a field is edited when the saved
 * value differs from it (trimmed, empty = none). Without it (no video, or no
 * server check): every non-empty field is edited, so the check never
 * replaces text an admin typed.
 */
export function flagsOnCreate<F extends string>(
  fields: readonly F[],
  saved: Partial<Record<F, unknown>>,
  youtube: Partial<TextValues<F>> | null
): Record<EditedFlag<F>, boolean> {
  const out = {} as Record<EditedFlag<F>, boolean>
  for (const f of fields) {
    const value = normText(saved[f])
    out[flagOf(f)] = youtube ? value !== (youtube[f] ?? null) : value !== null
  }
  return out
}

/**
 * Flags that turn true on an update; unchanged flags are left out of the
 * patch. Only fields present in the patch count. A field is edited when its
 * new value differs from the stored one, unless the update links a new video
 * the server verified and the value equals that video's routed text (a Fetch
 * from YouTube is not an edit). A stored flag is never cleared.
 */
export function flagsOnUpdate<F extends string>(
  fields: readonly F[],
  patch: Partial<Record<F, unknown>>,
  stored: Partial<Record<F | EditedFlag<F>, unknown>>,
  youtube: Partial<TextValues<F>> | null
): Partial<Record<EditedFlag<F>, true>> {
  const out: Partial<Record<EditedFlag<F>, true>> = {}
  for (const f of fields) {
    if (!(f in patch)) continue
    if (stored[flagOf(f)] === true) continue
    const value = normText(patch[f])
    if (value === normText(stored[f])) continue
    if (youtube && value === (youtube[f] ?? null)) continue
    out[flagOf(f)] = true
  }
  return out
}
