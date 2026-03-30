import { test, expect } from '@playwright/test'

test.describe('Navigation Bar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('nav renders with correct landmark', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: 'Main navigation' })
    await expect(nav).toBeVisible()
  })

  test('logo is visible and links to home', async ({ page }) => {
    const logoLink = page.getByRole('link', { name: 'Clickit Story home' })
    await expect(logoLink).toBeVisible()
    const img = logoLink.locator('img')
    await expect(img).toHaveAttribute('src', '/brand/Clickit_final_logo.svg')
  })

  test('nav has glass effect classes', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: 'Main navigation' })
    await expect(nav).toHaveClass(/backdrop-blur-lg/)
    await expect(nav).toHaveClass(/fixed/)
  })

  test('skip to content link exists', async ({ page }) => {
    const skipLink = page.getByRole('link', { name: 'Skip to content' })
    await expect(skipLink).toBeAttached()
  })

  test('sign in button visible when unauthenticated', async ({ page }) => {
    const signIn = page.getByRole('button', { name: 'Sign In' })
    await expect(signIn).toBeVisible()
  })

  test('responsive - nav visible at mobile width', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    const nav = page.getByRole('navigation', { name: 'Main navigation' })
    await expect(nav).toBeVisible()
    const logoLink = page.getByRole('link', { name: 'Clickit Story home' })
    await expect(logoLink).toBeVisible()
  })

  test('responsive - nav visible at desktop width', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const nav = page.getByRole('navigation', { name: 'Main navigation' })
    await expect(nav).toBeVisible()
  })
})
