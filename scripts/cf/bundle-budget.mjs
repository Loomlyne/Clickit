// Worker bundle budget (Phase 5, plan 05-19, controller condition 3). Runs in
// gate:local right after cf:build: a local wrangler dry run (nothing uploaded, no
// network needed) bundles custom-worker.ts with the OpenNext output, and the gate fails
// when the gzip size wrangler reports is above BUDGET_GZIP_KIB. The Workers Free limit
// is 3 MiB (3,072 KiB) compressed; the budget keeps 72 KiB of headroom under it.
//
//   HOME=/Users/koss/.clickit-cloudflare node scripts/cf/bundle-budget.mjs [--metafile <path>]
//
// Uses the repo's own wrangler (node_modules/.bin), never npx, so no registry fetch.

import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CLICKIT_HOME, wranglerChildEnv } from './wrangler-guard.mjs'

export const BUDGET_GZIP_KIB = 3000

const UNIT = { B: 1 / 1024, KiB: 1, MiB: 1024 }

/**
 * Reads the last "Total Upload: <n> <unit> / gzip: <n> <unit>" line of wrangler's output.
 * @param {string} text
 * @returns {{ totalKiB: number, gzipKiB: number } | null}
 */
export function parseUploadSize(text) {
  const re = /Total Upload:\s*([\d.]+)\s*(B|KiB|MiB)\s*\/\s*gzip:\s*([\d.]+)\s*(B|KiB|MiB)/g
  let last = null
  for (const m of String(text).matchAll(re)) last = m
  if (!last) return null
  const totalKiB = Number(last[1]) * UNIT[last[2]]
  const gzipKiB = Number(last[3]) * UNIT[last[4]]
  if (!Number.isFinite(totalKiB) || !Number.isFinite(gzipKiB)) return null
  return { totalKiB: Math.round(totalKiB * 100) / 100, gzipKiB: Math.round(gzipKiB * 100) / 100 }
}

/**
 * @param {{ totalKiB: number, gzipKiB: number } | null} size
 * @param {number} [budget]
 * @returns {{ ok: boolean, line: string }}
 */
export function checkBudget(size, budget = BUDGET_GZIP_KIB) {
  if (!size) return { ok: false, line: 'bundle-budget refused: no "Total Upload ... gzip" line in the wrangler output' }
  const head = `gzip=${size.gzipKiB.toFixed(2)} KiB total=${size.totalKiB.toFixed(2)} KiB budget=${budget} KiB`
  return size.gzipKiB <= budget
    ? { ok: true, line: `bundle-budget ok ${head} headroom=${(budget - size.gzipKiB).toFixed(2)} KiB` }
    : { ok: false, line: `bundle-budget FAIL ${head} over=${(size.gzipKiB - budget).toFixed(2)} KiB` }
}

function main(argv) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
  if (process.env.HOME !== CLICKIT_HOME) {
    console.error(`bundle-budget refused: HOME must be ${CLICKIT_HOME}`)
    return 1
  }
  if (!existsSync(join(root, '.open-next/worker.js'))) {
    console.error('bundle-budget refused: .open-next/worker.js missing (run npm run cf:build first)')
    return 1
  }
  const wrangler = join(root, 'node_modules/.bin/wrangler')
  const outdir = mkdtempSync(join(tmpdir(), 'clickit-bundle-budget-'))
  const i = argv.indexOf('--metafile')
  const metafile = i >= 0 ? argv[i + 1] : undefined
  try {
    const args = ['deploy', '--dry-run', '--outdir', outdir]
    if (metafile) args.push('--metafile', resolve(metafile))
    const res = spawnSync(wrangler, args, { cwd: root, env: wranglerChildEnv(process.env), encoding: 'utf8' })
    const text = `${res.stdout ?? ''}\n${res.stderr ?? ''}`
    if (res.status !== 0) {
      console.error(`bundle-budget refused: wrangler dry run exit ${res.status}`)
      console.error(text.split('\n').filter((l) => /error|✘/i.test(l)).slice(0, 10).join('\n'))
      return 1
    }
    const result = checkBudget(parseUploadSize(text))
    ;(result.ok ? console.log : console.error)(result.line)
    return result.ok ? 0 : 1
  } finally {
    rmSync(outdir, { recursive: true, force: true })
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(main(process.argv.slice(2)))
}
