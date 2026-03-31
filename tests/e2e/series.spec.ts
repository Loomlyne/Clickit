import { test, expect } from '@playwright/test'

test.describe('Series Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/series')
  })

  // CATL-08: Series listing page heading
  test('series page displays All Series heading', async ({ page }) => {
    const heading = page.getByRole('heading', { name: 'All Series' })
    await expect(heading).toBeVisible()
  })

  // CATL-08: Card grid shows all 5 mock shows
  test('series page shows show cards in a grid', async ({ page }) => {
    const cards = page.locator('h3').filter({
      hasText:
        /Last Call|Review Documentary|Doctor Care|Saturn Podcast|Poets Platform/,
    })
    await expect(cards).toHaveCount(5)
  })

  // CATL-09: Branded artwork with color ribbons
  test('series cards have brand color ribbons', async ({ page }) => {
    const ribbons = page.locator('[class*="h-1"][class*="bg-brand-"]')
    await expect(ribbons.first()).toBeVisible()
  })

  // DESG-09: Metadata badges on series cards
  test('series cards display genre badges', async ({ page }) => {
    const badge = page
      .locator('[class*="badge"]')
      .or(page.locator('[data-slot="badge"]'))
      .first()
    await expect(badge).toBeVisible()
  })

  // Responsive grid layout classes
  test('series grid uses responsive columns', async ({ page }) => {
    const grid = page.locator('[class*="grid-cols-1"]')
    await expect(grid).toBeVisible()
  })
})
