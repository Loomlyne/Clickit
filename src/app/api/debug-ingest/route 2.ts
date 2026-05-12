import { NextResponse } from 'next/server'
import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * Local NDJSON sink (disabled on Vercel — no durable cwd).
 * Writes to multiple paths so tooling and permissions are less likely to hide evidence.
 */
export async function GET() {
  if (process.env.VERCEL) {
    return NextResponse.json({ ok: false }, { status: 404 })
  }
  const cwd = process.cwd()
  return NextResponse.json({
    ok: true,
    cwd,
    nodeEnv: process.env.NODE_ENV,
    vercel: Boolean(process.env.VERCEL),
  })
}

export async function POST(req: Request) {
  if (process.env.VERCEL) {
    return NextResponse.json({ ok: false }, { status: 404 })
  }
  try {
    const text = await req.text()
    const line = text.trim()
    if (!line) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }
    const payload = JSON.parse(line) as { sessionId?: string }
    if (payload.sessionId !== 'c47955') {
      return NextResponse.json({ ok: false }, { status: 400 })
    }
    const cwd = process.cwd()
    const paths = [
      path.join(cwd, '.cursor', 'debug-c47955.log'),
      path.join(cwd, 'logs', 'debug-c47955.ndjson'),
      path.join(cwd, 'debug-c47955.log'),
    ]
    const out = `${line}\n`
    let wrote = false
    for (const logPath of paths) {
      try {
        await fs.mkdir(path.dirname(logPath), { recursive: true })
        await fs.appendFile(logPath, out, 'utf8')
        wrote = true
      } catch {
        // try next path
      }
    }
    if (!wrote) {
      return NextResponse.json({ ok: false, error: 'no writable log path' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
