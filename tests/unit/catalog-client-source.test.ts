// AUTH-08 / F1: the four episodes_view catalog reads must use the server-only
// service-role catalog client, so the M3 anon EXECUTE revoke cannot empty the
// series page, the watch sibling list or the rails.
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const QUERIES = readFileSync('src/lib/queries.ts', 'utf8')
const CATALOG_FNS = [
  'getNewEpisodes',
  'getEpisodesByShowId',
  'getEpisodesBySeasonId',
  'getComingSoonEpisodes',
]

function fnSlice(name: string): string {
  const re = new RegExp(`^export (?:const ${name}\\b|async function ${name}\\b)`, 'm')
  const m = re.exec(QUERIES)
  assert.ok(m, `${name} not found in src/lib/queries.ts`)
  const rest = QUERIES.slice(m.index + m[0].length)
  const next = rest.search(/^export /m)
  return QUERIES.slice(m.index, next === -1 ? QUERIES.length : m.index + m[0].length + next)
}

for (const name of CATALOG_FNS) {
  test(`${name} reads through createCatalogClient, not the anon client`, () => {
    const text = fnSlice(name)
    assert.ok(text.includes('createCatalogClient()'), `${name} must call createCatalogClient()`)
    assert.ok(!text.includes('createPublicClient()'), `${name} must not call createPublicClient()`)
  })
}

test('catalog-client is server-only', () => {
  const src = readFileSync('src/server/catalog-client.ts', 'utf8')
  assert.ok(src.includes("import 'server-only'"))
})

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry)) out.push(p)
  }
  return out
}

test('no client component imports the catalog client', () => {
  const offenders = walk('src').filter((file) => {
    const text = readFileSync(file, 'utf8')
    if (!text.includes('@/server/catalog-client')) return false
    const isClient = /^\s*['"]use client['"];?\s*$/m.test(text)
    const underComponents = file.split(/[\\/]/).slice(0, 2).join('/') === 'src/components'
    return isClient || underComponents
  })
  assert.deepEqual(offenders, [], `client imports of catalog-client: ${offenders.join(', ')}`)
})
