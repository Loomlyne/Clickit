/**
 * In-memory NDJSON payloads for debug mode (single Node process, e.g. `next dev`).
 * Serverless invocations do not share this — use hosting logs or enable file ingest.
 */
const MAX = 80
const recent: string[] = []

export function pushDebugIngestPayload(jsonLine: string) {
  const trimmed = jsonLine.replace(/\s+$/, '')
  if (!trimmed) return
  recent.push(trimmed)
  if (recent.length > MAX) recent.splice(0, recent.length - MAX)
}

export function getRecentDebugIngestPayloads(): string[] {
  return [...recent]
}
