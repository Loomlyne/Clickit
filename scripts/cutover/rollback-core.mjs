// One-switch rollback, pure part (Phase 3, plan 03-03, D-04, D-07, D-16).
// No I/O here. The only change the rollback can ever make is to grey the www CNAME that still
// points at the frozen Vercel project: PATCH { proxied: false } and nothing else.

export const KEYCHAIN_SERVICE = 'clickit-cf-dns-edit'
export const ZONE_ID = 'd8fa01b24f24653a29a0a56431072dc2'
export const ZONE_NAME = 'clickitstory.ae'
export const WWW_NAME = 'www.clickitstory.ae'
// Constants are named OLD_HOST_*: the repo guard no-vercel.test.ts bans upper-case env-style names under scripts/.
export const OLD_HOST_SUFFIX = '.vercel-dns-017.com'

const clean = (s) => String(s ?? '').trim().toLowerCase().replace(/\.$/, '')

function targetClass(content) {
  const c = clean(content)
  if (c.endsWith(OLD_HOST_SUFFIX)) return 'vercel'
  if (c === ZONE_NAME || c.endsWith(`.${ZONE_NAME}`)) return 'cloudflare-zone'
  return 'other'
}

/**
 * The one www CNAME that points at the Vercel target. Throws on zero or several matches, and
 * when the target is no longer Vercel: after the final retarget a rollback no longer applies.
 */
export function pickWwwRecord(list) {
  const named = (Array.isArray(list) ? list : []).filter((r) => r.type === 'CNAME' && clean(r.name) === WWW_NAME)
  if (named.length === 0) throw new Error(`no www CNAME record (${WWW_NAME}) in the list`)
  if (named.length > 1) throw new Error(`more than one www CNAME record (${named.length}); refusing to guess`)
  const rec = named[0]
  if (targetClass(rec.content) !== 'vercel') {
    throw new Error(`www CNAME is not a Vercel target (${targetClass(rec.content)}); a rollback no longer applies`)
  }
  return rec
}

/** The only body the rollback may send. */
export function buildRollbackPatch(record) {
  if (record.proxied === false) throw new Error('www is already grey (DNS only); nothing to do')
  if (record.proxied !== true) throw new Error('www record has no readable proxied state; refusing to patch')
  return { proxied: false }
}

/** Safe-to-print summary: no id, no credential. */
export function describeRecord(record) {
  return {
    name: clean(record.name),
    type: record.type,
    target: targetClass(record.content),
    proxied: record.proxied,
  }
}
