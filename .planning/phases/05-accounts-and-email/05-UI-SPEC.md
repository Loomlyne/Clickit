---
phase: 05
slug: accounts-and-email
status: draft
revision: 2
shadcn_initialized: true
preset: "shadcn new-york, baseColor neutral, cssVariables; every token overridden by UI System (ui.config.json -> src/styles/globals.css, 2026-10-20)"
created: 2026-10-20
signed_source: "none yet. Basis: 05-CONTEXT.md D-01..D-41 (PROVISIONAL, recommended option of each Q, awaiting Koss through the controller) + mockups/05-mockups.html option A of #q1, #q3, #q4, #q7, #q12 + live tokens in src/styles/globals.css + Phase 4 04-UI-SPEC.md (scale, V1 board, email structure) + Phase 6 06-UI-SPEC.md (admin chips, tables, ICU number rules)"
---

# Phase 5 - UI Design Contract

> Visual and interaction contract for: the unified code-first sign-in, the new-viewer name step, the show-aware sign-in header, the `/auth/confirm` interstitial, reset-password, the admin authenticator pages (`/auth/mfa`), the Profile additions (password, email change pending, notifications), the read-only Admins list, the audit log's admin names, the unsubscribe and newsletter-confirm public pages, the newsletter pending state, the support confirmation, and every email (auth and app). Values come from the option A pictures, CONTEXT.md, the live tokens in `src/styles/globals.css`, and the Phase 4 and Phase 6 contracts. Anything this contract chose that the pictures or CONTEXT did not settle is listed under "Provisional / needs Koss" and "Owner-visible deviations" at the end.

**Precedence.** (1) Koss's signed answers (2026-10-20 ~18:05 CET, `05-CONTEXT.md` status line; Q4 = B, Q12 = C, Q19 = B, the rest A). (2) The signed Phase 4 canvas, boards V1, V4 and E0-E7, once signed: it wins over this file for look (D-27 says so); email colour values come from Phase 4's `src/lib/email-tokens.ts`. (3) This file. The Phase 4 contract (`04-UI-SPEC.md`) is followed wherever it is specific: scale 11/14/20/24, six code boxes `h-11` with 8px gaps in `dir="ltr"`, email structure and type. Email colour is settled: scheme-adaptive (section 7.1).

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn (`components.json`, style new-york, `rsc: true`, Tailwind v4, CSS variables) |
| Preset | not applicable (tokens come from UI System `ui.config.json`, applied to `globals.css` 2026-10-20) |
| Component library | Radix (`radix-ui` ^1.4.3 umbrella package) via `src/components/ui/*` |
| Icon library | lucide-react |
| Font | LBC (local, `--font-lbc`), English and Arabic, two files only: 400 and 700. Emails use the system sans stack (LBC cannot load in mail clients) |
| Mode | Dark only (app). Emails: black header band, white body (section 7.1) |
| Radius roles | pill 999px (buttons, chips), field 8px (inputs, code cells), card 12px, media 11px, panel 16px. Use the Phase 4 named utilities (`rounded-field`, `rounded-card`, `rounded-panel`) once Phase 4 has merged; until then the bracket forms (`rounded-lg`, `rounded-[12px]`, `rounded-[16px]`), same pixels |
| Touch target | 44px (`min-h-11` / `size-11`) for every interactive element in this contract |
| Minimum text | 11px in the app, 12px in emails |
| Contrast | 4.5:1 for text, computed values under Color |

### Primitives used

Existing and unchanged: `ui/button`, `ui/input`, `ui/label`, `ui/skeleton`, `ui/table` (Admins list), `ui/checkbox` (support form, unchanged), `ui/textarea` (support form, unchanged). Existing shared components: `auth/password-field` (small token fixes, below), `auth/auth-alert` (spacing fix, below), `security/turnstile-field` (Phase 2, placed not changed), `admin/admin-shell` (`AdminPageHeader`, `AdminTableShell`, `AdminPanel`).

**New, one shadcn-official primitive:** `ui/switch` (`npx shadcn add switch`; Radix `Switch` ships inside the already-installed `radix-ui` package, no new dependency). Needed for the Profile notifications row (no switch exists in `src/components/ui`). Restyled at the file to the tokens in section 6.9.

**New shared components (not primitives):**

| Component | File | Used by |
|-----------|------|---------|
| `CodeField` | `src/components/auth/code-field.tsx` | sign-in code, MFA enrol, MFA verify, reauthentication in Profile |
| `AuthCardPage` | `src/components/auth/auth-card-page.tsx` | confirm, reset-password, mfa, welcome, unsubscribe, newsletter-confirm (the existing reset-password frame, extracted) |
| `StepBar` | `src/components/auth/step-bar.tsx` | welcome (2 segments), MFA enrol (2 segments) |
| `StatusLine` | inline in `auth-alert.tsx` | icon + text line for pending and success notes (no box) |

No third-party registry block and no new npm package for the UI. (`react-email`, `resend` are email-side, see research.)

### Inherited primitive typography: call-site overrides (mandatory)

LBC has no 500/600 file; primitives that ask for them render 400/700 anyway (Phase 4 open item 6). Every new element gets its size and weight at the call site:

| Primitive | Default it would inherit | Override in this phase |
|-----------|--------------------------|------------------------|
| `Button` default and `lg` | 13.5px / 15px `font-medium` | `text-sm font-bold`; size `default` (44px) only. `sm`, `xs`, `icon`, `icon-sm`, `icon-xs` are not used |
| `Input` | `text-base md:text-sm` | keep as is: 16px under 768px (stops iOS zoom), 14px from `md`. This is the one documented exception to the four-size scale (Phase 4 table "Phone input 16") |
| `Label` | 13px `font-medium`, `leading-none` | `text-sm font-normal leading-normal` |
| `AuthAlert` text | `text-sm` | unchanged (14px) |
| `TableHead` / `TableCell` (Admins list) | `h-12 text-[11px] font-semibold tracking-[0.18em]` / `px-4 py-4` | `h-11 text-[11px] font-normal tracking-[0.14em]` / `px-4 py-0` (row height `h-16` comes from the row) |

---

## Spacing Scale

Declared values (multiples of 4):

| Token | Value | Tailwind | Usage in this phase |
|-------|-------|----------|---------------------|
| xs | 4px | `1` | Strength bars gap, step bar segment height, icon to text in chips, countdown gap on 320px phones |
| sm | 8px | `2` | Label to field, h1 to subline, code cell gap, button row gap, link to button, alert icon gap, alert vertical padding, status chip and show-chip inline padding |
| md | 16px | `4` | Field to field, last field to Turnstile to button, alert padding inline, phone page padding, email card padding on phones |
| lg | 24px | `6` | Subline to form, card padding on phones, step bar to heading |
| xl | 32px | `8` | Card padding from `sm`, email card padding, section gap on Profile |
| 2xl | 48px | `12` | Hero pane padding (existing), top padding of card pages on `sm+` |
| 3xl | 64px | `16` | Admin row height (`h-16`) |

Exceptions (each justified):
- 44px: all controls, code cells (`h-11`), switch hit area (`size-11`), password eye (`size-11`, existing).
- Fixed sizes: QR image 160px inside a 16px white frame (192px square), show poster card on phones `h-48` (192px, the picture shows 190px), switch track 44x24px, step segment 4px high, focus ring 2px with 2px offset (3px on `Input`, primitive).
- Code cell width is fluid (6 columns): 50px at a 375px phone with 16px page padding, 41px at 320px. The row is one real `<input>` overlay, so the touch target is the whole row (343 x 44).

No half steps (`*.5`) in anything new. These existing values are **replaced** in files this phase touches: `PasswordField` label gap `mt-1.5` (6px) becomes `mt-2` (8px), strength bars `gap-1.5` becomes `gap-1`; `AuthAlert` `px-3.5 py-3 gap-2.5` becomes `px-4 py-2 gap-2`. There is no 12px spacing step in this phase (the 12px values in the email section are type sizes, not spacing).

---

## Typography

Phase 4 scale for new screens: exactly four sizes, two weights. Used unchanged. **Scope:** the app screens use 11/14/20/24 (plus the documented 16px typed-text exception for `Input` under 768px). Email templates are a separate scale, 12/16/24/32 (section 7.1), because LBC cannot load in mail clients; the two scales never mix.

| Role | Size | Weight | Line height |
|------|------|--------|-------------|
| Label | 11px (`text-[11px]`) | 400; 700 for status chips only | 1.4 |
| Body | 14px (`text-sm`) | 400; 700 for button labels and the named rows | 1.5 |
| Heading | 20px (`text-[20px]`) | 700 | 1.25 |
| Display | 24px (`text-[24px]`) | 700 | 1.2 |

**Where each size is used**
- 11px: overlines (uppercase, `tracking-[0.14em]`, e.g. "ADMIN SECURITY", "ACCOUNT RECOVERY"), table column headers, strength caption, status chips, step labels.
- 14px: field labels, sublines, helper and legal lines ("By continuing you agree..."), links, buttons, inputs from `md`, errors, alerts, Profile rows, Admins list cells, audit cells, resend countdown.
- 20px: in-card headings: support success panel title and Profile reauthentication title. (The pending-email card title is 14px bold.)
- 24px: page h1 on every screen in section 6 (sign-in, welcome, confirm, reset, MFA, unsubscribe, newsletter-confirm), the six code digits, the Admins page title uses `AdminPageHeader` (unchanged).

**Bold (700) at 14px, exact list:** every `Button` label; the pending-email card title; the `notifLabel` row title; the Admins table Name cell. Everything else at 14px is 400. The "You" chip is 11px/700.

Rules:
- Weights are 400 (`font-normal`) and 700 (`font-bold`) only. Remove `font-medium` / `font-semibold` from every line of a file this phase edits.
- Uppercase and tracking only on 11px overlines and column headers, written in bracket form `tracking-[0.14em]` so the global Arabic rule strips it.
- The existing viewer h1 on `/auth` (32/36px) and card titles (18/28px) are "sizes already on viewer pages" (Phase 4): the unified sign-in and every new page use Display 24. The old `welcomeBackHeading` block is replaced.
- **Mixed-script text.** Names, emails, show titles inside sentences are isolated: JSX uses `t.rich(key, { bdi: (c) => <bdi>{c}</bdi> })`; string sinks (aria-label, toast, `title`) use `t.markup` with first-strong isolate characters (`⁨` ... `⁩`). Emails and URLs inside Arabic sentences: `<bdi dir="ltr">`. Messages wrap placeholders in `<bdi>` in both locales.
- **Numbers and digits.** Phase 7 (AR-01..03) owns Arabic-Indic digits for the UI. Phase 5 rule (same as Phase 6): no literal digits in new message text; counts use `#` in plurals, other numbers use `{n, number}`; times (the resend countdown `0:42`) come from `Intl.NumberFormat(localeTag, { minimumIntegerDigits })` with the next-intl locale tag (reuse Phase 6's `formatClock` if it is on `main`; otherwise a 6-line local `formatCountdown` in `code-field.tsx`); dates (Admins last sign-in) use `Intl.DateTimeFormat(locale === 'ar' ? 'ar-AE' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai' })`.
  Exceptions that never change with Phase 7: the six code cells show the digits as typed (Western, Arabic-Indic or Extended Arabic-Indic; Phase 4 V1b), the value sent is normalised to 0-9; the authenticator manual key and emails always use Western digits.

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `--bg-0` #090909 | Page canvas, `/auth` form column, admin canvas |
| Secondary (30%) | `--bg-1` #101010 card pages, Profile cards, Admins panel, hero pane; `--bg-2` #191919 fields, code cells, QR caption, pending-email card, current admin row; `--bg-3` #2A2A2A switch off track, step off segments, strength off bars | Surfaces |
| Accent (10%) | `--primary` #ffcc00, ink `--primary-foreground` #090909; soft `--uis-primary-soft` #312915 (only as the decorative card-page background glow, aria-hidden) | Reserved list below |
| Status tones | `--color-brand-green-safe` #77d586, `--color-brand-orange-safe` #ffb46e, `--color-brand-red-safe` #ff8b82 | Error text and icons, success alert, Admins chips |
| Destructive | `--destructive` #ff3b30 | Only the primitive's `aria-invalid` border and ring. No destructive action exists in this phase (admin factor removal is Koss's script, D-20; Unsubscribe is not destructive) |
| Text | `--text` #F4F4F4, `--text-dim` #CCCCCC, `--text-mute` #A1A1A1 | Primary, secondary, tertiary |
| Lines | `--line` rgba(255,255,255,.08), `--line-2` rgba(255,255,255,.14) | Card borders, code cell borders |

**Accent reserved for (nothing else is yellow):**
1. Primary `Button`: Send code, Verify code, Sign in, Create account, Send reset link, Reset password, Start watching, Finish signing in, Choose a new password, Confirm new email, Next: enter the code, Verify and continue, Add a second one, Open admin, Save password, Save email, Confirm password change, Stop episode emails, Confirm subscription, Send another message.
2. The active code cell: 2px `--primary` border and the 2px x 24px caret bar.
3. Step bar filled segments.
4. Notifications switch, on state (track).
5. Password strength filled bars (existing).
6. The "Free with an account" chip on the show-aware sign-in (picture q4).
7. Keyboard focus rings (`--primary`, `--ring`).
8. Emails: the pill button and the quoted-message start rule.

Not accent: text links ("Use a password instead", "Resend code", "Forgot password?", "Change email") are `--text-dim` underlined, hover `--text`; the show-link and legal links are `--text` underlined; the QR block is white (required for scanning); success icons use `--color-brand-green-safe`; the pending states use `--text-dim`.

**Error rule.** Error text and icon: `--color-brand-red-safe` (8.4:1 on `--bg-1`, 7.8:1 on `--bg-2`). The field/cell gets `aria-invalid` (primitive draws the `--destructive` border) and the error words are always present: meaning is never colour alone.

### Contrast (computed, WCAG 2.x relative luminance)

| Pair | Ratio |
|------|-------|
| `--text` / `--text-dim` / `--text-mute` on `--bg-1` | 17.3 / 11.8 / 7.4:1 |
| `--text` / `--text-dim` / `--text-mute` on `--bg-2` | 16.0 / 10.9 / 6.8:1 |
| `--primary-foreground` on `--primary` (buttons, chip, switch thumb) | 13.2:1 |
| `--primary` on `--bg-1` (active cell border, switch track) | 12.6:1 |
| brand-red-safe on `--bg-1` / `--bg-2` | 8.4 / 7.8:1 |
| brand-green-safe on `--bg-1` | 10.6:1 |
| brand-orange-safe on `--bg-1` | 10.9:1 |
| `--text-mute` on `--bg-3` (switch off thumb on track) | 5.6:1 |
| Email: #111 on #fff / #333 on #fff / #555 on #fff / #666 on #f4f4f4 / #090909 on #ffcc00 | 18.9 / 12.6 / 7.5 / 5.2 / 13.2:1 |

**Known gap, not changed here (pre-existing, Phase 4 owns tokens):** field boundaries (`--line`, `--line-2` on `--bg-0/1/2`) are about 1.2 to 1.6:1, below the 3:1 non-text rule. The code cells add the active 2px yellow border and 24px digits; the password eye and every control carry words or icons. Flagged in deviations.

---

## 5. Shared building blocks

### 5.1 Page frames

**`/auth` (split page, existing structure kept).** Hero pane `hidden lg:block lg:w-1/2` (`--bg-1`, backdrop image, scrim, quote) and form column `w-full lg:w-1/2` on `--bg-0`, content `max-w-[420px]`, padding `px-4 py-8 sm:px-6 md:py-12 lg:py-16`. The page keeps the site navbar and its language link (preserving `next`). The quote block (`welcomeBackHeading`, `quote`) moves to the hero pane only; the form column never shows it. Admin-configured `authHeading*` copy (config) is **retired** for the sign-in h1 (it said "Welcome back. Resume watching. New here? Sign up below.", which is wrong for a unified screen); the fields stay in Settings untouched (no destructive change) but are no longer read by `/auth`. Needs Koss (item 12).

**`AuthCardPage` (centered card).** The existing reset-password frame: `relative flex min-h-[calc(100dvh-4rem)] justify-center px-4 py-8 sm:px-6 sm:items-center sm:py-12`; radial glow `bg-[radial-gradient(ellipse_at_50%_0%,var(--uis-primary-soft)_0%,var(--bg-0)_62%)]` (aria-hidden); content `max-w-[440px]`; logo `/brand/cit-story.png` 140x40 `brightness-0 invert`, `mb-8` (32px), `alt="Clickit Story"`; panel `rounded-panel border border-[var(--line)] bg-[var(--bg-1)] p-6 shadow-panel sm:p-8`. On phones the card aligns to the top (`items-start`) so the keyboard never pushes the content off; centered from `sm`.

Panel inner order: (optional `StepBar`) -> overline (11px, `--text-mute`, `mb-2`) -> h1 (24px) -> subline (14px `--text-dim`, `mt-2 mb-6`) -> body.

### 5.2 `CodeField` (one real input, six presentation cells)

- Markup: `<div dir="ltr" class="relative">` (code order is left-to-right on Arabic pages, Phase 4 V1b/V4). A visible `Label` (14px) above. Six `aria-hidden` cells in `grid grid-cols-6 gap-2`. One real `<input>` `absolute inset-0 h-11 w-full` with `text-transparent caret-transparent selection:bg-transparent`, font-size 24px (>=16px so iOS never zooms), `inputMode="numeric"`, `autoComplete="one-time-code"`, `pattern="[0-9٠-٩۰-۹]*"`, no `maxLength` (a pasted "481 523" or "٤٨١٥٢٣" must arrive whole), `spellCheck={false}`, `enterKeyHint="go"`, `aria-invalid`, `aria-describedby` = helper + error ids.
- Value handling (client and server share one pure `normalizeCode(raw)` in `src/lib/auth-code.ts`): strip whitespace, hyphens, bidi marks U+200E/200F/202A-202E/2066-2069; map U+0660-0669 and U+06F0-06F9 to 0-9; keep digits; cap at 6. The component keeps the **raw typed string** for display (cells show the digits as typed) and emits the normalised string.
- Cell: `h-11 rounded-field border border-[var(--line-2)] bg-[var(--bg-2)] text-[24px] font-bold text-[var(--text)] flex items-center justify-center`. Active cell (input focused, index = `min(length, 5)`): `border-2 border-[var(--primary)]` plus a caret bar (an `h-6` element drawn with `border-s-2 border-[var(--primary)]`, 2px, no half step) blinking at 1s steps (static under `prefers-reduced-motion`). Error: all cells `border-[var(--color-brand-red-safe)]` (the input carries `aria-invalid`). Busy/success: `opacity-60`, input `disabled`.
- Tapping any cell focuses the input and puts the caret at the end (`onFocus`/`onSelect` re-set the selection range). Backspace deletes the last digit. Auto-submit once when the normalised value reaches 6 digits (`onComplete`); after a failure the value clears and focus returns to the input.

### 5.3 `PasswordField` (existing, token fixes only)

Eye stays on the **physical right in both locales** (owner rule): the box that holds the input and the eye gets `dir="ltr"` (the label and error stay in the page direction), so `end-0` resolves to the right on `/ar` too; 44x44, keyboard reachable, `aria-pressed`, accessible name `auth.showPassword` / `auth.hidePassword`, `Eye`/`EyeOff` 16px. Changes: label 14px/400 with `mt-2` gap, strength caption 11px, error 14px `role="alert"` (so Arabic and screen readers get it), strength bars `gap-1`. Used in: sign-in (password mode), password sign-up, reset (new + confirm), Profile Set/Change password (new + confirm). **Every password input in this phase is a `PasswordField`**; a raw `type="password"` input fails review. The leaked-password refusal is an ordinary field error (`pwLeaked`).

### 5.4 Alerts and status lines

`AuthAlert` stays (error `role="alert"`, success `role="status"`, 12px/16px radius as today) with the spacing fix above and 16px icons. New `StatusLine` for non-boxed notes: `flex items-start gap-2 text-sm text-[var(--text-dim)]` with a 16px icon. Inline field errors: `mt-2 text-sm text-[var(--color-brand-red-safe)]`, `role="alert"`.

### 5.5 Turnstile slot

Phase 2's signed placement is used as is: Managed widget, dark, full form width (`appearance: always`, `size: flexible`), between the last field and the submit button on sign-in (Send code), password sign-in, password sign-up, forgot password and the contact form; newsletter uses `interaction-only`. Failure line (signed wording): "Security check failed. Please try again." under the widget. A submit consumes the token (`useTurnstileToken().consume()`), the widget remounts. **Resend code** needs a fresh token while the code boxes are on screen: that one instance uses `interaction-only` so the code screen stays uncluttered (item 9). Supabase `verifyOtp` needs no token.

### 5.6 `StepBar`

`flex gap-2 mb-6`, segments `h-1 flex-1 rounded-full`, filled `bg-[var(--primary)]`, off `bg-[var(--bg-3)]`, segments `aria-hidden`, plus `<span class="sr-only">` "Step {current} of {total}" (`stepOf`).

---

## 6. Screens

Frame, content order (= DOM and focus order), states, focal point. Strings are keys; text is in the Copywriting Contract.

### 6.0 The wall (D-01, D-02, AUTH-01): what a signed-out visitor can open

Open without an account: the landing page (`/` forwards to `/portfolio`), `/privacy`, `/terms`, `/legal/*`, every `/auth/*` page, `/support`, `/coming-soon` while that mode is on, and `/api/*` (own checks). **This contract adds two public pages the D-01 list omits:** `/{locale}/unsubscribe` (6.10; the `/api/email/unsubscribe` route that mail clients POST to, and that 303-redirects a GET to this page, is already covered by `/api/*`) and `/{locale}/newsletter/confirm` (6.11). Both must be added to the wall's open list and to plan 05-04's wall test, or recipients clicking the email link would be bounced to sign-in (open item 6). Everything else sends a signed-out visitor to `/{locale}/auth?next=<path>`. The wall has no visible UI of its own: no banner, no toast, no "please sign in" page.

### 6.1 `/{locale}/auth` unified sign-in (D-05..D-07, D-37; picture q1 A)

Frame: split page (5.1). Form is one client component `AuthSignInForm` replacing `AuthPanel`, `LoginForm`, `SignupForm` (tabs removed). Focal point: the email field (state 1), the six code cells (state 2).

**State 1 `email` (code mode, default).** Order: h1 `signInOrJoinTitle` -> subline `signInOrJoinSub` -> Email (`Label` + `Input type="email" autoComplete="email" inputMode="email" dir="ltr"`) -> Turnstile slot -> primary `Button` "Send code" (full width, 44px, `mt-2`) -> link-button "Use a password instead" (centered, `min-h-11`, underlined, `mt-2`). No autofocus on touch devices (keyboard would hide the page); autofocus only when `matchMedia('(hover: hover)')`. Submitting disables the button and shows `Loader2` spinner with `sending`.

**State 2 `code-sent` (same screen, no navigation).** The email field is replaced by one line: `codeSentTo` ("Code sent to <bdi>sara@example.com</bdi>") with link-button `changeEmail` at the end (returns to state 1 with the email kept). Order: that line -> `CodeField` (label `codeLabel`) -> error slot (below the cells) -> helper `codeHelp` (14px `--text-mute`) -> primary "Verify code" (disabled until 6 digits) -> resend row -> link "Use a password instead". The code field receives focus on entry and a polite status announces `codeSentAnnounce`. Typing the sixth digit submits automatically; the button remains for paste-failures and screen-reader users.
- Resend row (`mt-4`, centered, 14px): for the first 60s `<bdi>` countdown text `resendIn` ("Resend code in 0:42", `--text-mute`, **not** a live region, re-rendered each second); at 0 it becomes the link-button `resendCode` (`min-h-11`, underlined) and a single polite announcement `resendReady` is made. Resend restarts the 60s window and shows `codeSentAnnounce` again.
- Verifying: input and button disabled, spinner, `verifying`; cells `opacity-60`.
- Success (V1g): helper line replaced by `StatusLine` with `CheckCircle2` in green-safe, `signedIn`, `role="status"`; the page navigates (`window.location.assign`) to `next` (D-04); a new viewer goes to the name step (6.2).

**State 2 errors** (inline under the cells, 14px red-safe with `AlertCircle`, `role="alert"`; cells error-bordered; value cleared; focus back in the input):

| Case | Key |
|------|-----|
| Wrong, or expired and the client cannot tell (Supabase returns one error for both) | `codeWrong` |
| Client knows more than 15 minutes passed since the send | `codeExpired` (and the resend link is shown at once if the 60s window is over) |
| Rate limit (429, `over_request_rate_limit`, `over_email_send_rate_limit`) | `tooManyTries` |
| Send failed (email step) | `codeSendFailed` (form-level `AuthAlert` above the field) |
| Turnstile refused | signed line under the widget |
| Network | `errors.networkError` (existing) |
| Invalid email | `errors.emailInvalid` (existing, under the field) |

**State 3 `password` mode** ("Use a password instead"). Order: h1 `signInTitle` ("Sign in" / existing `signInButton` wording) -> subline `signInPasswordSub` -> Email (kept) -> `PasswordField` (`autoComplete="current-password"`) -> end-aligned link `forgotPassword` (`min-h-11`) -> Turnstile -> primary "Sign in" -> link-button `useCode` ("Email me a code instead") -> divider-free muted line `noAccountYet` + link-button `createWithPassword`. Sign-in errors: `errors.authInvalidCredentials`, `errors.authEmailNotConfirmed`, `errors.authRateLimit`, captcha line.

**State 4 `signup-password`** (behind the password path, D-05). Order: h1 `createAccountTitle` -> subline -> Email -> `PasswordField` with strength meter (`autoComplete="new-password"`) -> Turnstile -> primary "Create account" -> terms line `termsLine` (14px `--text-mute`, links underlined `--text`) -> link-button `switchToSignIn`. No name field here: the name step (6.2) follows the first confirmed sign-in for every new viewer. Errors: `pwLeaked`, `errors.passwordMin`, `errors.authEmailTaken`. Success: replace the form with `AuthAlert` success (`signupCheckEmailTitle` + `signupCheckEmailBody`, mentions 15 minutes) and a link-button `resendConfirmation` using the same 60s countdown pattern; email links work on any device (D-12).

**State 5 `forgot`** (from `forgotPassword`). Back link-button `backToSignIn` (ArrowLeft, `rtl:scale-x-[-1]`) -> subline `resetDescription` -> Email -> Turnstile -> primary `sendResetLink`. Success: `AuthAlert` success `resetEmailSent` + `resetEmailDescription` (15 minutes, any device).

**No show-aware header (D-03, Q4 = B signed).** `/auth` looks the same for every `next`: no show poster, no show title, no chip, no per-show Open Graph. `getSafeAuthNextPath(next)` is still validated and used after sign-in, so the viewer lands on the show or episode she came from.

**"Skip sign-in" is removed (D-02):** the link under the form, the admin setting and its Settings control are gone; no element on this screen offers to continue without an account.

**Already signed in:** unchanged redirect (admin without `next` -> `/admin`).

### 6.2 New-viewer name step (D-08; picture q3 A)

Route `/{locale}/auth/welcome?next=` (recommended; a sibling of `/auth/*`, so it is already on the open list; it redirects a signed-out visitor to `/auth`). Reached after the first verified sign-in of any viewer with no `display_name` or null `onboarded_at`, whether by code or by confirm link. Frame: `AuthCardPage`. Focal point: the name field.

Order: `StepBar` (2 of 2, both filled; step 1 was the code) -> h1 `welcomeTitle` -> subline `welcomeSub` -> Label `nameLabel` + `Input` (`autoComplete="name"`, `maxLength={60}`, min length 2 = `NAME_MIN`, autofocus) -> terms line `termsLine` -> primary "Start watching" -> note `passwordLaterNote` (14px `--text-mute`, plain text, **not a link**: the picture drew a link, but it would leave the page before the name is saved and Profile does not yet exist for the viewer; the live-control rule forbids a dead link, item 7).
Errors: `errors.nameMin` under the field; save failure `errors.authGeneric` in an `AuthAlert`. No skip. Saving sets `display_name` and `onboarded_at`, then goes to `next` or Browse.

### 6.3 `/{locale}/auth/confirm` interstitial (D-12, D-13; AUTH-04)

Frame: `AuthCardPage`. A **page with one button**: nothing is verified on GET (link scanners pre-fetch links). The button posts a server action `verifyOtp({ token_hash, type })`. Focal point: the single primary button (it takes focus on load; it is the only control).

Variants by `type` (icon in a 44px `rounded-full bg-[var(--bg-2)]` circle, 20px icon, `--text-dim`, `mb-4`, `aria-hidden`):

| `type` | Icon | h1 | Body | Button |
|--------|------|----|------|--------|
| `signup`, `email` | MailCheck | `confirmSignupTitle` | `confirmSignupBody` | `finishSigningIn` |
| `recovery` | KeyRound | `confirmRecoveryTitle` | `confirmRecoveryBody` | `chooseNewPassword` |
| `email_change` | Mail | `confirmEmailChangeTitle` | `confirmEmailChangeBody` | `confirmNewEmail` |

States:
- Submitting: button disabled, spinner, `working`.
- Success -> navigation: signup/email -> name step or `next`; recovery -> `/auth/reset-password`; email_change **second** link -> success card below.
- **Email change, first link (pending other address, D-13):** Supabase returns no error and no session. Card swaps to: icon Clock, h1 `pendingOtherTitle` ("Confirmed. Now open the link we sent to the other address"), body `pendingOtherBody`, button (outline) `goToProfile`. No auto-redirect.
- Email change, second link: icon CheckCircle2 (green-safe), h1 `emailChangedTitle`, body `emailChangedBody`, button `goToProfile` (the wall sends a signed-out visitor to sign-in, then back to Profile).
- Invalid, expired or already used (also missing params): icon AlertCircle (red-safe), h1 `linkExpiredTitle`, body `linkExpiredBody`, button `backToSignIn` (recovery: `requestNewLink`, opens `/auth` in forgot state). The three causes are indistinguishable from Supabase; one message.
- Error with a retry (network): `AuthAlert` error above the button; button stays enabled.

### 6.4 `/{locale}/auth/reset-password` (D-13; existing page, extended)

Frame: `AuthCardPage` (this is the current look, kept). Overline `resetHeading` -> h1 (existing `resetButton` "Reset password") -> subline `resetDescription` -> `ResetPasswordForm`: `PasswordField` new (strength meter, `autoComplete="new-password"`) -> `PasswordField` confirm -> primary "Reset password". Errors: `pwLeaked`, `errors.passwordMin`, `errors.passwordMismatch`, `errors.authGeneric`. Success: toast `resetSuccess` and navigation to `next` or Browse (the recovery link has already signed the viewer in on this device).
Focal point: the new-password field with its eye. **No valid session** (page opened directly, or the recovery session expired): the form is replaced by the expired state of 6.3 (`linkExpiredTitle`, `linkExpiredBody`, button `requestNewLink`). This replaces today's silent failure on submit (B2 audit note).

### 6.5 `/{locale}/auth/mfa` enrol (D-18..D-20; picture q7 A)

Frame: `AuthCardPage`; reached for an admin without a verified TOTP factor. Overline `mfaOverline` on every MFA screen. Focal point: the QR code (step 1), the code cells (step 2).

**Step 1 "scan".** `StepBar` 1 of 2 -> h1 `mfaEnrolTitle` -> subline `mfaEnrolSub` -> QR frame (`mx-auto size-48 rounded-card bg-white p-4`, image 160px from Supabase `totp.qr_code` SVG data URI via `<img>`, `alt` = `mfaQrAlt`, never mirrored in RTL; white is required for scanners and is the only non-token surface) -> manual key block: label `mfaManualKey` (14px `--text-mute`), key in groups of four (`JBSW Y3DP EHPK 3PXP`), `dir="ltr"`, `select-all`, 14px bold with `tracking-[0.12em]`, in `rounded-field bg-[var(--bg-2)] px-4 py-2`, followed by an outline `Button` `copyKey` (44px; on press the label becomes `keyCopied` for 2s and a polite status announces it) -> primary `mfaNext`.
**Step 2 "code".** `StepBar` 2 of 2 -> h1 `mfaStepCodeTitle` -> subline `mfaStepCodeSub` -> `CodeField` (autofocus, label `codeLabel`) -> error slot -> primary `mfaVerifyContinue` -> link-button `mfaBack`. Auto-submits at 6 digits. Errors: `mfaCodeWrong` (names the phone clock, the usual cause), `mfaTooMany` (Supabase MFA verify 15/min), `mfaEnrolFailed` (enrol call failed: `AuthAlert` plus a Reload `Button`).
**Step 3 "second authenticator" (D-20).** After the first factor verifies: icon CheckCircle2 (green-safe), h1 `mfaSecondTitle`, subline `mfaSecondSub`, primary `mfaSecondAdd` (repeats steps 1-2 with the heading `mfaSecondTitle`), link-button `mfaSecondSkip` (goes to step 4). Skippable (item 3). After the second factor verifies, or on skip -> step 4.
**Step 4 "done".** h1 `mfaDoneTitle`, primary `mfaDoneOpen` (goes to `next` or `/admin`).
Resuming a half-finished enrolment (page reloaded): the server removes leftover unverified factors and starts again at step 1 (D-18); no error is shown.

### 6.6 `/{locale}/auth/mfa` verify (D-19)

Frame: `AuthCardPage`. Focal point: the code cells. Order: overline `mfaOverline` -> h1 `mfaVerifyTitle` -> subline `mfaVerifySub` (when `reason=stale`, add the second sentence `mfaStaleNote`) -> `CodeField` (autofocus) -> error slot -> primary `mfaVerifyContinue` ("Verify and continue") -> note `mfaLostPhone` (14px `--text-mute`, plain text: no mailbox exists yet, so it is not a link) -> link-button `signOut` (existing `common.signOut`, `min-h-11`, for an admin who opened the wrong account). Errors as 6.5. Success -> `next` or `/admin`. The `next` is validated with `getSafeAuthNextPath`.

### 6.7 Profile additions (D-09, D-13, D-15, D-34, D-35; `src/components/profile/account-settings.tsx`)

Everything lives in the existing `AccountSettings` card using the existing `FieldRow` scaffold (icon 16px, label, value, outline "Change" button, inline form below, divider `divide-[var(--line)]`). B2's account pictures (`.planning/design/b2-account-before-after.html`) cover the row, the inline form, the eye and the mismatch error; they are reused, not redrawn. The card heading stays the existing profile card heading (Phase 4/B2 own it). Row order: Display name, Email, Password, **Notifications** (new). Language has no row in this card and **no visible change**: the language-sync server action runs silently (no toast, no spinner, no layout shift, no focus move).

**Password row.**
- Account has no password (`password_set_at` null): value `passwordNotSet` (14px `--text-mute`) and outline button `setPassword`; under the value, hint `passwordSetHint`.
- Account has a password: value `••••••••` (aria-hidden) and outline button `changePassword`.
- Edit form (both): `PasswordField` new (strength meter) + `PasswordField` confirm, then `Button` `savePassword` (primary) and `discardChanges` (ghost); saving shows a spinner and disables the pair. Errors under the field: `pwLeaked`, `errors.passwordMin`, `errors.passwordMismatch`. Success: toast `passwordChanged` (change) or `passwordAdded` (set), the row returns to its closed state with the new label ("Set" becomes "Change").
- **Reauthentication (conditional, D-26 template 5):** if Supabase answers that a recent sign-in or a nonce is required, the form's second step appears in place: h3 (20px) `reauthTitle`, subline `reauthSub`, `CodeField`, primary `confirmPasswordChange`, link-button `resendCode` with the 60s countdown. Same errors as 6.1 state 2. If Supabase is configured so it never asks, this step never renders (item 11).

**Email row.** Closed: current email, outline `changeAction` (unchanged). Pending (a `new_email` exists on the user, so it survives reloads and other devices): below the row, a card `rounded-field border border-[var(--line-2)] bg-[var(--bg-2)] p-4` with a Clock icon, title `emailPendingTitle` (14px bold), body `emailPendingBody`, link-button `resendLinks` (60s countdown, then toast `linksResent`). The "Change" button stays enabled (a new address replaces the pending one). The inline form's buttons are `saveEmail` (primary) and `discardChanges` (ghost). The display-name row has no button (it auto-saves, unchanged), so it needs no Save label. Submit errors as today (`emailInvalid`, mapped auth errors from i18n keys, not the English-only `mapAuthError`).

**Notifications row (D-34, D-35).** Icon Bell. Layout `flex min-h-11 items-start justify-between gap-4`: text block (label `notifLabel` 14px bold, help `notifHelp` 14px `--text-mute`) and the `Switch` (6.9) at the end, vertically aligned to the label line. Default on. Toggling saves at once (server action, optimistic with rollback); the switch is `aria-busy` and disabled while saving; a polite status announces `notifOn` / `notifOff`; failure reverts the switch and shows `notifSaveFailed` below the row (`role="alert"`). The same flag is flipped by the email's one-click unsubscribe, so the page always reads the stored value.

**Focal point:** the password edit form (eye visible). Mobile: rows stack (existing `flex-col sm:flex-row`).

### 6.8 Admin: read-only Admins list (D-22), audit names (D-23)

**Admins list.** Own page `admin/admins/page.tsx` (discretion; read-only either way), nav item `admins` in the Operations group between Settings and Audit, icon `ShieldCheck`. Behind `requireAdmin`. `AdminPageHeader` (title `admins.title`, description `admins.description`, no action). `AdminTableShell` with a `Table`: columns Name (14px bold, with chip "You" for the signed-in admin), Email (`dir="ltr"`, 14px `--text-dim`, `break-all`), Authenticator (chip: set up = ok tone, not set up = warn tone), Last sign-in (formatted Dubai time, `title` = ISO; "Never" when null). Current admin's row has `bg-[var(--bg-2)]`. Under `md` the table becomes a stacked list: one `rounded-card border border-[var(--line)] bg-[var(--bg-1)] p-4` per admin with name + "You" chip, email, chip, last sign-in, `gap-2`. Footer note (14px `--text-mute`, inside an `AdminPanel`): `admins.ownerNote`. Error: `AdminPanel` with `admins.loadError`. Focal point: the Authenticator column chips (a "Not set up" chip is the one thing an owner scans for). No add, edit, remove or reset control exists on this page. Empty state: not applicable (the signed-in admin is always a row).
Chips use the Phase 6 status-chip classes (base `inline-flex min-h-6 items-center gap-1 rounded-full border px-2 text-[11px] leading-none font-bold tracking-[0.04em] whitespace-nowrap`; ok `border-brand-green-safe/35 bg-brand-green-safe/8 text-brand-green-safe`; warn `border-brand-orange-safe/35 bg-brand-orange-safe/8 text-brand-orange-safe`; neutral `border-[var(--line-2)] text-[var(--text-mute)]`). Import the shared chip if Phase 6 or 4 has merged; else create it once at `src/components/admin/status-chip.tsx`.

**Audit log (`admin/audit/page.tsx`).** Add column `audit.adminColumn` ("Admin") as the second column, always visible (also under `md`, where Details is hidden). Cell: the admin's `display_name` from `admins` in `<bdi>`, 14px `--text`. No match (admin removed from `admins`): `audit.formerAdmin` in `--text-mute`. System rows (cron, no user): `audit.system`. New entity `admin_auth` (TOTP enrol/unenrol, sign-in failure) uses the existing row pattern; its action chips use the neutral chip, failures use the bad tone (`border-brand-red-safe/35 ... text-brand-red-safe`); no new colour and no raw palette class (B4 is replacing those).

### 6.9 `ui/switch`

Radix `Switch.Root` wrapped in `<span class="flex size-11 items-center justify-center">` (44px hit area). Track `h-6 w-11 rounded-full border`, off: `border-[var(--text-mute)] bg-[var(--bg-3)]`, on: `border-[var(--primary)] bg-[var(--primary)]`; thumb `size-5 rounded-full`, off `bg-[var(--text-mute)]`, on `bg-[var(--primary-foreground)]`, travel 20px, `rtl:` mirrored with `data-[state=checked]:translate-x-5 rtl:data-[state=checked]:-translate-x-5`; transition 120ms `--ease` (none under reduced motion); focus `ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-[var(--bg-1)]`; disabled `opacity-50`. Always labelled (`aria-labelledby` the label, `aria-describedby` the help text). Off-track boundary is `--text-mute` (7.4:1 on `--bg-1`) because `--bg-4` would be 1.9:1.

### 6.10 `/{locale}/unsubscribe` (D-35; MAIL-04)

Public (signed-out), HMAC-verified on load (`u`, `k`, `t`); language = the recipient's `profiles.locale`, else `en`. The List-Unsubscribe URL stays `/api/email/unsubscribe` (POST = one-click mail-client unsubscribe, GET = 303 to this page), so the page is a normal locale page. **The D-01 open list must add this path** (item 6). Frame: `AuthCardPage`; focal point: the Unsubscribe button.
- Confirm: icon BellOff, h1 `unsubTitle`, body `unsubBody`, primary `unsubscribe` (POST), link-button `unsubKeep` (goes to `/`).
- Submitting: disabled, spinner, `unsubscribing`.
- Done: icon CheckCircle2 (green-safe), h1 `unsubDoneTitle`, body `unsubDoneBody`, primary `goToClickit` (to Browse; the wall asks for sign-in if needed). A repeat visit shows Done again (idempotent).
- Invalid or tampered link: icon AlertCircle, h1 `unsubInvalidTitle`, body `unsubInvalidBody`, button `backToSignIn`.
- Server error: `AuthAlert` error `common.error`, button stays enabled.

### 6.11 `/{locale}/newsletter/confirm` (D-32; MAIL-06)

Public, HMAC-verified (7 days). Same interstitial principle as 6.3: GET shows a page with one button; POST confirms (a link scanner must not confirm consent for the person). Needs Koss (item 6): D-32 says "clicking it sets confirmed_at" and is silent on scanners. Frame: `AuthCardPage`; focal point: the Confirm button.
- Idle: icon MailCheck, h1 `nlConfirmTitle`, body `nlConfirmBody`, primary `nlConfirmButton`.
- Done: CheckCircle2 (green-safe), h1 `nlDoneTitle`, body `nlDoneBody`, link-button `goToClickit`.
- Already confirmed: h1 `nlAlreadyTitle`, body `nlDoneBody`.
- Expired (> 7 days): AlertCircle, h1 `nlExpiredTitle`, body `nlExpiredBody`, link-button `goToClickit`.
- Invalid: `unsubInvalidTitle` / `unsubInvalidBody`.

### 6.12 Newsletter form pending state (`newsletter-signup-form.tsx`, D-32, D-39)

The form must never say "subscribed" before the click. After a successful submit (new or refreshed pending row) the existing `role="status"` line shows `Mail` icon 16px `--text-dim` + `statusPending`. A second submit within 10 minutes shows `statusPendingRecent` (same icon). A confirmed address shows `statusAlreadySubscribed` with the existing accent `Check` icon. `statusSent` ("You are subscribed.") and `statusUpdated` are **removed** from the success path. The input keeps the typed email; the submit button re-enables after the response. `statusOfflineSaved` stays for an enqueue failure. Focal point: that status line. Compact (footer) and full variants share the strings. The compact variant's 44px arrow button keeps its look but its accessible name is `newsletter.submitAria` ("Send confirmation link"; the SVG is `aria-hidden`), never an unlabelled icon; the full variant's visible label is the existing `defaultButton`.

### 6.13 Support confirmation (`contact-form.tsx`, D-31, D-39)

Replace the toast-and-reset with a confirmation that stays: on success the form is replaced by an `AuthAlert`-success-style block (`rounded-card border border-[var(--color-brand-green-safe)]/35 bg-[var(--color-brand-green-safe)]/12 p-6`, `role="status"`, focus moved to its heading): `CheckCircle2` 20px, heading `support.sentTitle` (20px), body `support.sentBody` (14px `--text-dim`, names the sender's email in `<bdi>`), outline `Button` `support.sendAnother` (restores the empty form). Focal point: the success heading (it takes focus). No toast. The enqueue-failure case keeps the existing orange inline note with updated wording (`savedEmailFailedInline`). The static auto-reply is never echoed on screen either.

### 6.14 Loading and empty states

`auth/loading.tsx` skeleton matches the new page: a 24px title bar (`w-3/4`), a 14px subline bar, a 44px field, a 44px pill button, all `--bg-2` `Skeleton`s. Card pages show no skeleton (server-rendered). Admins list loading: three 64px row skeletons. No other empty states exist (every screen is a form or a status page).

---

## 7. Emails (D-25..D-28, D-39; MAIL-01, MAIL-03..07)

React Email source in `src/emails/**`; auth templates exported to `supabase/templates/*.html` with Go placeholders kept as literal text; app emails rendered in the queue consumer. Sender `Clickit Story <no-reply@clickitstory.ae>`. Locale per D-15: Go `{{ if eq .Data.locale "ar" }}...{{ else }}...{{ end }}` in auth templates, `profiles.locale` for app emails, page locale for support auto-reply and newsletter confirm.

### 7.1 Shell and colours

Structure and type are the Phase 4 section 5 contract, adopted unchanged: table-based, inline styles, `role="presentation"`, 600px max (`width:100%;max-width:600px`), 16px side padding on phones, card padding 32px, `lang` and `dir` on `<html>` and on the content table (`dir="rtl"` for Arabic), hidden preheader (<= 90 characters), logo as a hosted PNG on `media.clickitstory.ae` (`width="136"`, `alt="Clickit Story"`, `style="display:block;border:0"`, alt text coloured so it reads with images off; **`public/brand/email-logo-white.png`, 272px wide on its own solid #090909 plate, built by Phase 5 plan 05-07 Task 4** and placed on the media host by a controller step), exactly one primary action per email, a plain-text URL fallback line under every button, no tracking pixels or tracked links, no web fonts, no `rgba()`, no CSS class required for layout.

| Role | Size | Weight | Line height | Use |
|------|------|--------|-------------|-----|
| Heading | 24px | 700 | 1.25 | Email title |
| Body | 16px | 400 | 1.5 | Paragraphs; button label is 700 |
| Code | 32px | 700 | 1.2 | 6-digit code, `letter-spacing:8px` with `padding-left:8px` to centre it, `dir="ltr"` in Arabic too, `user-select:all`; mono stack `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` |
| Small | 12px | 400 | 1.5 | Hints, fallback URL, footer, legal |

Font stack `-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif` (Arabic adds `Tahoma` before `Arial`). Bulletproof button: `<td bgcolor="#ffcc00" style="border-radius:999px"><a style="display:inline-block;padding:12px 32px;font-size:16px;font-weight:700;line-height:24px;color:#090909;text-decoration:none;border-radius:999px">` (48px high; Outlook shows square corners, accepted). Digits in emails are always Western.

**Scheme-adaptive: Phase 5 Q12 = C, signed 2026-10-20 (D-27; also Phase 4 Q7 = C).** Colour values are owned by Phase 4: import them from `src/lib/email-tokens.ts` (literal hex, both schemes; Phase 4 plan 04-01, mirrored in DESIGN.md). Phase 5 never redefines a hex in template code. The table below names the roles and the values Phase 4 pins; they must match the signed picture exactly; a missing or different value stops 05-07 with `NEEDS CONTROLLER` until Phase 4 fixes `email-tokens.ts`. Colour reference: Phase 4 `mockups/04-q7c.png`; signed look: `mockups/05-q12-schemes.png`.

| Role | Light (default) | Dark (`@media (prefers-color-scheme: dark)`) |
|------|-----------------|----------------------------------------------|
| Meta | `<meta name="color-scheme" content="light dark">`, `<meta name="supported-color-schemes" content="light dark">`, `:root{color-scheme:light dark}` | same |
| Page | #F4F4F4 | #090909 |
| Header | black band #090909 with logo plate, padding 24px | #101010 card top, 1px #222 rule under it |
| Card | #FFFFFF, radius 12px | #101010, `1px solid #222`, radius 12px |
| Heading / code text | #111111 | #F4F4F4 heading; code digits #ffcc00 |
| Body | #333333 | #CCCCCC |
| Hints, fallback URL | #555555 | #A1A1A1 |
| Code box / quoted box | #F6F6F6, `1px solid #E5E5E5`, radius 8px (quote: 3px #ffcc00 start rule) | #191919, `1px solid #2A2A2A` |
| Links in body | #111111 underlined | #F4F4F4 underlined |
| Footer (inside the card, under a 1px #E5E5E5 rule) | 12px #767676 or darker on #FFFFFF (Phase 4 pin; #777777 is 4.48:1 and fails AA) | 12px #A1A1A1, rule #222 |
| Button | #ffcc00 background, #090909 ink | same |

Dark rules live in one `<style>` block in `<head>` with `!important` overrides on classes (`.cs-page`, `.cs-card`, `.cs-text`, …); inline styles carry the light values so clients that strip `<style>` show the light look. Gmail (web and apps) ignores the media query and may auto-invert: the logo is a PNG with its own solid #090909 plate (stays a dark band with a readable wordmark under inversion), the button is a solid `bgcolor` table cell with inline colours, no text inside transparent images. The Q12 picture (light, dark, Gmail-dark) was signed by Koss 2026-10-20 ~19:00 CET; it is the reference look for 05-07, 05-10, 05-11.

Footer content (all emails): line 1 "Clickit Story · Spacelight Studios FZ LLC, Abu Dhabi, United Arab Emirates"; line 2 "Help: clickitstory.ae/support" (link). **Digest and newsletter confirm only** add `{postalLine}` (Q19 = B signed: exactly "Spacelight Studios FZ LLC, Abu Dhabi, United Arab Emirates", no street). Digest adds the unsubscribe link and the Profile link. Welcome, auth and support emails have no unsubscribe link (transactional).

Dark mode: handled by the scheme table above. An owner render check (EN + AR, Gmail web, Gmail iOS/Android, Outlook, Apple Mail, light and dark, images off) is an owner step (research Pitfall 11).

### 7.2 Plain-text part (every email)

`Content-Type: text/plain; charset=utf-8`. Order: heading line, blank line, body paragraph(s), blank line, the code **or** the URL alone on its own line, blank line, fine print, blank line, `--`, footer lines. No HTML entities, no tables, lines not hard-wrapped. Arabic text is written in logical order (clients apply the bidi algorithm); the code and URLs stay on their own lines so they never reorder.

### 7.3 Per-email contract

All Arabic text is a draft for Koss's review. Go placeholders appear literally in the auth rows. "15 minutes" is a fixed literal in auth templates (D-10); a unit test pins it.

| # | Email | Subject EN / AR | Heading + body EN | Body AR | Button / block |
|---|-------|-----------------|-------------------|---------|----------------|
| E1 | Sign-in code (Magic Link) | `Your Clickit Story sign-in code` / `رمز الدخول إلى Clickit Story` (neutral: no code in the subject, so a locked phone's notification does not show a live code) | "Your sign-in code" / "Enter this code on Clickit Story. It works for 15 minutes." | "رمز الدخول" / "أدخل هذا الرمز في Clickit Story. صالح لمدة 15 دقيقة." | Code block. No button (picture q12 has none; Phase 4's placeholder "Open Clickit Story" is not adopted, item 10). Fine print: "Didn't ask for it? Ignore this email; nobody can sign in without the code." / "لم تطلب الرمز؟ تجاهل هذه الرسالة، فلا يمكن لأحد الدخول بدون الرمز." Preheader: "Your code works for 15 minutes." / "الرمز صالح لمدة 15 دقيقة." |
| E2 | Confirm signup | `Confirm your Clickit Story email` / `أكّد بريدك في Clickit Story` (neutral, no code) | "Confirm your email" / "Press the button to confirm your email, or enter the code below on Clickit Story. Both work for 15 minutes." | "أكّد بريدك الإلكتروني" / "اضغط الزر لتأكيد بريدك، أو أدخل الرمز أدناه في Clickit Story. كلاهما صالح لمدة 15 دقيقة." | Button "Confirm email" / "تأكيد البريد" -> `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=signup`; fallback URL line; code block below; fine print "Didn't sign up? Ignore this email." / "لم تنشئ حساباً؟ تجاهل هذه الرسالة." |
| E3 | Reset password | "Reset your Clickit Story password" / "إعادة تعيين كلمة مرور Clickit Story" | "Reset your password" / "Press the button to choose a new password. The link works for 15 minutes and opens on any device." | "إعادة تعيين كلمة المرور" / "اضغط الزر لاختيار كلمة مرور جديدة. الرابط صالح لمدة 15 دقيقة ويعمل من أي جهاز." | Button "Choose a new password" / "اختيار كلمة مرور جديدة" (`type=recovery`); fine print "Didn't ask? Ignore this email; your password stays the same." / "لم تطلب ذلك؟ تجاهل هذه الرسالة وستبقى كلمة مرورك كما هي." |
| E4 | Email change | "Confirm your new Clickit Story email" / "أكّد بريدك الجديد في Clickit Story" | "Confirm your new email" / "You asked to change your Clickit Story email from `{{ .Email }}` to `{{ .NewEmail }}`. Press the button to confirm. We also sent a link to your other address; both must be confirmed." | "أكّد بريدك الجديد" / "طلبت تغيير بريدك في Clickit Story من `{{ .Email }}` إلى `{{ .NewEmail }}`. اضغط الزر للتأكيد. أرسلنا رابطاً آخر إلى العنوان الثاني، ويجب تأكيد الرابطين." | Button "Confirm new email" / "تأكيد البريد الجديد" (`type=email_change`); addresses in `<span dir="ltr">`; fine print "Didn't ask? Ignore this email and your address stays the same." / "لم تطلب ذلك؟ تجاهل هذه الرسالة وسيبقى بريدك كما هو." |
| E5 | Reauthentication | `Your Clickit Story security code: {{ .Token }}` / `رمز الأمان في Clickit Story: {{ .Token }}` | "Confirm it's you" / "Enter this code to confirm your password change. It works for 15 minutes." | "تأكّد أنه أنت" / "أدخل هذا الرمز لتأكيد تغيير كلمة المرور. صالح لمدة 15 دقيقة." | Code block; fine print "Didn't ask for it? Someone may know your password. Sign in and change it now." / "لم تطلب الرمز؟ قد يكون أحدهم يعرف كلمة مرورك. سجّل الدخول وغيّرها الآن." |
| E6 | Welcome (MAIL-03) | "Welcome to Clickit Story" / "أهلاً بك في Clickit Story" | "Welcome to Clickit Story" / "Your account is ready. Pick a show, press play, and we'll remember where you stopped." | "أهلاً بك في Clickit Story" / "حسابك جاهز. اختر برنامجاً واضغط تشغيل، وسنتذكّر أين توقفت." | Button "Start watching" / "ابدأ المشاهدة" -> Browse |
| E7 | New-episodes digest (MAIL-04) | "New on your Clickit Story list" / "جديد في قائمتك على Clickit Story" | "New on your list" / "New episodes are ready from shows on your My List." | "جديد في قائمتك" / "حلقات جديدة جاهزة من البرامج في قائمتك." | **No primary button** (Phase 4: rows are text links). Up to 3 show rows: thumbnail (`media.clickitstory.ae`, `width`/`height` set, `alt` = show title), show title (16px bold), "S{season} E{episode} - {title}" (12px), text link "Watch episode" / "شاهد الحلقة"; more than 3 shows -> link "See all on Clickit Story" / "شاهد الكل على Clickit Story". Footer adds "You get this because a show on your My List has new episodes." / "تصلك هذه الرسالة لأن برنامجاً في قائمتك أضاف حلقات جديدة.", link "Unsubscribe" / "إلغاء الاشتراك", link "Manage in Profile" / "إدارة الرسائل من ملفك الشخصي", `{postalLine}`. Images blocked: the layout still reads (alt text, text rows) |
| E8 | Support auto-reply (MAIL-05) | "We got your message" / "وصلتنا رسالتك" | "We got your message" / "Thanks for writing to Clickit Story. We reply by email within {hours, number} hours. This is an automatic message; you don't need to answer it." | "وصلتنا رسالتك" / "شكراً لتواصلك مع Clickit Story. نردّ عبر البريد الإلكتروني خلال {hours, number} ساعة. هذه رسالة تلقائية ولا حاجة للرد عليها." | No button. **Static: it never quotes or echoes the visitor's text** (D-39, F17: Phase 4's E7 "message quoted" is overridden for the auto-reply) |
| E9 | Support admin copy (MAIL-05) | `[Clickit support] {subject}` (CR/LF stripped, cut at 100 characters) | "New support message" / rows From (name), Email, Subject; the message in the quote box (HTML-escaped, `white-space:pre-wrap`); "Press Reply to answer {name} directly." | "رسالة دعم جديدة" / "اضغط «رد» للرد على {name} مباشرة." | Button "Open in admin" / "افتح في لوحة الإدارة" -> `/admin/inbox/{id}`; `Reply-To` = sender; language = the admin's `profiles.locale` |
| E10 | Newsletter confirm (MAIL-06) | "Confirm your Clickit Story subscription" / "أكّد اشتراكك في نشرة Clickit Story" | "Confirm your subscription" / "Press the button to confirm that you want news from Clickit Story by email. The link works for {days, number} days." | "أكّد اشتراكك" / "اضغط الزر لتأكيد رغبتك في تلقي أخبار Clickit Story على بريدك. الرابط صالح لمدة {days, number} أيام." | Button "Confirm subscription" / "تأكيد الاشتراك" -> `/{locale}/newsletter/confirm?...`; fine print "Didn't sign up? Ignore this email and you won't be subscribed." / "لم تشترك؟ تجاهل هذه الرسالة ولن يتم اشتراكك."; footer adds `{postalLine}`; language = the page language at sign-up (stored with the row) |

AR/RTL rules (all emails): `dir="rtl"` and `lang="ar"` on `<html>` and on every wrapping table/cell with inline `direction:rtl;text-align:right`; logo and button aligned to the right; addresses, URLs, codes and show titles in `<bdi>`/`dir="ltr"` spans; the AR brand in emails is Latin "Clickit Story" (as in the Q12 picture and the sender name), unlike the app's Arabic brand (item 8).

---

## Copywriting Contract

| Element | Copy (EN) |
|---------|-----------|
| Primary CTA, sign-in | Send code (then Verify code) |
| Primary CTA, new viewer | Start watching |
| Primary CTA, links | Finish signing in / Choose a new password / Confirm new email (one label per link type) |
| Primary CTA, admin | Next: enter the code / Verify and continue (enrol step 2 and sign-in verify) / Open admin |
| Primary CTA, Profile | Set password / Change password (opens the form); in the form Save password, Save email, Confirm password change; secondary Discard changes |
| Primary CTA, public pages | Stop episode emails / Confirm subscription |
| Empty state heading | Not applicable: every screen is a form or a status page. Admins list always has the signed-in admin; digest with no new episodes sends nothing |
| Empty state body | Not applicable |
| Error state | "That code isn't right or has expired. Check it, or send a new code." / "This link has expired. Links work once, for 15 minutes. Ask for a new one." / "This password appeared in a data breach. Choose another." / "Security check failed. Please try again." (each names the problem and the next step) |
| Destructive confirmation | None in this phase. Admin factor removal is Koss's owner script (D-20); Unsubscribe and Sign out are not destructive and need no confirmation dialog |

### `auth` namespace (additions; existing keys `email`, `password`, `forgotPassword`, `backToSignIn`, `resetEmailSent`, `resetHeading`, `resetDescription`, `resetButton`, `resetSuccess`, `showPassword`, `switchToSignIn`, `strength*` stay)

Arabic is a **draft for Koss's review**. Numbers are ICU placeholders (`{length, number}`, `{minutes, number}`, `{hours, number}`).

| Key | EN | AR (draft) |
|-----|----|-----------|
| `signInOrJoinTitle` | Sign in or join | سجّل الدخول أو انضم إلينا |
| `signInOrJoinSub` | Enter your email. We'll send you a {length, number}-digit code. | أدخل بريدك الإلكتروني وسنرسل لك رمزاً من {length, number} أرقام. |
| `signInTitle` | Sign in | تسجيل الدخول |
| `signInPasswordSub` | Enter your email and password. | أدخل بريدك الإلكتروني وكلمة المرور. |
| `createAccountTitle` | Create your account | أنشئ حسابك |
| `sendCode` | Send code | أرسل الرمز |
| `sending` | Sending... | جارٍ الإرسال... |
| `usePassword` | Use a password instead | استخدم كلمة المرور بدلاً من ذلك |
| `useCode` | Email me a code instead | أرسل لي رمزاً بالبريد بدلاً من ذلك |
| `noAccountYet` | No account yet? | ليس لديك حساب؟ |
| `createWithPassword` | Create one with a password | أنشئ حساباً بكلمة مرور |
| `codeSentTo` | Code sent to <bdi>{email}</bdi> | أُرسل الرمز إلى <bdi>{email}</bdi> |
| `changeEmail` | Change email | تغيير البريد |
| `codeLabel` | {length, number}-digit code | الرمز المكوّن من {length, number} أرقام |
| `codeHelp` | Paste it or type it. It works for {minutes, number} minutes. Not there? Check your spam folder. | الصقه أو اكتبه. يعمل لمدة {minutes, number} دقيقة. لم يصل؟ تحقق من مجلد الرسائل غير المرغوبة. |
| `verifyCode` | Verify code | تحقق من الرمز |
| `verifying` | Verifying... | جارٍ التحقق... |
| `resendIn` | Resend code in <bdi>{time}</bdi> | إعادة إرسال الرمز بعد <bdi>{time}</bdi> |
| `resendCode` | Resend code | أعد إرسال الرمز |
| `resendReady` (announcement) | You can ask for a new code now. | يمكنك الآن طلب رمز جديد. |
| `codeSentAnnounce` (announcement) | We sent a code to {email}. | أرسلنا رمزاً إلى {email}. |
| `signedIn` | Signed in. Taking you to Clickit Story... | تم تسجيل الدخول. ننقلك إلى كلِك إت ستوري... |
| `codeWrong` | That code isn't right or has expired. Check it, or send a new code. | الرمز غير صحيح أو انتهت صلاحيته. تحقق منه أو أرسل رمزاً جديداً. |
| `codeExpired` | This code has expired. Send a new one. | انتهت صلاحية هذا الرمز. أرسل رمزاً جديداً. |
| `codeSendFailed` | We couldn't send the code. Try again in a moment. | تعذّر إرسال الرمز. حاول مرة أخرى بعد قليل. |
| `tooManyTries` | Too many tries. Wait a few minutes and try again. | محاولات كثيرة. انتظر بضع دقائق ثم حاول مجدداً. |
| `signupCheckEmailTitle` | Check your email | تحقق من بريدك الإلكتروني |
| `signupCheckEmailBody` | We sent a link to <bdi>{email}</bdi>. Open it to finish creating your account. It works for {minutes, number} minutes. | أرسلنا رابطاً إلى <bdi>{email}</bdi>. افتحه لإكمال إنشاء حسابك. يعمل لمدة {minutes, number} دقيقة. |
| `resendConfirmation` | Resend the link | أعد إرسال الرابط |
| `termsLine` | By continuing you agree to the <terms>Terms</terms> and <privacy>Privacy Policy</privacy>. | بمتابعتك فإنك توافق على <terms>الشروط</terms> و<privacy>سياسة الخصوصية</privacy>. |
| `pwLeaked` | This password appeared in a data breach. Choose another. | ظهرت كلمة المرور هذه في تسريب بيانات. اختر كلمة أخرى. |
| `sendResetLink` | Send reset link | أرسل رابط إعادة التعيين |
| `resetEmailDescription` (updated) | We sent a reset link. It works for {minutes, number} minutes and opens on any device. | أرسلنا رابط إعادة التعيين. يعمل لمدة {minutes, number} دقيقة ويمكن فتحه من أي جهاز. |
| `welcomeTitle` | Welcome to Clickit Story | أهلاً بك في كلِك إت ستوري |
| `welcomeSub` | What should we call you? This name shows on your reviews. | بماذا تحب أن نناديك؟ يظهر هذا الاسم على تقييماتك. |
| `nameLabel` | Your name | اسمك |
| `startWatching` | Start watching | ابدأ المشاهدة |
| `passwordLaterNote` | You can add a password any time in Profile. | يمكنك إضافة كلمة مرور في أي وقت من ملفك الشخصي. |
| `stepOf` (sr-only) | Step {current, number} of {total, number} | الخطوة {current, number} من {total, number} |
| `working` | Working... | جارٍ التنفيذ... |
| `finishSigningIn` | Finish signing in | إكمال تسجيل الدخول |
| `chooseNewPassword` | Choose a new password | اختيار كلمة مرور جديدة |
| `confirmNewEmail` | Confirm new email | تأكيد البريد الجديد |
| `confirmSignupTitle` | Confirm your email | أكّد بريدك الإلكتروني |
| `confirmSignupBody` | Press the button to finish signing in. You can open this link on any device. | اضغط الزر لإكمال تسجيل الدخول. يمكنك فتح هذا الرابط من أي جهاز. |
| `confirmRecoveryTitle` | Reset your password | إعادة تعيين كلمة المرور |
| `confirmRecoveryBody` | Press the button, then choose a new password. | اضغط الزر ثم اختر كلمة مرور جديدة. |
| `confirmEmailChangeTitle` | Confirm your new email | أكّد بريدك الجديد |
| `confirmEmailChangeBody` | Press the button to confirm the change of address. | اضغط الزر لتأكيد تغيير البريد. |
| `pendingOtherTitle` | Confirmed. Now open the link we sent to the other address | تم التأكيد. افتح الآن الرابط الذي أرسلناه إلى العنوان الآخر |
| `pendingOtherBody` | Your email changes when both links are confirmed. You can close this page. | يتغيّر بريدك عند تأكيد الرابطين. يمكنك إغلاق هذه الصفحة. |
| `emailChangedTitle` | Your email is updated | تم تحديث بريدك الإلكتروني |
| `emailChangedBody` | You can now sign in with the new address. | يمكنك الآن تسجيل الدخول بالعنوان الجديد. |
| `goToProfile` | Go to Profile | اذهب إلى الملف الشخصي |
| `linkExpiredTitle` | This link has expired | انتهت صلاحية هذا الرابط |
| `linkExpiredBody` | Links work once, for {minutes, number} minutes. Ask for a new one. | تعمل الروابط مرة واحدة ولمدة {minutes, number} دقيقة. اطلب رابطاً جديداً. |
| `requestNewLink` | Request a new link | اطلب رابطاً جديداً |
| `mfaOverline` | Admin security | أمان المشرفين |
| `mfaEnrolTitle` | Protect your admin account | احمِ حسابك كمشرف |
| `mfaEnrolSub` | Scan this QR code with Google Authenticator, 1Password or Microsoft Authenticator. | امسح رمز QR هذا باستخدام Google Authenticator أو 1Password أو Microsoft Authenticator. |
| `mfaQrAlt` | QR code for adding Clickit Story to your authenticator app | رمز QR لإضافة كلِك إت ستوري إلى تطبيق المصادقة |
| `mfaManualKey` | Can't scan? Enter this key in your app: | لا يمكنك المسح؟ أدخل هذا المفتاح في التطبيق: |
| `copyKey` / `keyCopied` | Copy key / Key copied | انسخ المفتاح / تم نسخ المفتاح |
| `mfaNext` | Next: enter the code | التالي: أدخل الرمز |
| `mfaStepCodeTitle` | Enter the code from your app | أدخل الرمز من تطبيقك |
| `mfaStepCodeSub` | Type the {length, number}-digit code your app shows for Clickit Story. | اكتب الرمز المكوّن من {length, number} أرقام الذي يعرضه تطبيقك لكلِك إت ستوري. |
| `mfaVerifyContinue` | Verify and continue | تحقق وتابع |
| `mfaBack` | Back to QR code | العودة إلى رمز QR |
| `mfaCodeWrong` | That code isn't right. Check the clock on your phone and try again. | الرمز غير صحيح. تحقق من ساعة هاتفك وحاول مرة أخرى. |
| `mfaTooMany` | Too many tries. Wait a minute and try again. | محاولات كثيرة. انتظر دقيقة ثم حاول مجدداً. |
| `mfaEnrolFailed` | We couldn't start the setup. Reload the page and try again. | تعذّر بدء الإعداد. أعد تحميل الصفحة وحاول مرة أخرى. |
| `mfaSecondTitle` | Add a second authenticator | أضف تطبيق مصادقة ثانياً |
| `mfaSecondSub` | If you lose your phone, a second app (for example 1Password) still lets you in. | إذا فقدت هاتفك، يبقى بإمكانك الدخول عبر تطبيق ثانٍ (مثل 1Password). |
| `mfaSecondAdd` / `mfaSecondSkip` | Add a second one / Skip for now | أضف تطبيقاً ثانياً / تخطَّ الآن |
| `mfaDoneTitle` / `mfaDoneOpen` | Authenticator added / Open admin | تمت إضافة تطبيق المصادقة / افتح لوحة الإدارة |
| `mfaVerifyTitle` | Enter your authenticator code | أدخل رمز تطبيق المصادقة |
| `mfaVerifySub` | Open your authenticator app and type the {length, number}-digit code for Clickit Story. | افتح تطبيق المصادقة واكتب الرمز المكوّن من {length, number} أرقام الخاص بكلِك إت ستوري. |
| `mfaStaleNote` | For your security we ask again every {hours, number} hours. | لأمانك، نطلب الرمز مجدداً كل {hours, number} ساعة. |
| `mfaLostPhone` | Lost your phone? Ask Koss to reset your authenticator. | فقدت هاتفك؟ اطلب من Koss إعادة ضبط تطبيق المصادقة. |

### `profile` namespace (additions)

| Key | EN | AR (draft) |
|-----|----|-----------|
| `savePassword` / `saveEmail` / `discardChanges` | Save password / Save email / Discard changes | حفظ كلمة المرور / حفظ البريد / تجاهل التغييرات |
| `confirmPasswordChange` | Confirm password change | تأكيد تغيير كلمة المرور |
| `setPassword` / `changePassword` | Set password / Change password | تعيين كلمة مرور / تغيير كلمة المرور |
| `passwordNotSet` | Not set | غير معيّنة |
| `passwordSetHint` | Add a password to sign in without waiting for a code. | أضف كلمة مرور لتسجّل الدخول دون انتظار رمز. |
| `passwordChanged` | Password changed. | تم تغيير كلمة المرور. |
| `errors.nameMin` | Enter at least {min, number} characters. | أدخل {min, number} أحرف على الأقل. |
| `passwordAdded` | Password added. You can now sign in with it. | تمت إضافة كلمة المرور. يمكنك الآن الدخول بها. |
| `reauthTitle` | Confirm it's you | تأكّد أنه أنت |
| `reauthSub` | We emailed a code to <bdi>{email}</bdi>. Enter it to save your password. | أرسلنا رمزاً إلى <bdi>{email}</bdi>. أدخله لحفظ كلمة المرور. |
| `emailPendingTitle` | Waiting for confirmation | بانتظار التأكيد |
| `emailPendingBody` | To finish changing to <bdi>{email}</bdi>, open the links we sent to both addresses. | لإتمام التغيير إلى <bdi>{email}</bdi>، افتح الرابطين اللذين أرسلناهما إلى العنوانين. |
| `resendLinks` / `linksResent` | Resend links / Links sent again | أعد إرسال الروابط / أُعيد إرسال الروابط |
| `notifLabel` | New episode emails | رسائل الحلقات الجديدة |
| `notifHelp` | One email in the evening when a show on My List has a new episode. | رسالة واحدة مساءً عندما تتوفر حلقة جديدة من برنامج في قائمتي. |
| `notifOn` / `notifOff` (announcements) | New episode emails are on / off | رسائل الحلقات الجديدة مفعّلة / متوقفة |
| `notifSaveFailed` | Couldn't save. Try again. | تعذّر الحفظ. حاول مرة أخرى. |

### `admin.admins`, `admin.audit`, public pages, newsletter, support

| Key | EN | AR (draft) |
|-----|----|-----------|
| `admin.admins.nav` / `title` | Admins | المشرفون |
| `admin.admins.description` | Who can sign in to this admin area. | من يمكنه الدخول إلى لوحة الإدارة. |
| `admin.admins.nameColumn` / `emailColumn` / `authenticatorColumn` / `lastSignInColumn` | Name / Email / Authenticator / Last sign-in | الاسم / البريد الإلكتروني / تطبيق المصادقة / آخر دخول |
| `admin.admins.setUp` / `notSetUp` | Set up / Not set up | مفعّل / غير مفعّل |
| `admin.admins.you` / `never` | You / Never | أنت / أبداً |
| `admin.admins.ownerNote` | To add or remove an admin, ask the owner. | لإضافة مشرف أو إزالته، اطلب ذلك من المالك. |
| `admin.admins.loadError` | We couldn't load the admins list. Reload the page. | تعذّر تحميل قائمة المشرفين. أعد تحميل الصفحة. |
| `admin.audit.adminColumn` | Admin | المشرف |
| `admin.audit.formerAdmin` / `system` | Former admin / System | مشرف سابق / النظام |
| `unsubTitle` | Stop new-episode emails? | إيقاف رسائل الحلقات الجديدة؟ |
| `unsubBody` | You'll no longer get the evening email about new episodes of shows on your My List. You can turn it back on in Profile. | لن تصلك بعد الآن رسالة المساء عن الحلقات الجديدة من البرامج في قائمتي. يمكنك إعادة تفعيلها من ملفك الشخصي. |
| `unsubscribe` / `unsubscribing` / `unsubKeep` | Stop episode emails / Stopping... / Keep getting them | إيقاف رسائل الحلقات / جارٍ الإيقاف... / أبقِ الرسائل |
| `unsubDoneTitle` | You're unsubscribed | تم إلغاء اشتراكك |
| `unsubDoneBody` | We won't send new-episode emails any more. Changed your mind? Turn them back on in Profile. | لن نرسل رسائل الحلقات الجديدة بعد الآن. غيّرت رأيك؟ أعد تفعيلها من ملفك الشخصي. |
| `unsubInvalidTitle` / `unsubInvalidBody` | This link isn't valid / Open Profile to manage your emails. | هذا الرابط غير صالح / افتح ملفك الشخصي لإدارة رسائلك. |
| `goToClickit` | Go to Clickit Story | اذهب إلى كلِك إت ستوري |
| `nlConfirmTitle` | Confirm your subscription | أكّد اشتراكك |
| `nlConfirmBody` | Press the button to get news from Clickit Story by email. | اضغط الزر لتصلك أخبار كلِك إت ستوري بالبريد. |
| `nlConfirmButton` | Confirm subscription | أكّد الاشتراك |
| `nlDoneTitle` / `nlDoneBody` | You're subscribed / Thanks for confirming. You can unsubscribe from any email we send. | تم اشتراكك / شكراً على التأكيد. يمكنك إلغاء الاشتراك من أي رسالة نرسلها. |
| `nlAlreadyTitle` | You're already subscribed | أنت مشترك بالفعل |
| `nlExpiredTitle` / `nlExpiredBody` | This link has expired / Sign up again from the footer of any page and we'll send a new link. | انتهت صلاحية هذا الرابط / اشترك مجدداً من أسفل أي صفحة وسنرسل لك رابطاً جديداً. |
| `newsletter.submitAria` (updated) | Send confirmation link | أرسل رابط التأكيد |
| `newsletter.statusPending` | Almost done. Check your email and confirm to subscribe. | بقيت خطوة واحدة. افتح بريدك وأكّد لإتمام الاشتراك. |
| `newsletter.statusPendingRecent` | We just sent you a link. Check your inbox, or try again in {minutes, number} minutes. | أرسلنا لك رابطاً قبل قليل. تحقق من بريدك أو حاول مجدداً بعد {minutes, number} دقائق. |
| `support.sentTitle` | Message sent | تم إرسال الرسالة |
| `support.sentBody` | We emailed a confirmation to <bdi>{email}</bdi>. We'll get back to you within {hours, number} hours. | أرسلنا تأكيداً إلى <bdi>{email}</bdi>. سنردّ عليك خلال {hours, number} ساعة. |
| `support.sendAnother` | Send another message | أرسل رسالة أخرى |
| `support.savedEmailFailedInline` (updated) | Your message is saved. The confirmation email is delayed; we'll still read your message. | تم حفظ رسالتك. رسالة التأكيد متأخرة، لكننا سنقرأ رسالتك. |

The English-only helper `mapAuthError` (`src/lib/auth-errors.ts`) returns hard-coded English even on `/ar`; no new Phase 5 code path uses it. New auth errors map Supabase error codes to the keys above or to existing `errors.*` keys.

---

## Accessibility and RTL

**Focus order = DOM order, top to bottom, no `tabindex` above 0.** Sign-in: h1, subline, email, widget, Send code, Use a password. Code state: Change email, code input, Verify code, Resend, Use a password. Card pages: the first control is the primary button or field; the primary button takes focus on `/auth/confirm`; name field on `/auth/welcome`; code input on `/auth/mfa` verify and step 2. After a state change on one screen (email -> code, enrol step 1 -> 2) focus moves to the new primary input and the change is announced once through a polite `role="status"` (`codeSentAnnounce`). After a failed code the value clears and focus returns to the code input. Support success moves focus to its heading (`tabIndex={-1}`).

**Live regions.** Errors `role="alert"` (inline, assertive). Success and pending notes `role="status"`. The resend countdown text is **not** live (a per-second announcement is noise): one polite message when the code is sent and one when resend becomes available. Copy-key announces `keyCopied`. Notifications switch announces `notifOn`/`notifOff`.

**Autofill and keyboards.** Email: `autoComplete="email"` (code mode) / `"username"` (password mode), `inputMode="email"`. Password: `current-password` / `new-password`. Code: `one-time-code`, `inputMode="numeric"`. Name: `name`. Email and code fields `dir="ltr"`. Enter submits every form; `enterKeyHint` "send" / "go".

**Hit areas.** Everything is 44px (`min-h-11`); text links are `min-h-11 inline-flex items-center`. Neighbouring links are at least 8px apart (no overlapping hit areas; memory "tap area opt-in": no global `::after` stretch on `Button`).

**Colour.** No state relies on colour alone (error = words + icon; active cell = border + caret; chip = words). Reduced motion: caret static, switch and spinner transitions removed or minimal (spinner kept; it is a progress indicator).

**RTL.** Logical properties only (`ms/me/ps/pe/start/end`, `text-start`, `border-s`); the lint rule AR-03 is Phase 7, but nothing new may add `left/right/ml/mr/pl/pr`. Back arrows `rtl:scale-x-[-1]`, forward chevrons `rtl:rotate-180`. The six code cells, email fields, the manual key, URLs and codes stay left-to-right (`dir="ltr"`) inside Arabic pages. Titles, names and emails inside sentences are in `<bdi>`. The QR is never mirrored. `Radix` components that default to `dir="ltr"` get `dir={dirFor(locale)}` (the old `AuthPanel` Tabs bug). The Admins table and audit table follow the page direction; the Admins page title uses `AdminPageHeader`.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | `switch` (new), existing `button`, `input`, `label`, `skeleton`, `table`, `checkbox`, `textarea` | not required |
| @react-bits (declared in `components.json`) | none | `@react-bits` is declared in `components.json` but not used in this phase. Nothing may be pulled from it or any other third-party registry; any future use needs a dated `npx shadcn view` gate record in this table first. A plan or executor step that runs `npx shadcn add @react-bits/...` violates this contract. A future block needs a `shadcn view` and a dated entry in this table first |

No third-party block is declared, so the registry vetting gate did not run.

---

## Provisional / needs Koss

Everything in this file is provisional until Koss signs 05-CONTEXT.md. Open items, in order of how much code they change:

1. **Email colour.** RESOLVED 2026-10-20: Q12 = C (scheme-adaptive, section 7.1); Phase 4 owns the hex values. Q12 picture (`mockups/05-q12-schemes.png`) signed 2026-10-20 ~19:00 CET. Remaining: Phase 5 builds the logo PNG on its own #090909 plate (05-07 Task 4); the controller places it on the media host.
2. **Phase 4 canvas not signed.** Boards V1 (sign-in), V4 (Arabic) and E0-E7 (emails) win over this file once signed; this file then gets a revision, not a rewrite. Phase 4's V1 button wording "Continue with email" is replaced here by the picture's "Send code".
3. **Second authenticator: skippable or required (D-20).** Recommended skippable (an admin with one device would otherwise be locked out of setup). The Admins list shows only "set up / not set up", not how many.
4. **"Free with an account" chip (picture q4).** It is a claim about price. Kept because the picture drew it; wording and Arabic ("مجاناً مع حساب") need Koss's word (no invented pricing or legal copy).
5. **"Lost your phone? Ask Koss to reset your authenticator."** Wording and whether a person is named in an admin-only screen (D-20 recovery is Koss's script). Not a link: no mailbox exists yet.
6. **Open list and scanners.** D-01's open list omits the two public pages this phase adds: `/{locale}/unsubscribe` and `/{locale}/newsletter/confirm`; both must be added (plan 05-04 test) or the pages would bounce signed-out recipients to sign-in. The newsletter confirm uses a one-button page instead of confirming on GET (link scanners would otherwise subscribe people); D-32 says "clicking it sets confirmed_at".
7. **Name step: "Add a password later" is plain text, not a link** (picture q3 drew a link). Also the route `/auth/welcome` is a recommendation (the contract is the look).
8. **Arabic brand.** App Arabic uses "كلِك إت ستوري" (existing messages); emails and subjects use Latin "Clickit Story" (as the Q12 picture and the sender name do). All Arabic copy in this file is a draft for Koss's review, written in natural Gulf-readable Modern Standard Arabic, not word for word.
9. **Resend-code Turnstile** uses `interaction-only` (the signed placement covers the first send only).
10. **Code email has no button** (picture q12 has none; Phase 4 placeholder says "Open Clickit Story"). A link needs `{{ .SiteURL }}`, which is production-only (F18).
11. **Reauthentication step in Profile** renders only if Supabase asks for it (D-26 template 5 exists, so it is specified); Koss/controller confirms "Secure password change" at the owner step.
12. **`authHeading*` / `authQuote*` config** on `/auth`: sign-in h1 no longer reads the admin-configured heading (it says "Sign up below", wrong now). The Settings fields stay; the quote still shows in the hero pane. Retire the settings fields in Phase 8 or keep them? Needs Koss.
13. **Postal line (Q19)** in digest and newsletter-confirm footers: default B until Koss gives the line.
14. **Digest rows show up to three poster thumbnails** (Phase 4 E6) although D-27 says no tracking pixels: thumbnails are shared static CDN images (same URL for everyone), not tracking; with images off the layout still reads.
15. **Admins list is its own page and nav item** (discretion area); could be a Settings section.

---

## Owner-visible deviations from the pictures and neighbours

1. **Heading sizes.** Pictures use 28px (q1) and 24px (q4, q7); all page h1 are 24px (Phase 4 Display). Subline 15px -> 14px; labels 13px -> 14px; helper 13px -> 14px; code digits 24px.
2. **q1 shows email and code boxes together with a "THEN" divider** to explain the flow; the real screen is stepwise (state 1 then state 2). Added: a Verify code button (picture auto-submits only), the resend link, a spam-folder hint. The picture's "Paste or type ٠-٩ / 0-9" note is not user copy.
3. **q4:** the subline "Enter your email..." is kept under the show h1 (picture dropped it). Chip and poster as drawn.
4. **q7:** QR 150px -> 160px in a 192px white frame; manual key gets a Copy button; "Lost your phone" is text, not a link; a Sign out link, a second-authenticator step and a done step are added (the picture shows two steps only).
5. **Fields:** the pictures fill fields `--bg-1` with a `--line-2` border; the real `Input` primitive is `--bg-2` with `--line`. Primitive kept (Phase 4 owns it).
6. **q12 email:** body 14px -> 16px, heading 22px -> 24px, code 34px -> 32px, footer 11px -> 12px, width 420 -> 600, footer grey #777 -> #555/#666 (contrast), logo is a hosted PNG not styled text. All from Phase 4 section 5 (its open item 13).
7. **Support auto-reply never quotes the visitor's message** (Phase 4 E7 said quoted): D-39 / F17 backscatter protection wins.
8. **Support confirmation is an on-page panel, not a toast**, because the toast vanished with the form reset and now has to say an email was sent.
9. **Newsletter form no longer says "You are subscribed."** after submit.
10. **Field boundary contrast** (see Color): pre-existing, not fixed here.
11. **Shared-file edits this phase makes:** `password-field.tsx` (token fixes), `auth-alert.tsx` (spacing), `contact-form.tsx` and `newsletter-signup-form.tsx` (states), `account-settings.tsx` (rows), `admin-header.tsx` (nav item), `admin/audit/page.tsx` (column). `ui/switch.tsx` is added. `ui/button.tsx`, `ui/input.tsx` and tokens are untouched.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
