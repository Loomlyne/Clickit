// Archive-first guards shared by server cores and admin UI (D-04, D-08).
// Pure: no imports.

export type GuardResult = { ok: true } | { ok: false; error: string }

export function requireArchived(
  row: { archived?: boolean | null } | null | undefined,
  kind: 'show' | 'episode'
): GuardResult {
  const label = kind === 'show' ? 'Show' : 'Episode'
  if (!row) return { ok: false, error: `${label} not found.` }
  if (row.archived !== true) {
    return { ok: false, error: `Archive this ${kind} before deleting it permanently.` }
  }
  return { ok: true }
}

export function canDeletePermanently(
  row: { archived?: boolean | null } | null | undefined
): boolean {
  return row?.archived === true
}
