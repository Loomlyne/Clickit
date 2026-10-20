// Ordered write steps with reverse-order undo, plus the audited-delete helper.
// Only extensionless `import type` lines are allowed (erased by strip-types).
import type { AuditWriter } from './ports'

type StepResult = { error: string | null }

export type WriteStep = {
  name: string
  run: () => Promise<StepResult>
  undo?: () => Promise<StepResult>
}

export type LeftInPlace = { step: string; error: string }

export type CompensationResult =
  | { ok: true; completed: string[]; wrote: boolean }
  | {
      ok: false
      failedStep: string
      error: string
      completed: string[]
      undone: string[]
      leftInPlace: LeftInPlace[]
      wrote: boolean
    }

function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

async function safe(fn: () => Promise<StepResult>): Promise<StepResult> {
  try {
    return await fn()
  } catch (e) {
    return { error: errText(e) }
  }
}

/** Runs steps one after another. On failure, undoes completed steps in reverse order. */
export async function runWithCompensation(
  steps: WriteStep[]
): Promise<CompensationResult> {
  const completed: WriteStep[] = []
  let wrote = false
  for (const step of steps) {
    wrote = true
    const res = await safe(step.run)
    if (res.error) {
      const undone: string[] = []
      const leftInPlace: LeftInPlace[] = []
      for (const done of [...completed].reverse()) {
        if (!done.undo) {
          leftInPlace.push({ step: done.name, error: 'no undo defined' })
          continue
        }
        const u = await safe(done.undo)
        if (u.error) leftInPlace.push({ step: done.name, error: u.error })
        else undone.push(done.name)
      }
      return {
        ok: false,
        failedStep: step.name,
        error: res.error,
        completed: completed.map((s) => s.name),
        undone,
        leftInPlace,
        wrote,
      }
    }
    completed.push(step)
  }
  return { ok: true, completed: completed.map((s) => s.name), wrote }
}

export function newAttemptId(): string {
  return globalThis.crypto.randomUUID()
}

export function pendingAuditDiff(
  context: Record<string, unknown>,
  attemptId: string
): Record<string, unknown> {
  return { outcome: 'pending', attempt_id: attemptId, ...context }
}

export function compensationAuditDiff(
  result: CompensationResult,
  context: Record<string, unknown>,
  attemptId?: string
): Record<string, unknown> {
  const attempt = attemptId ? { attempt_id: attemptId } : {}
  if (result.ok) return { outcome: 'committed', ...attempt, ...context }
  return {
    outcome: 'failed',
    ...attempt,
    failed_step: result.failedStep,
    error: result.error,
    undone: result.undone,
    left_in_place: result.leftInPlace,
    ...context,
  }
}

type AuditedDeleteInput = {
  audit: AuditWriter
  adminUserId: string
  action: Parameters<AuditWriter>[0]['action']
  entity: Parameters<AuditWriter>[0]['entity']
  entityId: string | null
  context: Record<string, unknown>
  steps: WriteStep[]
  /** Overrides for non-delete writes (uploads) so the messages stay truthful. */
  messages?: { pendingFailed?: string; terminalFailed?: (attemptId: string) => string }
}

export type AuditedDeleteResult = {
  ok: boolean
  wrote: boolean
  /** Every step ran; only the closing audit row may have failed. */
  committed?: boolean
  attemptId?: string
  error?: string
}

/** pending audit row -> irreversible steps -> one terminal audit row, same attempt_id. */
export async function runAuditedDelete(
  input: AuditedDeleteInput
): Promise<AuditedDeleteResult> {
  const attemptId = newAttemptId()
  const base = {
    adminUserId: input.adminUserId,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId,
  }

  let pending: StepResult
  try {
    pending = await input.audit({
      ...base,
      diff: pendingAuditDiff(input.context, attemptId),
    })
  } catch (e) {
    pending = { error: errText(e) }
  }
  if (pending.error) {
    return {
      ok: false,
      wrote: false,
      attemptId,
      error: input.messages?.pendingFailed ?? 'Could not write the audit record; nothing was deleted.',
    }
  }

  const result = await runWithCompensation(input.steps)

  let terminal: StepResult
  try {
    terminal = await input.audit({
      ...base,
      diff: compensationAuditDiff(result, input.context, attemptId),
    })
  } catch (e) {
    terminal = { error: errText(e) }
  }

  if (!result.ok) {
    return {
      ok: false,
      wrote: result.wrote,
      attemptId,
      error: terminal.error
        ? `${result.error} (the closing audit row also failed; attempt ${attemptId})`
        : result.error,
    }
  }
  if (terminal.error) {
    return {
      ok: false,
      wrote: true,
      committed: true,
      attemptId,
      error:
        input.messages?.terminalFailed?.(attemptId) ??
        `The item was deleted, but the closing audit row could not be written. The pending audit row remains (attempt_id ${attemptId}).`,
    }
  }
  return { ok: true, wrote: true, committed: true, attemptId }
}
