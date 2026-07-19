---
last_mapped_commit: de36f69b4405113cfc2d12b445fed3f8566a5dad
---
# Testing Patterns

**Analysis Date:** 2026-07-19

## Test Framework

**Runner:**
- Unit: Node.js built-in test runner, invoked by `npm run test:unit` from `package.json`. The command discovers `tests/unit/**/*.test.ts` and uses Node's TypeScript strip-types support.
- E2E: Playwright `^1.58.2`, configured in `playwright.config.ts` with Chromium Desktop Chrome and `tests/e2e` as the test directory.

**Assertion Library:**
- Unit tests use `node:assert/strict`, as in `tests/unit/auth-navigation.test.ts` and `tests/unit/hero-media.test.ts`.
- Browser tests use Playwright `expect` from `@playwright/test`, as in `tests/e2e/home.spec.ts`.

**Run Commands:**
```bash
npm run test:unit                         # Run the Node unit suite
npx playwright test                       # Run all E2E specifications
npx playwright test --ui                  # Run E2E tests interactively
```

## Test File Organization

**Location:**
- Put deterministic unit tests in `tests/unit/`, separate from source. Current targets are pure helpers in `src/lib/auth-navigation.ts` and `src/lib/hero-media.ts`.
- Put browser-level product checks in `tests/e2e/`, one `*.spec.ts` per page or behavior, for example `tests/e2e/watch-page.spec.ts` and `tests/e2e/nav.spec.ts`.

**Naming:**
- Use `*.test.ts` for Node unit tests and `*.spec.ts` for Playwright browser tests.

**Structure:**
```
tests/
├── unit/                 # pure TypeScript helper behavior
│   ├── auth-navigation.test.ts
│   └── hero-media.test.ts
└── e2e/                  # visible page and interaction behavior
    ├── home.spec.ts
    ├── nav.spec.ts
    ├── series-detail.spec.ts
    └── watch-page.spec.ts
```

## Test Structure

**Suite Organization:**
```typescript
// tests/e2e/series.spec.ts
test.describe('Series Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/series')
  })

  test('series page displays All Series heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'All Series' })).toBeVisible()
  })
})
```

**Patterns:**
- Use a `test.describe` per screen or behavior and a `test.beforeEach` navigation step when all tests share a route, as in `tests/e2e/series-detail.spec.ts`.
- Prefer role, accessible-name, and text locators. Use CSS locator assertions only when checking implementation-level visual contracts, such as the sticky glass nav classes in `tests/e2e/nav.spec.ts`.
- Assert user-visible outcomes and navigation with `toBeVisible`, `toHaveURL`, `toHaveTitle`, and `toHaveAttribute`, as in `tests/e2e/watch-page.spec.ts`.
- Test pure branch behavior as independent Node tests with explicit inputs and `assert.deepEqual`, as in `tests/unit/hero-media.test.ts`.

## Mocking

**Framework:** Not detected.

**Patterns:**
- No application test doubles, factories, fixtures, route interception, or `page.route` usage are present in `tests/`.
- Playwright starts the real application through `npm run dev` in `playwright.config.ts` and targets `http://localhost:3000`.

**What to Mock:**
- Add mocks only for an isolated pure unit test when an external dependency prevents deterministic coverage. Keep the mock local to the test file.

**What NOT to Mock:**
- Do not mock simple pure fallback and security helpers. Test their real exported function, following `tests/unit/auth-navigation.test.ts`.

## Fixtures and Factories

**Test Data:**
```typescript
// tests/unit/hero-media.test.ts
const DESKTOP_VIDEO = 'https://cdn/hero-desktop.mp4'
const MOBILE_IMAGE = 'https://cdn/hero-mobile.webp'

const result = resolveHeroMedia(false, {
  videoUrl: DESKTOP_VIDEO,
  videoType: 'mp4',
  imageUrl: MOBILE_IMAGE,
})
```

**Location:**
- Use file-local constants for unit inputs. No shared fixture or factory directory is present.
- E2E assertions depend on data returned by the running application, for example show names in `tests/e2e/home.spec.ts`; do not assume a separate seeded local test database exists.

## Coverage

**Requirements:** No coverage threshold, coverage provider, or coverage script is configured in `package.json`, `playwright.config.ts`, or the repository workflow.

**View Coverage:**
```bash
# Not configured. Add a coverage tool and package script before treating coverage as a gate.
```

## Test Types

**Unit Tests:**
- Cover deterministic helpers and edge cases, including open-redirect prevention in `src/lib/auth-navigation.ts` and responsive fallback ordering in `src/lib/hero-media.ts`.

**Integration Tests:**
- Not detected as a separate suite. Server Actions, Supabase clients, and route handlers under `src/app/actions/`, `src/app/[locale]/admin/actions.ts`, and `src/app/api/` have no dedicated integration tests.

**E2E Tests:**
- Playwright covers public navigation, layout, home rails, series details, watch flow, hero media, and coming-soon behavior in `tests/e2e/`.
- The coming-soon enabled assertions are deliberately conditional on `E2E_COMING_SOON_GATE=1` in `tests/e2e/coming-soon.spec.ts`; keep feature-flag-only tests skipped unless the matching app configuration is available.

## Common Patterns

**Async Testing:**
```typescript
// tests/e2e/watch-page.spec.ts
await page.goto('/watch/e1-1-1')
await expect(page.locator('iframe').first()).toBeVisible({ timeout: 15_000 })
```

**Error Testing:**
```typescript
// tests/unit/auth-navigation.test.ts
assert.equal(getSafeAuthNextPath('https://evil.test'), '/watch')
assert.equal(getSafeAuthNextPath('/auth?next=/my-list'), '/watch')
```

## CI and Test Execution

- `.github/workflows/supabase-migrations.yml` runs only Supabase migrations on pushes that change `supabase/migrations/**` on `main`; it does not run lint, unit tests, or Playwright tests.
- Playwright runs serially in CI (`workers: 1`) and rejects focused tests with `forbidOnly: !!process.env.CI` in `playwright.config.ts`. Locally it uses the available worker count and reuses an existing dev server.

---

*Testing analysis: 2026-07-19*
