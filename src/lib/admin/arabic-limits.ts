// The max length of each Arabic field, read from the zod schema the admin action already
// parses with (review item 7, PR #29): an AI fill longer than its field's max is dropped
// (left empty, counted as missing) instead of being stored over the limit. Pure: no zod
// import, no next/* or '@/' imports (node --test loads it); it reads zod 4's own def tree.

type ZodLike = {
  maxLength?: number | null
  _zod?: { def?: { type?: string; innerType?: unknown; in?: unknown } }
}

/** `.max()` of a string schema, looking through optional, nullable, default and pipes. */
export function maxLengthOf(schema: unknown): number | undefined {
  let s = schema as ZodLike | undefined
  for (let i = 0; s && i < 10; i++) {
    const def = s._zod?.def
    if (!def) return undefined
    if (def.type === 'string') {
      return typeof s.maxLength === 'number' ? s.maxLength : undefined
    }
    if (def.type === 'pipe') s = def.in as ZodLike
    else if (def.innerType) s = def.innerType as ZodLike
    else return undefined
  }
  return undefined
}

/** `{ <arabic key>: max }` for the keys of an object schema that end in `_ar` or `Ar`. */
export function arabicMaxLengths(objectSchema: { shape: Record<string, unknown> }): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [key, field] of Object.entries(objectSchema.shape)) {
    if (!/(_ar|Ar)$/.test(key)) continue
    const max = maxLengthOf(field)
    if (max !== undefined) out[key] = max
  }
  return out
}
