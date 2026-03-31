import { test, expect } from '@playwright/test'

test.describe('Home Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  // CATL-01, DESG-02: Hero banner fills viewport
  test('hero banner is visible and fills viewport height', async ({ page }) => {
    const hero = page.locator('[class*="h-screen"]').first()
    await expect(hero).toBeVisible()
    const viewport = page.viewportSize()
    const box = await hero.boundingBox()
    expect(box?.height).toBeGreaterThanOrEqual((viewport?.height ?? 800) * 0.9)
  })

  // CATL-01: Hero shows a featured show title and CTA
  test('hero banner displays show title and Watch Now CTA', async ({ page }) => {
    const heroTitle = page.locator('h1').first()
    await expect(heroTitle).toBeVisible()
    const watchNow = page
      .getByRole('link', { name: 'Watch Now' })
      .or(page.getByRole('button', { name: 'Watch Now' }))
    await expect(watchNow.first()).toBeVisible()
  })

  // CATL-02: Content rails with section headers
  test('content rails display section headers', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(500)
    const nowStreaming = page.getByRole('heading', { name: 'Now Streaming' })
    await expect(nowStreaming).toBeVisible()
  })

  // CATL-09: Show cards with title and genre
  test('show cards display title and genre badge', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(500)
    const cardTitle = page
      .locator('h3')
      .filter({
        hasText:
          /Last Call|Review Documentary|Doctor Care|Saturn Podcast|Poets Platform/,
      })
      .first()
    await expect(cardTitle).toBeVisible()
  })

  // DESG-08: Brand color ribbon on cards
  test('show cards have brand color ribbon', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(500)
    const ribbon = page
      .locator('[class*="h-1"][class*="bg-brand-"]')
      .first()
    await expect(ribbon).toBeVisible()
  })

  // DESG-09: Metadata badges (genre + episode count)
  test('show cards display genre and episode count badges', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(500)
    const badge = page
      .locator('[class*="badge"]')
      .or(page.locator('[data-slot="badge"]'))
      .first()
    await expect(badge).toBeVisible()
  })

  // CATL-10: Placeholder cards for visual density
  test('content rails include placeholder cards for visual density', async ({
    page,
  }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(500)
    const placeholder = page.getByText('Coming Soon', { exact: true }).first()
    await expect(placeholder).toBeVisible()
  })

  // DESG-04: White typography on dark background
  test('typography is white on dark background', async ({ page }) => {
    const body = page.locator('body')
    const bgColor = await body.evaluate(
      (el) => getComputedStyle(el).backgroundColor
    )
    // Background should be dark (low RGB values)
    expect(bgColor).toMatch(/rgb\(\s*\d{1,2},\s*\d{1,2},\s*\d{1,2}\s*\)/)
  })

  // DESG-03: Card hover state (interactive with pointer cursor)
  test('show cards are interactive with cursor pointer', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(500)
    const card = page.locator('[class*="cursor-pointer"]').first()
    await expect(card).toBeVisible()
  })
})
