import assert from 'node:assert/strict'
import test from 'node:test'

import { buildCsp, R2_S3_HOST } from '../../src/lib/csp.ts'

function directives(csp: string): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const part of csp.split('; ')) {
    const [name, ...values] = part.split(' ')
    out[name] = values
  }
  return out
}

const PROD = {
  nodeEnv: 'production',
  supabaseUrl: 'https://abc.supabase.co',
  mediaOrigin: 'https://clickit-media.x.workers.dev',
  upgradeInsecure: true,
  target: 'production' as const,
}

test('R2 S3 host is the pinned ClickitStory account endpoint', () => {
  assert.equal(R2_S3_HOST, 'https://e329b099b6e4272fc0915a99832e47fe.r2.cloudflarestorage.com')
})

test('production CSP allows Turnstile, Web Analytics, media, R2 and Supabase', () => {
  const csp = buildCsp(PROD)
  const d = directives(csp)
  assert.ok(d['script-src'].includes('https://challenges.cloudflare.com'))
  assert.ok(d['frame-src'].includes('https://challenges.cloudflare.com'))
  assert.ok(d['connect-src'].includes('https://challenges.cloudflare.com'))
  assert.ok(d['script-src'].includes('https://static.cloudflareinsights.com'))
  assert.ok(d['connect-src'].includes('https://cloudflareinsights.com'))
  assert.ok(d['connect-src'].includes(R2_S3_HOST))
  assert.ok(d['connect-src'].includes('https://abc.supabase.co'))
  assert.ok(d['connect-src'].includes('wss://abc.supabase.co'))
  assert.ok(d['img-src'].includes('https://clickit-media.x.workers.dev'))
  assert.ok(d['media-src'].includes('https://clickit-media.x.workers.dev'))
  assert.ok('upgrade-insecure-requests' in d)
})

test('no directive names Vercel', () => {
  for (const target of ['production', 'workersdev', 'preview'] as const) {
    assert.doesNotMatch(buildCsp({ ...PROD, target }), /vercel/i)
  }
})

test('R2 host is exact, never a wildcard', () => {
  const d = directives(buildCsp(PROD))
  for (const [name, values] of Object.entries(d)) {
    for (const v of values) {
      if (v.includes('cloudflarestorage')) {
        assert.equal(v, R2_S3_HOST, name)
        assert.equal(name, 'connect-src')
      }
      assert.ok(!/^https?:\/\/\*\.(cloudflare|workers)/.test(v), `${name} ${v}`)
    }
  }
})

test('supabaseUrl unset falls back to the *.supabase.co wildcard', () => {
  const d = directives(buildCsp({ ...PROD, supabaseUrl: undefined }))
  assert.ok(d['connect-src'].includes('https://*.supabase.co'))
  assert.ok(d['connect-src'].includes('wss://*.supabase.co'))
  assert.ok(d['media-src'].includes('https://*.supabase.co'))
})

test('invalid supabaseUrl falls back to the wildcard', () => {
  const d = directives(buildCsp({ ...PROD, supabaseUrl: 'not a url' }))
  assert.ok(d['connect-src'].includes('https://*.supabase.co'))
})

test('a null media origin adds nothing to img-src or media-src', () => {
  const d = directives(buildCsp({ ...PROD, mediaOrigin: null }))
  assert.ok(!d['img-src'].some((v) => v.includes('workers.dev')))
  assert.ok(!d['media-src'].some((v) => v.includes('workers.dev')))
})

test('preview target adds loopback media and local Supabase, without upgrade-insecure-requests', () => {
  const csp = buildCsp({
    nodeEnv: 'production',
    supabaseUrl: 'http://127.0.0.1:55321',
    mediaOrigin: 'http://127.0.0.1:8789',
    upgradeInsecure: false,
    target: 'preview',
  })
  const d = directives(csp)
  assert.ok(d['connect-src'].includes('http://127.0.0.1:55321'))
  assert.ok(d['connect-src'].includes('ws://127.0.0.1:55321'))
  assert.ok(d['img-src'].includes('http://127.0.0.1:55321'))
  assert.ok(d['media-src'].includes('http://127.0.0.1:55321'))
  assert.ok(d['img-src'].includes('http://127.0.0.1:8789'))
  assert.ok(d['media-src'].includes('http://127.0.0.1:8789'))
  assert.ok(d['connect-src'].includes('http://127.0.0.1:8789'))
  assert.ok(!('upgrade-insecure-requests' in d))
})

test('loopback origins are never emitted for workersdev or production targets', () => {
  for (const target of ['workersdev', 'production'] as const) {
    const csp = buildCsp({
      nodeEnv: 'production',
      supabaseUrl: 'http://127.0.0.1:55321',
      mediaOrigin: 'http://127.0.0.1:8789',
      upgradeInsecure: true,
      target,
    })
    assert.doesNotMatch(csp, /127\.0\.0\.1|localhost|ws:\/\//, target)
    assert.ok(buildCsp({ ...PROD, target }).includes('https://abc.supabase.co'))
  }
})

test('a non-loopback http origin is not added even for the preview target', () => {
  const csp = buildCsp({ ...PROD, target: 'preview', supabaseUrl: 'http://evil.example', mediaOrigin: 'http://evil.example', upgradeInsecure: false })
  assert.doesNotMatch(csp, /http:\/\/evil\.example/)
})

test('development adds the dev eval token to script-src, production does not', () => {
  const dev = directives(buildCsp({ ...PROD, nodeEnv: 'development', upgradeInsecure: false }))
  const prod = directives(buildCsp(PROD))
  assert.ok(dev['script-src'].includes("'unsafe-eval'"))
  assert.ok(!prod['script-src'].includes("'unsafe-eval'"))
})

test('GA, Meta and YouTube hosts and the locked-down directives are unchanged', () => {
  const d = directives(buildCsp(PROD))
  assert.ok(d['script-src'].includes('https://www.googletagmanager.com'))
  assert.ok(d['script-src'].includes('https://connect.facebook.net'))
  assert.ok(d['script-src'].includes('https://www.youtube.com'))
  assert.ok(d['connect-src'].includes('https://www.google-analytics.com'))
  assert.ok(d['connect-src'].includes('https://*.googlevideo.com'))
  assert.ok(d['frame-src'].includes('https://www.youtube-nocookie.com'))
  assert.deepEqual(d['frame-ancestors'], ["'self'"])
  assert.deepEqual(d['object-src'], ["'none'"])
  assert.deepEqual(d['base-uri'], ["'self'"])
  assert.deepEqual(d['form-action'], ["'self'"])
})
