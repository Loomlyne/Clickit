#!/usr/bin/env node
// MAIL-02 judge: reads the Authentication-Results lines of a test mail (Gmail, "Show
// original") and passes only on spf=pass, dkim=pass aligned with the sending domain, and
// dmarc=pass. The lines carry no secret.
//
//   pbpaste | node scripts/cutover/parse-auth-results.mjs
//   node scripts/cutover/parse-auth-results.mjs < /Users/koss/.clickit-checks/p3-auth-results.txt
//
// Rules
//   - Only the topmost Authentication-Results header is read (the one the receiving server
//     added). ARC-Authentication-Results is ignored.
//   - Folded lines (leading whitespace) are joined; so are lines that lost their
//     indentation in the paste, as long as they are not a new "Name:" header.
//   - spf: some spf clause says pass.
//   - dkim: some dkim clause says pass AND its header.d (else the domain of header.i) is
//     exactly the sending domain. A pass for another domain (the SES signature) does not count.
//   - dmarc: some dmarc clause says pass, and header.from, when present, is the sending domain.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const DEFAULT_DOMAIN = 'clickitstory.ae'

const HEADER_START = /^[A-Za-z][A-Za-z0-9-]*:/

/** Unfolded header lines: [{ name, value }] in order of appearance. */
function readHeaders(text) {
  const headers = []
  let current = null
  for (const raw of String(text).replace(/\r\n?/g, '\n').split('\n')) {
    if (raw.trim() === '') {
      current = null
      continue
    }
    const continues = /^\s/.test(raw) || !HEADER_START.test(raw)
    if (continues && current) {
      current.value += ` ${raw.trim()}`
      continue
    }
    const m = raw.match(/^([A-Za-z][A-Za-z0-9-]*):\s*(.*)$/)
    if (m) {
      current = { name: m[1].toLowerCase(), value: m[2].trim() }
      headers.push(current)
    } else {
      // Not header-shaped and nothing to continue: loose text.
      current = { name: '', value: raw.trim() }
      headers.push(current)
    }
  }
  return headers
}

function stripComments(value) {
  let out = value
  let previous
  do {
    previous = out
    out = out.replace(/\([^()]*\)/g, ' ')
  } while (out !== previous)
  return out
}

/** The value of the topmost Authentication-Results header, or null. */
function topmostValue(text) {
  const headers = readHeaders(text)
  const found = headers.find((h) => h.name === 'authentication-results')
  if (found) return found.value
  // A paste of the results without the header name: no "Name:" header anywhere in it.
  const hasNamedHeader = headers.some((h) => h.name !== '')
  if (!hasNamedHeader && headers.length > 0) return headers.map((h) => h.value).join(' ')
  return null
}

function clausesOf(value) {
  const clauses = []
  for (const part of stripComments(value).split(';')) {
    const m = part.match(/^\s*(spf|dkim|dmarc)\s*=\s*([A-Za-z]+)\b(.*)$/is)
    if (!m) continue
    clauses.push({ method: m[1].toLowerCase(), result: m[2].toLowerCase(), props: m[3] })
  }
  return clauses
}

function prop(props, name) {
  const m = props.match(new RegExp(`\\b${name.replace('.', '\\.')}\\s*=\\s*"?([^\\s;"]+)`, 'i'))
  return m ? m[1] : null
}

function dkimDomainOf(props) {
  const d = prop(props, 'header.d')
  if (d) return d.toLowerCase().replace(/^@/, '')
  const i = prop(props, 'header.i')
  if (i) return i.toLowerCase().slice(i.lastIndexOf('@') + 1)
  return null
}

/**
 * @param {string} text pasted Authentication-Results text
 * @param {{ domain?: string }} [options]
 * @returns {{ spf: 'PASS'|'FAIL', dkim: 'PASS'|'FAIL', dmarc: 'PASS'|'FAIL', ok: boolean,
 *             reasons: string[], dkimDomain: string|null }}
 */
export function parseAuthResults(text, { domain = DEFAULT_DOMAIN } = {}) {
  const want = domain.toLowerCase()
  const fail = (reasons) => ({ spf: 'FAIL', dkim: 'FAIL', dmarc: 'FAIL', ok: false, reasons, dkimDomain: null })

  if (String(text ?? '').trim() === '') return fail(['no text: paste the Authentication-Results lines'])
  const value = topmostValue(text)
  if (value === null) return fail(['no Authentication-Results header found (ARC-Authentication-Results does not count)'])

  const clauses = clausesOf(value)
  const reasons = []

  // SPF
  const spfClauses = clauses.filter((c) => c.method === 'spf')
  let spf = 'FAIL'
  if (spfClauses.length === 0) reasons.push('spf missing from Authentication-Results')
  else if (spfClauses.some((c) => c.result === 'pass')) spf = 'PASS'
  else reasons.push(`spf=${spfClauses[0].result}, expected pass`)

  // DKIM
  const dkimClauses = clauses.filter((c) => c.method === 'dkim')
  let dkim = 'FAIL'
  let dkimDomain = null
  if (dkimClauses.length === 0) reasons.push('dkim missing from Authentication-Results')
  else {
    const passing = dkimClauses.filter((c) => c.result === 'pass')
    const aligned = passing.find((c) => dkimDomainOf(c.props) === want)
    if (aligned) {
      dkim = 'PASS'
      dkimDomain = want
    } else if (passing.length > 0) {
      const seen = passing.map((c) => dkimDomainOf(c.props) ?? 'unknown').join(', ')
      dkimDomain = dkimDomainOf(passing[0].props)
      reasons.push(`dkim=pass but for ${seen}, not ${want} (not aligned)`)
    } else {
      reasons.push(`dkim=${dkimClauses[0].result}, expected pass for ${want}`)
    }
  }

  // DMARC
  const dmarcClauses = clauses.filter((c) => c.method === 'dmarc')
  let dmarc = 'FAIL'
  if (dmarcClauses.length === 0) reasons.push('dmarc missing from Authentication-Results')
  else {
    const passing = dmarcClauses.find((c) => c.result === 'pass')
    if (!passing) reasons.push(`dmarc=${dmarcClauses[0].result}, expected pass`)
    else {
      const from = prop(passing.props, 'header.from')
      if (from && from.toLowerCase() !== want) reasons.push(`dmarc=pass but header.from=${from}, not ${want}`)
      else dmarc = 'PASS'
    }
  }

  return { spf, dkim, dmarc, ok: spf === 'PASS' && dkim === 'PASS' && dmarc === 'PASS', reasons, dkimDomain }
}

function main() {
  if (process.stdin.isTTY) {
    console.error('Paste the Authentication-Results lines on stdin, e.g.:')
    console.error('  node scripts/cutover/parse-auth-results.mjs < /Users/koss/.clickit-checks/p3-auth-results.txt')
    console.log('MAIL-02: FAIL')
    process.exitCode = 1
    return
  }
  let text = ''
  try {
    text = readFileSync(0, 'utf8')
  } catch {
    text = ''
  }
  const r = parseAuthResults(text, { domain: DEFAULT_DOMAIN })
  console.log(`SPF: ${r.spf}`)
  console.log(`DKIM: ${r.dkim} (d=${r.dkimDomain ?? '-'})`)
  console.log(`DMARC: ${r.dmarc}`)
  for (const reason of r.reasons) console.log(`reason: ${reason}`)
  console.log(`MAIL-02: ${r.ok ? 'PASS' : 'FAIL'}`)
  process.exitCode = r.ok ? 0 : 1
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
