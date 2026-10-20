import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ARABIC_AI_MODEL,
  ARABIC_TRANSLATION_SYSTEM_PROMPT,
  acceptArabicTranslation,
  arabicMaxCompletionTokens,
  buildArabicTranslationInput,
  cleanModelText,
  hasArabicScript,
  readModelText,
  sameLineBreaks,
  translateBatchStrictCore,
  translateWithAi,
  type AiBinding,
} from '../../src/lib/arabic-text.ts'

test('hasArabicScript', () => {
  assert.equal(hasArabicScript('مرحبا'), true)
  assert.equal(hasArabicScript('Hello'), false)
  assert.equal(hasArabicScript('Episode 3 - الحلقة'), true)
})

test('acceptArabicTranslation', () => {
  assert.equal(acceptArabicTranslation('Hello', 'Hello'), null)
  assert.equal(acceptArabicTranslation('Hello', 'مرحبا'), 'مرحبا')
  assert.equal(acceptArabicTranslation('Hello', '  '), null)
})

// ---- fake Workers AI binding ----------------------------------------------

const openAi = (content: unknown, finish = 'stop') => ({
  choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: finish }],
})

function fakeAi(reply: (text: string) => unknown | Promise<unknown>) {
  const calls: Array<{ model: string; input: Record<string, unknown> }> = []
  const ai: AiBinding = {
    async run(model, input) {
      const inp = input as Record<string, unknown>
      calls.push({ model, input: inp })
      const messages = inp.messages as Array<{ role: string; content: string }>
      return reply(messages[messages.length - 1]!.content)
    },
  }
  return { ai, calls }
}

// ---- prompt and request ---------------------------------------------------

test('model id is Gemma 4 26B A4B', () => {
  assert.equal(ARABIC_AI_MODEL, '@cf/google/gemma-4-26b-a4b-it')
})

test('system prompt: MSA, UAE streaming, only the translation, keep names, line breaks, URLs, numbers, handles', () => {
  const p = ARABIC_TRANSLATION_SYSTEM_PROMPT
  assert.match(p, /Modern Standard Arabic/)
  assert.match(p, /United Arab Emirates/)
  assert.match(p, /streaming/)
  assert.match(p, /ONLY the Arabic translation/)
  assert.match(p, /no quotes/)
  assert.match(p, /no notes/)
  assert.match(p, /no transliteration/)
  assert.match(p, /line break/i)
  assert.match(p, /person names/)
  assert.match(p, /show titles/)
  assert.match(p, /"Clickit Story"/)
  assert.match(p, /URLs/)
  assert.match(p, /numbers/)
  assert.match(p, /@handles/)
  assert.match(p, /Do not translate the proper names of shows/)
  // Live check on workers.dev 2026-10-20: without this line the model kept
  // "Abu Dhabi", "November" and "PM" in English.
  assert.match(p, /Translate everything else into Arabic, including place names/)
  assert.match(p, /month and day names/)
  assert.match(p, /times/)
})

test('request: system + user messages, temperature 0, thinking off, bounded output', () => {
  const input = buildArabicTranslationInput('Season 2 is out') as Record<string, unknown>
  const messages = input.messages as Array<{ role: string; content: string }>
  assert.deepEqual(messages.map((m) => m.role), ['system', 'user'])
  assert.equal(messages[0]!.content, ARABIC_TRANSLATION_SYSTEM_PROMPT)
  assert.equal(messages[1]!.content, 'Season 2 is out')
  assert.equal(input.temperature, 0)
  assert.deepEqual(input.chat_template_kwargs, { enable_thinking: false })
  assert.equal(input.max_completion_tokens, arabicMaxCompletionTokens('Season 2 is out'))
})

test('max_completion_tokens grows with the input and is capped', () => {
  const small = arabicMaxCompletionTokens('Hi')
  const mid = arabicMaxCompletionTokens('x'.repeat(2000))
  const huge = arabicMaxCompletionTokens('x'.repeat(200_000))
  assert.ok(small >= 64)
  assert.ok(mid > small)
  assert.ok(huge <= 8192)
  assert.ok(mid <= huge)
})

// ---- response parsing -----------------------------------------------------

test('readModelText: OpenAI choices shape and the older response shape', () => {
  assert.equal(readModelText(openAi('مرحبا')), 'مرحبا')
  assert.equal(readModelText({ response: 'مرحبا' }), 'مرحبا')
  assert.equal(readModelText(openAi(null)), null)
  assert.equal(readModelText(openAi('مرحبا', 'length')), null, 'a cut-off answer is refused')
  assert.equal(readModelText({}), null)
  assert.equal(readModelText(null), null)
  assert.equal(readModelText('مرحبا'), null)
  assert.equal(readModelText({ choices: [] }), null)
})

test('cleanModelText strips surrounding quotes and code fences', () => {
  assert.equal(cleanModelText('"مرحبا"', 'Hello'), 'مرحبا')
  assert.equal(cleanModelText('“مرحبا”', 'Hello'), 'مرحبا')
  assert.equal(cleanModelText('«مرحبا»', 'Hello'), 'مرحبا')
  assert.equal(cleanModelText("'مرحبا'", 'Hello'), 'مرحبا')
  assert.equal(cleanModelText('```\nمرحبا\n```', 'Hello'), 'مرحبا')
  assert.equal(cleanModelText('```text\nسطر\nسطر\n```', 'a\nb'), 'سطر\nسطر')
  assert.equal(cleanModelText('<think>x</think>\nمرحبا', 'Hello'), 'مرحبا')
  // A quoted source keeps its quotes.
  assert.equal(cleanModelText('"مرحبا"', '"Hello"'), '"مرحبا"')
})

test('sameLineBreaks compares newline counts (CRLF counts as one)', () => {
  assert.equal(sameLineBreaks('a\nb', 'أ\nب'), true)
  assert.equal(sameLineBreaks('a\r\n\r\nb', 'أ\n\nب'), true)
  assert.equal(sameLineBreaks('a\nb', 'أ ب'), false)
  assert.equal(sameLineBreaks('a', 'أ\nملاحظة'), false)
})

// ---- strict translation ---------------------------------------------------

test('translateWithAi: OpenAI shape accepted, model id sent', async () => {
  const { ai, calls } = fakeAi(() => openAi('مرحبا'))
  assert.equal(await translateWithAi('Hello', ai), 'مرحبا')
  assert.equal(calls.length, 1)
  assert.equal(calls[0]!.model, '@cf/google/gemma-4-26b-a4b-it')
})

test('translateWithAi: response shape accepted', async () => {
  const { ai } = fakeAi(() => ({ response: '"مرحبا"' }))
  assert.equal(await translateWithAi('Hello', ai), 'مرحبا')
})

test('translateWithAi: English echoed back is null', async () => {
  const { ai } = fakeAi((t) => openAi(t))
  assert.equal(await translateWithAi('Clickit Story', ai), null)
  const { ai: ai2 } = fakeAi(() => openAi('Hello there'))
  assert.equal(await translateWithAi('Hello', ai2), null)
})

test('translateWithAi: line breaks must be preserved', async () => {
  const kept = fakeAi(() => openAi('السطر الأول\n\nالسطر الثاني'))
  assert.equal(await translateWithAi('First line\n\nSecond line', kept.ai), 'السطر الأول\n\nالسطر الثاني')
  const lost = fakeAi(() => openAi('السطر الأول السطر الثاني'))
  assert.equal(await translateWithAi('First line\nSecond line', lost.ai), null)
  const note = fakeAi(() => openAi('مرحبا\nملاحظة: ترجمة'))
  assert.equal(await translateWithAi('Hello', note.ai), null)
})

test('translateWithAi: throw, bad shape, missing binding and timeout are null', async () => {
  const throws: AiBinding = { run: async () => { throw new Error('4006: daily free allocation exceeded') } }
  assert.equal(await translateWithAi('Hello', throws), null)
  const bad = fakeAi(() => ({ result: 42 }))
  assert.equal(await translateWithAi('Hello', bad.ai), null)
  assert.equal(await translateWithAi('Hello', undefined), null)
  assert.equal(await translateWithAi('Hello', {} as AiBinding), null)
  const hang: AiBinding = { run: () => new Promise(() => {}) }
  assert.equal(await translateWithAi('Hello', hang, { timeoutMs: 20 }), null)
})

test('translateWithAi: blank input makes no call', async () => {
  const { ai, calls } = fakeAi(() => openAi('مرحبا'))
  assert.equal(await translateWithAi('   ', ai), null)
  assert.equal(calls.length, 0)
})

test('batch: one call per non-blank string, results keep their positions', async () => {
  const map: Record<string, string> = { a: 'أ', b: 'b', c: 'ج' }
  const { ai, calls } = fakeAi((t) => openAi(map[t]))
  const out = await translateBatchStrictCore(['a', '', 'b', ' c '], { ai })
  assert.deepEqual(out, ['أ', null, null, 'ج'])
  assert.deepEqual(calls.map((c) => (c.input.messages as Array<{ content: string }>)[1]!.content).sort(), ['a', 'b', 'c'])
})

test('batch: missing binding is all null with no call; a throw nulls only its slot', async () => {
  assert.deepEqual(await translateBatchStrictCore(['a', 'b'], { ai: undefined }), [null, null])
  const ai: AiBinding = {
    async run(_m, input) {
      const text = (input as { messages: Array<{ content: string }> }).messages[1]!.content
      if (text === 'boom') throw new Error('x')
      return openAi('نص')
    },
  }
  assert.deepEqual(await translateBatchStrictCore(['ok', 'boom'], { ai }), ['نص', null])
})

test('batch: the allow gate runs before every call; refused slots are null and not sent', async () => {
  const { ai, calls } = fakeAi(() => openAi('نص'))
  let n = 0
  const out = await translateBatchStrictCore(['a', 'b', 'c'], {
    ai,
    allow: async () => { n += 1; return n !== 2 },
    concurrency: 1,
  })
  assert.deepEqual(out, ['نص', null, 'نص'])
  assert.equal(calls.length, 2)
  const throwing = fakeAi(() => openAi('نص'))
  const out2 = await translateBatchStrictCore(['a'], { ai: throwing.ai, allow: async () => { throw new Error('db') } })
  assert.deepEqual(out2, [null])
  assert.equal(throwing.calls.length, 0)
})
