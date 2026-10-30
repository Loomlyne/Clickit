#!/usr/bin/env node

/**
 * Digest screenshots for the controller (Phase 5, plan 05-11, Task 4): the 5-show digest
 * fixture (second show without a thumbnail) in EN and AR, rendered through the direct
 * React path and through the pre-rendered fill path, saved as four PNGs in
 * .planning/phases/05-accounts-and-email/mockups/05-11-digest-<en|ar>-<direct|prerendered>.png.
 * Prints per pair whether the two PNG buffers are byte-equal.
 *
 * Heavy step (Playwright): run detached under the lock, one Chromium, sequential pages:
 *   caffeinate -i -s -m perl -MPOSIX -e 'POSIX::setsid(); exec @ARGV' bash scripts/heavy-run.sh \
 *     node --experimental-strip-types --disable-warning=ExperimentalWarning \
 *     --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/email-parity-shots.mjs \
 *     > /Users/koss/.clickit-checks/p5-05-11-shots.log 2>&1 &
 *
 * No network: the logo URL is served from public/brand/email-logo-white.png and every
 * thumbnail URL from public/brand/cit-story.png; any other request is aborted.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { LOGO_URL } from '../src/emails/brand.ts'
import { renderAppEmail } from '../src/emails/render-app.ts'
import { renderAppEmailDirect } from '../src/emails/app/direct.ts'
import { PARITY_CTX, digestFiveShows } from '../tests/unit/helpers/app-email-fixtures.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const MOCKUPS = `${root}.planning/phases/05-accounts-and-email/mockups`
const LOGO_PNG = readFileSync(`${root}public/brand/email-logo-white.png`)
const THUMB_PNG = readFileSync(`${root}public/brand/cit-story.png`)
const THUMB_PREFIX = 'https://media.clickitstory.ae/shows/'

async function main() {
  const browser = await chromium.launch()
  let allEqual = true
  try {
    const context = await browser.newContext({
      viewport: { width: 700, height: 900 },
      colorScheme: 'light',
      deviceScaleFactor: 1,
    })
    await context.route('**/*', (route) => {
      const url = route.request().url()
      if (url === LOGO_URL) {
        return route.fulfill({ status: 200, contentType: 'image/png', body: LOGO_PNG })
      }
      if (url.startsWith(THUMB_PREFIX)) {
        return route.fulfill({ status: 200, contentType: 'image/png', body: THUMB_PNG })
      }
      return route.abort()
    })
    for (const locale of ['en', 'ar']) {
      const row = digestFiveShows(locale)
      const shots = {}
      for (const [path, render] of [
        ['direct', renderAppEmailDirect],
        ['prerendered', renderAppEmail],
      ]) {
        const { html } = await render(row, PARITY_CTX)
        const page = await context.newPage()
        await page.setContent(html, { waitUntil: 'load' })
        const file = `${MOCKUPS}/05-11-digest-${locale}-${path}.png`
        shots[path] = await page.screenshot({ path: file, fullPage: true })
        await page.close()
        console.log(`wrote ${file.slice(root.length)} (${shots[path].length} bytes)`)
      }
      const equal = Buffer.compare(shots.direct, shots.prerendered) === 0
      if (!equal) allEqual = false
      console.log(`pair ${locale}: png byte-equal=${equal}`)
    }
  } finally {
    await browser.close()
  }
  if (!allEqual) process.exitCode = 1
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
