import { test, expect } from '@playwright/test'

test.describe('Watch Page', () => {
  // Use e1-1-1 (Last Call S1 E1 "Late Night in Abu Dhabi") as primary test episode
  test.beforeEach(async ({ page }) => {
    await page.goto('/watch/e1-1-1')
  })

  // ── WTCH-01: YouTube player iframe renders ──

  test('displays YouTube player iframe', async ({ page }) => {
    // YouTube iframe may take time to load; wait for it
    const iframe = page.locator('iframe[src*="youtube.com/embed"]')
    await expect(iframe).toBeVisible({ timeout: 15000 })
  })

  test('player has accessible region landmark', async ({ page }) => {
    const region = page.getByRole('region', { name: 'Video player' })
    await expect(region).toBeVisible()
  })

  // ── WTCH-02: Episode metadata renders ──

  test('displays episode title', async ({ page }) => {
    const title = page.getByRole('heading', { name: 'Late Night in Abu Dhabi' })
    await expect(title).toBeVisible()
  })

  test('displays episode breadcrumb with show name', async ({ page }) => {
    const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' })
    await expect(breadcrumb).toBeVisible()
    await expect(breadcrumb.getByText('Last Call')).toBeVisible()
  })

  test('displays duration chip', async ({ page }) => {
    await expect(page.getByText('25 min')).toBeVisible()
  })

  test('displays episode description', async ({ page }) => {
    await expect(
      page.getByText(/Street interviews after midnight/)
    ).toBeVisible()
  })

  // ── WTCH-03: Prev/Next navigation ──

  test('displays next episode navigation button', async ({ page }) => {
    // e1-1-1 is first episode, so Previous should be disabled
    const prevButton = page
      .locator('[aria-disabled="true"]')
      .filter({ hasText: 'Previous' })
    await expect(prevButton).toBeVisible()

    // Next should link to e1-1-2
    const nextLink = page.getByRole('link', { name: /Next/i })
    await expect(nextLink).toBeVisible()
    await expect(nextLink).toHaveAttribute('href', '/watch/e1-1-2')
  })

  test('next button navigates to next episode', async ({ page }) => {
    const nextLink = page.getByRole('link', { name: /Next/i })
    await nextLink.click()
    await expect(page).toHaveURL('/watch/e1-1-2')
    // Verify the new episode title renders
    await expect(
      page.getByRole('heading', { name: 'The Corniche Confessions' })
    ).toBeVisible()
  })

  test('cross-season navigation: next from last S1 ep goes to first S2 ep', async ({
    page,
  }) => {
    await page.goto('/watch/e1-1-5') // Island Nights (last ep of S1)
    const nextLink = page.getByRole('link', { name: /Next/i })
    await expect(nextLink).toHaveAttribute('href', '/watch/e1-2-1')
  })

  // ── WTCH-05: No overlays on YouTube player ──

  test('no elements overlay the YouTube player iframe', async ({ page }) => {
    // Wait for player region to exist
    const playerRegion = page.getByRole('region', { name: 'Video player' })
    await expect(playerRegion).toBeVisible()

    // Once iframe is visible, loading state should be hidden
    const iframe = page.locator('iframe[src*="youtube.com/embed"]')
    await expect(iframe).toBeVisible({ timeout: 15000 })

    // Verify no elements with position:absolute overlap the player
    // by checking that the player region has no visible absolute-positioned children
    const overlays = playerRegion.locator('[class*="absolute"]:visible')
    await expect(overlays).toHaveCount(0)
  })

  // ── WTCH-06: Episode quick-selector ──

  test('displays episode quick-selector with season tabs', async ({
    page,
  }) => {
    const selectorSection = page.getByRole('region', {
      name: 'Episode selector',
    })
    await expect(selectorSection).toBeVisible()
    await expect(selectorSection.getByText('Episodes')).toBeVisible()

    // Last Call has 2 seasons, so tabs should render (<=5 threshold)
    await expect(
      selectorSection.getByRole('tab', { name: /Season 1/ })
    ).toBeVisible()
    await expect(
      selectorSection.getByRole('tab', { name: /Season 2/ })
    ).toBeVisible()
  })

  test('current episode is highlighted in quick-selector', async ({
    page,
  }) => {
    // e1-1-1 should have aria-current="true"
    const currentEp = page.locator('[aria-current="true"]')
    await expect(currentEp).toBeVisible()
    await expect(currentEp).toContainText('Late Night in Abu Dhabi')
  })

  // ── 404 handling ──

  test('shows not-found page for invalid episode ID', async ({ page }) => {
    await page.goto('/watch/nonexistent-id')
    await expect(page.getByText('Episode Not Found')).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'Watch All Shows' })
    ).toBeVisible()
  })

  // ── Integration: Series detail episode row links to watch page ──

  test('series detail episode row links to watch page', async ({ page }) => {
    await page.goto('/series/last-call')
    // Find the first published episode link
    const episodeLink = page.getByRole('link', {
      name: /Late Night in Abu Dhabi/,
    })
    await expect(episodeLink).toHaveAttribute('href', '/watch/e1-1-1')
  })
})
