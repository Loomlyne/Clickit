import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Admin audit log helper. Every Server Action that mutates data should call
 * one of these after the mutation succeeds (not before — we only log what
 * actually happened).
 *
 * Design choices:
 *   - Never throws. Audit logging failures MUST NOT block the user's mutation.
 *     If the log write fails, we console.error and continue. The alternative —
 *     rolling back a successful save because we couldn't log it — is worse.
 *   - Takes the admin userId as an explicit param rather than re-reading auth
 *     state. Callers already have it from assertAdmin(); no reason to do
 *     another round trip.
 *   - Uses the admin (service-role) client, which bypasses the "no client
 *     writes" RLS policy on admin_audit_log.
 */

export type AuditAction =
  | 'create'
  | 'update'
  | 'archive'
  | 'restore'
  | 'delete'
  | 'config_update'
  | 'upload'
  | 'remove_media'

export type AuditEntity =
  | 'show'
  | 'season'
  | 'episode'
  | 'app_config'
  | 'storage'
  | 'feature_flags'

export interface AuditArgs {
  adminUserId: string
  action: AuditAction
  entity: AuditEntity
  entityId?: string | null
  /**
   * Free-form diff snapshot. Convention:
   *   create → { data: {...new row} }
   *   update → { before: {...}, after: {...} } OR { changed: {...fields} }
   *   archive/restore/delete → { id, title } (enough to recognize on the dashboard)
   *   config_update → { keys: [...] } (which columns were touched)
   *   upload → { slot, path, mime, sizeMB }
   */
  diff?: Record<string, unknown>
}

export async function logAudit(args: AuditArgs): Promise<void> {
  try {
    const admin = createAdminClient()
    const { error } = await admin.from('admin_audit_log').insert({
      admin_user_id: args.adminUserId,
      action_type: args.action,
      entity_type: args.entity,
      entity_id: args.entityId ?? null,
      // Cast: Supabase's generated Json type is narrower (JSON primitives only).
      // Record<string, unknown> is JSON-compatible in practice — the wider
      // public type here is intentional so callers can pass structured shapes
      // without fighting the type system. The DB column is jsonb, storage
      // accepts any JSON-serializable tree.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      diff: (args.diff ?? null) as any,
    })
    if (error) {
      // Structured, grep-friendly. Include context so you can tell which
      // action failed to log without tracing through call sites.
      console.error('[audit] insert failed', {
        action: args.action,
        entity: args.entity,
        entityId: args.entityId,
        err: error.message,
      })
    }
  } catch (err) {
    console.error('[audit] unexpected failure', err)
  }
}
