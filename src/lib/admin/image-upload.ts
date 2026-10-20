// Image finalize core (plan 02-15): an object already sitting in R2 (uploaded by
// presigned PUT) is verified, written to exactly one database target, audited, and
// only then is the previous R2 object removed. Same ordering as the Phase 01.1 hero
// core: write, strict audit, then commit the deletion; compensation on both failures.
// No next/*, server-only or '@/' imports: node --test loads this file.
import type { AuditWriter, CoreResult } from './ports'

/** The single column or row a finalize may change. Opaque to the core. A social icon has no target: its url lives in form state until the footer is saved. */
export type ImageTarget =
  | { type: 'show-artwork'; showId: string; column: string }
  | { type: 'app-config'; column: string }
  | { type: 'cast'; castId: string; showId: string }
  | { type: 'profile'; userId: string }

/**
 * Every place a re-sent key could already be live (Phase 01.1 review, PR #23). Read
 * before finalize; a key or variant key behind any of these urls is refused and nothing
 * is deleted. Wider than the target on purpose: a commit-false finalize has no target.
 */
export type LiveScope =
  /** The listed artwork columns of one show (a show that does not exist yet has none). */
  | { type: 'show-artwork'; showId: string; columns: readonly string[] }
  /** The listed app_config image columns. */
  | { type: 'app-config'; columns: readonly string[] }
  /** Every cast image of one show. */
  | { type: 'show-cast'; showId: string }
  /** Every icon url in app_config.footer_content.social. */
  | { type: 'social-icons' }
  /** One user's avatar. */
  | { type: 'profile'; userId: string }

export type FinalizeOutcome =
  | { ok: true; key: string; variants: string[]; droppedVariants?: unknown[]; cleanupFailed?: true }
  | { ok: false; error: string; cleanupFailed?: true }

export type ImageUploadPorts = {
  /** Bound to the R2 binding in production: size, key shape and owner, magic bytes, delete on refusal. */
  finalize(input: {
    kind: string
    slot: string | null
    showId: string | null
    userId: string
    key: string
    variantKeys: string[]
    /** Keys live in the scope right now: finalize must refuse them and delete nothing. */
    liveKeys: readonly string[]
  }): Promise<FinalizeOutcome>
  db: {
    /** Urls live in the scope right now; an error means the core refuses and deletes nothing. */
    readLive(scope: LiveScope): Promise<{ urls: Array<string | null>; error: string | null }>
    readCurrent(target: ImageTarget): Promise<{ url: string | null; error: string | null }>
    /** Returns an error message, or null on success. Writes only the target. */
    write(target: ImageTarget, url: string): Promise<string | null>
    restore(target: ImageTarget, previous: string | null): Promise<string | null>
  }
  media: { delete(keys: string[]): Promise<void> }
  /** null for the viewer avatar: there is no admin audit row for a user's own avatar. */
  audit: AuditWriter | null
  /** https verified media origin, or local-preview loopback; null when the media host is not ready. */
  mediaOrigin: string | null
  /** R2 keys (original and derived variants) behind a stored URL; [] for Supabase Storage URLs, null and foreign URLs. */
  previousR2Keys(url: string | null): string[]
  /** Every key a live url may stand for (our origin and the Supabase original's key). Only used to refuse. */
  liveKeys(url: string | null): string[]
}

export type FinalizeImageInput = {
  kind: string
  slot?: string | null
  showId?: string | null
  key: string
  variantKeys: string[]
  /** null: nothing in the database changes yet (cast member or social entry that does not exist); the url is returned. */
  target: ImageTarget | null
  /** Where this key could already be live; must cover the target when there is one. */
  live: LiveScope
  /** Admin id for admin kinds, the caller's own id for the avatar. */
  userId: string
}

export type FinalizeImageResult = CoreResult<string> & {
  mediaCleanupFailed?: boolean
}

export const MEDIA_HOST_NOT_READY = 'Media host is not ready'
export const IMAGE_KEY_IS_LIVE = 'This file is already the live image; upload a new file instead.'
const AUDIT_FAILED = 'Could not write the audit record; the image was not changed.'

async function deleteQuietly(ports: ImageUploadPorts, keys: string[]): Promise<boolean> {
  if (keys.length === 0) return true
  try {
    await ports.media.delete(keys)
    return true
  } catch (err) {
    console.error('[image-upload] R2 cleanup failed', err)
    return false
  }
}

export async function finalizeImageUploadCore(
  ports: ImageUploadPorts,
  input: FinalizeImageInput
): Promise<FinalizeImageResult> {
  // Before anything is touched: a url we cannot serve must never reach the database.
  if (!ports.mediaOrigin) {
    return { success: false, error: MEDIA_HOST_NOT_READY, wrote: false }
  }

  // Phase 01.1 (PR #23 review), as saveVideoCore: never touch the file that is already
  // live. A re-sent live key would otherwise be deleted by a finalize refusal or by a
  // failed write or audit below. Checked before finalize, which deletes what it refuses.
  // Unlike video, a failed read refuses here: without it nothing proves the key is new.
  const live = await ports.db.readLive(input.live)
  if (live.error) return { success: false, error: live.error, wrote: false }
  const liveKeys = [...new Set(live.urls.flatMap((url) => ports.liveKeys(url)))]
  if ([input.key, ...input.variantKeys].some((k) => liveKeys.includes(k))) {
    return { success: false, error: IMAGE_KEY_IS_LIVE, wrote: false }
  }

  const fin = await ports.finalize({
    kind: input.kind,
    slot: input.slot ?? null,
    showId: input.showId ?? null,
    userId: input.userId,
    key: input.key,
    variantKeys: input.variantKeys,
    liveKeys,
  })
  // Finalize already removed what it could prove to be ours; nothing was written.
  if (!fin.ok) {
    const out: FinalizeImageResult = { success: false, error: fin.error, wrote: false }
    if (fin.cleanupFailed) out.mediaCleanupFailed = true
    return out
  }

  const newKeys = [fin.key, ...fin.variants]
  const newUrl = `${ports.mediaOrigin}/${fin.key}`
  const { target } = input

  let previousUrl: string | null = null
  if (target) {
    const current = await ports.db.readCurrent(target)
    if (current.error) {
      await deleteQuietly(ports, newKeys)
      return { success: false, error: current.error, wrote: false }
    }
    previousUrl = current.url

    const writeError = await ports.db.write(target, newUrl)
    if (writeError) {
      const cleaned = await deleteQuietly(ports, newKeys)
      const out: FinalizeImageResult = { success: false, error: writeError, wrote: false }
      if (!cleaned) out.mediaCleanupFailed = true
      return out
    }
  }

  if (ports.audit) {
    const audit = await ports.audit({
      adminUserId: input.userId,
      action: 'upload',
      entity: 'storage',
      diff: {
        kind: input.kind,
        slot: input.slot ?? input.kind,
        key: fin.key,
        variants: fin.variants,
        target,
        previous_url: previousUrl,
      },
    })
    if (audit.error) {
      let error = AUDIT_FAILED
      if (target) {
        const restoreError = await ports.db.restore(target, previousUrl)
        if (restoreError) error += ` Restoring the previous value also failed: ${restoreError}.`
      }
      const cleaned = await deleteQuietly(ports, newKeys)
      const out: FinalizeImageResult = { success: false, error, wrote: target !== null }
      if (!cleaned) out.mediaCleanupFailed = true
      return out
    }
  }

  // Committed. Only now may the previous object go, only if it is one of ours in R2, and
  // only if no other live value in the scope still uses it. The scope read above holds the
  // target's own value once; every other entry is another reference. If the target changed
  // since that read, its old value is not found and every entry counts (keep on doubt).
  const others = [...live.urls]
  const own = others.indexOf(previousUrl)
  if (own >= 0) others.splice(own, 1)
  const stillLive = new Set(others.flatMap((url) => ports.liveKeys(url)))
  const doomed = ports
    .previousR2Keys(previousUrl)
    .filter((k) => !newKeys.includes(k) && !stillLive.has(k))
  const cleaned = await deleteQuietly(ports, doomed)
  const out: FinalizeImageResult = { success: true, data: newUrl, wrote: target !== null }
  if (!cleaned) out.mediaCleanupFailed = true
  return out
}
