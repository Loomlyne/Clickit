import { pushDebugIngestPayload } from '@/lib/debug/debug-ingest-buffer'
import { writeSessionDebugLine } from '@/lib/debug/write-session-debug-line'

export function isDebugIngestConfigured() {
  return (
    process.env.NODE_ENV !== 'production' ||
    process.env.CIT_DEBUG_INGEST === '1'
  )
}

/** Appends one NDJSON line (same paths as /api/debug-ingest) without browser fetch. */
export async function agentDebugServerLog(
  payload: Record<string, unknown> & {
    hypothesisId: string
    location: string
    message: string
    data?: unknown
  }
) {
  if (!isDebugIngestConfigured()) return
  try {
    const data =
      typeof payload.data === 'object' && payload.data !== null && !Array.isArray(payload.data)
        ? { ...payload.data, _nodeEnv: process.env.NODE_ENV }
        : { value: payload.data, _nodeEnv: process.env.NODE_ENV }

    const line = JSON.stringify({
      sessionId: 'c080c4',
      ...payload,
      data,
      timestamp: Date.now(),
    })
    pushDebugIngestPayload(line)
    await writeSessionDebugLine(line)
  } catch {
    /* ignore */
  }
}
