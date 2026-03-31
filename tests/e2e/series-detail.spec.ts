import { test, expect } from '@playwright/test'

test.describe('Series Detail Page', () => {
  // Use Last Call (slug: last-call) as primary test show — 2 seasons, mixed episode statuses
  test.beforeEach(async ({ page }) => {
    await page.goto('/series/last-call')
  })

  // CATL-03: Series detail hero displays show title
  test('hero displays show title', async ({ page }) => {
    const title = page.getByRole('heading', { name: 'Last Call' })
    await expect(title).toBeVisible()
  })

  // CATL-03: Series detail hero displays genre chip and episode count chip
  test('hero displays genre and episode count metadata chips', async ({
    page,
  }) => {
    const entertainmentBadge = page.getByText('Entertainment').first()
    await expect(entertainmentBadge).toBeVisible()
    const episodesBadge = page.getByText(/\d+ Episodes/).first()
    await expect(episodesBadge).toBeVisible()
  })

  // CATL-03: Hero Watch CTA button
  test('hero displays Watch CTA button with episode label', async ({
    page,
  }) => {
    // Last Call has published episodes, so CTA should show "Watch S1 E1"
    const watchBtn = page
      .getByRole('link', { name: /Watch S\d+ E\d+/ })
      .or(page.getByRole('button', { name: /Watch S\d+ E\d+/ }))
    await expect(watchBtn).toBeVisible()
  })

  // CATL-04: Season selector shows tabs for Last Call (2 seasons)
  test('season selector shows tabs for a show with 2 seasons', async ({
    page,
  }) => {
    // Last Call has 2 seasons — should render Tabs (not Select)
    const season1Tab = page.getByRole('tab', { name: 'Season 1' })
    const season2Tab = page.getByRole('tab', { name: 'Season 2' })
    await expect(season1Tab).toBeVisible()
    await expect(season2Tab).toBeVisible()
  })

  // CATL-04: Clicking Season 2 tab switches episode list
  test('clicking Season 2 tab switches the active tab', async ({ page }) => {
    const season2Tab = page.getByRole('tab', { name: 'Season 2' })
    await season2Tab.click()
    // After clicking Season 2, verify it becomes active
    await expect(season2Tab).toHaveAttribute('data-state', 'active')
  })

  // CATL-05: Episode rows display episode number, title, and duration
  test('episode rows display episode number, title, and duration', async ({
    page,
  }) => {
    // Season 1 is default — check for first episode content
    const episodeNumber = page.getByText('E1').first()
    await expect(episodeNumber).toBeVisible()
    // Check a duration chip is visible (e.g., "25 min")
    const duration = page.getByText(/\d+ min/).first()
    await expect(duration).toBeVisible()
  })

  // CATL-05: Episode title is visible
  test('episode rows display episode title', async ({ page }) => {
    // First episode of Last Call Season 1 is "Late Night in Abu Dhabi"
    const title = page.getByText('Late Night in Abu Dhabi')
    await expect(title).toBeVisible()
  })

  // CATL-06: Coming Soon badge on coming-soon episodes
  test('Coming Soon badge appears on coming-soon episodes', async ({
    page,
  }) => {
    // Switch to Season 2 which has a coming-soon episode (ep 4)
    const season2Tab = page.getByRole('tab', { name: 'Season 2' })
    await season2Tab.click()
    const comingSoonBadge = page.getByText('Coming Soon', { exact: true }).first()
    await expect(comingSoonBadge).toBeVisible()
  })

  // CATL-06: Coming-soon episode rows are not interactive (no link)
  test('coming-soon episode rows are not interactive', async ({ page }) => {
    // Switch to Season 2 which has non-interactive episodes
    const season2Tab = page.getByRole('tab', { name: 'Season 2' })
    await season2Tab.click()
    // Find a disabled row
    const disabledRow = page.locator('[aria-disabled="true"]').first()
    await expect(disabledRow).toBeVisible()
  })

  // CATL-06: Locked badge on locked episodes
  test('Locked badge appears on locked episodes', async ({ page }) => {
    // Switch to Season 2 which has a locked episode (ep 5)
    const season2Tab = page.getByRole('tab', { name: 'Season 2' })
    await season2Tab.click()
    const lockedBadge = page.getByText('Locked', { exact: true }).first()
    await expect(lockedBadge).toBeVisible()
  })

  // More Like This rail (or at least verify page renders fully)
  test('page renders with correct title metadata', async ({ page }) => {
    await expect(page).toHaveTitle(/Last Call.*Clickit Story/)
  })

  // 404 handling for invalid slugs
  test('invalid slug shows not found page', async ({ page }) => {
    await page.goto('/series/nonexistent-show')
    const heading = page.getByText('Show Not Found')
    await expect(heading).toBeVisible()
    const browseLink = page.getByRole('link', { name: 'Browse All Series' })
    await expect(browseLink).toBeVisible()
  })

  // Episodes section has accessible landmark
  test('episode list has accessible section landmark', async ({ page }) => {
    const section = page.locator('section[aria-label="Episodes"]')
    await expect(section).toBeVisible()
  })
})
