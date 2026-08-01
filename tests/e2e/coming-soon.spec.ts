import { test, expect } from '@playwright/test'

test.describe('Coming Soon gate splash', () => {
  test('redirects to watch when gate is off', async ({ page }) => {
    await page.goto('/coming-soon')
    // When coming-soon mode is disabled (default in most envs), bounce to watch.
    await expect(page).toHaveURL(/\/watch/, { timeout: 10_000 })
  })

  test.describe('when gate is on', () => {
    test.beforeEach(async ({ page }) => {
      // Skip catalog-era assertions — splash only exists with the feature flag.
      test.skip(
        process.env.E2E_COMING_SOON_GATE !== '1',
        'Set E2E_COMING_SOON_GATE=1 with comingSoonMode enabled in app_config'
      )
      await page.goto('/coming-soon')
    })

    test('shows splash heading and description', async ({ page }) => {
      await expect(
        page.getByRole('heading', { name: 'Coming Soon', exact: true })
      ).toBeVisible()
      await expect(
        page.getByText('The full platform launches shortly.')
      ).toBeVisible()
    })

    test('does not show the old upcoming-shows catalog', async ({ page }) => {
      await expect(
        page.getByRole('heading', { name: "What we're releasing next." })
      ).not.toBeVisible()
      await expect(page.getByText('Remind me')).not.toBeVisible()
    })

    test('page has correct title', async ({ page }) => {
      await expect(page).toHaveTitle(/Coming Soon.*Clickit Story/)
    })
  })
})
