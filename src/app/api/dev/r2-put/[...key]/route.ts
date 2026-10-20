import { NextResponse } from 'next/server'

import { getWorkerEnv } from '@/server/cloudflare'
import { checkShimRequest } from '@/server/dev-upload-shim'
import { normalizeContentType } from '@/server/upload-kinds'

// Local preview only (T-02-56). Answers 404 unless LOCAL_DEV=1, the host is
// 127.0.0.1 and the HMAC token from requestMediaUpload matches this key and
// content type. On workers.dev and in production LOCAL_DEV is never set, so this
// is a plain 404 (plan 02-22 verifies it). The Host header is the check: under
// OpenNext preview request.url reports localhost while Host is 127.0.0.1.
export const dynamic = 'force-dynamic'

const KEY_RE = /^[a-z0-9/_.-]+$/
const MAX_BODY_BYTES = 60 * 1024 * 1024

export async function PUT(request: Request, ctx: { params: Promise<{ key: string[] }> }) {
  const env = await getWorkerEnv()
  const { key: parts } = await ctx.params
  const key = Array.isArray(parts) ? parts.join('/') : ''
  const url = new URL(request.url)
  const host = request.headers.get('host')

  const check = await checkShimRequest({
    localDev: env.LOCAL_DEV,
    host,
    token: url.searchParams.get('t'),
    key,
    contentType: normalizeContentType(request.headers.get('content-type')),
    secret: env.LOCAL_UPLOAD_SHIM_SECRET,
  })
  if (!check.ok) return new NextResponse(null, { status: check.status })

  if (!KEY_RE.test(key) || key.includes('..') || key.includes('//')) return new NextResponse(null, { status: 400 })
  const length = Number(request.headers.get('content-length'))
  if (!Number.isFinite(length) || length <= 0) return new NextResponse(null, { status: 411 })
  if (length > MAX_BODY_BYTES || !request.body) return new NextResponse(null, { status: 413 })

  // Next hands the Worker a body stream of unknown length, which R2 put refuses
  // ("must have a known length"). Local-only and capped, so buffer it.
  const body = await request.arrayBuffer()
  if (body.byteLength === 0 || body.byteLength > MAX_BODY_BYTES) return new NextResponse(null, { status: 413 })
  await env.MEDIA.put(key, body, {
    httpMetadata: { contentType: normalizeContentType(request.headers.get('content-type')) },
  })
  return new NextResponse(null, { status: 200 })
}
