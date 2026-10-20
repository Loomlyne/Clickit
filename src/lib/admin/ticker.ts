export type TickerItem = {
  tag: string
  text: string
  tag2?: string
  tag_ar?: string
  text_ar?: string
  tag2_ar?: string
}

type Slot = { index: number; field: 'tag_ar' | 'text_ar' | 'tag2_ar'; source: string }

export async function fillTickerArabic(
  items: TickerItem[],
  translateBatch: (texts: string[]) => Promise<(string | null)[]>
): Promise<{ items: TickerItem[]; untranslated: number }> {
  const out = items.map((it) => ({ ...it }))
  const slots: Slot[] = []
  out.forEach((it, index) => {
    if (!it.tag_ar?.trim() && it.tag?.trim()) slots.push({ index, field: 'tag_ar', source: it.tag })
    if (!it.text_ar?.trim() && it.text?.trim()) slots.push({ index, field: 'text_ar', source: it.text })
    if (!it.tag2_ar?.trim() && it.tag2?.trim()) slots.push({ index, field: 'tag2_ar', source: it.tag2 })
  })
  if (slots.length === 0) return { items: out, untranslated: 0 }

  const results = await translateBatch(slots.map((s) => s.source))
  let untranslated = 0
  slots.forEach((slot, i) => {
    const tr = results[i]
    if (tr?.trim()) out[slot.index]![slot.field] = tr.trim()
    else untranslated += 1
  })
  return { items: out, untranslated }
}
