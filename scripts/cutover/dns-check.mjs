// G-DNS: read-only DNS gate for the Phase 3 cutover (plan 03-03, DNS-01, MAIL-02, DNS-04, PLAT-11).
// Asks the .ae registry servers and the zone's own nameservers (jen, brett) with dig, never a
// recursive resolver, and passes a record only when both zone servers pass and agree.
//
// Usage:
//   node scripts/cutover/dns-check.mjs --phase ns
//   node scripts/cutover/dns-check.mjs --phase resend --resend-mx <host> --dkim-file <path>
//   node scripts/cutover/dns-check.mjs --phase pre-flip|post-flip|rollback|final [--with-resend ...]
//
// The registry server list is read at run time from `dig NS ae. +short`. dig is started with an
// argument array (no shell). Any FAIL, any dig error and any silent timeout exits 1.

import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PHASES, ZONE_SERVERS, expectedFor, hasNegativeProof, judge, judgeBoth, parseDig } from './dns-check-core.mjs'

export const STOP_LINE = 'do not change NS / do not press Verify / do not flip'

export const USAGE = `dns-check: read-only DNS gate (dig against the registry, jen and brett)
  --phase <name>          required, one of:
      ns         registry NS list is exactly brett+jen on every .ae server, no DS
      resend     ns rules + apex, www (still Vercel), media, SOA + Resend/DMARC records
                 (G-DNS before pressing Verify in Resend)
      pre-flip   ns rules + apex, media, www = exact Vercel CNAME
      post-flip  same, www must be proxied (Cloudflare addresses, no CNAME)
      rollback   same table as pre-flip (after greying www)
      final      post-flip table + no Vercel target anywhere in the zone
  --with-resend           also check the four Resend/DMARC records in a non-resend phase
  --resend-mx <host>      Resend return-path MX host (dashboard value); needed by --phase resend
                          and --with-resend
  --dkim-file <path>      file holding the public DKIM value (p=...); needed with --resend-mx
  --json                  print one JSON document instead of lines
  --help
Exit 0 only on ALL PASS. On any FAIL: ${STOP_LINE}`

export function parseArgs(argv) {
  const out = { phase: null, withResend: false, resendMx: null, dkimFile: null, json: false, help: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => {
      const v = argv[++i]
      if (v === undefined || v.startsWith('--')) throw new Error(`${a} needs a value`)
      return v
    }
    if (a === '--help' || a === '-h') out.help = true
    else if (a === '--phase') out.phase = next()
    else if (a === '--with-resend') out.withResend = true
    else if (a === '--resend-mx') out.resendMx = next()
    else if (a === '--dkim-file') out.dkimFile = next()
    else if (a === '--json') out.json = true
    else throw new Error(`unknown argument ${a}`)
  }
  if (out.help) return out
  if (!out.phase) throw new Error('--phase is required')
  if (!PHASES.includes(out.phase)) throw new Error(`unknown phase "${out.phase}" (one of ${PHASES.join(', ')})`)
  const needsResend = out.phase === 'resend' || out.withResend
  if (needsResend) {
    const why = out.phase === 'resend' ? '--phase resend' : '--with-resend'
    if (!out.resendMx) throw new Error(`${why} needs --resend-mx <host>`)
    if (!out.dkimFile) throw new Error(`${why} needs --dkim-file <path>`)
  } else if (out.resendMx || out.dkimFile) {
    throw new Error('--resend-mx / --dkim-file are only used with --phase resend or --with-resend')
  }
  return out
}

/** The public DKIM value: surrounding quotes and any whitespace/newlines removed. */
export function readDkimValue(path, readFile = readFileSync) {
  const text = String(readFile(path, 'utf8')).replace(/\s+/g, '').replace(/^"+|"+$/g, '')
  if (text === '') throw new Error(`DKIM file ${path} is empty`)
  return text
}

const DIG_OPTIONS = ['+norec', '+noall', '+answer', '+authority', '+time=5', '+tries=2']

function defaultDig(args) {
  return new Promise((resolve, reject) => {
    execFile('dig', args, { timeout: 30000, maxBuffer: 1024 * 1024 }, (err, stdout) => {
      if (err) reject(err)
      else resolve(String(stdout))
    })
  })
}

const asFailure = (err) => (err instanceof Error ? err.message : String(err)).split('\n')[0]

export function parseServerList(text) {
  const seen = new Set()
  for (const raw of String(text).split('\n')) {
    const host = raw.trim().replace(/\.$/, '').toLowerCase()
    if (/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(host)) seen.add(host)
  }
  return [...seen]
}

/**
 * Run one phase. deps: { dig(args) -> stdout text, out(line), readFile }. Returns the failure count.
 * opts: { phase, withResend, resendMx, dkimFile, json }.
 */
export async function run(opts, deps = {}) {
  const dig = deps.dig ?? defaultDig
  const lines = []
  const results = []
  const emit = (line) => {
    if (opts.json) lines.push(line)
    else (deps.out ?? console.log)(line)
  }

  const resendOptions = {}
  if (opts.phase === 'resend' || opts.withResend) {
    resendOptions.withResend = true
    resendOptions.resendMx = opts.resendMx
    resendOptions.dkimValue = readDkimValue(opts.dkimFile, deps.readFile)
  }
  const table = expectedFor(opts.phase, resendOptions)

  const query = (type, name, server) => dig([...DIG_OPTIONS, type, name, `@${server}`])
  let failures = 0
  const record = (pass, fqdn, type, server, reason) => {
    results.push({ pass, phase: opts.phase, name: fqdn, type, server, reason: pass ? undefined : reason })
    emit(`${pass ? 'PASS' : 'FAIL'} ${opts.phase} ${fqdn} ${type} @${server}${pass ? '' : ` - ${reason}`}`)
  }

  // Registry rules: every server in `dig NS ae.`, read now.
  const registryRules = table.filter((e) => e.scope === 'registry')
  if (registryRules.length > 0) {
    let servers = []
    try {
      servers = parseServerList(await dig(['NS', 'ae.', '+short']))
    } catch (err) {
      servers = []
      record(false, 'ae', 'NS', 'registry-list', `dig failed: ${asFailure(err)}`)
      failures++
    }
    if (servers.length === 0 && failures === 0) {
      record(false, 'ae', 'NS', 'registry-list', 'no registry servers returned for ae.')
      failures++
    }
    for (const rule of registryRules) {
      for (const server of servers) {
        let verdict
        try {
          const records = parseDig(await query(rule.type, rule.fqdn, server))
          verdict = judge(rule, records)
          if (verdict.pass && rule.kind === 'absent' && !hasNegativeProof(records)) {
            verdict = { pass: false, reason: 'no negative answer from the server (no SOA); silence is not proof' }
          }
        } catch (err) {
          verdict = { pass: false, reason: `dig failed: ${asFailure(err)}` }
        }
        record(verdict.pass, rule.fqdn, rule.type, server, verdict.reason)
        if (!verdict.pass) failures++
      }
    }
  }

  // Zone rules: jen and brett, both must pass and agree.
  for (const rule of table.filter((e) => e.scope === 'zone')) {
    const types = rule.types ?? [rule.type]
    const answers = {}
    const errors = {}
    await Promise.all(
      ZONE_SERVERS.map(async (server) => {
        const name = server.split('.')[0]
        const records = []
        for (const type of types) {
          try {
            records.push(...parseDig(await query(type, rule.fqdn, server)))
          } catch (err) {
            errors[name] = asFailure(err)
          }
        }
        answers[name] = records
      }),
    )
    const label = rule.type ?? 'ANY'
    if (Object.keys(errors).length > 0) {
      for (const name of ['jen', 'brett']) {
        if (errors[name]) record(false, rule.fqdn, label, `${name}.ns.cloudflare.com`, `dig failed: ${errors[name]}`)
      }
      record(false, rule.fqdn, label, 'both', 'a zone nameserver did not answer')
      failures++
      continue
    }
    if (rule.kind !== 'soa-equal') {
      for (const name of ['jen', 'brett']) {
        const v = judge(rule, answers[name])
        record(v.pass, rule.fqdn, label, `${name}.ns.cloudflare.com`, v.reason)
      }
    }
    const both = judgeBoth(rule, { jen: answers.jen, brett: answers.brett })
    record(both.pass, rule.fqdn, label, 'both', both.reason)
    if (!both.pass) failures++
  }

  const summary = failures === 0 ? `dns-check ${opts.phase}: ALL PASS` : `dns-check ${opts.phase}: ${failures} FAIL`
  if (opts.json) {
    (deps.out ?? console.log)(
      JSON.stringify({ phase: opts.phase, pass: failures === 0, failures, results, message: failures === 0 ? summary : STOP_LINE }, null, 2),
    )
  } else {
    emit(summary)
    if (failures > 0) emit(STOP_LINE)
  }
  return failures
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  let opts
  try {
    opts = parseArgs(process.argv.slice(2))
  } catch (err) {
    console.error(err.message)
    console.error(USAGE)
    process.exit(1)
  }
  if (opts.help) {
    console.log(USAGE)
    process.exit(0)
  }
  try {
    const failures = await run(opts)
    process.exit(failures === 0 ? 0 : 1)
  } catch (err) {
    console.error(`dns-check error: ${err.message}`)
    console.error(STOP_LINE)
    process.exit(1)
  }
}
