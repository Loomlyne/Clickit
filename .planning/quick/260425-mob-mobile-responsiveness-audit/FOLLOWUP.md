# Follow-up fix phases — Mobile Responsiveness

Derived from [AUDIT.md](AUDIT.md). Each phase below is a sketch — run `/gsd:plan-phase` to expand into a real PLAN.md when ready to execute.

Ordering: by user-facing impact, not by code complexity.

---

## Phase A — Wire the mobile menu (P0, ~2 hours)

**The single most important fix.** Closes CC-1.

**Scope**:

- Add `<MobileNav />` import and render to [src/components/layout/navbar.tsx](../../../src/components/layout/navbar.tsx)
- Gate the inline `<nav>` with `hidden md:flex`
- Gate the desktop `AuthSection` with `hidden md:flex` and add a mobile-friendly equivalent inside the sheet
- Reduce navbar `px-10` → `px-4 md:px-10`
- Reduce navbar `gap-7` → `gap-3 md:gap-7`
- Verify `MobileNav` sheet's auth/links cover both authed and unauthed states (currently only NAV_LINKS — needs Sign in / Profile / Sign out depending on session)
- Add `pt-[env(safe-area-inset-top)]` to the navbar (or to the body) so it clears the iOS notch

**Verification**:

- 375px screenshot: hamburger visible, nav links not visible
- 768px screenshot: hamburger hidden, inline nav visible
- iOS Safari add-to-home-screen test: navbar doesn't sit under Dynamic Island
- All NAV_LINKS reachable via the sheet

**Files touched**:

- [src/components/layout/navbar.tsx](../../../src/components/layout/navbar.tsx) (modify)
- [src/components/layout/mobile-nav.tsx](../../../src/components/layout/mobile-nav.tsx) (extend with auth section)
- [src/components/layout/auth-section.tsx](../../../src/components/layout/auth-section.tsx) (responsive variant)

**Effort**: 1 plan, ~2 hours, 1 atomic commit.

---

## Phase B — Form inputs + chrome padding (P1, ~3 hours)

**Closes CC-2 and CC-3.** Highest-frustration fixes for daily mobile users.

**Scope**:

1. **Form input font-size**: bump every `<input>` and `<textarea>` to `text-base` (16px) or above on mobile
   - [src/components/layout/footer.tsx:43](../../../src/components/layout/footer.tsx#L43) — `text-sm` → `text-base sm:text-sm`
   - All inputs in [src/components/auth/](../../../src/components/auth/) — confirm computed font-size
   - Support page form fields
   - Admin search inputs
   - Add a Tailwind plugin or shadcn/ui Input override so this is enforced going forward
2. **Chrome padding**: introduce a project-wide pattern `px-4 sm:px-6 md:px-12` and apply
   - [navbar.tsx:53](../../../src/components/layout/navbar.tsx#L53) — already partially handled by Phase A
   - [footer.tsx:13,54,135](../../../src/components/layout/footer.tsx#L13) — `px-12` → `px-6 md:px-12`
   - browse CTA `mx-10` (browse page)
   - shows-portfolio `px-10` ([src/components/landing/shows-portfolio.tsx](../../../src/components/landing/))
3. **Footer grid**: `grid-cols-2` → `grid-cols-1 sm:grid-cols-2` for breathing room on small phones
4. **Touch targets ≥44**: bump every chrome link's `py-1.5` to `py-2.5` and small CTAs to `min-h-[44px]`

**Verification**:

- DOM probe: zero inputs with computed `font-size < 16px`
- DOM probe: every visible button/link has `boundingRect.height >= 44`
- Visual regression: 500px and 768px screenshots stay within reasonable layout

**Files touched** (~10 files):

- footer.tsx, navbar.tsx, auth-section.tsx, several admin form components, browse-cta, ui/input.tsx (default font-size)

**Effort**: 1 plan, ~3 hours, 2-3 commits (forms / padding / touch-targets as separate commits).

---

## Phase C — Hero + watch page reflow (P1, ~3 hours)

**Closes CC-7 and the watch page sticky-header overflow risk.**

**Scope**:

1. **Hero heights**: `min-height: 580` → `min-height: 480px md:min-height: 580px` on home hero; same for series detail
   - [src/components/home/hero-banner.tsx:47](../../../src/components/home/hero-banner.tsx#L47)
   - [src/components/series/series-detail-hero.tsx:81](../../../src/components/series/series-detail-hero.tsx#L81)
2. **Hero overlay content**: `max-w-[720px]` constrained by responsive horizontal insets
   - [series-detail-hero.tsx:118](../../../src/components/series/series-detail-hero.tsx#L118) — `start-10 end-10` → `start-4 end-4 sm:start-10 sm:end-10`
3. **Sticky scrolled mini-bar**: handle long titles with `truncate`
   - [series-detail-hero.tsx:66-67](../../../src/components/series/series-detail-hero.tsx#L66)
4. **Watch page sticky header**: `flex-wrap` + collapse middle breadcrumb on `<sm:`
   - [src/components/watch/watch-page-content.tsx:53-79](../../../src/components/watch/watch-page-content.tsx#L53)
   - Hide season label, keep show + episode title
   - Reduce `px-8` → `px-4 sm:px-8`
   - Reduce gap and button padding on mobile
5. **"View all" rail headers**: add `min-h-[44px] inline-flex items-center` so they're tappable
6. **Series detail back link**: `← Home` becomes a real `min-h-11` button

**Verification**:

- 375px static: every hero CTA is reachable above the fold or within one scroll
- Watch page sticky header at 320px: shows + episode visible, no horizontal overflow
- Series detail at 375: hero overlay content text not clipped

**Files touched**: 6 files in `src/components/home/`, `src/components/series/`, `src/components/watch/`.

**Effort**: 1 plan, ~3 hours, 3 commits.

---

## Phase D — Touch & a11y polish (P1/P2, ~2 hours)

**Closes CC-4, CC-5 leftovers, and Lighthouse a11y failures.**

**Scope**:

1. **Hover-only fixes**:
   - Add `@media (hover: none)` rule in `globals.css` that forces `opacity: 1` on `group-hover:opacity-100` patterns
   - Or refactor: cast-editor delete button, admin row actions become always-visible on touch
   - [cast-editor.tsx:147](../../../src/components/admin/cast-editor.tsx#L147) — change `opacity-0 group-hover:opacity-100` → `opacity-60 group-hover:opacity-100 hover-none:opacity-60` (custom variant) or use Radix DropdownMenu
2. **Lighthouse a11y**:
   - `button-name` — add `aria-label` to icon-only buttons in footer ([footer.tsx:71-86](../../../src/components/layout/footer.tsx#L71))
   - `color-contrast` — find the offending pair (likely `text-[var(--text-mute)]` on `bg-[var(--bg-0)]`) and bump muted color
   - `heading-order` — audit landing page heading levels for sequence violation
3. **focus-visible rings**: Tailwind `focus-visible:ring-2 focus-visible:ring-[var(--accent)]` on every interactive element. Currently only Radix primitives have this.
4. **`active:scale-[0.97]` on primary CTAs** for haptic-style feedback on touch

**Verification**:

- Lighthouse mobile run scores ≥95 accessibility
- DOM probe at 500px: every button has computed `opacity > 0` (no hover-gated buttons hiding)
- Manual touch test: every interactive element gives visible feedback on tap

**Files touched**: globals.css, footer.tsx, cast-editor.tsx, ui/button.tsx, scattered.

**Effort**: 1 plan, ~2 hours, 2 commits.

---

## Phase E — Admin mobile (P1, ~4 hours)

**Closes the admin-side gaps.**

**Scope**:

1. **Tables → card-view on mobile**: introduce a `<MobileTableCard>` shadcn component that renders the same data as a stacked card
   - shows-table, archive, audit-log, shorts-table
2. **Admin form drawers**: ensure `Sheet side="right"` is full-width on mobile and capped on desktop
3. **Cast editor**: see Phase D, but apply pattern across all admin row-action surfaces
4. **Settings tabs**: convert `<Tabs>` to a `<Select>` on mobile (or scroll-snap horizontal tabs) when there are >3 tabs
5. **Admin layout padding**: already correct (`px-4 md:px-8`) but verify

**Verification**:

- /admin renders without horizontal scroll at 375
- Every row action discoverable on touch
- Form drawers cover the full width at 375 with a clear close affordance

**Files touched**: ~12 files in `src/components/admin/` and `src/app/[locale]/admin/`.

**Effort**: 1 plan, ~4 hours, 4 commits.

---

## Recommended order

1. **Phase A** — fix the P0 first. Even if nothing else lands, the site becomes usable on a phone.
2. **Phase B** — biggest UX-per-hour for daily users (forms + chrome).
3. **Phase C** — feels-better-as-you-scroll; closes the visible polish gaps in the hero / watch areas.
4. **Phase D** — a11y compliance + touch feedback. Important but not blocking.
5. **Phase E** — admin is the lowest-frequency surface (single admin user, edits on desktop). Last.

If the user wants to ship incrementally, **A then B then C** covers ~85% of perceived mobile improvements in one focused day.

---

## Out of scope (per user decision in the audit plan)

- Bottom tab bar (Netflix-style)
- Search-as-modal
- Bottom-sheet episode drawer on watch page
- Mobile poster aspect-ratio change to 2:3
- Profile-as-sheet
- Full Editorial variant audit (separate design track)

If the user changes their mind on any of these, they're scoped in the original plan file at `/Users/koss/.claude/plans/i-want-to-make-sharded-kahn.md`.
