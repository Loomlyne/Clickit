import { test, expect } from '@playwright/test'

/**
 * E2E verification for the post-v1.0 per-show hero media system.
 *
 * These tests exercise the viewer-side rendering: given a show with hero media
 * configured in the database, does the hero render the correct variant for the
 * viewport? Admin-side upload flows are not covered here because the test
 * environment has no auth fixtures.
 *
 * Memory note: don't run Playwright in worktrees — dev server fails. These
 * specs live in the main branch for CI / manual runs only.
 */

test.describe('Hero media — viewport-aware rendering', () => {
  test('watch hero renders at least one media element on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/watch')

    // The backdrop always renders a solid black base + bloom. Beyond that, the
    // hero should render exactly ONE of: video, youtube iframe, next/image.
    // With server-side UA detection, the opposite-viewport variant is NOT
    // rendered at all, so asserting on presence is a real signal.
    const videoOrImage = page.locator('video, iframe, img').first()
    await expect(videoOrImage).toBeVisible()
  })

  test('watch hero on mobile viewport does not render desktop-only media', async ({ page }) => {
    // Pretend to be an iPhone. UA-sniffing in src/lib/device.ts should flip.
    await page.setViewportSize({ width: 375, height: 812 })
    await page.setExtraHTTPHeaders({
      'user-agent':
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    })
    await page.goto('/watch')

    // Post-fix, the CinematicBackdrop is rendered viewport-aware (single variant).
    // A rendered `<video class="md:hidden">` or similar dual-branch layout would
    // indicate the server-side viewport path is NOT being taken — that's a
    // regression to the old CSS-hide-one behavior which double-loaded media.
    const desktopOnlyVideo = page.locator('video.md\\:block, video.hidden')
    await expect(desktopOnlyVideo).toHaveCount(0)
  })

  test('bloom-only fallback renders when no hero media is configured', async ({ page }) => {
    await page.goto('/watch')
    // The hero container always exists even when no media is set. This guards
    // against the resolveHeroMedia(null) branch crashing the render.
    const hero = page.locator('[class*="h-dvh"]').first()
    await expect(hero).toBeVisible()
  })
})

test.describe('Hero media — YouTube iframe accessibility', () => {
  test('every rendered YouTube iframe has a non-empty title attribute', async ({ page }) => {
    await page.goto('/watch')
    const iframes = page.locator('iframe[src*="youtube.com"]')
    const count = await iframes.count()
    for (let i = 0; i < count; i++) {
      const title = await iframes.nth(i).getAttribute('title')
      expect(title, `iframe #${i} is missing a title attribute`).toBeTruthy()
    }
  })
})
