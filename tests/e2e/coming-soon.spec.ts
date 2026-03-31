import { test, expect } from '@playwright/test'

test.describe('Coming Soon Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/coming-soon')
  })

  // CATL-07: Page renders with title
  test('coming soon page displays page title', async ({ page }) => {
    const heading = page.getByRole('heading', {
      name: 'Coming Soon',
      exact: true,
    })
    await expect(heading).toBeVisible()
  })

  test('coming soon page displays subtitle', async ({ page }) => {
    const subtitle = page.getByText('New shows and episodes on the way.')
    await expect(subtitle).toBeVisible()
  })

  // CATL-07: Unreleased shows section
  test('upcoming shows section is visible', async ({ page }) => {
    const sectionHeading = page.getByRole('heading', {
      name: 'Upcoming Shows',
    })
    await expect(sectionHeading).toBeVisible()
  })

  test('shows coming-soon show card (Poets Platform)', async ({ page }) => {
    // Poets Platform is the coming-soon show in mock data
    const showTitle = page.getByText('Poets Platform').first()
    await expect(showTitle).toBeVisible()
  })

  test('coming-soon show card has Coming Soon badge', async ({ page }) => {
    // ComingSoonShowCard renders a Badge with "Coming Soon"
    const badge = page
      .locator('[data-slot="badge"]')
      .filter({ hasText: 'Coming Soon' })
      .first()
    await expect(badge).toBeVisible()
  })

  // CATL-07: Upcoming episodes section
  test('new episodes section is visible', async ({ page }) => {
    const sectionHeading = page.getByRole('heading', {
      name: 'New Episodes Dropping Soon',
    })
    await expect(sectionHeading).toBeVisible()
  })

  test('upcoming episodes show episode rows from streaming shows', async ({
    page,
  }) => {
    // Streaming shows with coming-soon episodes should appear here
    // Check that at least one episode row with a duration chip is visible
    const durationChip = page.getByText(/\d+ min/).first()
    await expect(durationChip).toBeVisible({ timeout: 5000 })
  })

  // Page metadata
  test('page has correct title', async ({ page }) => {
    await expect(page).toHaveTitle(/Coming Soon.*Clickit Story/)
  })
})
