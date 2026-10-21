import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseDig,
  judge,
  judgeBoth,
  expectedFor,
  inCloudflareRange,
  hasNegativeProof,
  PHASES,
  OLD_HOST_TARGET,
} from '../../scripts/cutover/dns-check-core.mjs'
import { run, parseArgs, USAGE } from '../../scripts/cutover/dns-check.mjs'

type Rule = { scope: string; fqdn: string; type?: string; kind: string; values: string[]; prefix?: string; mustContain?: string }

// Captured dig text (public DNS data only, 2026-10-20/21). No network in these tests.

const APEX_A = `clickitstory.ae.\t300\tIN\tA\t172.67.171.221
clickitstory.ae.\t300\tIN\tA\t104.21.29.215
`
const APEX_AAAA = `clickitstory.ae.\t300\tIN\tAAAA\t2606:4700:3032::6815:1dd7
clickitstory.ae.\t300\tIN\tAAAA\t2606:4700:3034::ac43:abdd
`
const WWW_CNAME_VERCEL = `www.clickitstory.ae.\t300\tIN\tCNAME\tba211fb55cf67415.vercel-dns-017.com.
`
const NS_REFERRAL = `clickitstory.ae.\t3600\tIN\tNS\tbrett.ns.cloudflare.com.
clickitstory.ae.\t3600\tIN\tNS\tjen.ns.cloudflare.com.
`
const DS_NEGATIVE = `ae.\t600\tIN\tSOA\tns1.aedns.ae. hostmaster.aeda.ae. 2026102001 1800 900 604800 600
`
const SOA_JEN = `clickitstory.ae.\t1800\tIN\tSOA\tjen.ns.cloudflare.com. dns.cloudflare.com. 2417983238 10000 2400 604800 1800
`
const SOA_BRETT = SOA_JEN.replace('jen.ns', 'brett.ns')
const DMARC_SPLIT = `_dmarc.clickitstory.ae.\t300\tIN\tTXT\t"v=DMARC1; " "p=none; rua=mailto:dmarc@clickitstory.ae"
`

// ---------------------------------------------------------------- parseDig

test('parseDig joins split TXT chunks into one string', () => {
  const recs = parseDig(DMARC_SPLIT)
  assert.equal(recs.length, 1)
  assert.equal(recs[0].type, 'TXT')
  assert.equal(recs[0].data, 'v=DMARC1; p=none; rua=mailto:dmarc@clickitstory.ae')
  assert.equal(recs[0].name, '_dmarc.clickitstory.ae')
  assert.equal(recs[0].ttl, 300)
})

test('parseDig reads NS answers from the AUTHORITY section of a referral, ignoring comments', () => {
  const text = `;; AUTHORITY SECTION:\n${NS_REFERRAL}\n; comment line\n`
  const recs = parseDig(text)
  assert.deepEqual(
    recs.map((r) => r.data).sort(),
    ['brett.ns.cloudflare.com', 'jen.ns.cloudflare.com'],
  )
  assert.ok(recs.every((r) => r.type === 'NS' && r.name === 'clickitstory.ae'))
})

test('parseDig lowercases and strips trailing dots on non-TXT data, keeps TXT case', () => {
  const recs = parseDig('SEND.ClickitStory.ae.\t300\tIN\tMX\t10 Feedback-SMTP.eu-west-1.amazonses.com.\n')
  assert.equal(recs[0].name, 'send.clickitstory.ae')
  assert.equal(recs[0].data, '10 feedback-smtp.eu-west-1.amazonses.com')
})

test('parseDig returns [] for empty or comment-only text', () => {
  assert.deepEqual(parseDig(''), [])
  assert.deepEqual(parseDig(';; nothing here\n'), [])
})

// ------------------------------------------------------ inCloudflareRange

test('inCloudflareRange accepts Cloudflare IPv4 and IPv6 answers', () => {
  assert.equal(inCloudflareRange('104.21.29.215'), true)
  assert.equal(inCloudflareRange('172.67.171.221'), true)
  assert.equal(inCloudflareRange('2606:4700:3032::6815:1dd7'), true)
  assert.equal(inCloudflareRange('2606:4700:3034::ac43:abdd'), true)
})

test('inCloudflareRange refuses Vercel and other addresses', () => {
  assert.equal(inCloudflareRange('216.198.79.1'), false)
  assert.equal(inCloudflareRange('64.29.17.1'), false)
  assert.equal(inCloudflareRange('2001:db8::1'), false)
  assert.equal(inCloudflareRange('not an ip'), false)
  assert.equal(inCloudflareRange('104.15.255.255'), false) // just below 104.16.0.0/13
})

// ------------------------------------------------------------------- judge

const expApexA = { kind: 'exact', type: 'A', fqdn: 'clickitstory.ae', values: ['172.67.171.221', '104.21.29.215'] }

test('judge exact passes on set equality regardless of order', () => {
  const swapped = parseDig(APEX_A.split('\n').filter(Boolean).reverse().join('\n'))
  assert.equal(judge(expApexA, swapped).pass, true)
})

test('judge exact fails on an extra record and on a missing record', () => {
  const extra = parseDig(APEX_A + 'clickitstory.ae.\t300\tIN\tA\t216.198.79.1\n')
  assert.equal(judge(expApexA, extra).pass, false)
  const missing = parseDig('clickitstory.ae.\t300\tIN\tA\t172.67.171.221\n')
  assert.equal(judge(expApexA, missing).pass, false)
  assert.equal(judge(expApexA, []).pass, false)
})

test('judge cloudflare-proxied passes for Cloudflare A records', () => {
  const exp = { kind: 'cloudflare-proxied', type: 'A', fqdn: 'clickitstory.ae' }
  assert.equal(judge(exp, parseDig(APEX_A)).pass, true)
  const expV6 = { kind: 'cloudflare-proxied', type: 'AAAA', fqdn: 'clickitstory.ae' }
  assert.equal(judge(expV6, parseDig(APEX_AAAA)).pass, true)
})

test('judge cloudflare-proxied fails on a CNAME, a non-Cloudflare IP, or no answer', () => {
  const exp = { kind: 'cloudflare-proxied', type: 'A', fqdn: 'www.clickitstory.ae' }
  assert.equal(judge(exp, parseDig(WWW_CNAME_VERCEL)).pass, false)
  assert.equal(
    judge(exp, parseDig('www.clickitstory.ae.\t300\tIN\tA\t216.198.79.1\n')).pass,
    false,
  )
  const mixed = parseDig(
    'www.clickitstory.ae.\t300\tIN\tA\t104.21.29.215\nwww.clickitstory.ae.\t300\tIN\tA\t64.29.17.1\n',
  )
  assert.equal(judge(exp, mixed).pass, false)
  assert.equal(judge(exp, []).pass, false)
})

test('judge txt-prefix passes for a DMARC record with the mailbox, fails without it', () => {
  const exp = {
    kind: 'txt-prefix',
    type: 'TXT',
    fqdn: '_dmarc.clickitstory.ae',
    prefix: 'v=DMARC1; p=none',
    mustContain: 'rua=mailto:',
  }
  assert.equal(judge(exp, parseDig(DMARC_SPLIT)).pass, true)
  const noRua = parseDig('_dmarc.clickitstory.ae.\t300\tIN\tTXT\t"v=DMARC1; p=none"\n')
  assert.equal(judge(exp, noRua).pass, false)
  const quarantine = parseDig('_dmarc.clickitstory.ae.\t300\tIN\tTXT\t"v=DMARC1; p=quarantine; rua=mailto:a@b.c"\n')
  assert.equal(judge(exp, quarantine).pass, false)
})

test('judge absent passes on an empty answer and fails on any record of that type', () => {
  const exp = { kind: 'absent', type: 'DS', fqdn: 'clickitstory.ae' }
  assert.equal(judge(exp, []).pass, true)
  assert.equal(judge(exp, parseDig(DS_NEGATIVE)).pass, true) // an SOA is not a DS
  const ds = parseDig('clickitstory.ae.\t3600\tIN\tDS\t12345 13 2 ABCDEF\n')
  assert.equal(judge(exp, ds).pass, false)
})

test('hasNegativeProof needs an SOA in the answer (a silent timeout is not "absent")', () => {
  assert.equal(hasNegativeProof(parseDig(DS_NEGATIVE)), true)
  assert.equal(hasNegativeProof([]), false)
})

test('judge no-vercel fails on a vercel name or a Vercel address', () => {
  const exp = { kind: 'no-vercel', fqdn: 'www.clickitstory.ae', types: ['CNAME', 'A'] }
  assert.equal(judge(exp, parseDig(WWW_CNAME_VERCEL)).pass, false)
  assert.equal(judge(exp, parseDig('www.clickitstory.ae.\t300\tIN\tA\t216.198.79.1\n')).pass, false)
  assert.equal(judge(exp, parseDig('www.clickitstory.ae.\t300\tIN\tA\t104.21.29.215\n')).pass, true)
  assert.equal(judge(exp, []).pass, true)
})

// --------------------------------------------------------------- judgeBoth

test('judgeBoth passes when jen and brett agree', () => {
  const r = judgeBoth(expApexA, { jen: parseDig(APEX_A), brett: parseDig(APEX_A) })
  assert.equal(r.pass, true)
})

test('judgeBoth fails when jen and brett each pass but return different data', () => {
  const exp = { kind: 'cloudflare-proxied', type: 'A', fqdn: 'clickitstory.ae' }
  const jen = parseDig('clickitstory.ae.\t300\tIN\tA\t104.21.29.215\n')
  const brett = parseDig('clickitstory.ae.\t300\tIN\tA\t172.67.171.221\n')
  assert.equal(judge(exp, jen).pass, true)
  assert.equal(judge(exp, brett).pass, true)
  const r = judgeBoth(exp, { jen, brett })
  assert.equal(r.pass, false)
  assert.match(r.reason, /differ/)
})

test('judgeBoth fails when only one server passes', () => {
  const r = judgeBoth(expApexA, { jen: parseDig(APEX_A), brett: [] })
  assert.equal(r.pass, false)
})

test('judgeBoth soa-equal compares the serial on jen and brett', () => {
  const exp = { kind: 'soa-equal', type: 'SOA', fqdn: 'clickitstory.ae' }
  assert.equal(judgeBoth(exp, { jen: parseDig(SOA_JEN), brett: parseDig(SOA_BRETT) }).pass, true)
  const behind = SOA_BRETT.replace('2417983238', '2417983237')
  assert.equal(judgeBoth(exp, { jen: parseDig(SOA_JEN), brett: parseDig(behind) }).pass, false)
  assert.equal(judgeBoth(exp, { jen: parseDig(SOA_JEN), brett: [] }).pass, false)
})

// -------------------------------------------------------------- expectedFor

const RESEND_OPTS = { resendMx: 'feedback-smtp.eu-west-1.amazonses.com', dkimValue: 'p=MIGfMA0GCSqGSIb3DQEB' }
const find = (table: Rule[], fqdn: string, type: string, scope?: string) =>
  table.filter((e) => e.fqdn === fqdn && (e.type === type || e.kind === type) && (!scope || e.scope === scope))

test('resend includes registry rules', () => {
  const t = expectedFor('resend', RESEND_OPTS)
  const ns = find(t, 'clickitstory.ae', 'NS', 'registry')
  assert.equal(ns.length, 1)
  assert.deepEqual([...ns[0].values].sort(), ['brett.ns.cloudflare.com', 'jen.ns.cloudflare.com'])
  assert.equal(find(t, 'clickitstory.ae', 'DS', 'registry')[0].kind, 'absent')
  assert.ok(t.some((e: Rule) => e.kind === 'soa-equal'))
  assert.equal(find(t, 'clickitstory.ae', 'A')[0].kind, 'cloudflare-proxied')
  assert.equal(find(t, 'clickitstory.ae', 'AAAA')[0].kind, 'cloudflare-proxied')
  const www = find(t, 'www.clickitstory.ae', 'CNAME')[0]
  assert.equal(www.kind, 'exact')
  assert.deepEqual(www.values, [OLD_HOST_TARGET])
  assert.equal(find(t, 'media.clickitstory.ae', 'A')[0].kind, 'cloudflare-proxied')
})

test('resend phase has the four Resend/DMARC records with the supplied MX and DKIM', () => {
  const t = expectedFor('resend', RESEND_OPTS)
  const mx = find(t, 'send.clickitstory.ae', 'MX')[0]
  assert.deepEqual(mx.values, ['10 feedback-smtp.eu-west-1.amazonses.com'])
  const spf = find(t, 'send.clickitstory.ae', 'TXT')[0]
  assert.deepEqual(spf.values, ['v=spf1 include:amazonses.com ~all'])
  const dkim = find(t, 'resend._domainkey.clickitstory.ae', 'TXT')[0]
  assert.equal(dkim.kind, 'exact')
  assert.deepEqual(dkim.values, ['p=MIGfMA0GCSqGSIb3DQEB'])
  const dmarc = find(t, '_dmarc.clickitstory.ae', 'TXT')[0]
  assert.equal(dmarc.kind, 'txt-prefix')
  assert.equal(dmarc.prefix, 'v=DMARC1; p=none')
  assert.equal(dmarc.mustContain, 'rua=mailto:')
})

test('expectedFor resend and withResend refuse missing values', () => {
  assert.throws(() => expectedFor('resend'), /resend/i)
  assert.throws(() => expectedFor('resend', { resendMx: 'x.example' }), /dkim/i)
  assert.throws(() => expectedFor('resend', { dkimValue: 'p=abc' }), /mx/i)
  assert.throws(() => expectedFor('pre-flip', { withResend: true }), /resend/i)
  assert.throws(() => expectedFor('post-flip', { withResend: true, resendMx: 'x.example' }), /dkim/i)
})

test('expectedFor without withResend has no Resend records; with it, all four', () => {
  const plain = expectedFor('pre-flip')
  assert.equal(find(plain, 'send.clickitstory.ae', 'MX').length, 0)
  assert.equal(find(plain, '_dmarc.clickitstory.ae', 'TXT').length, 0)
  const withR = expectedFor('pre-flip', { withResend: true, ...RESEND_OPTS })
  assert.equal(find(withR, 'send.clickitstory.ae', 'MX').length, 1)
  assert.equal(find(withR, 'send.clickitstory.ae', 'TXT').length, 1)
  assert.equal(find(withR, 'resend._domainkey.clickitstory.ae', 'TXT').length, 1)
  assert.equal(find(withR, '_dmarc.clickitstory.ae', 'TXT').length, 1)
})

test('www is the exact Vercel CNAME in pre-flip and rollback, proxied in post-flip and final', () => {
  for (const phase of ['pre-flip', 'rollback']) {
    const www = find(expectedFor(phase), 'www.clickitstory.ae', 'CNAME')
    assert.equal(www.length, 1, phase)
    assert.equal(www[0].kind, 'exact', phase)
  }
  assert.deepEqual(expectedFor('rollback'), expectedFor('pre-flip'))
  for (const phase of ['post-flip', 'final']) {
    const www = find(expectedFor(phase), 'www.clickitstory.ae', 'A')
    assert.equal(www.length, 1, phase)
    assert.equal(www[0].kind, 'cloudflare-proxied', phase)
    assert.equal(find(expectedFor(phase), 'www.clickitstory.ae', 'CNAME').length, 0, phase)
  }
})

test('final adds a no-vercel rule over www, @, media, send, _dmarc, resend._domainkey', () => {
  const rules = expectedFor('final').filter((e: Rule) => e.kind === 'no-vercel')
  assert.deepEqual(
    rules.map((r: Rule) => r.fqdn).sort(),
    [
      '_dmarc.clickitstory.ae',
      'clickitstory.ae',
      'media.clickitstory.ae',
      'resend._domainkey.clickitstory.ae',
      'send.clickitstory.ae',
      'www.clickitstory.ae',
    ],
  )
  assert.equal(expectedFor('pre-flip').filter((e: Rule) => e.kind === 'no-vercel').length, 0)
})

test('ns phase has the registry and DS rules only', () => {
  const t = expectedFor('ns')
  assert.ok(t.length > 0)
  assert.ok(t.every((e: Rule) => e.scope === 'registry'))
  assert.deepEqual(t.map((e: Rule) => e.type).sort(), ['DS', 'NS'])
})

test('expectedFor refuses an unknown phase; PHASES lists the six', () => {
  assert.throws(() => expectedFor('nope'), /phase/i)
  assert.deepEqual([...PHASES].sort(), ['final', 'ns', 'post-flip', 'pre-flip', 'resend', 'rollback'])
})

// ------------------------------------------------------------- CLI + runner

test('parseArgs requires --phase and refuses --with-resend or phase resend without both values', () => {
  assert.throws(() => parseArgs([]), /--phase/)
  assert.throws(() => parseArgs(['--phase', 'resend']), /resend-mx/)
  assert.throws(() => parseArgs(['--phase', 'pre-flip', '--with-resend']), /--resend-mx/)
  assert.throws(() => parseArgs(['--phase', 'pre-flip', '--with-resend', '--resend-mx', 'x.example']), /--dkim-file/)
  assert.throws(() => parseArgs(['--phase', 'bogus']), /phase/)
  assert.throws(() => parseArgs(['--phase', 'ns', '--nope']), /unknown/)
  const ok = parseArgs(['--phase', 'pre-flip', '--json'])
  assert.equal(ok.phase, 'pre-flip')
  assert.equal(ok.json, true)
  assert.match(USAGE, /pre-flip/)
})

// A fake dig that serves the "pre-flip" world; overrides model failures.
function fakeDig(overrides: Record<string, string | Error> = {}) {
  const world: Record<string, string> = {
    'NS ae.': 'ns1.aedns.ae.\nns2.aedns.ae.\nnsext-pch.aedns.ae.\nns4.apnic.net.\n',
    'NS clickitstory.ae': NS_REFERRAL,
    'DS clickitstory.ae': DS_NEGATIVE,
    'SOA clickitstory.ae': SOA_JEN,
    'A clickitstory.ae': APEX_A,
    'AAAA clickitstory.ae': APEX_AAAA,
    'CNAME www.clickitstory.ae': WWW_CNAME_VERCEL,
    'A media.clickitstory.ae': APEX_A.replaceAll('clickitstory.ae.', 'media.clickitstory.ae.'),
  }
  const calls: string[][] = []
  const dig = async (args: string[]) => {
    calls.push(args)
    const server = args.find((a) => a.startsWith('@'))?.slice(1) ?? ''
    const type = args.find((a) => /^[A-Z]+$/.test(a)) as string
    const name = args.find((a) => /[a-z]/.test(a) && !a.startsWith('+') && !a.startsWith('@')) as string
    const key = `${type} ${name}`
    const hit = overrides[`${key} @${server}`] ?? overrides[key] ?? world[key]
    if (hit instanceof Error) throw hit
    return hit ?? ''
  }
  return { dig, calls }
}

function capture() {
  const lines: string[] = []
  return { lines, out: (s: string) => lines.push(s) }
}

test('run pre-flip prints ALL PASS and returns 0 against a healthy fake world', async () => {
  const { dig, calls } = fakeDig()
  const { lines, out } = capture()
  const failures = await run({ phase: 'pre-flip', json: false }, { dig, out })
  assert.equal(failures, 0, lines.join('\n'))
  assert.ok(lines.some((l) => l === 'dns-check pre-flip: ALL PASS'))
  assert.ok(lines.some((l) => l.startsWith('PASS pre-flip www.clickitstory.ae CNAME @jen.ns.cloudflare.com')))
  assert.ok(lines.some((l) => l.startsWith('PASS pre-flip clickitstory.ae NS @ns1.aedns.ae')))
  // every call is an argument array with the agreed options and no shell metacharacters in names
  for (const args of calls.filter((a) => a[0] !== 'NS' || a[1] !== 'ae.')) {
    assert.ok(args.includes('+norec') && args.includes('+time=5') && args.includes('+tries=2'))
  }
})

test('run fails and prints the stop line when a registry server still lists extra nameservers', async () => {
  const stale = NS_REFERRAL + 'clickitstory.ae.\t3600\tIN\tNS\tignat.ns.cloudflare.com.\n'
  const { dig } = fakeDig({ 'NS clickitstory.ae @nsext-pch.aedns.ae': stale })
  const { lines, out } = capture()
  const failures = await run({ phase: 'ns', json: false }, { dig, out })
  assert.ok(failures > 0)
  assert.ok(lines.some((l) => l.startsWith('FAIL ns clickitstory.ae NS @nsext-pch.aedns.ae')))
  assert.ok(lines.includes('do not change NS / do not press Verify / do not flip'))
})

test('run treats a dig error or a silent timeout as FAIL, never as "absent" PASS', async () => {
  const boom = fakeDig({ 'DS clickitstory.ae @ns2.aedns.ae': new Error('dig timed out') })
  const a = capture()
  assert.ok((await run({ phase: 'ns', json: false }, { dig: boom.dig, out: a.out })) > 0)
  assert.ok(a.lines.some((l) => l.startsWith('FAIL ns clickitstory.ae DS @ns2.aedns.ae')))

  const silent = fakeDig({ 'DS clickitstory.ae @ns2.aedns.ae': '' })
  const b = capture()
  assert.ok((await run({ phase: 'ns', json: false }, { dig: silent.dig, out: b.out })) > 0)
})

test('run fails when the ae. registry list is empty', async () => {
  const { dig } = fakeDig({ 'NS ae.': '' })
  const { lines, out } = capture()
  assert.ok((await run({ phase: 'ns', json: false }, { dig, out })) > 0)
  assert.ok(lines.includes('do not change NS / do not press Verify / do not flip'))
})

test('run post-flip fails while www is still the Vercel CNAME (jen/brett both queried)', async () => {
  const { dig, calls } = fakeDig({
    'A www.clickitstory.ae': WWW_CNAME_VERCEL,
  })
  const { lines, out } = capture()
  const failures = await run({ phase: 'post-flip', json: false }, { dig, out })
  assert.ok(failures > 0)
  assert.ok(lines.some((l) => l.startsWith('FAIL post-flip www.clickitstory.ae A')))
  const servers = new Set(calls.map((a) => a.find((x) => x.startsWith('@'))))
  assert.ok(servers.has('@jen.ns.cloudflare.com') && servers.has('@brett.ns.cloudflare.com'))
})
