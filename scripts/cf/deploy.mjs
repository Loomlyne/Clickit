// The only deploy path for Phase 2 (D-03, D-04, PLAT-08). Run by the control
// session after gate:local and Koss's word. It refuses unless every rule in
// scripts/cf/deploy-guard.mjs passes. No GitHub deploy token exists.
//
// Usage (via npm scripts, which pin HOME):
//   npm run cf:deploy:workersdev -- --media-flag off
//   npm run cf:deploy:workersdev -- --media-flag verified --media-origin <https origin> \
//        --verify-report <path> [--manifest <path>]
//   npm run cf:deploy:media -- --env supabase-only   # Supabase originals (production today)
//   npm run cf:deploy:media -- --env r2              # R2 first: only after DNS-PLAN.md §5d passes
//   (clickit-media serves media.clickitstory.ae in every env, so either one changes production media)
//   add --dry-run to run the guard only (no build, no deploy)
//
// Prints reasons and never any env value.

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkDeploy, checkMediaDeploy, parseJsonc } from './deploy-guard.mjs'
import { DEFAULT_MANIFEST_PATH, STAMP_PATH, loadManifestInfo } from './build-target.mjs'
import { CLICKIT_HOME, checkEnv, checkWhoamiOutput, wranglerChildEnv } from './wrangler-guard.mjs'

function readOption(argv, name) {
  const i = argv.lastIndexOf(name)
  return i >= 0 ? argv[i + 1] : undefined
}

function run(command, args, options = {}) {
  return spawnSync(command, args, { encoding: 'utf8', env: wranglerChildEnv(process.env), ...options })
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function readWhoami() {
  const res = run('npx', ['wrangler', 'whoami'])
  if (res.error) return null
  return `${res.stdout ?? ''}\n${res.stderr ?? ''}`
}

function gitInfo() {
  const head = run('git', ['rev-parse', 'HEAD']).stdout.trim()
  const status = run('git', ['status', '--porcelain']).stdout
  const branches = run('git', ['branch', '-r', '--contains', 'HEAD']).stdout
  return { head, status, branches }
}

function refuse(reasons) {
  console.error('deploy-guard REFUSED:')
  for (const reason of reasons) console.error(`  - ${reason}`)
  return 1
}

function parentChecks() {
  const reasons = []
  if (process.env.HOME !== CLICKIT_HOME) reasons.push(`HOME must be ${CLICKIT_HOME}`)
  const env = checkEnv(process.env)
  if (!env.ok) reasons.push(env.reason)
  return reasons
}

function deployWorkersdev(argv) {
  const dryRun = argv.includes('--dry-run')
  // A real deploy needs the flag spelled out; the dry run defaults to off.
  const mediaFlag = readOption(argv, '--media-flag') ?? (dryRun ? 'off' : undefined)
  if (mediaFlag !== 'off' && mediaFlag !== 'verified') {
    return refuse(['--media-flag off|verified is required'])
  }
  const early = parentChecks()
  if (early.length > 0) return refuse(early)

  const whoami = readWhoami()
  if (whoami === null) return refuse(['could not run wrangler whoami'])
  const git = gitInfo()

  if (!dryRun) {
    // Refuse before a long build when the account or the tree is already wrong.
    const pre = []
    const who = checkWhoamiOutput(whoami, 'remote')
    if (!who.ok) pre.push(who.reason)
    if (git.status.trim() !== '') pre.push('working tree is dirty: commit or remove changes first')
    if (pre.length > 0) return refuse(pre)

    const buildArgs = ['scripts/cf/build-target.mjs', '--target', 'workersdev', '--media-flag', mediaFlag]
    for (const name of ['--media-origin', '--verify-report', '--manifest']) {
      const value = readOption(argv, name)
      if (value !== undefined) buildArgs.push(name, value)
    }
    const build = spawnSync('node', buildArgs, { env: { ...process.env, HOME: CLICKIT_HOME }, stdio: 'inherit' })
    if (build.status !== 0) return refuse([`workersdev build failed (exit ${build.status})`])
  }

  const stamp = existsSync(STAMP_PATH) ? readJson(STAMP_PATH) : null
  let verifyReport = null
  let manifest = null
  const reportPath = readOption(argv, '--verify-report')
  if (reportPath && existsSync(reportPath)) verifyReport = readJson(reportPath)
  const manifestPath = readOption(argv, '--manifest') ?? DEFAULT_MANIFEST_PATH
  if (existsSync(manifestPath)) {
    try {
      manifest = loadManifestInfo(manifestPath)
    } catch {
      manifest = null
    }
  }
  const wranglerConfig = parseJsonc(readFileSync('wrangler.jsonc', 'utf8'))

  const result = checkDeploy({
    whoami,
    processEnv: process.env,
    stamp,
    headSha: git.head,
    gitStatus: git.status,
    originBranches: git.branches,
    wranglerConfig,
    verifyReport,
    manifest,
  })
  if (!result.ok) return refuse(result.reasons)
  if (dryRun) {
    console.log('deploy-guard ok (dry run)')
    return 0
  }
  console.log('deploy-guard ok')

  const res = run('npx', ['opennextjs-cloudflare', 'deploy'], { stdio: ['inherit', 'pipe', 'inherit'] })
  if (res.stdout) process.stdout.write(res.stdout)
  if (res.status !== 0) {
    console.error(`deploy failed (exit ${res.status})`)
    return res.status ?? 1
  }
  const url = /https:\/\/[^\s]+\.workers\.dev/.exec(res.stdout ?? '')
  if (url) console.log(`deployed: ${url[0]}`)
  return 0
}

function deployMedia(argv) {
  const dryRun = argv.includes('--dry-run')
  if (!argv.includes('--env')) {
    return refuse(['--env is required: pass --env supabase-only or --env r2'])
  }
  const mediaEnv = readOption(argv, '--env')
  const early = parentChecks()
  if (early.length > 0) return refuse(early)

  const whoami = readWhoami()
  if (whoami === null) return refuse(['could not run wrangler whoami'])
  const git = gitInfo()
  const wranglerConfig = parseJsonc(readFileSync('workers/media/wrangler.jsonc', 'utf8'))

  const result = checkMediaDeploy({
    whoami,
    processEnv: process.env,
    gitStatus: git.status,
    wranglerConfig,
    env: mediaEnv,
  })
  if (!result.ok) return refuse(result.reasons)
  if (dryRun) {
    console.log('deploy-guard ok (dry run)')
    return 0
  }
  console.log('deploy-guard ok')

  // The env is always passed explicitly so wrangler never guesses.
  const res = run('npx', ['wrangler', 'deploy', '-c', 'workers/media/wrangler.jsonc', '--env', mediaEnv], {
    stdio: ['inherit', 'pipe', 'inherit'],
  })
  if (res.stdout) process.stdout.write(res.stdout)
  if (res.status !== 0) {
    console.error(`media deploy failed (exit ${res.status})`)
    return res.status ?? 1
  }
  const url = /https:\/\/[^\s]+\.workers\.dev/.exec(res.stdout ?? '')
  if (url) console.log(`deployed: ${url[0]}`)
  return 0
}

function main(argv) {
  process.chdir(resolve(dirname(fileURLToPath(import.meta.url)), '../..'))
  const target = readOption(argv, '--target')
  if (target === 'workersdev') return deployWorkersdev(argv)
  if (target === 'media') return deployMedia(argv)
  console.error('usage: deploy.mjs --target workersdev|media [--dry-run]')
  return 1
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(main(process.argv.slice(2)))
}
