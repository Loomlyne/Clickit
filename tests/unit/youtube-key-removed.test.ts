import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { test } from 'node:test'

// Phase 6 (06-19, YT-04): nothing hand-written under src/ can read, write or
// mention the old database copy of the YouTube key or its helper. The key lives
// in Supabase Vault (D-20).
//
// The generated types file still lists the column because the contract
// migration that drops it ships later in its own PR (06-23). That one path is
// excluded here; 06-23 removes this exclusion once the types are regenerated.
export const SCAN_EXCLUDE = ['src/lib/database.types.ts']

const ROOT = new URL('../../', import.meta.url).pathname
const SRC = join(ROOT, 'src')
const EXTENSIONS = ['.ts', '.tsx', '.json']

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else if (EXTENSIONS.some((ext) => entry.name.endsWith(ext))) out.push(full)
  }
  return out
}

const files = walk(SRC).filter(
  (f) => !SCAN_EXCLUDE.includes(relative(ROOT, f)),
)

function offenders(needle: string): string[] {
  return files
    .filter((f) => readFileSync(f, 'utf8').includes(needle))
    .map((f) => relative(ROOT, f))
}

test('the exclusion list is exactly the generated types file', () => {
  assert.deepEqual(SCAN_EXCLUDE, ['src/lib/database.types.ts'])
})

test('the scan sees the source tree', () => {
  assert.ok(files.length > 100, `scanned only ${files.length} files`)
  assert.ok(files.some((f) => f.endsWith('src/lib/config.ts')))
})

test('no file under src mentions youtube_api_key', () => {
  assert.deepEqual(offenders('youtube_api_key'), [])
})

test('no file under src calls getYouTubeApiKey(', () => {
  assert.deepEqual(offenders('getYouTubeApiKey('), [])
})

test('no file under src mentions api/youtube-meta', () => {
  assert.deepEqual(offenders('api/youtube-meta'), [])
})
