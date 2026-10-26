// Who acted on an audit row (D-23, AUTH-07). Pure: no imports, so node --test
// can load it and the audit page and the client share one rule.
//
// - The owner script (scripts/admin-remove-factor.mjs, 05-17) writes rows whose
//   admin_user_id is the affected admin, not the actor, and marks them with
//   diff.by = 'owner script'. Only that exact marker changes the actor: the
//   admin's own enrol-restart row (05-25) carries by = 'enrol restart' and is
//   still that admin's action.
// - A row with no admin id is System (cron, no user).
// - An id with no admins row (removed admin) is Former admin; the id stays in
//   the row, only the label changes.

export type AuditActorLabel =
  | { kind: 'name'; text: string }
  | { kind: 'former' }
  | { kind: 'system' }
  | { kind: 'owner_script' }

export const OWNER_SCRIPT_MARKER = 'owner script'

export function auditActorLabel(
  adminUserId: string | null | undefined,
  names: ReadonlyMap<string, string>,
  diff?: Record<string, unknown> | null
): AuditActorLabel {
  const by = diff && typeof diff === 'object' ? diff.by : undefined
  if (typeof by === 'string' && by.trim() === OWNER_SCRIPT_MARKER) {
    return { kind: 'owner_script' }
  }
  if (!adminUserId) return { kind: 'system' }
  const name = names.get(adminUserId)?.trim()
  if (!name) return { kind: 'former' }
  return { kind: 'name', text: name }
}
