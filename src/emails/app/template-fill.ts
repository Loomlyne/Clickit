// Single-pass escaping fill for the pre-rendered app emails (Phase 5, plan 05-11).
//
// The templates in src/generated/app-email-templates.json are React Email output with
// slot sentinels `__clk_<type>_<name>__` where row data goes. At send time the consumer
// only fills them here. No imports: this module runs in the Worker and must stay tiny.
//
// Rules (controller condition 1):
// - One pass: `template.replace(new RegExp(SLOT_SOURCE, 'g'), cb)` with a fresh regex per
//   call. Inserted values are never scanned again, so a visitor's text that looks like a
//   sentinel is written literally.
// - Required slots come from the template itself and are checked before anything is filled.
// - html: txt -> escapeHtml, url -> escapeHtml(safeUrl(v)), pre -> the react-email Preview
//   body, blk -> a TrustedBlock built by renderRows (anything else throws).
// - text: txt and url plain (url still checked), blk -> TrustedBlock text, never a pre slot.

/** Sentinel pattern as a string; build a fresh RegExp from it per use (no shared lastIndex). */
export const SLOT_SOURCE = '__clk_(txt|url|pre|blk)_([a-z][a-z0-9]*)__'

export type SlotType = 'txt' | 'url' | 'pre' | 'blk'
export type SlotValue = { type: 'txt' | 'url' | 'pre'; value: string }
export type SlotValues = Record<string, SlotValue>
export type Slot = { token: string; type: SlotType; name: string }

/** The checked-in file written by scripts/build-app-templates.mjs. */
export type AppTemplateFile = {
  generatedBy: string
  templates: Record<string, { subject: string; html: string; text: string }>
  rows: Record<
    'en' | 'ar',
    Record<'show' | 'shownoimage' | 'episode', { html: string; text: string }>
  >
  strings: Record<'en' | 'ar', { episodeLine: string; e9Preheader: string }>
}

/**
 * react-email 6.11.0, node_modules/react-email/dist/components/preview/preview.mjs:
 * the hidden preheader text is cut at 200 characters and, when shorter, followed by a
 * <div> holding this 7-character string repeated (200 - length) times. Written with
 * \u escapes on purpose (no invisible characters in source). The parity test catches drift
 * on a react-email upgrade.
 */
export const PREVIEW_MAX = 200
export const PREVIEW_PAD = '\u00A0\u200C\u200B\u200D\u200E\u200F\uFEFF'

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
}

/** React 19's text and attribute escaping, character for character. */
export function escapeHtml(value: string): string {
  return String(value).replace(/[&<>"']/g, (c) => ESCAPES[c])
}

/**
 * Allows https, and http only on localhost / 127.0.0.1 (local mail). Returns the input
 * itself, unchanged: `new URL` is used only to check. Whitespace and control characters
 * are refused (a URL never needs them; they would change meaning in text or headers).
 */
export function safeUrl(value: string): string {
  if (
    typeof value !== 'string' ||
    value === '' ||
    /[\s\u0000-\u001F\u007F]/.test(value)
  ) {
    throw new Error('unsafe url')
  }
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new Error('unsafe url')
  }
  if (parsed.protocol === 'https:' && parsed.hostname !== '') return value
  if (
    parsed.protocol === 'http:' &&
    (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
  ) {
    return value
  }
  throw new Error('unsafe url')
}

/** Every slot occurrence in the template, in order. Fresh regex per call. */
export function slotsOf(template: string): Slot[] {
  const out: Slot[] = []
  for (const m of template.matchAll(new RegExp(SLOT_SOURCE, 'g'))) {
    out.push({ token: m[0], type: m[1] as SlotType, name: m[2] })
  }
  return out
}

const ISSUE = Symbol('trusted-block')
const ISSUED = new WeakSet<object>()

/**
 * The only value a blk slot accepts: html and text built by renderRows from escaped row
 * templates. It cannot be constructed outside this module.
 */
export class TrustedBlock {
  readonly html: string
  readonly text: string
  constructor(key: symbol, html: string, text: string) {
    if (key !== ISSUE) throw new Error('trusted block required')
    this.html = html
    this.text = text
    ISSUED.add(this)
  }
}

function isTrusted(value: unknown): value is TrustedBlock {
  return typeof value === 'object' && value !== null && ISSUED.has(value)
}

function has(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

function stripLineBreaks(value: string): string {
  return value.replace(/[\r\n]/g, '')
}

type Mode = 'html' | 'text' | 'subject'

function check(
  template: string,
  values: SlotValues,
  blocks: Record<string, TrustedBlock>,
  mode: Mode
): void {
  for (const slot of slotsOf(template)) {
    if (slot.type === 'blk') {
      if (mode === 'subject') throw new Error(`blk slot in subject ${slot.name}`)
      if (!has(blocks, slot.name)) throw new Error(`missing slot ${slot.name}`)
      if (!isTrusted(blocks[slot.name])) throw new Error('trusted block required')
      continue
    }
    if (!has(values, slot.name)) throw new Error(`missing slot ${slot.name}`)
    const v = values[slot.name]
    if (!v || typeof v.value !== 'string') {
      throw new Error(`bad slot value ${slot.name}`)
    }
    if (v.type !== slot.type) throw new Error(`slot type mismatch ${slot.name}`)
    if (slot.type === 'pre' && mode !== 'html') {
      throw new Error(`pre slot in ${mode} ${slot.name}`)
    }
    if (slot.type === 'url' && mode === 'subject') {
      throw new Error(`url slot in subject ${slot.name}`)
    }
    if (slot.type === 'url') safeUrl(v.value)
  }
}

function preheaderHtml(value: string): string {
  const text = value.substring(0, PREVIEW_MAX)
  const pad =
    text.length < PREVIEW_MAX
      ? `<div>${PREVIEW_PAD.repeat(PREVIEW_MAX - text.length)}</div>`
      : ''
  return `${escapeHtml(text)}${pad}`
}

/** Fills an html template in one pass. */
export function fillHtml(
  template: string,
  values: SlotValues,
  blocks: Record<string, TrustedBlock> = {}
): string {
  check(template, values, blocks, 'html')
  return template.replace(
    new RegExp(SLOT_SOURCE, 'g'),
    (_whole, type: SlotType, name: string) => {
      if (type === 'blk') {
        const block = blocks[name]
        if (!isTrusted(block)) throw new Error('trusted block required')
        return block.html
      }
      const v = values[name].value
      if (type === 'txt') return escapeHtml(v)
      if (type === 'url') return escapeHtml(safeUrl(v))
      return preheaderHtml(v)
    }
  )
}

/** Fills a plain-text template in one pass: values as given, no entities. */
export function fillText(
  template: string,
  values: SlotValues,
  blocks: Record<string, TrustedBlock> = {}
): string {
  check(template, values, blocks, 'text')
  return template.replace(
    new RegExp(SLOT_SOURCE, 'g'),
    (_whole, type: SlotType, name: string) => {
      if (type === 'blk') {
        const block = blocks[name]
        if (!isTrusted(block)) throw new Error('trusted block required')
        return block.text
      }
      const v = values[name].value
      return type === 'url' ? safeUrl(v) : v
    }
  )
}

/** Fills a subject line in one pass: txt only, CR/LF removed, no escaping. */
export function fillSubject(template: string, values: SlotValues): string {
  check(template, values, {}, 'subject')
  return template.replace(
    new RegExp(SLOT_SOURCE, 'g'),
    (_whole, _type: SlotType, name: string) =>
      stripLineBreaks(values[name].value)
  )
}

export type RowTemplate = { html: string; text: string }
export type RowItem = {
  row: string
  values: SlotValues
  blocks?: Record<string, TrustedBlock>
}

/**
 * Fills one row template per item (each a single pass, nested blocks included) and joins
 * them: html with nothing, text with a blank line. The result is the only value a blk slot
 * accepts.
 */
export function renderRows(
  rowTemplateFor: (row: string) => RowTemplate,
  items: RowItem[]
): TrustedBlock {
  const html: string[] = []
  const text: string[] = []
  for (const item of items) {
    const tpl = rowTemplateFor(item.row)
    if (!tpl) throw new Error(`missing row template ${item.row}`)
    html.push(fillHtml(tpl.html, item.values, item.blocks ?? {}))
    text.push(fillText(tpl.text, item.values, item.blocks ?? {}))
  }
  return new TrustedBlock(ISSUE, html.join(''), text.join('\n\n'))
}
