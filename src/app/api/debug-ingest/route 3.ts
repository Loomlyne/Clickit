import { appendFile, mkdir } from 'fs/promises'
import { dirname, join } from 'path'
import { NextResponse } from 'next/server'

const LOG_FILE = join(process.cwd(), '.cursor/debug-c080c4.log')

export async function POST(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse(null, { status: 404 })
  }
  try {
    const text = await req.text()
    if (!text) return NextResponse.json({ ok: false }, { status: 400 })
    await mkdir(dirname(LOG_FILE), { recursive: true })
    await appendFile(LOG_FILE, `${text}\n`, 'utf8')
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
