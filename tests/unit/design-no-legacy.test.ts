import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('../../', import.meta.url).pathname
const SRC = join(ROOT, 'src')

function walk(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

const srcFiles = walk(SRC).filter((f) => /\.(ts|tsx)$/.test(f))
const rel = (f: string) => relative(ROOT, f)

// design-truth.ts documents the old values on purpose (codemod maps).
const BANNED_SCAN_FILES = srcFiles.filter((f) => rel(f) !== 'src/lib/design-truth.ts')

const BANNED = [
  '#0a0a0a',
  '6073ff',
  '7082ff',
  '10131a',
  '11151d',
  'rgba(96,',
  'rgba(96, ',
  'rgba(4,6,10',
  'rgba(8,8,12',
  'rgba(10,10,10',
  'bg-red-500',
]

test('no banned legacy literal in src/ (ts, tsx) or DESIGN.md', () => {
  const targets = [...BANNED_SCAN_FILES, join(ROOT, 'DESIGN.md')]
  const hits: string[] = []
  for (const file of targets) {
    const text = readFileSync(file, 'utf8').toLowerCase()
    for (const literal of BANNED) {
      if (text.includes(literal)) hits.push(`${rel(file)}: ${literal}`)
    }
  }
  assert.deepEqual(hits, [])
})

test('src/styles/admin.css has no border-radius px literal and no hex', () => {
  const css = readFileSync(join(SRC, 'styles/admin.css'), 'utf8')
  assert.doesNotMatch(css, /border-radius:\s*\d+px/)
  assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b/)
})

test('every clickit/no-raw-design-values waiver carries a reason after " -- "', () => {
  const bad: string[] = []
  for (const file of srcFiles) {
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        if (!line.includes('eslint-disable') || !line.includes('clickit/no-raw-design-values')) return
        const m = line.match(/ -- (.+)/)
        if (!m || m[1].trim().length < 3) bad.push(`${rel(file)}:${i + 1}`)
      })
  }
  assert.deepEqual(bad, [])
})

test('no file-wide clickit/no-raw-design-values waiver (next-line only)', () => {
  const bad: string[] = []
  for (const file of srcFiles) {
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        if (/eslint-disable(?!-next-line)\b[^\n]*clickit\/no-raw-design-values/.test(line)) {
          bad.push(`${rel(file)}:${i + 1}`)
        }
      })
  }
  assert.deepEqual(bad, [])
})

test('the guard allowlist is only the three token-source files', () => {
  const cfg = readFileSync(join(ROOT, 'eslint.config.mjs'), 'utf8')
  assert.ok(!cfg.includes("'src/emails/**'"))
  assert.ok(!cfg.includes("'src/lib/mail/templates/**'"))
  const block = cfg.slice(cfg.indexOf('files: [', cfg.indexOf('Allowlist')))
  const files = block.slice(0, block.indexOf(']')).match(/'[^']+'/g)
  assert.deepEqual(files, [
    "'src/lib/brand-colors.ts'",
    "'src/lib/design-truth.ts'",
    "'src/lib/email-tokens.ts'",
  ])
})

test('eslint.config.mjs sets clickit/no-raw-design-values to error for src', () => {
  const cfg = readFileSync(join(ROOT, 'eslint.config.mjs'), 'utf8')
  assert.ok(cfg.includes("'clickit/no-raw-design-values': 'error'"))
  assert.ok(!cfg.includes("'clickit/no-raw-design-values': 'warn'"))
})
