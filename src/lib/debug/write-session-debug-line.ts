import { appendFile, mkdir } from 'fs/promises'
import { dirname, join } from 'path'
import { tmpdir } from 'os'

const SESSION_ID = 'c080c4'

/**
 * Writes one NDJSON line for debug mode. Tries project paths first, then /tmp.
 */
export async function writeSessionDebugLine(line: string): Promise<void> {
  const normalized = line.endsWith('\n') ? line : `${line}\n`
  const paths = [
    join(process.cwd(), `debug-${SESSION_ID}.log`),
    join(process.cwd(), `.cursor/debug-${SESSION_ID}.log`),
    join(tmpdir(), `clickit-debug-${SESSION_ID}.log`),
  ]
  let lastErr: unknown
  for (const p of paths) {
    try {
      await mkdir(dirname(p), { recursive: true })
      await appendFile(p, normalized, 'utf8')
      if (process.env.NODE_ENV !== 'production' && p !== paths[0]) {
        console.info(`[debug ${SESSION_ID}] wrote to ${p} (fallback)`)
      }
      return
    } catch (e) {
      lastErr = e
    }
  }
  console.error(`[debug ${SESSION_ID}] write failed all paths`, lastErr)
}
