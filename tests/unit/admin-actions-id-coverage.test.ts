import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const src = readFileSync('src/app/[locale]/admin/actions.ts', 'utf8')

const ID_NAMES = ['id', 'showId', 'episodeId', 'seasonId', 'categoryId']

function blocks(): Array<{ name: string; text: string }> {
  const re = /export async function (\w+)\(/g
  const starts: Array<{ name: string; index: number }> = []
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) starts.push({ name: m[1]!, index: m.index })
  return starts.map((s, i) => ({
    name: s.name,
    text: src.slice(s.index, starts[i + 1]?.index ?? src.length),
  }))
}

function takesId(text: string): boolean {
  const open = text.indexOf('(')
  // Signature: text up to the first line that closes the parameter list.
  const sigEnd = text.search(/\)\s*:\s*Promise</)
  const sig = text.slice(open, sigEnd === -1 ? open + 400 : sigEnd)
  const inSig = ID_NAMES.some((n) => new RegExp(`(^|[(,{\\s])${n}\\s*[:,?}=]`).test(sig))
  const inForm = ID_NAMES.some((n) => text.includes(`formData.get('${n}')`))
  return inSig || inForm
}

test('every exported action that takes an id validates it', () => {
  const offenders = blocks()
    .filter((b) => takesId(b.text))
    .filter((b) => !(b.text.includes('parseId(') || /\w+Core\(/.test(b.text) || b.text.includes('UUID_RE.test(')))
    .map((b) => b.name)
  assert.deepEqual(offenders, [], `actions with unvalidated ids: ${offenders.join(', ')}`)
})

test('reorderShort validates the direction', () => {
  const b = blocks().find((x) => x.name === 'reorderShort')
  assert.ok(b, 'reorderShort not found')
  assert.ok(b.text.includes('parseDirection('))
})
