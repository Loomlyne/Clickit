import { NextResponse } from 'next/server'

import {
  getRecentDebugIngestPayloads,
  pushDebugIngestPayload,
} from '@/lib/debug/debug-ingest-buffer'
import { isDebugIngestConfigured } from '@/lib/debug/server-agent-log'
import { writeSessionDebugLine } from '@/lib/debug/write-session-debug-line'

/**
 * NDJSON sink for debug mode (browser → filesystem + in-memory ring buffer).
 *
 * - Default: enabled when NODE_ENV !== 'production' (e.g. next dev).
 * - Override: set CIT_DEBUG_INGEST=1 (e.g. next start locally).
 *
 * GET (same guard): returns recent payloads from this dev server's memory — use when
 * workspace log files are missing (serverless FS, etc.).
 */

export async function GET() {
  if (!isDebugIngestConfigured()) {
    return new NextResponse(null, { status: 404 })
  }
  const lines = getRecentDebugIngestPayloads()
  return NextResponse.json({
    sessionId: 'c080c4',
    count: lines.length,
    lines: lines.map((raw) => {
      try {
        return JSON.parse(raw) as unknown
      } catch {
        return raw
      }
    }),
  })
}

export async function POST(req: Request) {
  if (!isDebugIngestConfigured()) {
    return new NextResponse(null, { status: 404 })
  }
  try {
    const text = await req.text()
    if (!text) return NextResponse.json({ ok: false }, { status: 400 })
    const trimmed = text.trim()
    pushDebugIngestPayload(trimmed)
    await writeSessionDebugLine(trimmed)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
