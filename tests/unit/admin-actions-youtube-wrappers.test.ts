// Source-scan checks on the Phase 6 admin action wrappers (06-13): admin
// check first through the one Phase 5 seam, a tested core behind every action,
// the server video check on episode save, and no key exposure (T-06-49, T-06-51).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const src = readFileSync('src/app/[locale]/admin/actions.ts', 'utf8')

// Same block parser as admin-actions-id-coverage.test.ts.
function blocks(): Array<{ name: string; text: string }> {
  const re = /export async function (\w+)\(/g
  const starts: Array<{ name: string; index: number }> = []
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) starts.push({ name: m[1]!, index: m.index })
  return starts.map((s, i) => ({
    name: s.name,
    text: src.slice(s.index, starts[i + 1]?.index ?? src.length),
  }))
}

function block(name: string): string {
  const b = blocks().find((x) => x.name === name)
  assert.ok(b, `${name} not found in actions.ts`)
  return b.text
}

const READ_ONLY = ['previewPlaylistPage', 'fetchYouTubeMeta']
const WRITES: Array<[string, string]> = [
  ['commitImport', 'commitImportCore'],
  ['renumberSeason', 'renumberSeasonCore'],
]
const PHASE6 = [...READ_ONLY, ...WRITES.map(([n]) => n)]

// The seam and the helpers the new actions share (seam line up to the schemas).
function seamRegion(): string {
  const start = src.indexOf('const requireAdminForYouTube')
  const end = src.indexOf('// Zod Schemas', start)
  assert.ok(start !== -1 && end !== -1, 'seam region not found')
  return src.slice(start, end)
}

test('requireAdminForYouTube is defined once, right after the TODO(phase-5) marker', () => {
  const defs = src.match(/const requireAdminForYouTube\b/g) ?? []
  assert.equal(defs.length, 1)
  const lines = src.split('\n')
  const at = lines.findIndex((l) => l.startsWith('const requireAdminForYouTube'))
  assert.match(lines[at - 1] ?? '', /^\/\/ TODO\(phase-5\): swap this for requireAdmin\(\)/)
  assert.match(src, /const youtubeAdminEnv: AdminActionEnv = \{ \.\.\.adminEnv, assertAdmin: requireAdminForYouTube \}/)
})

for (const name of READ_ONLY) {
  test(`${name} checks the admin before any core call and writes nothing`, () => {
    const text = block(name)
    const admin = text.indexOf('await requireAdminForYouTube()')
    assert.ok(admin !== -1, `${name} lacks await requireAdminForYouTube()`)
    const core = text.search(/\w+Core\(/)
    assert.ok(core !== -1, `${name} calls no core`)
    assert.ok(admin < core, `${name} calls a core before the admin check`)
    assert.ok(admin < text.indexOf('getServerYouTubeClient('), `${name} reads the key before the admin check`)
    assert.ok(!text.includes('runAdminAction'), `${name} must stay read-only`)
  })
}

for (const [name, core] of WRITES) {
  test(`${name} runs ${core} through runAdminAction(youtubeAdminEnv)`, () => {
    const text = block(name)
    assert.match(text, /runAdminAction\(\s*youtubeAdminEnv\b/)
    assert.ok(text.includes(`${core}(`), `${name} lacks ${core}(`)
    assert.ok(text.includes('revalidate:'), `${name} does not revalidate`)
  })
}

test('no Phase 6 action calls assertAdmin directly', () => {
  for (const name of PHASE6) {
    assert.ok(!/\bassertAdmin\(/.test(block(name)), `${name} calls assertAdmin(`)
  }
})

test('createEpisode and updateEpisode pass the server video check', () => {
  for (const name of ['createEpisode', 'updateEpisode']) {
    assert.ok(block(name).includes('verifyVideo'), `${name} lacks verifyVideo`)
  }
  assert.ok(block('updateEpisode').includes('serverVideoVerifier(ctx.db, id)'))
})

test('the verifier builds its client from getServerYouTubeClient', () => {
  const region = seamRegion()
  assert.ok(region.includes('getServerYouTubeClient()'))
  assert.ok(region.includes('verifyVideoCore('))
})

test('no new action or shared helper references the key or logs with console.log', () => {
  const texts: Array<[string, string]> = [
    ...PHASE6.map((n): [string, string] => [n, block(n)]),
    ['seam helpers', seamRegion()],
  ]
  for (const [name, text] of texts) {
    for (const banned of ['apiKey', 'YOUTUBE_API_KEY', 'console.log']) {
      assert.ok(!text.includes(banned), `${name} contains ${banned}`)
    }
  }
})

test('the old database key reader is not used by the new actions', () => {
  for (const name of PHASE6) {
    assert.ok(!block(name).includes('getYouTubeApiKey('), `${name} calls getYouTubeApiKey(`)
  }
  assert.ok(!seamRegion().includes('getYouTubeApiKey('))
})

test('the scheduler actions accept an optional episode selection', () => {
  assert.match(block('previewShowSchedule'), /episodeIds\?: string\[\]/)
  const apply = block('applyShowSchedule')
  assert.match(apply, /episodeIds\?: string\[\]/)
  assert.ok(apply.includes('planOverride'), 'applyShowSchedule lacks planOverride')
})
