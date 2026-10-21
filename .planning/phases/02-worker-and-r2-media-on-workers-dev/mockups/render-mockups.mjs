// Renders each mockup option to PNG with a headless Chromium, one at a time.
// Uses Playwright's cached chrome-headless-shell (no npm install needed).
// Usage: node render-mockups.mjs
import { execFileSync } from 'node:child_process'
import { readdirSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const cache = join(homedir(), 'Library/Caches/ms-playwright')
const shellDir = readdirSync(cache).filter((d) => d.startsWith('chromium_headless_shell-')).sort().pop()
if (!shellDir) throw new Error('No Playwright headless shell in ' + cache)
const sub = readdirSync(join(cache, shellDir)).find((d) => d.startsWith('chrome-headless-shell'))
const bin = join(cache, shellDir, sub, 'chrome-headless-shell')
if (!existsSync(bin)) throw new Error('Missing ' + bin)

const jobs = [
  ['turnstile-placement.html', 'A', 'turnstile-A.png', 1440, 1320],
  ['turnstile-placement.html', 'B', 'turnstile-B.png', 1440, 1300],
  ['turnstile-placement.html', 'C', 'turnstile-C.png', 1440, 1160],
  ['turnstile-placement.html', 'A', 'turnstile-A-mobile.png', 390, 3060],
  ['turnstile-placement.html', 'B', 'turnstile-B-mobile.png', 390, 2860],
  ['upload-states.html', 'A', 'upload-A.png', 1440, 1290],
  ['upload-states.html', 'B', 'upload-B.png', 1440, 1240],
  ['upload-states.html', 'M', 'upload-M.png', 1440, 1300],
]
for (const [file, only, out, w, h] of jobs) {
  const url = pathToFileURL(join(here, file)).href + '?only=' + only
  execFileSync(bin, ['--headless', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
    '--virtual-time-budget=3000', `--window-size=${w},${h}`, `--screenshot=${join(here, out)}`, url], { stdio: 'ignore' })
  console.log('wrote', out)
}
