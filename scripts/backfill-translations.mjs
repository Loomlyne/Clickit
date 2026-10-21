// One-time backfill: fill empty Arabic (`_ar`) fields from their English source
// using DeepL, for all existing rows. Idempotent — re-running only touches rows
// whose Arabic is still blank, so it's safe to run again after a partial run.
//
// Run with:  node --env-file=.env.local scripts/backfill-translations.mjs
//
// Covers: shows, seasons, episodes, faqs, legal_pages, and the app_config JSON
// blobs (footer tagline, top ticker, site/hero/portfolio metadata).

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DEEPL_KEY = process.env.DEEPL_API_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
if (!DEEPL_KEY) {
  console.error('Missing DEEPL_API_KEY')
  process.exit(1)
}

const deeplHost = DEEPL_KEY.endsWith(':fx')
  ? 'https://api-free.deepl.com/v2/translate'
  : 'https://api.deepl.com/v2/translate'

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
})

const blank = (v) => !v || !String(v).trim()

/** Translate a batch of English strings to Arabic, preserving order. */
async function translate(texts) {
  if (texts.length === 0) return []
  const res = await fetch(deeplHost, {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${DEEPL_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: texts, source_lang: 'EN', target_lang: 'AR' }),
  })
  if (!res.ok) {
    throw new Error(`DeepL ${res.status}: ${(await res.text()).slice(0, 200)}`)
  }
  const data = await res.json()
  return (data.translations ?? []).map((t) => t.text)
}

/**
 * Generic table backfiller. `fields` is a list of [enColumn, arColumn] pairs.
 * Collects every blank-AR cell across the page, translates in one DeepL call,
 * then writes each row's filled values back.
 */
async function backfillTable(table, fields, selectCols) {
  const { data: rows, error } = await db.from(table).select(selectCols)
  if (error) {
    console.error(`[${table}] read failed:`, error.message)
    return
  }
  const texts = []
  const slots = [] // [rowIndex, arColumn]
  rows.forEach((row, i) => {
    for (const [en, ar] of fields) {
      if (!blank(row[en]) && blank(row[ar])) {
        texts.push(row[en])
        slots.push([i, ar])
      }
    }
  })
  if (texts.length === 0) {
    console.log(`[${table}] nothing to backfill`)
    return
  }
  const translated = await translate(texts)
  // Group filled values per row id
  const updates = new Map() // id -> { arColumn: value }
  slots.forEach(([rowIdx, ar], i) => {
    const row = rows[rowIdx]
    const patch = updates.get(row.id) ?? {}
    patch[ar] = translated[i]
    updates.set(row.id, patch)
  })
  let ok = 0
  for (const [id, patch] of updates) {
    const { error: upErr } = await db.from(table).update(patch).eq('id', id)
    if (upErr) console.error(`[${table}] update ${id} failed:`, upErr.message)
    else ok++
  }
  console.log(`[${table}] backfilled ${ok}/${updates.size} rows (${texts.length} strings)`)
}

async function backfillAppConfig() {
  const { data: row, error } = await db
    .from('app_config')
    .select(
      'site_description, site_description_ar, site_tagline, site_tagline_ar, hero_description, hero_description_ar, portfolio_heading, portfolio_heading_ar, footer_content, top_ticker'
    )
    .eq('id', 1)
    .single()
  if (error || !row) {
    console.error('[app_config] read failed:', error?.message)
    return
  }

  const texts = []
  const apply = [] // fn(translatedValue)
  const patch = {}

  const queueCol = (enVal, arCol) => {
    if (!blank(enVal) && blank(row[arCol])) {
      texts.push(enVal)
      apply.push((tr) => { patch[arCol] = tr })
    }
  }
  queueCol(row.site_description, 'site_description_ar')
  queueCol(row.site_tagline, 'site_tagline_ar')
  queueCol(row.hero_description, 'hero_description_ar')
  queueCol(row.portfolio_heading, 'portfolio_heading_ar')

  // footer_content.taglineAr
  const footer = row.footer_content && typeof row.footer_content === 'object' ? { ...row.footer_content } : null
  if (footer && !blank(footer.tagline) && blank(footer.taglineAr)) {
    texts.push(footer.tagline)
    apply.push((tr) => { footer.taglineAr = tr; patch.footer_content = footer })
  }

  // top_ticker items: tag_ar / text_ar / tag2_ar
  const ticker = row.top_ticker && typeof row.top_ticker === 'object' ? { ...row.top_ticker } : null
  if (ticker && Array.isArray(ticker.items)) {
    ticker.items = ticker.items.map((it) => ({ ...it }))
    ticker.items.forEach((it) => {
      if (!blank(it.tag) && blank(it.tag_ar)) {
        texts.push(it.tag); apply.push((tr) => { it.tag_ar = tr; patch.top_ticker = ticker })
      }
      if (!blank(it.text) && blank(it.text_ar)) {
        texts.push(it.text); apply.push((tr) => { it.text_ar = tr; patch.top_ticker = ticker })
      }
      if (!blank(it.tag2) && blank(it.tag2_ar)) {
        texts.push(it.tag2); apply.push((tr) => { it.tag2_ar = tr; patch.top_ticker = ticker })
      }
    })
  }

  if (texts.length === 0) {
    console.log('[app_config] nothing to backfill')
    return
  }
  const translated = await translate(texts)
  apply.forEach((fn, i) => fn(translated[i]))
  const { error: upErr } = await db.from('app_config').update(patch).eq('id', 1)
  if (upErr) console.error('[app_config] update failed:', upErr.message)
  else console.log(`[app_config] backfilled ${Object.keys(patch).length} fields (${texts.length} strings)`)
}

async function main() {
  console.log('Backfilling Arabic translations (DeepL)…\n')
  await backfillTable(
    'shows',
    [['title', 'title_ar'], ['description', 'description_ar'], ['tagline', 'tagline_ar']],
    'id, title, title_ar, description, description_ar, tagline, tagline_ar'
  )
  await backfillTable('seasons', [['title', 'title_ar']], 'id, title, title_ar')
  await backfillTable(
    'episodes',
    [['title', 'title_ar'], ['description', 'description_ar']],
    'id, title, title_ar, description, description_ar'
  )
  await backfillTable(
    'faqs',
    [['question', 'question_ar'], ['answer', 'answer_ar']],
    'id, question, question_ar, answer, answer_ar'
  )
  await backfillTable(
    'legal_pages',
    // Legal Arabic is a draft until an admin ticks "Arabic reviewed" (Koss 2026-10-21).
    [['title', 'title_ar_draft'], ['content', 'content_ar_draft']],
    'id, title, title_ar_draft, content, content_ar_draft'
  )
  await backfillAppConfig()
  console.log('\nDone.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
