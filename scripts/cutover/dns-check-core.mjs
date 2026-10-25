// G-DNS core (Phase 3, plan 03-03). Pure functions only: no I/O, no network, no state
// between runs. The runner (dns-check.mjs) feeds this module the text that dig prints.
//
// An expectation is a plain object:
//   { scope: 'registry' | 'zone', fqdn, type, kind, ... }
// kinds:
//   exact               values[] must equal the record data set (order does not matter)
//   txt-prefix          one TXT record begins with `prefix` and contains `mustContain`
//   cloudflare-proxied  every A/AAAA answer lies inside Cloudflare's published ranges, no CNAME
//   absent              no record of `type`
//   no-vercel           over `types`, no answer mentions vercel or sits on a Vercel address
//   soa-equal           (judgeBoth only) the SOA serial is the same on jen and brett

export const PHASES = Object.freeze(['ns', 'resend', 'pre-flip', 'post-flip', 'rollback', 'final'])

export const ZONE = 'clickitstory.ae'
export const OLD_HOST_TARGET = 'ba211fb55cf67415.vercel-dns-017.com'
export const CLOUDFLARE_NS = Object.freeze(['brett.ns.cloudflare.com', 'jen.ns.cloudflare.com'])
export const ZONE_SERVERS = Object.freeze(['jen.ns.cloudflare.com', 'brett.ns.cloudflare.com'])

// Cloudflare's published ranges, https://www.cloudflare.com/ips-v4 and /ips-v6,
// fetched 2026-10-21 14:11 UTC while writing this file. Re-fetch if Cloudflare announces a change.
const CF_V4 = Object.freeze([
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22',
])
const CF_V6 = Object.freeze([
  '2400:cb00::/32',
  '2606:4700::/32',
  '2803:f800::/32',
  '2405:b500::/32',
  '2405:8100::/32',
  '2a06:98c0::/29',
  '2c0f:f248::/32',
])
// Addresses Vercel has used for apex/www records. Used only by the final no-vercel rule.
const OLD_HOST_V4 = Object.freeze(['216.198.79.0/24', '64.29.17.0/24', '76.76.21.0/24'])

function v4ToInt(ip) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip)
  if (!m) return null
  const parts = m.slice(1).map(Number)
  if (parts.some((p) => p > 255)) return null
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
}

function v6ToBig(ip) {
  if (!/^[0-9a-f:]+$/i.test(ip) || !ip.includes(':')) return null
  const halves = ip.split('::')
  if (halves.length > 2) return null
  const head = halves[0] === '' ? [] : halves[0].split(':')
  const tail = halves.length === 2 && halves[1] !== '' ? halves[1].split(':') : []
  const missing = 8 - head.length - tail.length
  if (halves.length === 1 ? head.length !== 8 : missing < 1) return null
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill('0'), ...tail]
  if (groups.length !== 8) return null
  let n = 0n
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/i.test(g)) return null
    n = (n << 16n) | BigInt(parseInt(g, 16))
  }
  return n
}

function inCidr(ip, cidr) {
  const [base, bitsText] = cidr.split('/')
  const bits = Number(bitsText)
  if (base.includes(':')) {
    const a = v6ToBig(ip)
    const b = v6ToBig(base)
    if (a === null || b === null) return false
    const shift = BigInt(128 - bits)
    return a >> shift === b >> shift
  }
  const a = v4ToInt(ip)
  const b = v4ToInt(base)
  if (a === null || b === null) return false
  if (bits === 0) return true
  const mask = (0xffffffff << (32 - bits)) >>> 0
  return (a & mask) >>> 0 === (b & mask) >>> 0
}

/** True when `ip` (v4 or v6 text) lies inside Cloudflare's published proxy ranges. */
export function inCloudflareRange(ip) {
  const text = String(ip).trim().toLowerCase()
  return (text.includes(':') ? CF_V6 : CF_V4).some((c) => inCidr(text, c))
}

function inVercelRange(ip) {
  return !String(ip).includes(':') && OLD_HOST_V4.some((c) => inCidr(String(ip).trim(), c))
}

/** dig text -> [{ name, ttl, type, data }]. Lowercase, trailing dot stripped, TXT chunks joined. */
export function parseDig(text) {
  const out = []
  for (const raw of String(text).split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith(';')) continue
    const m = /^(\S+)\s+(\d+)\s+IN\s+(\S+)\s+(.*)$/.exec(line)
    if (!m) continue
    let data = m[4].trim()
    if (m[3] === 'TXT') {
      data = [...data.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((x) => x[1]).join('')
    } else {
      data = data.replace(/\.$/, '').toLowerCase()
    }
    out.push({ name: m[1].replace(/\.$/, '').toLowerCase(), ttl: Number(m[2]), type: m[3], data })
  }
  return out
}

const ok = (reason = 'ok') => ({ pass: true, reason })
const bad = (reason) => ({ pass: false, reason })

const normData = (type, data) => (type === 'TXT' ? String(data) : String(data).toLowerCase().replace(/\.$/, ''))
const ofType = (records, type, fqdn) => records.filter((r) => r.type === type && (!fqdn || r.name === fqdn))
const sameSet = (a, b) => a.length === b.length && a.every((x, i) => x === b[i])

/** An empty answer only counts as "absent" when the server also sent its SOA (a real negative answer). */
export function hasNegativeProof(records) {
  return records.some((r) => r.type === 'SOA')
}

export function soaSerial(records) {
  const soa = records.find((r) => r.type === 'SOA')
  if (!soa) return null
  const serial = soa.data.split(/\s+/)[2]
  return serial && /^\d+$/.test(serial) ? serial : null
}

/** Judge one server's records against one expectation. Returns { pass, reason }. */
export function judge(expect, records) {
  switch (expect.kind) {
    case 'exact': {
      const got = ofType(records, expect.type, expect.fqdn)
        .map((r) => normData(expect.type, r.data))
        .sort()
      const want = expect.values.map((v) => normData(expect.type, v)).sort()
      if (sameSet(got, want)) return ok()
      return bad(`want [${want.join(', ')}] got [${got.join(', ')}]`)
    }
    case 'txt-prefix': {
      const hit = ofType(records, 'TXT', expect.fqdn).find(
        (r) => r.data.startsWith(expect.prefix) && (!expect.mustContain || r.data.includes(expect.mustContain)),
      )
      if (hit) return ok()
      return bad(`no TXT starting "${expect.prefix}"${expect.mustContain ? ` containing "${expect.mustContain}"` : ''}`)
    }
    case 'cloudflare-proxied': {
      const cnames = ofType(records, 'CNAME', expect.fqdn)
      if (cnames.length > 0) return bad(`answer is a CNAME to ${cnames.map((r) => r.data).join(', ')}`)
      const addrs = ofType(records, expect.type, expect.fqdn)
      if (addrs.length === 0) return bad(`no ${expect.type} records`)
      const outside = addrs.filter((r) => !inCloudflareRange(r.data))
      if (outside.length > 0) return bad(`outside Cloudflare ranges: ${outside.map((r) => r.data).join(', ')}`)
      return ok()
    }
    case 'absent': {
      const found = ofType(records, expect.type, expect.fqdn)
      if (found.length === 0) return ok()
      return bad(`${expect.type} present: ${found.map((r) => r.data).join(', ')}`)
    }
    case 'no-vercel': {
      const types = expect.types ?? []
      const hits = records.filter((r) => types.includes(r.type) && (!expect.fqdn || r.name === expect.fqdn))
      const vercel = hits.filter(
        (r) => /vercel|vc-domain-verify/i.test(r.data) || ((r.type === 'A') && inVercelRange(r.data)),
      )
      if (vercel.length === 0) return ok()
      return bad(`vercel target remains: ${vercel.map((r) => `${r.type} ${r.data}`).join(', ')}`)
    }
    case 'soa-equal':
      return bad('soa-equal needs both servers (use judgeBoth)')
    default:
      throw new Error(`unknown expectation kind ${expect.kind}`)
  }
}

function signature(expect, records) {
  const types = expect.types ?? [expect.type]
  return records
    .filter((r) => types.includes(r.type) && (!expect.fqdn || r.name === expect.fqdn))
    .map((r) => `${r.type} ${normData(r.type, r.data)}`)
    .sort()
}

/** PASS only if jen AND brett pass and return the same data set. */
export function judgeBoth(expect, { jen, brett }) {
  if (expect.kind === 'soa-equal') {
    const a = soaSerial(jen)
    const b = soaSerial(brett)
    if (a === null || b === null) return bad(`SOA serial missing (jen ${a ?? 'none'}, brett ${b ?? 'none'})`)
    return a === b ? ok(`serial ${a}`) : bad(`SOA serial differs: jen ${a}, brett ${b}`)
  }
  const j = judge(expect, jen)
  const b = judge(expect, brett)
  if (!j.pass || !b.pass) {
    return {
      pass: false,
      reason: [!j.pass ? `jen: ${j.reason}` : null, !b.pass ? `brett: ${b.reason}` : null].filter(Boolean).join('; '),
      jen: j,
      brett: b,
    }
  }
  if (!sameSet(signature(expect, jen), signature(expect, brett))) {
    return { pass: false, reason: 'jen and brett return different data (they differ)', jen: j, brett: b }
  }
  return { pass: true, reason: 'ok', jen: j, brett: b }
}

const fq = (label) => (label === '@' ? ZONE : `${label}.${ZONE}`)
const stripDot = (s) => String(s).trim().toLowerCase().replace(/\.$/, '')

function registryRules() {
  return [
    { scope: 'registry', fqdn: ZONE, type: 'NS', kind: 'exact', values: [...CLOUDFLARE_NS] },
    { scope: 'registry', fqdn: ZONE, type: 'DS', kind: 'absent' },
  ]
}

function resendRules(resendMx, dkimValue) {
  return [
    { scope: 'zone', fqdn: fq('send'), type: 'MX', kind: 'exact', values: [`10 ${stripDot(resendMx)}`] },
    { scope: 'zone', fqdn: fq('send'), type: 'TXT', kind: 'exact', values: ['v=spf1 include:amazonses.com ~all'] },
    { scope: 'zone', fqdn: fq('resend._domainkey'), type: 'TXT', kind: 'exact', values: [String(dkimValue).trim()] },
    {
      scope: 'zone',
      fqdn: fq('_dmarc'),
      type: 'TXT',
      kind: 'txt-prefix',
      prefix: 'v=DMARC1; p=none',
      mustContain: 'rua=mailto:',
    },
  ]
}

/**
 * Expected-record table for a phase. options: { withResend, resendMx, dkimValue }.
 * The phase `resend` always includes the Resend/DMARC records; any other phase only when
 * options.withResend is true. Both values are then required.
 */
export function expectedFor(phase, options = {}) {
  if (!PHASES.includes(phase)) throw new Error(`unknown phase "${phase}" (expected one of ${PHASES.join(', ')})`)
  const rules = registryRules()
  if (phase === 'ns') return rules

  const wantResend = phase === 'resend' || options.withResend === true
  if (wantResend) {
    if (!options.resendMx) throw new Error('Resend records need the MX host (resendMx)')
    if (!options.dkimValue) throw new Error('Resend records need the DKIM value (dkimValue)')
  }

  rules.push({ scope: 'zone', fqdn: ZONE, type: 'SOA', kind: 'soa-equal' })
  rules.push({ scope: 'zone', fqdn: ZONE, type: 'A', kind: 'cloudflare-proxied' })
  rules.push({ scope: 'zone', fqdn: ZONE, type: 'AAAA', kind: 'cloudflare-proxied' })
  if (phase === 'post-flip' || phase === 'final') {
    rules.push({ scope: 'zone', fqdn: fq('www'), type: 'A', kind: 'cloudflare-proxied' })
  } else {
    rules.push({ scope: 'zone', fqdn: fq('www'), type: 'CNAME', kind: 'exact', values: [OLD_HOST_TARGET] })
  }
  rules.push({ scope: 'zone', fqdn: fq('media'), type: 'A', kind: 'cloudflare-proxied' })
  if (wantResend) rules.push(...resendRules(options.resendMx, options.dkimValue))
  if (phase === 'final') {
    for (const label of ['www', '@', 'media', 'send', '_dmarc', 'resend._domainkey']) {
      rules.push({
        scope: 'zone',
        fqdn: fq(label),
        kind: 'no-vercel',
        types: ['A', 'AAAA', 'CNAME', 'MX', 'TXT'],
      })
    }
  }
  return rules
}
