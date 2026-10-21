// How many Arabic fields an admin save could not auto-fill (pure; shared by the
// server actions and the admin forms).

/** Adds `arabicMissing` to a successful result when at least one field is left empty. */
export function withArabicMissing<R extends { success: boolean }>(
  result: R,
  missing: number
): R & { arabicMissing?: number } {
  return result.success && missing > 0 ? { ...result, arabicMissing: missing } : result
}

/** The count from a save result; 0 for a failed save or anything unexpected. */
export function arabicMissingOf(result: unknown): number {
  if (!result || typeof result !== 'object') return 0
  const r = result as { success?: unknown; arabicMissing?: unknown }
  if (r.success !== true) return 0
  const n = r.arabicMissing
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : 0
}
