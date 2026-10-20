import { test, expect, type Page } from '@playwright/test'

// Stacked watch page (06-14): top bar, black 16:9 video area, control bar, then
// the static episode list. Episode ids are generated uuids, so every test
// reaches an episode through its series page row, like a viewer does.
//
// Seed (supabase/seed.sql): Last Call S1 E1-E3 have real YouTube ids (the
// iframe shows); every later episode has a placeholder id and shows the
// branded error card instead (the iframe is hidden), so only E1-E3 are used
// where the iframe must be visible.

const WATCH_URL = /\/watch\/[0-9a-f-]{36}$/

async function openEpisode(page: Page, title: string) {
  await page.goto('/series/last-call')
  await page.getByRole('link', { name: new RegExp(title) }).click()
  await expect(page).toHaveURL(WATCH_URL)
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
}

test.describe('Watch Page', () => {
  // Last Call S1 E1 "Late Night in Abu Dhabi" is the primary test episode.
  test.describe('on the first episode', () => {
    test.beforeEach(async ({ page }) => {
      await openEpisode(page, 'Late Night in Abu Dhabi')
    })

    // ── WTCH-01: YouTube player iframe renders ──

    test('displays YouTube player iframe', async ({ page }) => {
      // YouTube iframe may take time to load; wait for it
      const iframe = page.locator('iframe[src*="youtube.com/embed"]')
      await expect(iframe).toBeVisible({ timeout: 15000 })
    })

    test('player has exactly one accessible region landmark', async ({ page }) => {
      // The shell owns the only "Video player" landmark; the player adds none.
      const region = page.getByRole('region', { name: 'Video player', exact: true })
      await expect(region).toHaveCount(1)
      await expect(region).toBeVisible()
      await expect(
        region.locator('iframe[src*="youtube.com/embed"]')
      ).toBeVisible({ timeout: 15000 })
    })

    // ── WTCH-02: Episode metadata renders ──

    test('displays episode title', async ({ page }) => {
      await expect(
        page.getByRole('heading', { level: 1, name: 'Late Night in Abu Dhabi' })
      ).toBeVisible()
    })

    test('top bar links back to the show', async ({ page }) => {
      // The desktop top bar's back link carries the show name.
      const back = page.getByRole('link', { name: 'Last Call', exact: true })
      await expect(back).toBeVisible()
      await expect(back).toHaveAttribute('href', /\/series\/last-call$/)
    })

    test('control bar shows the season and episode line', async ({ page }) => {
      // Shown in the top bar and in the control bar, so take the first match.
      await expect(page.getByText('Season 1 · Episode 1').first()).toBeVisible()
    })

    test('episode list shows the duration of the other episodes', async ({ page }) => {
      // The current episode reads "Now playing"; the others show their length.
      const second = page.getByRole('button', { name: /The Corniche Confessions/ })
      await expect(second).toContainText('22 min')
      const current = page.getByRole('button', { name: /Late Night in Abu Dhabi/ })
      await expect(current).toContainText('Now playing')
    })

    // ── WTCH-03: Prev/Next navigation ──

    test('control bar has Previous (disabled on E1) and Next', async ({ page }) => {
      // E1 is the first episode of the first season: nothing before it.
      await expect(page.getByRole('button', { name: 'Previous', exact: true })).toBeDisabled()
      await expect(page.getByRole('button', { name: 'Next episode' })).toBeEnabled()
    })

    test('next button switches to the next episode', async ({ page }) => {
      const before = page.url()
      await page.getByRole('button', { name: 'Next episode' }).click()
      // The shell swaps the episode in place and syncs the URL.
      await expect(page).not.toHaveURL(before)
      await expect(page).toHaveURL(WATCH_URL)
      await expect(
        page.getByRole('heading', { level: 1, name: 'The Corniche Confessions' })
      ).toBeVisible()
      await expect(
        page.getByRole('button', { name: /The Corniche Confessions/ })
      ).toHaveAttribute('aria-current', 'true')
      // Now there is something before it.
      await expect(page.getByRole('button', { name: 'Previous', exact: true })).toBeEnabled()
    })

    // ── WTCH-05: No overlays on YouTube player ──

    test('no elements overlay the YouTube player iframe', async ({ page }) => {
      const iframe = page.locator('iframe[src*="youtube.com/embed"]')
      await expect(iframe).toBeVisible({ timeout: 15000 })
      await iframe.scrollIntoViewIfNeeded()

      // At the four corners (1px inside) and the centre, the topmost element
      // must be the iframe itself (or inside it).
      const blockers = await iframe.evaluate((node) => {
        const rect = node.getBoundingClientRect()
        const points = {
          topLeft: [rect.left + 1, rect.top + 1],
          topRight: [rect.right - 2, rect.top + 1],
          bottomLeft: [rect.left + 1, rect.bottom - 2],
          bottomRight: [rect.right - 2, rect.bottom - 2],
          centre: [rect.left + rect.width / 2, rect.top + rect.height / 2],
        } as const
        const found: string[] = []
        for (const [name, [x, y]] of Object.entries(points)) {
          const hit = document.elementFromPoint(x, y)
          if (!hit || !(hit === node || node.contains(hit))) {
            found.push(`${name}: ${hit ? hit.outerHTML.slice(0, 120) : 'nothing'}`)
          }
        }
        return found
      })
      expect(blockers).toEqual([])
    })

    // ── WTCH-06: Static episode list ──

    test('displays episode list with season pills', async ({ page }) => {
      await expect(page.getByRole('heading', { level: 2, name: 'Episodes' })).toBeAttached()

      // Last Call has 2 seasons, so a pill per season; S1 is active.
      const season1 = page.getByRole('button', { name: 'Season 1', exact: true })
      const season2 = page.getByRole('button', { name: 'Season 2', exact: true })
      await expect(season1).toBeVisible()
      await expect(season2).toBeVisible()
      await expect(season1).toHaveAttribute('aria-pressed', 'true')
      await expect(season2).toHaveAttribute('aria-pressed', 'false')

      // Season 2 pill switches the list to Season 2 (an episode of S2 shows).
      await season2.click()
      await expect(season2).toHaveAttribute('aria-pressed', 'true')
      await expect(
        page.getByRole('button', { name: /Return to the Streets/ })
      ).toBeVisible()
    })

    test('current episode is highlighted in the episode list', async ({ page }) => {
      const current = page.getByRole('button', { name: /Late Night in Abu Dhabi/ })
      await expect(current).toBeVisible()
      await expect(current).toHaveAttribute('aria-current', 'true')
      // Only the current episode carries it (visible copy: rail or phone list).
      await expect(
        page.getByRole('button', { name: /The Corniche Confessions/ })
      ).not.toHaveAttribute('aria-current', 'true')
    })
  })

  // ── WTCH-03: cross-season navigation ──

  test('cross-season navigation: next from last S1 ep goes to first S2 ep', async ({
    page,
  }) => {
    // Island Nights is the last episode of S1 (placeholder video: error card,
    // but the control bar and the list still work).
    await openEpisode(page, 'Island Nights')
    await page.getByRole('button', { name: 'Next episode' }).click()
    await expect(
      page.getByRole('heading', { level: 1, name: 'Return to the Streets' })
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Season 2', exact: true })
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(
      page.getByRole('button', { name: /Return to the Streets/ })
    ).toHaveAttribute('aria-current', 'true')
  })

  // ── 404 handling ──

  test('shows not-found page for invalid episode ID', async ({ page }) => {
    await page.goto('/watch/nonexistent-id')
    await expect(page.getByRole('heading', { name: 'Page Not Found' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Watch Shows' })).toBeVisible()
  })

  // ── Integration: Series detail episode row links to watch page ──

  test('series detail episode row links to watch page', async ({ page }) => {
    await page.goto('/series/last-call')
    const episodeLink = page.getByRole('link', {
      name: /Late Night in Abu Dhabi/,
    })
    await expect(episodeLink).toHaveAttribute('href', /\/watch\/[0-9a-f-]{36}$/)
  })
})
