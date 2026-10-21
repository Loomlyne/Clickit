// R2 CORS rule builder for the clickit-media bucket (MEDIA-01, T-02-07).
// Prints the nested `wrangler r2 bucket cors set --file` JSON for the given app
// origins. Refuses http, wildcards and anything that is not a bare https origin.
// No network, no wrangler call. Key names headers / exposeHeaders / maxAgeSeconds
// are research assumption A3; if wrangler rejects one, this file is the one fix point.
//
// Usage:
//   node scripts/cf/r2-cors.mjs --app-origin https://clickit.<SUB>.workers.dev --app-origin https://www.clickitstory.ae

import { fileURLToPath } from 'node:url'

/**
 * @param {unknown} raw
 * @returns {string} normalized origin
 */
function parseOrigin(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new Error(`invalid origin: expected a non-empty string, got ${JSON.stringify(raw)}`)
  }
  const text = raw.trim()
  if (text.includes('*')) {
    throw new Error(`refused: wildcard origin "${text}" is not allowed`)
  }
  let url
  try {
    url = new URL(text)
  } catch {
    throw new Error(`invalid origin: "${text}" is not a URL`)
  }
  if (url.protocol !== 'https:') {
    throw new Error(`refused: origin "${text}" must use https`)
  }
  if (url.pathname !== '/') {
    throw new Error(`refused: origin "${text}" must not have a path`)
  }
  if (url.search !== '') {
    throw new Error(`refused: origin "${text}" must not have a query (search)`)
  }
  if (url.hash !== '') {
    throw new Error(`refused: origin "${text}" must not have a hash (fragment)`)
  }
  if (url.username !== '' || url.password !== '') {
    throw new Error(`refused: origin "${text}" must not carry credentials`)
  }
  return url.origin
}

/**
 * @param {string[]} origins https origins allowed to PUT to the bucket
 * @returns {{ rules: Array<{ allowed: { origins: string[], methods: string[], headers: string[] }, exposeHeaders: string[], maxAgeSeconds: number }> }}
 */
export function buildR2CorsRules(origins) {
  if (!Array.isArray(origins) || origins.length === 0) {
    throw new Error('at least one https origin is required')
  }
  const unique = [...new Set(origins.map(parseOrigin))]
  return {
    rules: [
      {
        allowed: {
          origins: unique,
          methods: ['PUT'],
          headers: ['Content-Type'],
        },
        exposeHeaders: ['ETag'],
        maxAgeSeconds: 3600,
      },
    ],
  }
}

/**
 * @param {string[]} argv
 * @returns {string[]}
 */
function parseArgs(argv) {
  const origins = []
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--app-origin') {
      const value = argv[i + 1]
      if (value === undefined) throw new Error('--app-origin needs a value')
      origins.push(value)
      i += 1
    } else if (arg.startsWith('--app-origin=')) {
      origins.push(arg.slice('--app-origin='.length))
    } else {
      throw new Error(`unknown argument: ${arg}`)
    }
  }
  return origins
}

function main(argv) {
  try {
    const result = buildR2CorsRules(parseArgs(argv))
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    return 0
  } catch (error) {
    process.stderr.write(`r2-cors: ${error instanceof Error ? error.message : String(error)}\n`)
    return 1
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(main(process.argv.slice(2)))
}
