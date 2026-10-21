// Plan 02-19 guard (MEDIA-01 / PLAT-01): nothing reachable from a Worker request path
// may load sharp or the AWS S3 SDK (Node-only; sharp fails to load on workerd and turned
// every admin server action into a 500, deferred item 10), and no upload body goes
// through a server action. scripts/ and tests/ keep both packages (devDependencies).
//
// Static scan, no bundler: (1) every source file the Worker can ship (src/, the app
// Worker entry files, workers/media/src) must not import the banned packages or the
// deleted mirror modules; (2) the import graph from every route entry is walked so a
// banned import reached through a helper is named with its path.
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const CODE = /\.(ts|tsx|mts|js|jsx|mjs)$/

const BANNED_SPECIFIER = /^(sharp(\/|$)|@aws-sdk\/|@smithy\/)/
const BANNED_LOCAL = /(^|\/)r2-media(-core)?(\.ts)?$/

const OLD_ACTIONS = [
  'uploadArtwork',
  'uploadSiteImage',
  'uploadSocialIcon',
  'uploadCastImage',
  'uploadAvatar',
  'createHeroVideoUpload',
  'saveHeroVideoUpload',
  'createPreloaderVideoUpload',
  'savePreloaderVideoUpload',
  'createShowVideoUpload',
  'saveShowVideoUpload',
]

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (CODE.test(name)) out.push(full)
  }
  return out
}

/** Static, dynamic and require() specifiers in a source text (comments stripped). */
function specifiersOf(text: string): string[] {
  const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1')
  const out: string[] = []
  const re =
    /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)(['"])([^'"\n]+)\1/g
  for (let m = re.exec(code); m; m = re.exec(code)) out.push(m[2]!)
  return out
}

const shipped = [
  ...walk(join(ROOT, 'src')),
  ...walk(join(ROOT, 'workers/media/src')),
  ...['custom-worker.ts', 'image-loader.ts', 'open-next.config.ts']
    .map((f) => join(ROOT, f))
    .filter(existsSync),
]

test('specifiersOf finds static, dynamic and require imports and ignores comments', () => {
  const s = specifiersOf(
    [
      "import a from 'sharp'",
      "export { x } from '@aws-sdk/client-s3'",
      "const m = await import('sharp')",
      "const r = require('@aws-sdk/x')",
      "// import z from 'sharp'",
      "/* import y from '@aws-sdk/y' */",
      "import 'side-effect'",
    ].join('\n')
  )
  assert.deepEqual(s, ['sharp', '@aws-sdk/client-s3', 'sharp', '@aws-sdk/x', 'side-effect'])
})

test('no shipped source imports sharp, the AWS SDK or the deleted r2-media modules', () => {
  assert.ok(shipped.length > 100, 'scan found too few files')
  const bad: string[] = []
  for (const file of shipped) {
    for (const spec of specifiersOf(readFileSync(file, 'utf8'))) {
      if (BANNED_SPECIFIER.test(spec) || BANNED_LOCAL.test(spec)) {
        bad.push(`${relative(ROOT, file)} imports ${spec}`)
      }
    }
  }
  assert.deepEqual(bad, [])
})

test('the request graph from every route, action and middleware entry reaches no banned package', () => {
  const entries = walk(join(ROOT, 'src/app')).filter((f) =>
    /(^|\/)(page|layout|route|actions|not-found|error|global-error|loading|template|default|opengraph-image|icon|sitemap|robots|manifest)\.(ts|tsx)$/.test(f)
  )
  for (const f of ['src/proxy.ts', 'src/middleware.ts', 'custom-worker.ts', 'image-loader.ts']) {
    if (existsSync(join(ROOT, f))) entries.push(join(ROOT, f))
  }
  assert.ok(entries.length > 20, 'found too few request entries')

  const resolveLocal = (from: string, spec: string): string | null => {
    let base: string | null = null
    if (spec.startsWith('@/')) base = join(ROOT, 'src', spec.slice(2))
    else if (spec.startsWith('.')) base = resolve(dirname(from), spec)
    if (!base || base.includes('/.open-next/') || base.includes('/node_modules/')) return null
    for (const cand of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
      if (existsSync(cand) && statSync(cand).isFile()) return cand
    }
    return null
  }

  const seen = new Set<string>()
  const bad: string[] = []
  const visit = (file: string, trail: string[]) => {
    if (seen.has(file)) return
    seen.add(file)
    for (const spec of specifiersOf(readFileSync(file, 'utf8'))) {
      if (BANNED_SPECIFIER.test(spec)) {
        bad.push([...trail, relative(ROOT, file), spec].join(' -> '))
        continue
      }
      const next = resolveLocal(file, spec)
      if (next) visit(next, [...trail, relative(ROOT, file)])
    }
  }
  for (const entry of entries) visit(entry, [])
  assert.ok(seen.size > 200, `graph walk reached only ${seen.size} files`)
  assert.deepEqual(bad, [])
})

test('the mirror module files and the old FormData upload actions are gone', () => {
  assert.equal(existsSync(join(ROOT, 'src/lib/r2-media-core.ts')), false)
  assert.equal(existsSync(join(ROOT, 'src/lib/r2-media.ts')), false)
  assert.equal(existsSync(join(ROOT, 'tests/unit/r2-media.test.ts')), false)
  const admin = readFileSync(join(ROOT, 'src/app/[locale]/admin/actions.ts'), 'utf8')
  const profile = readFileSync(join(ROOT, 'src/app/[locale]/(viewer)/profile/actions.ts'), 'utf8')
  for (const name of OLD_ACTIONS) {
    assert.equal(
      new RegExp(`export\\s+async\\s+function\\s+${name}\\b`).test(admin + profile),
      false,
      `${name} is back`
    )
  }
})

test('server actions accept no upload body: bodySizeLimit is 2mb', () => {
  const cfg = readFileSync(join(ROOT, 'next.config.ts'), 'utf8')
  assert.match(cfg, /bodySizeLimit:\s*'2mb'/)
})

test('sharp and @aws-sdk/client-s3 are devDependencies only', () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
    dependencies: Record<string, string>
    devDependencies: Record<string, string>
  }
  for (const name of ['sharp', '@aws-sdk/client-s3']) {
    assert.equal(pkg.dependencies[name], undefined, `${name} is a runtime dependency`)
    assert.ok(pkg.devDependencies[name], `${name} missing from devDependencies`)
  }
  for (const name of Object.keys(pkg.dependencies)) {
    assert.equal(/^@aws-sdk\//.test(name), false, `${name} is a runtime dependency`)
  }
})
