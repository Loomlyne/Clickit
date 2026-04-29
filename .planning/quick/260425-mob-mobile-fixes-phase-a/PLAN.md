# Mobile fixes — Phase A through G

User asked for 8 concrete mobile fixes. Executing as one phase, one atomic commit per item.

## Order

1. **Mobile nav wired** (P0 from audit) — hamburger replaces inline nav on `<md:`
2. **"Start watching free" button** — shorter copy + responsive padding so it fits one line
3. **Hero rotator dots** — hidden on mobile
4. **UPGRADE banner** — responsive padding/margin
5. **Hero heights** — shrink min-height floors on mobile
6. **Watch sticky header** — collapse to back-arrow + episode title on mobile
7. **Watch page YT-style polish** — stronger title hierarchy, channel-row prominence
8. **Contact/support redesign** — input font 16px, checkbox 20px, tighter mobile layout, stronger card framing on desktop

## Files (per item)

1. `src/components/layout/navbar.tsx`, `src/components/layout/mobile-nav.tsx`, `src/components/layout/auth-section.tsx` (maybe)
2. `src/components/landing/landing-hero.tsx` (or wherever the CTA lives)
3. `src/components/home/hero-banner.tsx` or `hero-dots.tsx`
4. `src/components/landing/upgrade-banner.tsx` (or whatever wraps it)
5. `src/components/home/hero-banner.tsx:47`, `src/components/series/series-detail-hero.tsx:81,118`
6. `src/components/watch/watch-page-content.tsx:53-79`
7. `src/components/watch/watch-page-content.tsx:82-200` ish
8. `src/app/[locale]/(viewer)/support/page.tsx` + form components

## Verification (per commit)

- Type check passes (`npx tsc --noEmit`)
- Build passes (`npm run build` or trust Vercel preview)
- Visual: navigate to the affected page on the deployed preview at 375 / 768 / 1280

## Out of scope

- Bottom tab bar
- Search modal redesign
- Admin mobile pass (separate phase later)
- Editorial variant
