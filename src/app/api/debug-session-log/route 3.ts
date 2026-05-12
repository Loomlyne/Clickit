import { NextResponse } from 'next/server'

import { writeDebugSessionNdjson } from '@/lib/debug/log-session'

export async function POST(req: Request) {
  if (process.env.VERCEL === '1' && process.env.VERCEL_ENV === 'production') {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  try {
    const payload = (await req.json()) as Record<string, unknown>
    await writeDebugSessionNdjson(payload)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
}

/** Quick check that file writes work: open `/api/debug-session-log` in the browser. */
export async function GET() {
  if (process.env.VERCEL === '1' && process.env.VERCEL_ENV === 'production') {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  await writeDebugSessionNdjson({
    sessionId: 'c080c4',
    hypothesisId: 'H0',
    location: 'api/debug-session-log/route.ts:GET',
    message: 'ping',
    data: {},
    runId: 'ping',
  })
  return NextResponse.json({ ok: true, wrote: true })
}
