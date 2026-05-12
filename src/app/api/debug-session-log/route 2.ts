import { appendFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { NextResponse } from 'next/server'

/** Append NDJSON for Cursor debug sessions. Disabled only on Vercel production (not local `next start`). */
export async function POST(req: Request) {
  if (process.env.VERCEL === '1' && process.env.VERCEL_ENV === 'production') {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  let line: string
  try {
    const payload = await req.json()
    line = `${JSON.stringify(payload)}\n`
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  const dir = join(process.cwd(), '.cursor')
  const file = join(dir, 'debug-c080c4.log')
  await mkdir(dir, { recursive: true })
  await appendFile(file, line, 'utf8')
  return NextResponse.json({ ok: true })
}
