import { test, expect } from '@playwright/test'

test.describe('Navigation Bar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/watch')
  })

  test('desktop nav shows watch link', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const nav = page.getByRole('navigation').first()
    await expect(nav.getByRole('link', { name: 'Watch' })).toBeVisible()
  })

  test('logo is visible and links to watch', async ({ page }) => {
    const logoLink = page.getByRole('link', { name: 'Clickit Story home' })
    await expect(logoLink).toBeVisible()
    await expect(logoLink).toHaveAttribute('href', '/en/watch')
    const img = logoLink.locator('img')
    await expect(img).toHaveAttribute(
      'src',
      '/brand/Clickit_final_logo.CITpng.svg'
    )
  })

  test('nav has glass effect classes', async ({ page }) => {
    const header = page.locator('header').first()
    await expect(header).toHaveClass(/backdrop-blur/)
    await expect(header).toHaveClass(/sticky/)
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
    const logoLink = page.getByRole('link', { name: 'Clickit Story home' })
    await expect(logoLink).toBeVisible()
    await page.getByRole('button', { name: 'Open navigation menu' }).click()
    await expect(
      page
        .getByRole('navigation', { name: 'Mobile navigation' })
        .getByRole('link', { name: 'Watch' })
    ).toBeVisible()
  })

  test('responsive - nav visible at desktop width', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await expect(page.getByRole('navigation').first()).toBeVisible()
  })
})
