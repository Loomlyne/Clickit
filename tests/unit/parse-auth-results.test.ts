import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { parseAuthResults } from '../../scripts/cutover/parse-auth-results.mjs'

// Public header text with synthetic b= values. No secret here.
const DOMAIN = 'clickitstory.ae'
const CLI = fileURLToPath(new URL('../../scripts/cutover/parse-auth-results.mjs', import.meta.url))

const GMAIL_PASS = `Authentication-Results: mx.google.com;
       dkim=pass header.i=@clickitstory.ae header.s=resend header.b=AbCdEf12;
       dkim=pass header.i=@amazonses.com header.s=abc123 header.b=ZyXwVu98;
       spf=pass (google.com: domain of 0102abcd@send.clickitstory.ae designates 54.240.1.2 as permitted sender) smtp.mailfrom=0102abcd@send.clickitstory.ae;
       dmarc=pass (p=NONE sp=NONE dis=NONE) header.from=clickitstory.ae
`

test('a Gmail-style block with all three passing yields ok', () => {
  const r = parseAuthResults(GMAIL_PASS, { domain: DOMAIN })
  assert.equal(r.spf, 'PASS')
  assert.equal(r.dkim, 'PASS')
  assert.equal(r.dmarc, 'PASS')
  assert.equal(r.ok, true)
  assert.deepEqual(r.reasons, [])
  assert.equal(r.dkimDomain, 'clickitstory.ae')
})

test('dkim=pass for another domain only (amazonses.com) is FAIL: not aligned', () => {
  const text = `Authentication-Results: mx.google.com;
       dkim=pass header.i=@amazonses.com header.s=abc123 header.b=ZyXwVu98;
       spf=pass smtp.mailfrom=0102@send.clickitstory.ae;
       dmarc=pass header.from=clickitstory.ae`
  const r = parseAuthResults(text, { domain: DOMAIN })
  assert.equal(r.dkim, 'FAIL')
  assert.equal(r.ok, false)
  assert.ok(r.reasons.some((x: string) => x.includes('amazonses.com')))
})

test('header.d is honoured and wins over a different header.i', () => {
  const ok = parseAuthResults(
    'Authentication-Results: mx.example; dkim=pass header.d=clickitstory.ae header.i=@other.example; spf=pass; dmarc=pass header.from=clickitstory.ae',
    { domain: DOMAIN },
  )
  assert.equal(ok.dkim, 'PASS')
  const bad = parseAuthResults(
    'Authentication-Results: mx.example; dkim=pass header.d=other.example header.i=@clickitstory.ae; spf=pass; dmarc=pass header.from=clickitstory.ae',
    { domain: DOMAIN },
  )
  assert.equal(bad.dkim, 'FAIL')
})

test('a look-alike domain does not count as aligned', () => {
  for (const d of ['clickitstory.ae.evil.example', 'notclickitstory.ae', 'send.clickitstory.ae']) {
    const r = parseAuthResults(
      `Authentication-Results: mx.example; dkim=pass header.d=${d}; spf=pass; dmarc=pass header.from=clickitstory.ae`,
      { domain: DOMAIN },
    )
    assert.equal(r.dkim, 'FAIL', d)
  }
})

test('folded continuation lines are joined before parsing', () => {
  const folded = [
    'Authentication-Results: mx.google.com;',
    '\tdkim=pass',
    '\t header.i=@clickitstory.ae header.s=resend;',
    '    spf=pass smtp.mailfrom=a@send.clickitstory.ae;',
    '  dmarc=pass',
    '    header.from=clickitstory.ae',
  ].join('\r\n')
  const r = parseAuthResults(folded, { domain: DOMAIN })
  assert.equal(r.ok, true)
})

test('continuation lines that lost their indentation in the paste still count', () => {
  const flat = [
    'Authentication-Results: mx.google.com;',
    'dkim=pass header.i=@clickitstory.ae header.s=resend;',
    'spf=pass smtp.mailfrom=a@send.clickitstory.ae;',
    'dmarc=pass header.from=clickitstory.ae',
    'Received: by 2002:a05:6a00:0:0:0:0:0 with SMTP id x;',
    ' dkim=fail header.i=@clickitstory.ae',
  ].join('\n')
  const r = parseAuthResults(flat, { domain: DOMAIN })
  assert.equal(r.ok, true, 'the Received header after it must not leak in')
})

test('several Authentication-Results headers: the topmost decides', () => {
  const text = `Authentication-Results: mx.google.com;
       dkim=pass header.i=@clickitstory.ae;
       spf=pass smtp.mailfrom=a@send.clickitstory.ae;
       dmarc=fail (p=NONE) header.from=clickitstory.ae
Authentication-Results: other.example;
       dkim=pass header.i=@clickitstory.ae;
       spf=pass;
       dmarc=pass header.from=clickitstory.ae`
  const r = parseAuthResults(text, { domain: DOMAIN })
  assert.equal(r.dmarc, 'FAIL')
  assert.equal(r.ok, false)
})

test('ARC-Authentication-Results is ignored, even when it comes first', () => {
  const text = `ARC-Authentication-Results: i=1; mx.google.com;
       dkim=fail header.i=@clickitstory.ae;
       spf=fail;
       dmarc=fail header.from=clickitstory.ae
Authentication-Results: mx.google.com;
       dkim=pass header.i=@clickitstory.ae;
       spf=pass smtp.mailfrom=a@send.clickitstory.ae;
       dmarc=pass header.from=clickitstory.ae`
  assert.equal(parseAuthResults(text, { domain: DOMAIN }).ok, true)
  const onlyArc = parseAuthResults(
    'ARC-Authentication-Results: i=1; mx.google.com; dkim=pass header.i=@clickitstory.ae; spf=pass; dmarc=pass header.from=clickitstory.ae',
    { domain: DOMAIN },
  )
  assert.equal(onlyArc.ok, false)
  assert.ok(onlyArc.reasons.some((x: string) => /Authentication-Results/.test(x)))
})

test('dmarc=fail gives ok false with the reason', () => {
  const r = parseAuthResults(
    'Authentication-Results: mx.example; dkim=pass header.i=@clickitstory.ae; spf=pass; dmarc=fail (p=NONE) header.from=clickitstory.ae',
    { domain: DOMAIN },
  )
  assert.equal(r.ok, false)
  assert.equal(r.dmarc, 'FAIL')
  assert.equal(r.spf, 'PASS')
  assert.ok(r.reasons.some((x: string) => /dmarc/i.test(x)))
})

test('a missing mechanism is FAIL with a reason', () => {
  const r = parseAuthResults('Authentication-Results: mx.example; dkim=pass header.i=@clickitstory.ae; dmarc=pass header.from=clickitstory.ae', {
    domain: DOMAIN,
  })
  assert.equal(r.spf, 'FAIL')
  assert.equal(r.ok, false)
  assert.ok(r.reasons.some((x: string) => /spf.*missing/i.test(x)))
})

test('softfail, neutral, none and temperror are all FAIL', () => {
  for (const result of ['softfail', 'neutral', 'none', 'temperror', 'permerror']) {
    const r = parseAuthResults(
      `Authentication-Results: mx.example; dkim=pass header.i=@clickitstory.ae; spf=${result}; dmarc=pass header.from=clickitstory.ae`,
      { domain: DOMAIN },
    )
    assert.equal(r.spf, 'FAIL', result)
    assert.equal(r.ok, false, result)
  }
})

test('dmarc pass for a different From domain is not proof for this domain', () => {
  const r = parseAuthResults(
    'Authentication-Results: mx.example; dkim=pass header.i=@clickitstory.ae; spf=pass; dmarc=pass header.from=other.example',
    { domain: DOMAIN },
  )
  assert.equal(r.dmarc, 'FAIL')
})

test('empty or unrelated text fails without throwing', () => {
  for (const text of ['', '   \n', 'Subject: hello\nFrom: a@b.example']) {
    const r = parseAuthResults(text, { domain: DOMAIN })
    assert.equal(r.ok, false)
    assert.equal(r.spf, 'FAIL')
    assert.equal(r.dkim, 'FAIL')
    assert.equal(r.dmarc, 'FAIL')
    assert.ok(r.reasons.length > 0)
  }
})

test('a paste with the results but without the header name is accepted', () => {
  const r = parseAuthResults(
    `mx.google.com;
       dkim=pass header.i=@clickitstory.ae;
       spf=pass smtp.mailfrom=a@send.clickitstory.ae;
       dmarc=pass header.from=clickitstory.ae`,
    { domain: DOMAIN },
  )
  assert.equal(r.ok, true)
})

test('case differences in names and results do not matter', () => {
  const r = parseAuthResults(
    'AUTHENTICATION-RESULTS: mx.example; DKIM=PASS HEADER.I=@ClickitStory.AE; SPF=Pass; DMARC=PASS HEADER.FROM=CLICKITSTORY.AE',
    { domain: DOMAIN },
  )
  assert.equal(r.ok, true)
})

// ---- CLI

test('CLI: a passing block prints the lines and MAIL-02: PASS with exit 0', () => {
  const out = execFileSync(process.execPath, [CLI], { input: GMAIL_PASS, encoding: 'utf8' })
  assert.match(out, /^SPF: PASS$/m)
  assert.match(out, /^DKIM: PASS \(d=clickitstory\.ae\)$/m)
  assert.match(out, /^DMARC: PASS$/m)
  assert.match(out, /^MAIL-02: PASS$/m)
})

test('CLI: a failing block prints MAIL-02: FAIL, the reason and exits 1', () => {
  const input = 'Authentication-Results: mx.example; dkim=pass header.i=@clickitstory.ae; spf=pass; dmarc=fail header.from=clickitstory.ae\n'
  const r = spawnSync(process.execPath, [CLI], { input, encoding: 'utf8' })
  assert.equal(r.status, 1)
  assert.match(r.stdout, /^DMARC: FAIL$/m)
  assert.match(r.stdout, /^MAIL-02: FAIL$/m)
  assert.doesNotMatch(r.stdout, /MAIL-02: PASS/)
})

test('CLI: empty stdin exits 1', () => {
  const r = spawnSync(process.execPath, [CLI], { input: '', encoding: 'utf8' })
  assert.equal(r.status, 1)
  assert.match(r.stdout, /MAIL-02: FAIL/)
})
