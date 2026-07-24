import { expect, test } from '@playwright/test'

test('public about page renders without catalog fixtures', async ({ page }) => {
  const response = await page.goto('/en/about')

  expect(response?.status()).toBe(200)
  await expect(page).toHaveURL(/\/en\/about$/)
  await expect(
    page.getByRole('heading', {
      name: 'A viewing platform built by editorial taste, not an algorithm.',
    })
  ).toBeVisible()
})
