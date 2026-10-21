'use server'

import { getCloudflareContext } from '@opennextjs/cloudflare'

// Spike (e): invalidate / purge Workers Cache entries by tag from a server
// action, through an RPC method on the cached SpikeProbe entrypoint (research
// F1: ctx.cache is scoped to the calling entrypoint). THROWAWAY: deleted in
// plan 02.1-06. One tag only, no pathPrefixes, no purgeEverything.

const TAG = 'spike-a'

export type SpikeCacheActionState = {
  op: 'invalidate' | 'purge'
  at: string
  refused?: string
  available?: boolean
  result?: unknown
} | null

type SpikeRpcResult = { available: boolean; result: unknown }
type SpikeProbeRpc = {
  invalidate(opts: { tags: string[] }): Promise<SpikeRpcResult>
  purge(opts: { tags: string[] }): Promise<SpikeRpcResult>
}
type SpikeContext = { exports?: { SpikeProbe?: SpikeProbeRpc } }

function spikeOn(env: unknown): boolean {
  if (process.env.CLICKIT_SPIKE === 'on') return true
  return (env as { CLICKIT_SPIKE?: unknown } | undefined)?.CLICKIT_SPIKE === 'on'
}

function cloudflareContext(): { env: unknown; ctx: SpikeContext } | null {
  try {
    return getCloudflareContext<Record<string, unknown>, SpikeContext>()
  } catch {
    return null
  }
}

async function run(op: 'invalidate' | 'purge', formData: FormData): Promise<SpikeCacheActionState> {
  const at = new Date().toISOString()
  const context = cloudflareContext()
  if (!context) return { op, at, refused: 'no Cloudflare context' }
  if (!spikeOn(context.env)) return { op, at, refused: 'CLICKIT_SPIKE is not on' }
  if (formData.get('tag') !== TAG) return { op, at, refused: `only the tag ${TAG}` }
  if (!context.ctx.exports?.SpikeProbe) return { op, at, refused: 'ctx.exports.SpikeProbe unavailable' }
  const reply =
    op === 'invalidate'
      ? await context.ctx.exports.SpikeProbe.invalidate({ tags: [TAG] })
      : await context.ctx.exports.SpikeProbe.purge({ tags: [TAG] })
  return { op, at, available: reply.available, result: reply.result }
}

export async function invalidateSpike(_prev: SpikeCacheActionState, formData: FormData): Promise<SpikeCacheActionState> {
  return run('invalidate', formData)
}

export async function purgeSpike(_prev: SpikeCacheActionState, formData: FormData): Promise<SpikeCacheActionState> {
  return run('purge', formData)
}
