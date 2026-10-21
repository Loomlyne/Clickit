// Client IP for rate limiting (PLAT-07, T-02-14). Pure: no imports.
// Only cf-connecting-ip is trusted, because Cloudflare sets it on every request
// that reaches the Worker. the forwarded-for style headers are attacker-controlled
// and are never read. A missing or malformed value yields null (callers refuse).
// allowLocalOverride is for local preview only: the caller derives it from
// LOCAL_DEV=1, and the deploy guard (plan 02-06) refuses any build carrying it.

const MAX_IP_LENGTH = 45

function isIPv4(text: string): boolean {
  const parts = text.split('.')
  if (parts.length !== 4) return false
  return parts.every((part) => /^(0|[1-9]\d{0,2})$/.test(part) && Number(part) <= 255)
}

function isIPv6(text: string): boolean {
  if (!/^[0-9a-fA-F:.]+$/.test(text) || !text.includes(':')) return false
  const doubleColon = text.split('::')
  if (doubleColon.length > 2) return false
  const hasCompression = doubleColon.length === 2
  const groups: string[] = []
  for (const side of doubleColon) {
    if (side !== '') groups.push(...side.split(':'))
  }
  let count = groups.length
  const last = groups[groups.length - 1]
  if (last !== undefined && last.includes('.')) {
    if (!isIPv4(last)) return false
    groups.pop()
    count += 1 // an embedded IPv4 fills two 16-bit groups
  }
  if (!groups.every((group) => /^[0-9a-fA-F]{1,4}$/.test(group))) return false
  // A leading or trailing single colon (not part of "::") leaves an empty group.
  if (!hasCompression && text.split(':').some((group) => group === '')) return false
  if (hasCompression) return count <= 7
  return count === 8
}

export function clientIpFrom(headers: Headers, options: { allowLocalOverride?: boolean } = {}): string | null {
  const raw = headers.get('cf-connecting-ip')
  if (raw === null || raw.trim() === '') {
    return options.allowLocalOverride === true ? '127.0.0.1' : null
  }
  const value = raw.trim()
  if (value.length > MAX_IP_LENGTH) return null
  return isIPv4(value) || isIPv6(value) ? value : null
}
