import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { siteUrl } from '../../src/lib/site-url.ts'

const KEYS = ['NEXT_PUBLIC_SITE_URL', 'VERCEL_URL', 'VERCEL_PROJECT_PRODUCTION_URL', 'NODE_ENV'] as const
const saved: Record<string, string | undefined> = {}
const env = process.env as Record<string, string | undefined>

beforeEach(() => {
  for (const k of KEYS) {
    saved[k] = env[k]
    delete env[k]
  }
})
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete env[k]
    else env[k] = saved[k]
  }
})

test('an explicit NEXT_PUBLIC_SITE_URL wins and loses its trailing slash', () => {
  env.NODE_ENV = 'production'
  env.NEXT_PUBLIC_SITE_URL = 'https://x.workers.dev/'
  assert.equal(siteUrl(), 'https://x.workers.dev')
})

test('multiple trailing slashes are removed', () => {
  env.NODE_ENV = 'production'
  env.NEXT_PUBLIC_SITE_URL = 'https://x.workers.dev//'
  assert.equal(siteUrl(), 'https://x.workers.dev')
})

test('VERCEL_URL and VERCEL_PROJECT_PRODUCTION_URL are ignored in production', () => {
  env.NODE_ENV = 'production'
  env.VERCEL_URL = 'clickit-abc.vercel.app'
  env.VERCEL_PROJECT_PRODUCTION_URL = 'clickit.vercel.app'
  assert.equal(siteUrl(), 'https://www.clickitstory.ae')
})

test('production with nothing set returns the canonical www host', () => {
  env.NODE_ENV = 'production'
  assert.equal(siteUrl(), 'https://www.clickitstory.ae')
})

test('development with nothing set returns the loopback address the repo binds', () => {
  env.NODE_ENV = 'development'
  assert.equal(siteUrl(), 'http://127.0.0.1:3000')
})

test('a value without a protocol is refused (production default)', () => {
  env.NODE_ENV = 'production'
  env.NEXT_PUBLIC_SITE_URL = 'x.workers.dev'
  assert.equal(siteUrl(), 'https://www.clickitstory.ae')
})

test('a value without a protocol is refused (development default)', () => {
  env.NODE_ENV = 'development'
  env.NEXT_PUBLIC_SITE_URL = 'x.workers.dev'
  assert.equal(siteUrl(), 'http://127.0.0.1:3000')
})

test('a non-http protocol or unparsable value is refused', () => {
  env.NODE_ENV = 'production'
  env.NEXT_PUBLIC_SITE_URL = 'javascript:alert(1)'
  assert.equal(siteUrl(), 'https://www.clickitstory.ae')
  env.NEXT_PUBLIC_SITE_URL = 'https://'
  assert.equal(siteUrl(), 'https://www.clickitstory.ae')
})

test('http is accepted for an explicit local override', () => {
  env.NODE_ENV = 'development'
  env.NEXT_PUBLIC_SITE_URL = 'http://127.0.0.1:8787'
  assert.equal(siteUrl(), 'http://127.0.0.1:8787')
})

test('a test environment (NODE_ENV test) behaves like development', () => {
  env.NODE_ENV = 'test'
  assert.equal(siteUrl(), 'http://127.0.0.1:3000')
})
