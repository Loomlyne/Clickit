import { NextResponse, type NextRequest } from 'next/server'

import { LOCALE_COOKIE, DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/lib/locale'
import { verifyLinkToken } from '@/server/email/links'
import { getLinkSecret } from '@/server/email/link-secret'
import { unsubscribeRequest } from '@/server/email/public-links-core'
import { createUnsubscribeStore, readProfileLocale } from '@/server/email/public-links-store'

// One-click unsubscribe for the new-episode digest (D-35, RFC 8058).
// POST: mail client (or the confirm page's own action) turns the digest off.
// GET: never writes (link scanners prefetch); sends the person to the button page.
// The token is a bearer credential: it is never logged. Neither is any address.

function tokenFrom(url: URL): string {
  return url.searchParams.get('t') ?? ''
}

export async function POST(request: NextRequest) {
  let token = tokenFrom(new URL(request.url))
  if (!token) {
    // RFC 8058 clients post List-Unsubscribe=One-Click as a form; accept `t` there too.
    try {
      const form = await request.formData()
      const value = form.get('t')
      if (typeof value === 'string') token = value
    } catch {
      // not a form body
    }
  }

  const secret = await getLinkSecret()
  // The admin client throws when its env is missing; keep that out of the 400 path.
  let result
  try {
    result = await unsubscribeRequest({
      token,
      secret,
      now: Math.floor(Date.now() / 1000),
      store: createUnsubscribeStore(),
    })
  } catch {
    console.error('[email/unsubscribe] POST outcome=error')
    return new Response(null, { status: 500 })
  }

  if (result.ok) {
    console.info('[email/unsubscribe] POST outcome=ok')
    return new Response(null, { status: 200 })
  }
  console.warn(`[email/unsubscribe] POST outcome=${result.reason}`)
  if (result.reason === 'invalid') return new Response(null, { status: 400 })
  if (result.reason === 'unavailable') return new Response(null, { status: 503 })
  return new Response(null, { status: 500 })
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const token = tokenFrom(url)

  let locale: string = DEFAULT_LOCALE
  const cookie = request.cookies.get(LOCALE_COOKIE)?.value
  if (cookie && (SUPPORTED_LOCALES as readonly string[]).includes(cookie)) locale = cookie

  const secret = await getLinkSecret()
  if (secret && token) {
    const v = await verifyLinkToken(token, 'unsub_digest', secret, Math.floor(Date.now() / 1000))
    if (v.ok) {
      const stored = await readProfileLocale(v.id)
      if (stored) locale = stored
    }
  }

  // No write here. A bad token still lands on the page, which shows the invalid state.
  const target = new URL(`/${locale}/unsubscribe`, url.origin)
  if (token) target.searchParams.set('t', token)
  console.info('[email/unsubscribe] GET redirect')
  return NextResponse.redirect(target, 303)
}
