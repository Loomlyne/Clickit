import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

// Source-level pins (Koss, Phase 4 signing 2026-10-20): the password eye stays
// on the PHYSICAL right in Arabic, and every field is the live Input.

const root = join(import.meta.dirname, '..', '..')
const fieldPath = join(root, 'src/components/auth/password-field.tsx')
const source = readFileSync(fieldPath, 'utf8')

/** Text of one JSX opening tag, from `<name` up to its closing `>` / `/>`. */
function openingTag(src: string, name: string, from = 0) {
  const start = src.indexOf(`<${name}`, from)
  assert.notEqual(start, -1, `<${name} not found`)
  let depth = 0
  for (let i = start; i < src.length; i++) {
    const ch = src[i]
    if (ch === '{') depth++
    else if (ch === '}') depth--
    else if (ch === '>' && depth === 0) return { start, end: i, text: src.slice(start, i + 1) }
  }
  throw new Error(`<${name} is not closed`)
}

test('a dir="ltr" wrapper holds the Input and then the eye button', () => {
  const wrapperAt = source.indexOf('<div dir="ltr"')
  assert.notEqual(wrapperAt, -1, 'dir="ltr" wrapper missing')
  const input = openingTag(source, 'Input', wrapperAt)
  const button = openingTag(source, 'button', wrapperAt)
  assert.ok(input.start > wrapperAt, 'Input is inside the wrapper')
  assert.ok(button.start > input.end, 'button comes after the Input in DOM order')
  // The wrapper closes after the button; label, strength and error sit outside.
  const closeAt = source.indexOf('</div>', button.end)
  assert.ok(closeAt > button.end)
  const label = source.indexOf('<Label')
  assert.ok(label !== -1 && label < wrapperAt, 'Label is outside (before) the wrapper')
  const errorAt = source.indexOf('role="alert"')
  assert.ok(errorAt > closeAt, 'error line is outside (after) the wrapper')
  assert.match(input.text, /dir="ltr"/, 'masked input keeps dir="ltr"')
})

test('the eye uses a physical right-* class and no logical or rtl: class', () => {
  const wrapperAt = source.indexOf('<div dir="ltr"')
  const input = openingTag(source, 'Input', wrapperAt)
  const button = openingTag(source, 'button', input.end)
  const classes = /className="([^"]*)"/.exec(button.text)?.[1] ?? ''
  const list = classes.split(/\s+/)
  assert.ok(list.some((c) => /^right-/.test(c)), `no right-* in "${classes}"`)
  for (const c of list) {
    assert.doesNotMatch(c, /(^|:)(start|end|left)-/, `forbidden class ${c}`)
    assert.doesNotMatch(c, /^rtl:/, `forbidden class ${c}`)
  }
})

test('the Input carries no fill, border or font-size override', () => {
  const input = openingTag(source, 'Input', source.indexOf('<div dir="ltr"'))
  const classNames = [...input.text.matchAll(/['"`]([^'"`]*)['"`]/g)].map((m) => m[1])
  for (const entry of classNames) {
    for (const c of entry.split(/\s+/)) {
      assert.doesNotMatch(c, /(^|:)(bg|border|text)-/, `Input override ${c}`)
    }
  }
  assert.match(source, /from '@\/components\/ui\/input'/)
})

test('the eye is a pressed-state toggle with a show/hide name', () => {
  assert.match(source, /aria-pressed=\{shown\}/)
  assert.match(source, /t\('hidePassword'\)/)
  assert.match(source, /t\('showPassword'\)/)
})

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return tsxFiles(full)
    return full.endsWith('.tsx') ? [full] : []
  })
}

test('no Phase 5 auth file draws a field with the #q1 values', () => {
  const files = [
    ...tsxFiles(join(root, 'src/components/auth')),
    ...tsxFiles(join(root, 'src/app/[locale]/(viewer)/auth')),
  ]
  assert.ok(files.length > 0)
  const offences: string[] = []
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    // Every <Input ...> and <input ...> opening tag in the file. (The 15px
    // subline of the old /auth page is not a field; 05-22 replaces it.)
    for (const m of text.matchAll(/<(?:Input|input)\b/g)) {
      const tag = openingTag(text, m[0].slice(1), m.index).text
      if (/--bg-1|--line-2|text-\[15px\]/.test(tag)) offences.push(`${file}: ${tag.slice(0, 60)}`)
    }
  }
  assert.deepEqual(offences, [])
})
