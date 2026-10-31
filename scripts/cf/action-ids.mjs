// Server action ids read from the client chunks a deployed version serves (plan 02.1-01).
// An id is reported only when a chunk binds it to one of the four allowed names through
// createServerReference. An id is never derived from a build (unpinned builds of one commit
// differ) and a missing name is listed, never guessed.
//
// The page GETs are themselves on the failing render path, so each page gets up to 5 tries,
// 15 s apart, on a 5xx or network failure, and every try is recorded. Only --admin-page GETs
// carry the admin cookie. Response bodies are never written anywhere.
//
// Exit: 0 all found; 5 a page failed; 6 a name is missing with every page ok; 7 session lost
// (an admin page redirected; no retry); 8 one name bound to two ids; 2 usage or refused base.
//
// Usage:
//   node scripts/cf/action-ids.mjs --base <url> --page /en/auth --page /en/support \
//     --admin-page /en/admin/settings --admin-cookie-file <file> --out <file> --run-tag <tag>

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const ALLOWED_REMOTE_BASE = 'https://clickit.clickitstory.workers.dev'
/** The only names ever returned, and the page each one is used from at 787ca3a. */
export const NAME_PAGES = Object.freeze({
  signInAction: '/en/auth',
  signUpAction: '/en/auth',
  submitSupportMessage: '/en/support',
  updateFeatureFlags: '/en/admin/settings',
})
export const ALLOWED_NAMES = Object.freeze(Object.keys(NAME_PAGES))
export const MAX_TRIES = 5
export const RETRY_DELAY_MS = 15_000
export const MAX_CHUNK_FILES = 300
export const EXIT = Object.freeze({ OK: 0, USAGE: 2, PAGE_FAILED: 5, NAME_MISSING: 6, SESSION_LOST: 7, CONFLICT: 8 })

export const USAGE = `action-ids: read server action ids from a deployed version's client chunks
  --base <url>              loopback or ${ALLOWED_REMOTE_BASE}
  --page <path>             page read without a cookie (repeatable)
  --admin-page <path>       page read with the admin cookie (repeatable)
  --admin-cookie-file <f>   the Cookie header line, needed with --admin-page
  --out <file>              result JSON, mode 600, outside the repo
  --run-tag <tag>           short run tag for the sl= query
  --help`

/** Loopback (any port) or the exact test Worker. Everything else is refused. */
export function isAllowedBase(base) {
  let url
  try {
    url = new URL(base)
  } catch {
    return false
  }
  if (url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) return false
  if (url.origin === ALLOWED_REMOTE_BASE) return true
  return url.protocol === 'http:' && (url.hostname === '127.0.0.1' || url.hostname === 'localhost')
}

/** workerd may redact id-like URL segments, so a tag stays short with no long hex run. */
export function isValidTag(tag) {
  return typeof tag === 'string' && /^[a-z0-9-]+$/.test(tag) && tag.length < 16 && !/[0-9a-f]{5}/.test(tag)
}

/**
 * Every createServerReference call that binds a 40-44 hex id to a quoted name, as in
 * (0,k.createServerReference)("60ba…",k.callServer,void 0,k.findSourceMapURL,"signInAction")
 */
export function extractActionRefs(text) {
  const out = []
  const pattern = /createServerReference\)?\s*\(\s*["']([0-9a-fA-F]{40,44})["']\s*,[^()"']*,\s*["']([\w$]+)["']\s*\)/g
  for (const match of String(text).matchAll(pattern)) out.push({ id: match[1], name: match[2] })
  return out
}

/** static/chunks/*.js names in HTML, flight data or another chunk. */
export function extractChunkNames(text) {
  const names = new Set()
  for (const match of String(text).matchAll(/static\/chunks\/[A-Za-z0-9_\-./~%[\]()]+?\.js/g)) {
    if (!match[0].includes('..')) names.add(match[0])
  }
  return [...names]
}

async function fetchPage({ base, page, cookie, admin, tagFor, fetchImpl, sleep, retryDelayMs }) {
  const tries = []
  for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
    if (attempt > 1) await sleep(retryDelayMs)
    const tag = tagFor()
    const url = new URL(page, base)
    url.searchParams.set('sl', tag)
    const headers = admin && cookie ? { cookie } : {}
    let res
    try {
      res = await fetchImpl(url.toString(), { method: 'GET', headers, redirect: 'manual' })
    } catch (error) {
      tries.push({ tag, status: null, error: error?.name ?? 'network' })
      continue
    }
    tries.push({ tag, status: res.status })
    if (res.status >= 500) {
      await res.body?.cancel?.()
      continue
    }
    if (res.status >= 300 && res.status < 400 && admin) {
      await res.body?.cancel?.()
      return { page, status: 'session-lost', tries, html: '' }
    }
    if (res.status !== 200) {
      await res.body?.cancel?.()
      return { page, status: 'page-failed', tries, html: '' }
    }
    return { page, status: 'ok', tries, html: await res.text() }
  }
  return { page, status: 'page-failed', tries, html: '' }
}

/**
 * readActionIds({ base, pages, adminPages, adminCookie, runTag, fetchImpl, sleep })
 * -> { pages: [{ page, status, tries }], names: { name: { status, id? } }, conflicts, chunks, exitCode }
 */
export async function readActionIds({
  base,
  pages = [],
  adminPages = [],
  adminCookie = null,
  runTag = 'r',
  fetchImpl = fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  retryDelayMs = RETRY_DELAY_MS,
  maxChunkFiles = MAX_CHUNK_FILES,
}) {
  let tagCount = 0
  const tagFor = () => {
    tagCount++
    const tag = `${runTag}-id-${tagCount}`
    if (!isValidTag(tag)) throw new Error('run tag makes an invalid sl tag')
    return tag
  }
  const pageResults = []
  const queue = []
  const seen = new Set()
  const refs = []
  const enqueue = (text) => {
    for (const name of extractChunkNames(text)) {
      if (!seen.has(name)) {
        seen.add(name)
        queue.push(name)
      }
    }
  }
  const list = [...pages.map((page) => ({ page, admin: false })), ...adminPages.map((page) => ({ page, admin: true }))]
  let sessionLost = false
  for (const { page, admin } of list) {
    const result = await fetchPage({ base, page, cookie: adminCookie, admin, tagFor, fetchImpl, sleep, retryDelayMs })
    pageResults.push({ page, admin, status: result.status, tries: result.tries })
    if (result.status === 'session-lost') {
      sessionLost = true
      break
    }
    refs.push(...extractActionRefs(result.html))
    enqueue(result.html)
  }

  let chunkFiles = 0
  let chunkFailures = 0
  while (queue.length > 0 && chunkFiles < maxChunkFiles) {
    const name = queue.shift()
    chunkFiles++
    try {
      const res = await fetchImpl(new URL(`/_next/${name}`, base).toString(), { method: 'GET', redirect: 'manual' })
      if (res.status !== 200) {
        await res.body?.cancel?.()
        chunkFailures++
        continue
      }
      const text = await res.text()
      refs.push(...extractActionRefs(text))
      enqueue(text)
    } catch {
      chunkFailures++
    }
  }
  const truncated = queue.length > 0

  const idsByName = new Map(ALLOWED_NAMES.map((name) => [name, new Set()]))
  for (const { id, name } of refs) idsByName.get(name)?.add(id)

  const statusOf = (page) => pageResults.find((p) => p.page === page)?.status ?? null
  const anyPageBad = pageResults.some((p) => p.status !== 'ok')
  const incompleteRead = truncated || chunkFailures > 0
  const names = {}
  const conflicts = []
  for (const [name, ids] of idsByName) {
    if (ids.size === 1) {
      names[name] = { status: 'found', id: [...ids][0] }
    } else if (ids.size > 1) {
      conflicts.push(name)
      names[name] = { status: 'conflict' }
    } else if ((anyPageBad && statusOf(NAME_PAGES[name]) !== 'ok') || incompleteRead) {
      names[name] = { status: 'unresolved' }
    } else {
      names[name] = { status: 'name-missing' }
    }
  }

  let exitCode = EXIT.OK
  if (sessionLost) exitCode = EXIT.SESSION_LOST
  else if (conflicts.length > 0) exitCode = EXIT.CONFLICT
  else if (anyPageBad || Object.values(names).some((n) => n.status === 'unresolved')) exitCode = EXIT.PAGE_FAILED
  else if (Object.values(names).some((n) => n.status === 'name-missing')) exitCode = EXIT.NAME_MISSING

  return { pages: pageResults, names, conflicts, chunks: { files: chunkFiles, failures: chunkFailures, truncated }, exitCode }
}

export function parseArgs(argv) {
  const out = { base: null, pages: [], adminPages: [], cookieFile: null, out: null, runTag: 'r', help: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => {
      const v = argv[++i]
      if (v === undefined || v.startsWith('--')) throw new Error(`${a} needs a value`)
      return v
    }
    if (a === '--help' || a === '-h') out.help = true
    else if (a === '--base') out.base = next()
    else if (a === '--page') out.pages.push(next())
    else if (a === '--admin-page') out.adminPages.push(next())
    else if (a === '--admin-cookie-file') out.cookieFile = next()
    else if (a === '--out') out.out = next()
    else if (a === '--run-tag') out.runTag = next()
    else throw new Error(`unknown argument ${a}`)
  }
  return out
}

async function main(argv) {
  let args
  try {
    args = parseArgs(argv)
  } catch (error) {
    process.stderr.write(`${error.message}\n${USAGE}\n`)
    return EXIT.USAGE
  }
  if (args.help) {
    process.stdout.write(`${USAGE}\n`)
    return EXIT.OK
  }
  if (!args.base || !isAllowedBase(args.base)) {
    process.stderr.write(`refused: --base must be loopback or ${ALLOWED_REMOTE_BASE}\n`)
    return EXIT.USAGE
  }
  if (!args.out || args.pages.length + args.adminPages.length === 0) {
    process.stderr.write(`--out and at least one page are required\n${USAGE}\n`)
    return EXIT.USAGE
  }
  if (!isValidTag(`${args.runTag}-id-1`)) {
    process.stderr.write('--run-tag must be short lower-case letters and digits\n')
    return EXIT.USAGE
  }
  if (args.adminPages.length > 0 && !args.cookieFile) {
    process.stderr.write('--admin-page needs --admin-cookie-file\n')
    return EXIT.USAGE
  }
  const adminCookie = args.cookieFile ? readFileSync(args.cookieFile, 'utf8').trim() : null
  const result = await readActionIds({ base: args.base, pages: args.pages, adminPages: args.adminPages, adminCookie, runTag: args.runTag })
  writeFileSync(args.out, `${JSON.stringify({ base: args.base, at: new Date().toISOString(), ...result }, null, 2)}\n`, { mode: 0o600 })
  for (const page of result.pages) process.stdout.write(`page ${page.page}: ${page.status} (${page.tries.length} tries)\n`)
  for (const [name, entry] of Object.entries(result.names)) process.stdout.write(`name ${name}: ${entry.status}\n`)
  process.stdout.write(`chunks read: ${result.chunks.files}, failed: ${result.chunks.failures}, truncated: ${result.chunks.truncated}\nexit=${result.exitCode}\n`)
  return result.exitCode
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = await main(process.argv.slice(2))
}
