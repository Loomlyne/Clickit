/* Shared fake world for the video finalize core tests (plan 02-16). Test-only. */
import { keyMatchesKind } from '../../../src/server/upload-kinds.ts'
import type { HeroVideoPorts } from '../../../src/lib/admin/hero-video.ts'
import { readMediaReferenceUrls, type ReferenceDb } from '../../../src/server/media-references.ts'
import { stageR2Deletion } from '../../../src/server/r2-delete.ts'
import { createFakeSupabase } from './fake-supabase.ts'

export const MB = 1024 * 1024
export const ORIGIN = 'https://media.test'
export const SHOW_ID = '0b9f2a0e-1111-4222-8333-444455556666'

export const OLD_KEY = 'site-assets/hero/video-1700000000000-aaaaaaaa.mp4'
export const OLD_URL = `${ORIGIN}/${OLD_KEY}`
export const NEW_KEY = 'site-assets/hero/video-1700000009999-bbbbbbbb.mp4'
export const NEW_MOBILE_KEY = 'site-assets/hero/video-mobile-1700000009999-bbbbbbbb.mp4'
export const NEW_PRELOADER_KEY = 'site-assets/preloader/video-1700000009999-bbbbbbbb.mp4'
export const NEW_SHOW_KEY = `site-assets/shows/${SHOW_ID}/hero-desktop-1700000009999-bbbbbbbb.mp4`
export const SUPABASE_URL = 'https://proj.supabase.co/storage/v1/object/public/site-assets/hero/video-1000.mp4'

function box(type: string, payloadLength: number) {
  const bytes = new Uint8Array(8 + payloadLength)
  new DataView(bytes.buffer).setUint32(0, bytes.length)
  bytes.set(new TextEncoder().encode(type), 4)
  return bytes
}
function concat(...parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let offset = 0
  for (const p of parts) {
    out.set(p, offset)
    offset += p.length
  }
  return out
}

/** A tiny synthetic MP4 prefix: ftyp, moov, mdat (fast-start) or ftyp, mdat, moov (not). */
export function mp4Prefix(layout: 'fast' | 'slow' | 'unknown' = 'fast') {
  if (layout === 'fast') return concat(box('ftyp', 12), box('moov', 40), box('mdat', 100))
  if (layout === 'slow') return concat(box('ftyp', 12), box('mdat', 100), box('moov', 40))
  return concat(box('ftyp', 12), box('free', 20))
}

export type WorldOpts = {
  headSize?: number | null
  layout?: 'fast' | 'slow' | 'unknown'
  readNull?: boolean
  audio?: boolean
  deleteFails?: boolean
  commitResult?: boolean
  stageRollbackResult?: boolean
  mediaOrigin?: string | null
  finalizeError?: string
  heroUrl?: string | null
  heroMobileUrl?: string | null
  preloaderUrl?: string | null
  showUrl?: string | null
  showMobileUrl?: string | null
  /** Stage previous-object deletions through the production guarded stageR2Deletion (re-reads every reference at commit). */
  realStage?: boolean
  /** Runs once, right before the first update of app_config or shows: another admin saving first. */
  beforeWrite?: (tables: Record<string, Array<Record<string, unknown>>>) => void
}

export function videoWorld(opts: WorldOpts = {}) {
  const fake = createFakeSupabase({
    app_config: [
      {
        id: 1,
        hero_video_url: opts.heroUrl === undefined ? OLD_URL : opts.heroUrl,
        hero_video_type: (opts.heroUrl === undefined ? OLD_URL : opts.heroUrl) ? 'mp4' : null,
        hero_video_mobile_url: opts.heroMobileUrl ?? null,
        hero_video_mobile_type: opts.heroMobileUrl ? 'mp4' : null,
        hero_video_muted: true,
        preloader_video_url: opts.preloaderUrl === undefined ? null : opts.preloaderUrl,
      },
    ],
    shows: [
      {
        id: SHOW_ID,
        title: 'A show',
        hero_video_url: opts.showUrl === undefined ? null : opts.showUrl,
        hero_video_type: opts.showUrl ? 'mp4' : null,
        hero_video_mobile_url: opts.showMobileUrl ?? null,
        hero_video_mobile_type: opts.showMobileUrl ? 'mp4' : null,
      },
    ],
  })
  const log: string[] = []
  const calls = {
    delete: [] as string[][],
    readHead: [] as Array<[string, number]>,
    finalize: [] as Array<Record<string, unknown>>,
    stage: [] as string[][],
    commit: 0,
    rollback: 0,
  }
  let beforeWrite = opts.beforeWrite
  const db = {
    from: (t: string) => {
      const b = fake.client.from(t)
      if (t === 'app_config' || t === 'shows') {
        const orig = b.update.bind(b)
        b.update = (p: unknown) => {
          log.push('update')
          if (beforeWrite) {
            beforeWrite(fake.tables)
            beforeWrite = undefined
          }
          return orig(p)
        }
      }
      return b
    },
  } as never
  const ports: HeroVideoPorts = {
    db,
    mediaOrigin: opts.mediaOrigin === undefined ? ORIGIN : opts.mediaOrigin,
    finalize: async (input) => {
      log.push('finalize')
      calls.finalize.push(input as unknown as Record<string, unknown>)
      if (opts.finalizeError) return { ok: false, error: opts.finalizeError }
      // Same shape check the Worker uses: a wrong key is refused and nothing is deleted.
      const ok = keyMatchesKind(input.kind, input.key, {
        slot: input.slot,
        showId: input.showId,
        userId: input.userId,
      })
      if (!ok) return { ok: false, error: 'Invalid upload key' }
      return { ok: true, key: input.key }
    },
    head: async () => {
      log.push('head')
      return opts.headSize === null ? null : { size: opts.headSize ?? 10 * MB }
    },
    readHead: async (key, maxBytes) => {
      log.push('readHead')
      calls.readHead.push([key, maxBytes])
      return opts.readNull ? null : mp4Prefix(opts.layout ?? 'fast')
    },
    media: {
      delete: async (keys) => {
        log.push('delete')
        calls.delete.push(keys)
        if (opts.deleteFails) throw new Error('r2 boom')
      },
      stageDeletion: async (keys) => {
        log.push('stage')
        calls.stage.push(keys)
        if (opts.realStage) {
          const staged = stageR2Deletion({ delete: (k) => ports.media.delete(Array.isArray(k) ? k : [k]) }, keys, {
            readReferences: () => readMediaReferenceUrls(fake.client as ReferenceDb),
            mediaOrigin: ORIGIN,
            label: '[video-world]',
          })
          return {
            commit: async () => {
              log.push('commit')
              calls.commit += 1
              return staged.commit()
            },
            rollback: async () => {
              log.push('rollback')
              calls.rollback += 1
              return staged.rollback()
            },
          }
        }
        return {
          commit: async () => {
            log.push('commit')
            calls.commit += 1
            return opts.commitResult ?? true
          },
          rollback: async () => {
            log.push('rollback')
            calls.rollback += 1
            return opts.stageRollbackResult ?? true
          },
        }
      },
    },
    hasAudioTrack: () => opts.audio ?? true,
    // Only urls on the media origin are ours; a Supabase Storage url yields nothing.
    previousR2Keys: (url) => {
      const prefix = `${ORIGIN}/`
      if (!url || !url.startsWith(prefix)) return []
      return [url.slice(prefix.length).split('?')[0]!]
    },
    storagePathFromUrl: (url) => {
      const prefix = `${ORIGIN}/`
      if (url && url.startsWith(prefix)) return url.slice(prefix.length).split('?')[0]!
      return null
    },
  }
  const deps = {
    adminUserId: 'admin-1',
    audit: async (e: Parameters<typeof fake.auditWriter>[0]) => {
      log.push('audit')
      return fake.auditWriter(e)
    },
  }
  return { fake, ports, deps, log, calls }
}

export type VideoWorld = ReturnType<typeof videoWorld>
export const appConfig = (w: VideoWorld) => w.fake.tables.app_config![0]!
export const showRow = (w: VideoWorld) => w.fake.tables.shows![0]!
