import { test, expect } from '@playwright/test'

test.describe('Layout Shell', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('dark background applied to body', async ({ page }) => {
    const body = page.locator('body')
    await expect(body).toHaveClass(/bg-background/)
  })

  test('main landmark exists with correct id', async ({ page }) => {
    const main = page.locator('main#main')
    await expect(main).toBeVisible()
  })

  test('main has top padding to clear fixed nav', async ({ page }) => {
    const main = page.locator('main#main')
    await expect(main).toHaveClass(/pt-16/)
  })

  test('no max-width wrapper on body or main', async ({ page }) => {
    const body = page.locator('body')
    const bodyClass = await body.getAttribute('class') || ''
    expect(bodyClass).not.toContain('max-w-')
    const main = page.locator('main#main')
    const mainClass = await main.getAttribute('class') || ''
    expect(mainClass).not.toContain('max-w-')
  })
})
