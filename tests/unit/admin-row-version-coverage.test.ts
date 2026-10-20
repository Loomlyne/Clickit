// Deferred item 23 residual (b), static guard: every UPDATE of shows, app_config or show_cast
// anywhere under src/ is either an optimistic-concurrency write on updated_at, or is listed
// below with the check it has instead (compare-and-swap on the previous column values, a state
// guard) or why it needs none. A new writer that is neither fails here, so it cannot skip the
// check. The admin actions that save those rows must take the page's updated_at, and every
// client call must pass it.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const TABLES = new Set(['shows', 'app_config', 'show_cast'])

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(name)) out.push(p)
  }
  return out
}

function closeParen(s: string, open: number): number {
  let depth = 0
  for (let i = open; i < s.length; i++) {
    if (s[i] === '(') depth++
    else if (s[i] === ')' && --depth === 0) return i
  }
  return -1
}

type Site = { file: string; line: number; table: string; chain: string; after: string }

/** Every `.update(` chain whose `.from(...)` is one of TABLES or not a string literal. */
function updateSites(): Site[] {
  const sites: Site[] = []
  for (const file of walk('src')) {
    const s = readFileSync(file, 'utf8')
    let at = 0
    while ((at = s.indexOf('.update(', at)) !== -1) {
      const end0 = closeParen(s, at + '.update'.length)
      const fromAt = s.lastIndexOf('.from(', at)
      const head = fromAt === -1 ? '' : s.slice(fromAt, at)
      // A hash .update() (createHash) or a builder without a nearby .from() is not a table write.
      if (fromAt === -1 || at - fromAt > 400 || head.includes(';') || /\n\s*\n/.test(head)) {
        at = end0
        continue
      }
      const arg = s.slice(fromAt + '.from('.length, closeParen(s, fromAt + '.from'.length)).trim()
      const literal = /^'([^']+)'$/.exec(arg)
      const table = literal ? literal[1]! : `<${arg}>`
      let end = end0
      for (;;) {
        const m = /^\s*\.(\w+)\(/.exec(s.slice(end + 1))
        if (!m) break
        end = closeParen(s, end + 1 + m[0].length - 1)
      }
      if (!literal || TABLES.has(table)) {
        sites.push({
          file,
          line: s.slice(0, at).split('\n').length,
          table,
          chain: s.slice(fromAt, end + 1).replace(/\s+/g, ' '),
          after: s.slice(at, end + 700).replace(/\s+/g, ' '),
        })
      }
      at = end
    }
  }
  return sites
}

type Allowed = {
  file: string
  /** Substring of the whitespace-normalised `.from(...)...update(...)` chain. */
  chain: string
  kind: 'column-cas' | 'state-guard' | 'undo' | 'derived'
  /** For column-cas and state-guard: what must follow the update (same statement or the next lines). */
  check?: RegExp
  /** Also writes app_config and must apply the settings page's updated_at when given. */
  pageVersion?: true
  why: string
}

const ALLOWED: Allowed[] = [
  {
    file: 'src/app/[locale]/admin/actions.ts',
    chain: ".update({ featured: !show.featured })",
    kind: 'column-cas',
    check: /\.eq\('featured', show\.featured\)/,
    why: 'toggleFeatured: a one-click toggle with no form state; CAS on the value it read flips exactly once.',
  },
  {
    file: 'src/lib/admin/counts.ts',
    chain: '.update({ season_count:',
    kind: 'derived',
    why: 'Counters recomputed from COUNT(*) after a season/episode write; idempotent, no form value.',
  },
  {
    file: 'src/lib/admin/hero-video.ts',
    chain: ".from(table as 'shows') .update(patch as never)",
    kind: 'column-cas',
    check: /q\.is\(c, null\) : q\.eq\(c, expected\)/,
    pageVersion: true,
    why: 'Video slot writes (1d6ce5b): CAS on the url read before.',
  },
  {
    file: 'src/lib/admin/image-db.ts',
    chain: ".from('shows') .update({ [target.column]: url } as never)",
    kind: 'column-cas',
    check: /q\.is\(column, null\) : q\.eq\(column, expected\)/,
    why: 'Show artwork finalize with commit true (1d6ce5b): CAS on the url read before. The drawer uses commit false.',
  },
  {
    file: 'src/lib/admin/image-db.ts',
    chain: ".from('app_config') .update({ [target.column]: url } as never)",
    kind: 'column-cas',
    check: /q\.is\(column, null\) : q\.eq\(column, expected\)/,
    pageVersion: true,
    why: 'Site image finalize (1d6ce5b): CAS on the url read before.',
  },
  {
    file: 'src/lib/admin/image-db.ts',
    chain: ".from('show_cast') .update({ image_url: url })",
    kind: 'column-cas',
    check: /q\.is\('image_url', null\) : q\.eq\('image_url', expected\)/,
    why: 'The only show_cast UPDATE (cast image finalize with a castId, 1d6ce5b): CAS on image_url. There is no cast edit or cast reorder action.',
  },
  {
    file: 'src/lib/admin/media-removal.ts',
    chain: '.from(table) .update({ [column]: null } as never)',
    kind: 'column-cas',
    check: /base\.is\(column, null\)\s*: base\.eq\(column, previous\)/,
    pageVersion: true,
    why: 'removeSiteImage / removePreloaderVideo (1d6ce5b): CAS clear on the value read before.',
  },
  {
    file: 'src/lib/admin/show-archive.ts',
    chain: '.update({ archived: true, slug: archiveSlugForShow(showId) })',
    kind: 'state-guard',
    check: /\.eq\('archived', false\)/,
    why: 'Archive (01.1): only an active row moves; no form value.',
  },
  {
    file: 'src/lib/admin/show-archive.ts',
    chain: '.update({ archived: false, slug: show.slug })',
    kind: 'undo',
    why: 'Compensation undo of the archive step in the same action.',
  },
  {
    file: 'src/lib/admin/show-archive.ts',
    chain: '.update(showPatch)',
    kind: 'state-guard',
    check: /\.eq\('archived', true\)/,
    why: 'Restore (01.1): only an archived row moves; the rename comes from the conflict dialog.',
  },
  {
    file: 'src/lib/admin/show-archive.ts',
    chain: '.update({ archived: true, slug: show.slug, title: show.title, title_ar: show.title_ar, })',
    kind: 'undo',
    why: 'Compensation undo of the restore step in the same action.',
  },
  {
    file: 'src/lib/admin/show-writes.ts',
    chain: '.update({ sort_order: n })',
    kind: 'column-cas',
    check: /\.eq\('sort_order', expected\)/,
    why: 'reorderShow: per-row CAS on the sort_order read before; both moves or neither.',
  },
  {
    file: 'src/app/api/cron/publish-scheduled/route.ts',
    chain: ".update({ status: 'now-streaming' })",
    kind: 'state-guard',
    check: /\.eq\('status', 'coming-soon'\)/,
    why: 'Scheduled publish cron: only a coming-soon show flips; no form value.',
  },
]

const isVersioned = (site: Site) => site.chain.includes(".eq('updated_at', ")

test('every UPDATE of shows, app_config or show_cast checks updated_at or is listed with its check', () => {
  const sites = updateSites()
  assert.ok(sites.length >= 10, `scanner found only ${sites.length} sites`)
  const offenders: string[] = []
  const used = new Set<Allowed>()
  for (const site of sites) {
    if (isVersioned(site)) continue
    const entry = ALLOWED.find((a) => a.file === site.file && site.chain.includes(a.chain))
    if (!entry) {
      offenders.push(`${site.file}:${site.line} ${site.chain.slice(0, 160)}`)
      continue
    }
    used.add(entry)
    if (entry.check) assert.match(site.after, entry.check, `${site.file}:${site.line} lost its ${entry.kind} check`)
    if (entry.pageVersion) {
      assert.match(site.after, /\.eq\('updated_at', \w+\.expected\)/, `${site.file}:${site.line} must apply the page version`)
    }
  }
  assert.deepEqual(offenders, [], `UPDATEs without an updated_at check:\n${offenders.join('\n')}`)
  const stale = ALLOWED.filter((a) => !used.has(a)).map((a) => `${a.file} ${a.chain}`)
  assert.deepEqual(stale, [], 'allow-list entries that match nothing (remove them)')
})

test('the versioned writes return the new updated_at', () => {
  for (const site of updateSites().filter(isVersioned)) {
    assert.match(site.chain, /\.select\(/, `${site.file}:${site.line} must select the row back`)
  }
  const core = readFileSync('src/lib/admin/row-version.ts', 'utf8')
  assert.match(core, /\.eq\('updated_at', version\.expected\)/)
})

// ---- the actions ----

const src = readFileSync('src/app/[locale]/admin/actions.ts', 'utf8')
function actions(): Array<{ name: string; body: string }> {
  const re = /export async function (\w+)\(/g
  const starts: Array<{ name: string; index: number }> = []
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) starts.push({ name: m[1]!, index: m.index })
  return starts.map((s, i) => ({ name: s.name, body: src.slice(s.index, starts[i + 1]?.index ?? src.length) }))
}

/** Actions that save shows or app_config from a loaded form: they take the page's updated_at. */
const VERSIONED_ACTIONS = [
  'updateShow',
  'setHeroVideoUrl',
  'removeHeroVideo',
  'setHeroVideoMuted',
  'removePreloaderVideo',
  'updateLiveStreamUrl',
  'updateSiteMetadata',
  'updateAuthPageConfig',
  'updateFooterContent',
  'updatePortfolioContent',
  'updateContactRecipient',
  'updateCtaCopy',
  'updateGenreConfig',
  'updateIntegrations',
  'updateFeatureFlags',
  'updateTopTicker',
  'removeSiteImage',
  'finalizeSiteImageUpload',
  'finalizeHeroVideoUpload',
  'finalizePreloaderVideoUpload',
]

const WRITES_ROW =
  /'app_config'|'app-config'|updateShowCore\(|setHeroVideoUrlCore\(|removeHeroVideoCore\(|'hero-desktop'|target: 'preloader'|updateIfUnchanged\(/

test('every action that saves app_config or a show form takes and validates updated_at', () => {
  const all = actions()
  for (const name of VERSIONED_ACTIONS) {
    const a = all.find((x) => x.name === name)
    assert.ok(a, `${name} missing`)
    assert.ok(a.body.includes('rowVersion('), `${name} must validate updated_at with rowVersion()`)
    assert.ok(/updatedAt/.test(a.body), `${name} must return the new updatedAt`)
  }
  const unlisted = all.filter((a) => WRITES_ROW.test(a.body) && !VERSIONED_ACTIONS.includes(a.name)).map((a) => a.name)
  assert.deepEqual(unlisted, [], 'actions that write app_config or a show form without the updated_at check')
})

test('no app_config or shows form save is left as a plain update in actions.ts', () => {
  assert.ok(!/from\('app_config'\)\s*(\/\/[^\n]*\n\s*)*\.update\(/.test(src), 'app_config writes go through updateIfUnchanged')
  assert.ok(!/\.from\('shows'\)\s*\.update\((?!\{ featured)/.test(src))
})

// ---- the clients ----

function callArgs(text: string, name: string): string[] {
  const out: string[] = []
  const re = new RegExp(`\\b${name}\\(`, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const open = m.index + m[0].length - 1
    out.push(text.slice(open, closeParen(text, open) + 1))
  }
  return out
}

test('every client call of a versioned action passes the version from a row-version hook', () => {
  const files = [...walk('src/components'), ...walk('src/app')].filter(
    (f) => !f.endsWith('admin/actions.ts') && !/\/page\.tsx$/.test(f)
  )
  const problems: string[] = []
  let calls = 0
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    const importsActions = text.includes("from '@/app/[locale]/admin/actions'")
    if (!importsActions) continue
    for (const name of VERSIONED_ACTIONS) {
      for (const args of callArgs(text, name)) {
        calls++
        if (!/expected/.test(args)) problems.push(`${file}: ${name}${args.slice(0, 80)}`)
        if (!/use(Shared)?RowVersion\(/.test(text)) problems.push(`${file}: no row-version hook`)
      }
    }
  }
  assert.ok(calls >= 15, `only ${calls} client calls found`)
  assert.deepEqual(problems, [])
})

test('the settings and inbox pages read app_config fresh with its updated_at; the tabs share one version', () => {
  for (const page of ['src/app/[locale]/admin/settings/page.tsx', 'src/app/[locale]/admin/inbox/page.tsx']) {
    const text = readFileSync(page, 'utf8')
    assert.ok(text.includes('getAppConfigWithVersion('), `${page} must read the row and its updated_at together`)
    assert.ok(/updatedAt/.test(text), `${page} must pass updatedAt to the form`)
  }
  const config = readFileSync('src/lib/config.ts', 'utf8')
  const fresh = config.slice(config.indexOf('export async function getAppConfigWithVersion'))
  assert.ok(fresh.length > 0 && !/unstable_cache|cache\(/.test(fresh.slice(0, 800)), 'the version read is not cached')
  assert.ok(readFileSync('src/components/admin/settings/settings-tabs.tsx', 'utf8').includes('<RowVersionProvider'))
  const form = readFileSync('src/components/admin/show-form.tsx', 'utf8')
  assert.ok(form.includes('useRowVersion(show?.updated_at'), 'the show drawer starts from the loaded row')
})
