# B3 info hand-over

Branch `claude/design-b3-info-75ed00`, base `ui-system-home` (PR #17). Signed picture: `.planning/design/b3-info-before-after.html` (signed by Koss 2026-10-20, incl. D1 = delete `/design-system`).

## What changed
- New `src/components/info/` (`PageEyebrow`, `PageTitle`, `LegalDocument`, `LegalSection`, `LegalUpdated`): one title recipe, one legal shell, no nested `<main>`, underlined legal links. Legal wording untouched (same i18n keys / DB content).
- About: flat hero card, CTA is the real `Button`.
- Support: FAQ reuses the landing `FaqAccordion`; brand strip via `bg-brand-*`; contact form fields all 8px, 44px consent row, errors linked with `aria-invalid`/`aria-describedby`, autocomplete, warning box uses card radius + brand-orange-safe.
- Updates / `newsletter-signup-form.tsx`: `Input` + `Button`, accessible name (new key `newsletter.emailLabel`, en + ar), `role="status"` result, `role="alert"` error. Footer (compact) variant: same look, now has an accessible name.
- Coming soon: indigo glow replaced by yellow tint, `--text`, `--nav-h`.
- Skeletons: about, privacy (+terms re-export), support, updates, coming-soon redrawn to match pages; `portfolio-skeletons.tsx` shared by `portfolio/page.tsx` and `portfolio/loading.tsx` (offset now `--nav-h`).
- Deleted `(viewer)/design-system/*` (6 files) and its `src/proxy.ts` entry.

## Gates (run under the heavy lock)
- `npm run lint`: 0 errors, 17 warnings (pre-existing React Compiler notes).
- `npm run test:unit`: pass.
- `npm run build`: **fails without Supabase env** (`supabaseUrl is required` at `legal/[slug]` generateStaticParams, unchanged code). With placeholder env (`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`, dummy keys) build exits 0; `/design-system` no longer in the route list.

## NOT verified
- No run against live or local Supabase, so the real pages were not opened in a browser; only the signed HTML picture was rendered.
- Arabic / RTL not eyeballed (logical classes only).
- Playwright e2e not run.

## For the controller
- DS-01 / DS-04 in REQUIREMENTS.md and ROADMAP.md Phase 4 criteria 1 and 4 still name `/design-system`; reword to the UI System repo.
- `src/components/ui/accordion.tsx` now has zero users (left in place). `ui/checkbox.tsx` `sm:size-4` and `rounded-[10px]` still wrong at source (contact form overrides with a class). `.label` in globals.css is 10.5px.

## UAT (type/click → expected)
1. Open /about on phone width → one yellow "Contact the team" button; click → /support.
2. Open /privacy, /terms → eyebrow "Legal", title, six numbered sections separated by hairlines; links "Google's Privacy Policy" and "support page" are underlined. View source: exactly one `<main>`.
3. Open /legal/<any slug> → same shell with the "Legal" eyebrow.
4. Open /support → FAQ is one column; first item open; click another → it opens, first closes; toggles are 44px circles.
5. On /support type `abc` in email, tab away, press Send → email box turns red with the message under it; a screen reader announces it. Tick the consent by clicking its text.
6. Open /updates, click the email box → yellow focus ring. Enter your email, click "Send me updates" → ✓ message appears.
7. Turn coming-soon mode on in admin, open /coming-soon → warm yellow glow, no blue tint.
8. Open /design-system → page not found.
9. Reload /about, /support, /coming-soon with throttled network → skeleton has same shape as the page.
