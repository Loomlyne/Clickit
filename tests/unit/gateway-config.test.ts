// Public gateway config written next to the build stamp (plan 02.1-01 Task 1).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { GATEWAY_CONFIG_PATH, authCookieNameFor, gatewayConfigFromEnv } from '../../scripts/cf/gateway-config.mjs'

test('authCookieNameFor matches supabase-js (first hostname label)', () => {
  assert.equal(authCookieNameFor('https://lajguozmtissnnfccmej.supabase.co'), 'sb-lajguozmtissnnfccmej-auth-token')
  assert.equal(authCookieNameFor('http://127.0.0.1:55321'), 'sb-127-auth-token')
})

test('gatewayConfigFromEnv throws without NEXT_PUBLIC_SUPABASE_URL', () => {
  assert.throws(() => gatewayConfigFromEnv({}), /NEXT_PUBLIC_SUPABASE_URL/)
  assert.throws(() => gatewayConfigFromEnv({ NEXT_PUBLIC_SUPABASE_URL: '  ' }), /NEXT_PUBLIC_SUPABASE_URL/)
  assert.throws(() => gatewayConfigFromEnv({ NEXT_PUBLIC_SUPABASE_URL: 'not a url' }), /NEXT_PUBLIC_SUPABASE_URL/)
  assert.throws(() => gatewayConfigFromEnv({ NEXT_PUBLIC_SUPABASE_URL: 'ftp://x.supabase.co' }), /NEXT_PUBLIC_SUPABASE_URL/)
})

test('gatewayConfigFromEnv gives URL, cookie name and JWKS URL', () => {
  assert.deepEqual(gatewayConfigFromEnv({ NEXT_PUBLIC_SUPABASE_URL: 'https://lajguozmtissnnfccmej.supabase.co/' }), {
    supabaseUrl: 'https://lajguozmtissnnfccmej.supabase.co',
    authCookieName: 'sb-lajguozmtissnnfccmej-auth-token',
    jwksUrl: 'https://lajguozmtissnnfccmej.supabase.co/auth/v1/.well-known/jwks.json',
  })
  assert.equal(
    gatewayConfigFromEnv({ NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:55321' }).jwksUrl,
    'http://127.0.0.1:55321/auth/v1/.well-known/jwks.json',
  )
  assert.equal(GATEWAY_CONFIG_PATH, '.open-next/clickit-gateway-config.json')
})

test('the written object holds only public values', () => {
  const config = gatewayConfigFromEnv({
    NEXT_PUBLIC_SUPABASE_URL: 'https://lajguozmtissnnfccmej.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-fixture-value',
    SUPABASE_SERVICE_ROLE_KEY: 'service-fixture-value',
    CRON_SECRET: 'cron-fixture-value',
    CLOUDFLARE_API_TOKEN: 'token-fixture-value',
  })
  assert.deepEqual(Object.keys(config).sort(), ['authCookieName', 'jwksUrl', 'supabaseUrl'])
  for (const name of Object.keys(config)) assert.doesNotMatch(name, /KEY|SECRET|TOKEN/i)
  assert.doesNotMatch(JSON.stringify(config), /fixture-value/)
})
