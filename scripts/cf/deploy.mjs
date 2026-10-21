// The only deploy path (D-03, D-04, PLAT-08; Phase 3 D-07, D-18). Run by the control
// session after gate:local and Koss's word. It refuses unless every rule in
// scripts/cf/deploy-guard.mjs passes. No GitHub deploy token exists.
//
// Usage (via npm scripts, which pin HOME):
//   Production (www), flip day = ONE build, then a dry run and a deploy of that same build:
//   npm run cf:build:production -- --verify-report <path>                  # build + stamp
//   npm run cf:deploy:production -- --dry-run --verify-report <path>       # guard only
//   npm run cf:deploy:production -- --verify-report <path>                 # deploy-only
//   (--target production never builds; it deploys the stamped build with --env production
//   and records it in /Users/koss/.clickit-cloudflare/clickit.last-deploy.json)
//   npm run cf:deploy:workersdev -- --media-flag off
//   npm run cf:deploy:workersdev -- --media-flag verified --media-origin <https origin> \
//        --verify-report <path> [--manifest <path>]
//   npm run cf:deploy:media -- --env supabase-only   # Supabase originals (production today)
//   npm run cf:deploy:media -- --env r2              # R2 first: only after DNS-PLAN.md §5d passes
//   npm run cf:deploy:media -- --env r2-workersdev   # separate clickit-media-r2 Worker, workers.dev only (Step 28)
//   (clickit-media serves media.clickitstory.ae in every env, so either one changes production media)
//   add --dry-run to run the guard only (no build, no deploy)
//   add --offline (only with --dry-run) to skip wrangler whoami and every wrangler call;
//   the guard then reports "account check: skipped (offline)" (production also
//   "secret check: skipped (offline)") and checks the rest
//   production reads `wrangler secret list --name clickit` (names only, never printed):
//   RESEND_API_KEY must be set and CLEANUP_SUPABASE_ORIGINALS must not be
//   D-18: after a production deploy, --target workersdev is refused unless
//   --override-production-reason "<why, 15+ characters>" is passed (Koss's word only)
//   add --allow-upload-sweep-delete ONLY on Koss's word, when wrangler.jsonc sets
//   R2_UPLOAD_SWEEP_DELETE to "on" (the weekly cron then deletes unfinalised R2 uploads);
//   without it the guard refuses "on"
//
// Prints reasons and never any env value. Refuses while a .env file that
// OpenNext folds into the bundle exists in the root (before the build and again
// before the upload) and when the built next-env.mjs carries any value.

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  MEDIA_ENVS,
  NEXT_ENV_MODULE_PATH,
  PRODUCTION_CRONS,
  PRODUCTION_ROUTE,
  PRODUCTION_WORKER_NAME,
  UPLOAD_SWEEP_FLAG,
  checkDeploy,
  checkEnvFiles,
  checkMediaDeploy,
  checkProductionDeploy,
  checkTargetSwitch,
  findFoldedEnvFiles,
  parseJsonc,
} from './deploy-guard.mjs'
import { DEFAULT_MANIFEST_PATH, STAMP_PATH, fileSha256, loadManifestInfo } from './build-target.mjs'
import { CLICKIT_HOME, checkEnv, checkWhoamiOutput, wranglerChildEnv } from './wrangler-guard.mjs'

// D-18 state: which target of the clickit Worker was deployed last. Outside the repo,
// next to the pinned wrangler login; holds a target, a commit sha and a time only.
export const LAST_DEPLOY_PATH = `${CLICKIT_HOME}/clickit.last-deploy.json`

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

// Read-only: secret names of the production Worker (the API returns no values). The
// output goes to the guard only and is never printed. null when wrangler fails.
function readSecretList() {
  const res = run('npx', ['wrangler', 'secret', 'list', '--name', PRODUCTION_WORKER_NAME])
  if (res.error || res.status !== 0) return null
  return res.stdout ?? ''
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

function printNotes(notes) {
  for (const note of notes ?? []) console.log(note)
}

/** null when no deploy was recorded; a fail-closed marker when the file is unreadable. */
function readLastDeploy() {
  if (!existsSync(LAST_DEPLOY_PATH)) return null
  try {
    const parsed = JSON.parse(readFileSync(LAST_DEPLOY_PATH, 'utf8'))
    return parsed && typeof parsed === 'object' ? parsed : { target: 'unreadable' }
  } catch {
    return { target: 'unreadable' }
  }
}

function writeLastDeploy(target, gitSha) {
  const record = { target, gitSha, deployedAt: new Date().toISOString() }
  writeFileSync(LAST_DEPLOY_PATH, `${JSON.stringify(record, null, 2)}\n`)
}

function warnUploadSweep(vars) {
  if (vars?.[UPLOAD_SWEEP_FLAG] !== 'on') return
  console.warn('')
  console.warn(`!!! ${UPLOAD_SWEEP_FLAG}=on: the weekly cleanup-media cron will DELETE unfinalised R2 uploads !!!`)
  console.warn('!!! Allowed by --allow-upload-sweep-delete. Only with Koss\'s word.                          !!!')
  console.warn('')
}

function readJsonOrNull(path) {
  try {
    return readJson(path)
  } catch {
    return null
  }
}

function readManifest(argv) {
  const manifestPath = readOption(argv, '--manifest') ?? DEFAULT_MANIFEST_PATH
  if (!existsSync(manifestPath)) return null
  try {
    return loadManifestInfo(manifestPath)
  } catch {
    return null
  }
}

function parentChecks() {
  const reasons = []
  if (process.env.HOME !== CLICKIT_HOME) reasons.push(`HOME must be ${CLICKIT_HOME}`)
  const env = checkEnv(process.env, 'remote')
  if (!env.ok) reasons.push(env.reason)
  return reasons
}

function deployWorkersdev(argv) {
  const dryRun = argv.includes('--dry-run')
  const offline = argv.includes('--offline')
  // A real deploy needs the flag spelled out; the dry run defaults to off.
  const mediaFlag = readOption(argv, '--media-flag') ?? (dryRun ? 'off' : undefined)
  if (mediaFlag !== 'off' && mediaFlag !== 'verified') {
    return refuse(['--media-flag off|verified is required'])
  }
  const early = parentChecks()
  if (early.length > 0) return refuse(early)

  // D-18: refuse before any build when production is the last deploy of clickit.
  const overrideReason = readOption(argv, '--override-production-reason')
  const switchCheck = checkTargetSwitch({ lastDeploy: readLastDeploy(), target: 'workersdev', overrideReason })
  if (!switchCheck.ok) return refuse(switchCheck.reasons)
  if (switchCheck.overridden) {
    console.log(`D-18 override: workers.dev deploy after a production deploy. Reason: ${String(overrideReason).trim()}`)
  }

  const whoami = offline ? null : readWhoami()
  if (whoami === null && !offline) return refuse(['could not run wrangler whoami'])
  const git = gitInfo()

  if (!dryRun) {
    // Refuse before a long build when the account or the tree is already wrong.
    const pre = []
    const who = checkWhoamiOutput(whoami, 'remote')
    if (!who.ok) pre.push(who.reason)
    if (git.status.trim() !== '') pre.push('working tree is dirty: commit or remove changes first')
    pre.push(...checkEnvFiles(findFoldedEnvFiles(process.cwd())).reasons)
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
  const reportPath = readOption(argv, '--verify-report')
  if (reportPath && existsSync(reportPath)) verifyReport = readJson(reportPath)
  const manifest = readManifest(argv)
  const wranglerConfig = parseJsonc(readFileSync('wrangler.jsonc', 'utf8'))

  const result = checkDeploy({
    whoami,
    offline,
    processEnv: process.env,
    stamp,
    headSha: git.head,
    gitStatus: git.status,
    originBranches: git.branches,
    wranglerConfig,
    verifyReport,
    manifest,
    // Checked again right before the upload: a file added during the build counts too.
    envFilesPresent: findFoldedEnvFiles(process.cwd()),
    nextEnvText: existsSync(NEXT_ENV_MODULE_PATH) ? readFileSync(NEXT_ENV_MODULE_PATH, 'utf8') : null,
    allowUploadSweepDelete: argv.includes('--allow-upload-sweep-delete'),
  })
  printNotes(result.notes)
  if (!result.ok) return refuse(result.reasons)
  warnUploadSweep(wranglerConfig?.vars)
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
  writeLastDeploy('workersdev', git.head)
  const url = /https:\/\/[^\s]+\.workers\.dev/.exec(res.stdout ?? '')
  if (url) console.log(`deployed: ${url[0]}`)
  return 0
}

// Deploy-only, in both modes: this never builds. The build is cf:build:production
// (build-target.mjs --target production), which wrote the stamp this deploys.
function deployProduction(argv) {
  const dryRun = argv.includes('--dry-run')
  const offline = argv.includes('--offline')
  const reportPath = readOption(argv, '--verify-report')
  if (!reportPath || reportPath.startsWith('--')) {
    return refuse(['--verify-report <path> is required: the same report cf:build:production used'])
  }
  const early = parentChecks()
  if (early.length > 0) return refuse(early)

  const switchCheck = checkTargetSwitch({ lastDeploy: readLastDeploy(), target: 'production' })
  if (!switchCheck.ok) return refuse(switchCheck.reasons)

  const whoami = offline ? null : readWhoami()
  if (whoami === null && !offline) return refuse(['could not run wrangler whoami'])
  // RESEND_API_KEY present, CLEANUP_SUPABASE_ORIGINALS absent (runbook Step 25), dry run too.
  const secretList = offline ? null : readSecretList()
  if (secretList === null && !offline) return refuse([`could not run wrangler secret list --name ${PRODUCTION_WORKER_NAME}`])
  const git = gitInfo()

  if (!dryRun) {
    // Refuse early when the account or the tree is already wrong.
    const pre = []
    const who = checkWhoamiOutput(whoami, 'remote')
    if (!who.ok) pre.push(who.reason)
    if (git.status.trim() !== '') pre.push('working tree is dirty: commit or remove changes first')
    if (pre.length > 0) return refuse(pre)
  }

  const stamp = existsSync(STAMP_PATH) ? readJsonOrNull(STAMP_PATH) : null
  if (stamp) {
    console.log(`deploy-only: using build stamp ${String(stamp.gitSha ?? '').slice(0, 7)} built ${String(stamp.createdAt)}`)
  }
  const reportExists = existsSync(reportPath)
  const verifyReport = reportExists ? readJsonOrNull(reportPath) : null
  const verifyReportSha256 = reportExists ? fileSha256(reportPath) : null
  const manifest = readManifest(argv)
  const wranglerConfig = parseJsonc(readFileSync('wrangler.jsonc', 'utf8'))

  const result = checkProductionDeploy({
    whoami,
    offline,
    processEnv: process.env,
    stamp,
    headSha: git.head,
    gitStatus: git.status,
    originBranches: git.branches,
    wranglerConfig,
    verifyReport,
    verifyReportSha256,
    manifest,
    envFilesPresent: findFoldedEnvFiles(process.cwd()),
    nextEnvText: existsSync(NEXT_ENV_MODULE_PATH) ? readFileSync(NEXT_ENV_MODULE_PATH, 'utf8') : null,
    allowUploadSweepDelete: argv.includes('--allow-upload-sweep-delete'),
    secretList,
  })
  printNotes(result.notes)
  if (!result.ok) return refuse(result.reasons)
  warnUploadSweep(wranglerConfig?.env?.production?.vars)
  if (dryRun) {
    console.log('deploy-guard ok (dry run)')
    return 0
  }
  console.log('deploy-guard ok')

  const res = run('npx', ['opennextjs-cloudflare', 'deploy', '--env', 'production'], {
    stdio: ['inherit', 'pipe', 'inherit'],
  })
  if (res.stdout) process.stdout.write(res.stdout)
  if (res.status !== 0) {
    console.error(`production deploy failed (exit ${res.status})`)
    return res.status ?? 1
  }
  writeLastDeploy('production', git.head)
  console.log(`deployed production: route ${PRODUCTION_ROUTE}, crons ${PRODUCTION_CRONS.join(', ')}`)
  console.log(`D-18: ${LAST_DEPLOY_PATH} now says production; cf:deploy:workersdev is refused until Phase 3 closes`)
  return 0
}

function deployMedia(argv) {
  const dryRun = argv.includes('--dry-run')
  const offline = argv.includes('--offline')
  if (!argv.includes('--env')) {
    return refuse([`--env is required: pass one of ${MEDIA_ENVS.map((e) => `--env ${e}`).join(', ')}`])
  }
  const mediaEnv = readOption(argv, '--env')
  const early = parentChecks()
  if (early.length > 0) return refuse(early)

  const whoami = offline ? null : readWhoami()
  if (whoami === null && !offline) return refuse(['could not run wrangler whoami'])
  const git = gitInfo()
  const wranglerConfig = parseJsonc(readFileSync('workers/media/wrangler.jsonc', 'utf8'))

  const result = checkMediaDeploy({
    whoami,
    offline,
    processEnv: process.env,
    gitStatus: git.status,
    wranglerConfig,
    env: mediaEnv,
  })
  printNotes(result.notes)
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

/**
 * `--offline` is a work-session dry run only: it skips wrangler whoami and every wrangler
 * call, so it can never be part of a real deploy.
 * @param {string[]} argv
 * @returns {string[]} reasons
 */
export function offlineFlagReasons(argv) {
  if (argv.includes('--offline') && !argv.includes('--dry-run')) {
    return ['--offline is only allowed together with --dry-run']
  }
  return []
}

function main(argv) {
  process.chdir(resolve(dirname(fileURLToPath(import.meta.url)), '../..'))
  const offline = offlineFlagReasons(argv)
  if (offline.length > 0) return refuse(offline)
  const target = readOption(argv, '--target')
  if (target === 'production') return deployProduction(argv)
  if (target === 'workersdev') return deployWorkersdev(argv)
  if (target === 'media') return deployMedia(argv)
  console.error('usage: deploy.mjs --target production|workersdev|media [--dry-run [--offline]]')
  return 1
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(main(process.argv.slice(2)))
}
