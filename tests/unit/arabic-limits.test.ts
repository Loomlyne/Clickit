// Review item 7 (PR #29): an AI fill obeys the max length of the field's own zod schema.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { z } from 'zod'
import { arabicMaxLengths, maxLengthOf } from '../../src/lib/admin/arabic-limits.ts'

test('maxLengthOf reads .max() through trim, nullable, optional, default and transform pipes', () => {
  assert.equal(maxLengthOf(z.string().trim().max(120).nullable()), 120)
  assert.equal(maxLengthOf(z.string().max(300).default('')), 300)
  assert.equal(maxLengthOf(z.string().max(500).optional().nullable()), 500)
  assert.equal(maxLengthOf(z.string().max(40).nullish().transform((v) => v ?? null)), 40)
  assert.equal(maxLengthOf(z.string().optional().nullable()), undefined)
  assert.equal(maxLengthOf(z.number()), undefined)
  assert.equal(maxLengthOf(undefined), undefined)
})

test('arabicMaxLengths lists the Arabic keys (_ar or Ar) of an object schema that have a max', () => {
  const s = z.object({
    site_tagline: z.string().max(120),
    site_tagline_ar: z.string().trim().max(120).nullable(),
    taglineAr: z.string().max(300).default(''),
    content_ar: z.string().optional().nullable(),
  })
  assert.deepEqual(arabicMaxLengths(s), { site_tagline_ar: 120, taglineAr: 300 })
})

const actions = readFileSync('src/app/[locale]/admin/actions.ts', 'utf8')

test('every admin AI fill of a field with a schema max passes that max', () => {
  // `<target>.<field> = (await arabic.fill(<en>, <ar>[, <max>]))` for every capped field.
  const CAPPED = [
    'site_description_ar',
    'site_tagline_ar',
    'auth_heading_ar',
    'auth_subheading_ar',
    'auth_quote_ar',
    'auth_quote_attribution_ar',
    'taglineAr',
    'hero_description_ar',
    'portfolio_heading_ar',
    'question_ar',
  ]
  for (const field of CAPPED) {
    const re = new RegExp(`\\.${field} = \\(?await arabic\\.fill\\(([^;]*?)\\)\\)?( \\?\\? '')?\\n`, 's')
    const m = re.exec(actions)
    assert.ok(m, `${field}: arabic.fill call not found`)
    assert.ok(m[1]!.includes(`.${field}`) && /Max\.\w+\s*$|MAX\.\w+\s*$|max\.\w+\s*$/.test(m[1]!.trim()), `${field}: pass the schema max as the third argument (got: ${m[1]})`)
  }
  assert.match(actions, /fillTickerArabic\(trimmed, arabic\.fillBatch, arabicMaxLengths\(topTickerItemSchema\)\)/)
})
