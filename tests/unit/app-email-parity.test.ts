// Parity of the pre-rendered fill path with the direct React path, the plural guard for
// the baked numbers, and the Worker import allow-list (Phase 5, plan 05-11, Task 4;
// controller conditions 2 and 3).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderAppEmail, SUPPORT_REPLY_HOURS } from '../../src/emails/render-app.ts'
import { renderAppEmailDirect } from '../../src/emails/app/direct.ts'
import type { AppEmailCtx, AppEmailRow } from '../../src/emails/app/model.ts'
import { slotsOf } from '../../src/emails/app/template-fill.ts'
import { NEWSLETTER_CONFIRM_TTL_DAYS } from '../../src/server/email/links.ts'
import { parityFixtures, PARITY_CTX } from './helpers/app-email-fixtures.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

/**
 * Known structural text differences between the two paths (html-to-text block spacing
 * around the row block). Each entry names one; any other text difference fails.
 * Empty: the text parts match after whitespace normalisation.
 */
const TEXT_DIFF_ALLOW: { name: string; apply(s: string): string }[] = []

function norm(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

function firstDiff(a: string, b: string): string {
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  return `at ${i}:\n  direct: ${JSON.stringify(a.slice(i, i + 200))}\n  filled: ${JSON.stringify(b.slice(i, i + 200))}`
}

async function compare(label: string, row: AppEmailRow, ctx: AppEmailCtx): Promise<void> {
  const direct = await renderAppEmailDirect(row, ctx)
  const filled = await renderAppEmail(row, ctx)
  assert.equal(filled.subject, direct.subject, `${label}: subject`)
  assert.equal(filled.replyTo, direct.replyTo, `${label}: replyTo`)
  const dh = norm(direct.html)
  const fh = norm(filled.html)
  assert.ok(dh === fh, `${label}: html differs ${firstDiff(dh, fh)}`)
  let dt = norm(direct.text)
  let ft = norm(filled.text)
  for (const allow of TEXT_DIFF_ALLOW) {
    dt = allow.apply(dt)
    ft = allow.apply(ft)
  }
  assert.ok(dt === ft, `${label}: text differs ${firstDiff(dt, ft)}`)
}

test('condition 3: digest parity', async () => {
  const fx = parityFixtures().filter((f) => f.row.kind === 'digest')
  assert.equal(fx.length, 4, 'digest base and more, EN and AR')
  const variants = new Set<string>()
  for (const f of fx) {
    await compare(f.label, f.row, PARITY_CTX)
    const out = await renderAppEmail(f.row, PARITY_CTX)
    variants.add(`${f.row.locale}:${out.html.includes('/my-list"') ? 'more' : 'base'}`)
    // the no-thumbnail row is inside the rendered shows: fewer <img> than logo + shows
    const imgs = (out.html.match(/<img\b/g) ?? []).length
    const shown = Math.min(3, ((f.row.payload as { shows: unknown[] }).shows).length)
    assert.ok(imgs < 1 + shown, `${f.label}: a show renders without a thumbnail`)
  }
  assert.deepEqual([...variants].sort(), ['ar:base', 'ar:more', 'en:base', 'en:more'])
})

test('condition 3: all kinds parity', async () => {
  const fx = parityFixtures().filter((f) => f.row.kind !== 'digest')
  const kinds = new Set(fx.map((f) => `${f.row.kind}:${f.row.locale}`))
  assert.equal(kinds.size, 8, 'four kinds x two locales')
  for (const f of fx) await compare(f.label, f.row, PARITY_CTX)
})

test('condition 2: plural guard', () => {
  const msg = 'plural form changed: update messages/ar.ts (E8 hours / E10 days) and rebuild the templates'
  assert.equal(SUPPORT_REPLY_HOURS, 48)
  assert.equal(NEWSLETTER_CONFIRM_TTL_DAYS, 7)
  assert.equal(new Intl.PluralRules('en').select(SUPPORT_REPLY_HOURS), 'other', msg)
  assert.equal(new Intl.PluralRules('en').select(NEWSLETTER_CONFIRM_TTL_DAYS), 'other', msg)
  assert.equal(new Intl.PluralRules('ar').select(SUPPORT_REPLY_HOURS), 'many', msg)
  assert.equal(new Intl.PluralRules('ar').select(NEWSLETTER_CONFIRM_TTL_DAYS), 'few', msg)
})

// ---------------------------------------------------------------------------
// Import allow-list of the Worker renderer
// ---------------------------------------------------------------------------

const ALLOWED_BARE: string[] = []

/** Whole-line // comments first (they may hold text such as "@react-email/*"), then blocks. */
function stripComments(src: string): string {
  return src.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
}

function specifiers(src: string): string[] {
  const code = stripComments(src)
  const out: string[] = []
  const patterns = [
    /(?:^|[\s;])(?:import|export)\s[^'"]*?\bfrom\s*['"]([^'"]+)['"]/g,
    /(?:^|[\s;])import\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ]
  for (const source of patterns) {
    for (const m of code.matchAll(new RegExp(source.source, source.flags))) out.push(m[1])
  }
  return out
}

function walk(entry: string): Set<string> {
  const seen = new Set<string>()
  const queue = [resolve(ROOT, entry)]
  while (queue.length) {
    const file = queue.shift()!
    const rel = relative(ROOT, file)
    if (seen.has(rel)) continue
    seen.add(rel)
    if (file.endsWith('.json')) continue
    for (const spec of specifiers(readFileSync(file, 'utf8'))) {
      if (spec.startsWith('.')) {
        queue.push(resolve(dirname(file), spec))
      } else if (!spec.startsWith('node:') && !ALLOWED_BARE.includes(spec)) {
        assert.fail(`bare import '${spec}' in ${rel} is not allowed in the Worker renderer`)
      }
    }
  }
  return seen
}

test('import allow-list: render-app.ts reaches exactly the seven Worker-safe files', () => {
  const visited = walk('src/emails/render-app.ts')
  assert.deepEqual(
    [...visited].sort(),
    [
      'src/emails/app/model.ts',
      'src/emails/app/template-fill.ts',
      'src/emails/brand.ts',
      'src/emails/render-app.ts',
      'src/generated/app-email-templates.json',
      'src/lib/email-constants.ts',
      'src/lib/email-tokens.ts',
    ]
  )
})

test('import walker sees every import form, including with { type: json }', () => {
  const src = [
    "import a from './a.ts'",
    "import type { B } from './b.ts'",
    "import {\n  c,\n  d,\n} from './c.ts'",
    "export { e } from './e.ts'",
    "export * from './f.ts'",
    "import './g.ts'",
    "const h = await import('./h.ts')",
    "import data from '../x.json' with { type: 'json' }",
    "// import z from './commented.ts' (see @react-email/*)",
    "/* import y from './block.ts' */",
    "import last from './last.ts'",
  ].join('\n')
  assert.deepEqual(specifiers(src).sort(), ['../x.json', './a.ts', './b.ts', './c.ts', './e.ts', './f.ts', './g.ts', './h.ts', './last.ts'].sort())
})

test('trusted block: no innerHTML in the fill path; the only blk slots are shows and episodes', () => {
  for (const f of ['src/emails/render-app.ts', 'src/emails/app/template-fill.ts']) {
    assert.ok(!readFileSync(resolve(ROOT, f), 'utf8').includes('innerHTML'), f)
  }
  const json = readFileSync(resolve(ROOT, 'src/generated/app-email-templates.json'), 'utf8')
  const blks = new Set(slotsOf(json).filter((s) => s.type === 'blk').map((s) => s.name))
  assert.deepEqual([...blks].sort(), ['episodes', 'shows'])
})
