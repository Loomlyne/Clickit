# Phase 2: App Shell & Navigation - Research

**Researched:** 2026-03-31
**Domain:** Next.js App Router layout shell, glassmorphism nav bar, shadcn DropdownMenu, SVG logo rendering
**Confidence:** HIGH

## Summary

Phase 2 builds the permanent chrome wrapping every page: a fixed glassmorphism navigation bar with the CIT logo and auth button, plus a full-bleed layout structure. The technical scope is narrow and well-defined -- three custom components (Navbar, UserAvatar, UserDropdown), one shadcn component install (DropdownMenu), modifications to the root layout, and CSS for the glass effect. No backend, no routing complexity, no state management beyond a local boolean toggle for auth state demonstration.

The primary technical challenges are: (1) correctly combining Tailwind v4 `backdrop-blur-lg` + `backdrop-saturate-[1.2]` utilities for the glass effect, (2) rendering the CIT logo SVG at constrained height with its internal gradients preserved, and (3) installing and configuring shadcn DropdownMenu to align to the right edge of the avatar with proper animation. All three are well-understood patterns with HIGH confidence.

**Primary recommendation:** Build the Navbar as a server component shell with client-only islands (UserAvatar/UserDropdown) to minimize client JS. Use a native `<img>` tag for the SVG logo (not `next/image` -- SVGs gain nothing from image optimization). Use Tailwind v4 utility classes for the glass effect rather than custom CSS, falling back to arbitrary values only for the `saturate(1.2)` value.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Ultra-minimal nav: `[CIT Logo]` on the left, `[Sign In / Avatar]` on the right. Nothing else -- no links, no search icon. Clean and efficient.
- **D-02:** Logo is the home button (clicking navigates to `/`). No separate "Home" link.
- **D-03:** Content discovery is through scrolling on the home page, not nav links. Nav links would add friction and aren't needed for this catalog size.
- **D-04:** Same nav structure on mobile -- not a hamburger or drawer, just the same minimal layout scaled responsively.
- **D-05:** Always visible -- nav floats over content at all times with glass effect always shown. No scroll listener needed. Pure CSS `position: fixed` with `backdrop-filter: blur()`.
- **D-06:** Unauthenticated: "Sign In" button on the right.
- **D-07:** Authenticated: Initial letter of user's name in a circle (avatar) replaces Sign In. Clicking opens a dropdown with: My List, Profile, Sign Out.
- **D-08:** Full bleed -- content goes edge-to-edge. Cinematic, Netflix-style. Individual sections handle their own inner horizontal padding.
- **D-09:** No global max-width wrapper on the root layout. Hero banners and content rails span the full viewport width.

### Claude's Discretion
- Glass effect exact values (backdrop-filter blur amount, background opacity -- target: dark enough to read logo/text, light enough to feel premium)
- "Sign In" button variant (outline or ghost from shadcn Button -- must be legible on dark backgrounds)
- Avatar dropdown component and animation
- Inner horizontal padding amount per section type (hero vs. rails vs. text)
- Whether a very subtle bottom border separates the nav from page content

### Deferred Ideas (OUT OF SCOPE)
- Search -- explicitly removed from nav for now; if needed in future, can be a floating search overlay triggered from elsewhere (Phase 8)
- Nav links (Series, Coming Soon, My List) -- removed from nav; these will be discoverable via home page scroll or addressed in future phases
- My List page -- nav link removed, but My List exists in the avatar dropdown after login
- Footer -- not part of Phase 2 scope; add in a later phase if needed
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NAVG-01 | Floating top nav bar with: Home, Series, Coming Soon, My List, Search, Profile | D-01 overrides this: ultra-minimal nav with logo (= Home) + auth only. No other links. The original requirement is satisfied by the logo-as-home-button pattern and avatar dropdown containing My List and Profile. |
| NAVG-02 | Nav is clean, minimal -- shows CIT logo (white variant on dark) | Direct match. Use `Clickit_final_logo.svg` (white on transparent) via `<img>` tag, constrained to 32px height. |
| NAVG-03 | Responsive layout -- works on mobile, tablet, desktop | D-04: same layout at all breakpoints. Only horizontal padding changes (24px mobile, 48px desktop at md 768px+). Logo + auth always visible. |
| NAVG-04 | Dark cinematic UI as default theme | Already established in Phase 1: `class="dark"` on `<html>`, `bg-background` (#0A0A0F) on body. No changes needed. |
| NAVG-05 | Login/signup accessible from nav (or profile dropdown when logged in) | D-06/D-07: "Sign In" ghost button when unauthenticated; avatar + dropdown with Sign Out when authenticated. Mock auth toggle for Phase 2. |
| DESG-01 | Dark luxury background (black/near-black) across all pages | Inherited from Phase 1 `globals.css`: `--background: oklch(0.07 0.01 270)` (#0A0A0F). Enforced by `bg-background` on body. |
| DESG-06 | Soft glass-effect top navigation bar | Glass effect via `backdrop-blur-lg backdrop-saturate-[1.2]` + `bg-[rgba(10,10,15,0.75)]`. UI-SPEC provides exact values. |
| DESG-10 | CIT logo (SVG) displayed correctly following brand guidelines | `Clickit_final_logo.svg` rendered at 32px height via `<img>` tag with proper alt text. White SVG on glass background. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Stack:** Next.js 16.2.x (App Router) + Tailwind CSS 4.2.x + shadcn/ui (New York style)
- **Dark-only:** `class="dark"` hardcoded on `<html>`, no theme toggle
- **shadcn style:** New York with 0.5rem radius
- **Path alias:** `@/*` maps to `./src/*`
- **Icons:** lucide-react (tree-shakable, shadcn default)
- **No framer-motion package:** Use `motion` package with `motion/react` imports (renamed)
- **No @supabase/auth-helpers-nextjs:** Deprecated, use @supabase/ssr
- **No Prisma:** Use Supabase client directly
- **Conventional commits:** `feat:`, `fix:`, `docs:`, etc.

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Verified |
|---------|---------|---------|----------|
| next | 16.2.1 | Framework, App Router, `next/link`, `next/font` | `package.json` |
| react | 19.2.4 | UI library, Server Components | `package.json` |
| tailwindcss | ^4 | Utility CSS, backdrop-filter utilities | `package.json` |
| tw-animate-css | ^1.4.0 | Animation utilities (animate-in, fade-in, zoom-in) for shadcn | `package.json` |
| lucide-react | ^1.7.0 | Icons (Bookmark, User, LogOut) | `package.json` |
| class-variance-authority | ^0.7.1 | Variant management for Button | `package.json` |
| @base-ui/react | ^1.3.0 | Base UI primitives (Button foundation) | `package.json` |
| radix-ui | ^1.4.3 | Accessible primitives (DropdownMenu foundation) | `package.json` |

### Needs Install
| Library | Purpose | Install Command |
|---------|---------|----------------|
| shadcn DropdownMenu | Avatar dropdown menu | `npx shadcn@latest add dropdown-menu` |

**No new npm packages needed.** The `DropdownMenu` is a vendored shadcn component (copies source to `src/components/ui/`), not a new dependency. Radix UI primitives are already installed via the `radix-ui` package.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `<img>` for SVG logo | `next/image` | next/image adds no value for SVGs (no optimization possible). Adds `width`/`height` prop requirements. Native `<img>` is simpler. |
| `<img>` for SVG logo | Inline SVG React component (SVGR) | The CIT logo SVG has linear gradients with unique IDs. Inline rendering works but adds ~83 lines of JSX to the component. An `<img>` tag is cleaner for a static logo. |
| Tailwind utilities for glass | Custom CSS class | Tailwind v4 has all needed utilities (`backdrop-blur-lg`, `backdrop-saturate-[1.2]`). No custom CSS needed except the arbitrary `saturate(1.2)` value, which Tailwind handles with bracket syntax. |
| shadcn ghost Button for Sign In | Custom styled button | Ghost variant already exists and is perfect: transparent bg, white text, subtle hover. No custom work needed. |

## Architecture Patterns

### Component Structure
```
src/
  components/
    layout/
      navbar.tsx          # Server component shell, renders logo + auth section
      user-avatar.tsx     # Client component: avatar circle button
      user-dropdown.tsx   # Client component: dropdown menu (uses shadcn DropdownMenu)
    ui/
      button.tsx          # Already exists (Phase 1)
      badge.tsx           # Already exists (Phase 1)
      dropdown-menu.tsx   # Will be added by shadcn CLI
  app/
    layout.tsx            # Modified: add skip-link + Navbar + <main id="main">
    page.tsx              # Modified: remove <main>, add placeholder content
```

### Pattern 1: Server Component Shell with Client Islands
**What:** The Navbar component itself is a server component. It renders the static parts (logo, layout, skip-link) directly. Only the auth section (UserAvatar + UserDropdown) is a client component because it needs `useState` for the mock auth toggle and Radix DropdownMenu requires client-side JS.
**When to use:** Any layout component where most content is static but some parts need interactivity.
**Example:**
```typescript
// src/components/layout/navbar.tsx (Server Component -- no 'use client')
import Link from 'next/link'
import { AuthSection } from './auth-section'

export function Navbar() {
  return (
    <nav
      aria-label="Main navigation"
      className="fixed top-0 right-0 left-0 z-50 flex h-16 items-center justify-between
                 bg-[rgba(10,10,15,0.75)] px-6 backdrop-blur-lg backdrop-saturate-[1.2]
                 md:px-12"
      style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}
    >
      <Link href="/" aria-label="Clickit Story home">
        <img
          src="/brand/Clickit_final_logo.svg"
          alt="Clickit Story"
          className="h-8 w-auto"
        />
      </Link>
      <AuthSection />
    </nav>
  )
}
```

### Pattern 2: Mock Auth State Toggle
**What:** A simple `useState<boolean>` in a client component to toggle between signed-in and signed-out states. No real auth in Phase 2. The toggle is for development/demo purposes only.
**When to use:** Phase 2 only. Real auth replaces this in Phase 8 with Supabase session detection.
**Example:**
```typescript
// src/components/layout/auth-section.tsx ('use client')
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { UserAvatar } from './user-avatar'
import { UserDropdown } from './user-dropdown'

export function AuthSection() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  if (!isAuthenticated) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsAuthenticated(true)}
      >
        Sign In
      </Button>
    )
  }

  return (
    <UserDropdown onSignOut={() => setIsAuthenticated(false)}>
      <UserAvatar name="Demo User" />
    </UserDropdown>
  )
}
```

### Pattern 3: Radix DropdownMenu with shadcn Styling
**What:** shadcn DropdownMenu wraps Radix UI primitives. The trigger is the UserAvatar button. Content aligns to end (right edge), offset 8px below.
**When to use:** Any context menu or action menu triggered by a button.
**Example:**
```typescript
// src/components/layout/user-dropdown.tsx ('use client')
'use client'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Bookmark, User, LogOut } from 'lucide-react'

interface UserDropdownProps {
  children: React.ReactNode
  onSignOut: () => void
}

export function UserDropdown({ children, onSignOut }: UserDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-[200px]">
        <DropdownMenuLabel className="font-normal text-muted-foreground">
          viewer@example.com
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Bookmark className="mr-2 size-4" />
          My List
        </DropdownMenuItem>
        <DropdownMenuItem>
          <User className="mr-2 size-4" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-brand-red-safe focus:text-brand-red-safe"
          onSelect={onSignOut}
        >
          <LogOut className="mr-2 size-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

### Anti-Patterns to Avoid
- **Making the entire Navbar a client component:** The logo, layout, and skip-link are static. Only the auth section needs client JS. Splitting into server shell + client island reduces client bundle.
- **Using `next/image` for the SVG logo:** SVGs are resolution-independent. `next/image` adds no optimization benefit and requires explicit `width`/`height` props that complicate auto-sizing. Use a plain `<img>` tag.
- **Adding scroll listeners for nav behavior:** D-05 explicitly says the glass effect is always visible. No `useEffect` scroll tracking needed. Pure CSS `position: fixed`.
- **Using `backdrop-filter` shorthand CSS:** Tailwind v4 provides individual utilities (`backdrop-blur-lg`, `backdrop-saturate-[1.2]`) that compose correctly. A raw `backdrop-filter` style prop would bypass Tailwind's composition layer.
- **Creating a separate mobile nav:** D-04 says same layout on mobile. No hamburger, no drawer, no separate mobile component. The two-element nav (logo + auth) fits at every viewport width.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dropdown menu | Custom positioned menu with click-outside detection, keyboard nav, focus trapping | shadcn DropdownMenu (wraps Radix UI) | Radix handles ARIA attributes, keyboard navigation (arrow keys, Escape, Enter, Tab), focus management, collision-aware positioning, typeahead, and portal rendering. Rolling your own means months of accessibility bugs. |
| Button variants | Custom button with manual hover/focus/disabled states | shadcn Button (already installed) | CVA-based variants handle all states including aria-expanded styling for the dropdown trigger. |
| Animation classes | Custom keyframe animations for dropdown open/close | tw-animate-css (already installed) | `animate-in`, `fade-in-0`, `zoom-in-95`, `slide-in-from-top-2` are all provided. shadcn DropdownMenu uses these automatically via data-state selectors. |
| CSS utility composition | Manual className merging with template literals | `cn()` utility (already in `src/lib/utils.ts`) | `clsx` + `tailwind-merge` handles conditional classes and deduplication correctly. |

**Key insight:** Phase 2 is almost entirely composition of existing primitives. shadcn Button (installed), shadcn DropdownMenu (to install), Tailwind utilities (available), Radix accessibility (built-in). The custom code is minimal: a nav layout, an avatar circle, and a mock auth toggle.

## Common Pitfalls

### Pitfall 1: `-webkit-backdrop-filter` Missing for Safari
**What goes wrong:** Glass effect works in Chrome/Firefox but appears as a solid dark rectangle in Safari (especially older versions).
**Why it happens:** Safari historically required the `-webkit-` prefix for `backdrop-filter`. While modern Safari (15.4+) supports the unprefixed version, Tailwind v4's `backdrop-blur-lg` utility generates only the unprefixed `backdrop-filter` property.
**How to avoid:** Tailwind v4 automatically includes the `-webkit-` prefix when needed via its built-in autoprefixer. Verify in the generated CSS that `-webkit-backdrop-filter` is present. If not, add a one-line `style` prop as fallback: `style={{ WebkitBackdropFilter: 'blur(16px) saturate(1.2)' }}`.
**Warning signs:** Glass effect looks opaque (no blur) on Safari during testing.

### Pitfall 2: Fixed Nav Causing Content Overlap
**What goes wrong:** Page content renders behind the fixed nav bar, cutting off the first 64px of content.
**Why it happens:** `position: fixed` removes the nav from document flow. Content starts at the top of the viewport, hidden behind the nav.
**How to avoid:** Add `pt-16` (64px, matching nav height) to the `<main>` element in the root layout. The UI-SPEC explicitly calls this out.
**Warning signs:** First heading or hero section partially hidden behind the nav.

### Pitfall 3: SVG Logo Not Rendering on Dark Background
**What goes wrong:** Logo appears invisible or partially transparent on the dark nav background.
**Why it happens:** The CIT logo SVGs (`Clickit_final_logo.svg` and `Clickit_final_logo.CITpng.svg`) use white fills (`.cls-5 { fill: #fff }`) AND linear gradients that fade from white to transparent. The gradient portions will be less visible against the glass background.
**How to avoid:** This is by design -- the gradient creates a subtle depth effect. The main letterforms are solid white (#fff) and will be clearly legible. Test at 32px height to ensure the primary wordmark is sharp. If the gradient letters look too faded, the full wordmark SVG is the right choice (wider viewBox, larger solid-white areas).
**Warning signs:** Some letters appear ghostly or partially visible.

### Pitfall 4: DropdownMenu Portal Z-Index Conflict
**What goes wrong:** Dropdown appears behind the nav bar or behind other fixed/sticky elements.
**Why it happens:** shadcn DropdownMenuContent has `z-50` by default. If the nav also uses `z-50`, the portal might render at the same layer.
**How to avoid:** The nav uses `z-50`, the dropdown content also uses `z-50`. Since the dropdown is rendered in a Radix portal (appended to `<body>`), it naturally stacks above the nav. No z-index override needed. But if other fixed elements are added later, ensure they don't use z-index > 50.
**Warning signs:** Dropdown visually clipped or behind other elements.

### Pitfall 5: Arbitrary Tailwind Values Not Working
**What goes wrong:** `backdrop-saturate-[1.2]` or `bg-[rgba(10,10,15,0.75)]` classes don't generate CSS.
**Why it happens:** Tailwind v4 arbitrary values require exact syntax. The value `1.2` needs no units for saturate (it's a ratio). For `bg-[rgba(...)]`, the parentheses and commas must be exactly right.
**How to avoid:** Verify the generated CSS in browser DevTools. Alternative: use `backdrop-saturate-125` (closest built-in, 125% vs 120%) if arbitrary values cause issues, though the visual difference is negligible.
**Warning signs:** Element missing expected styles in DevTools, no matching CSS rule.

### Pitfall 6: Button Import from Incorrect Base
**What goes wrong:** Type errors or runtime errors when using the shadcn Button component.
**Why it happens:** The project's Button component uses `@base-ui/react/button` (not Radix). This is the newer shadcn pattern. Developers familiar with older shadcn might try importing from Radix Slot.
**How to avoid:** Always import `{ Button }` from `@/components/ui/button`. It already handles all variants (ghost, outline, etc.) and sizes (sm, default, lg). The `ghost` variant is what the UI-SPEC calls for the Sign In button.
**Warning signs:** TypeScript errors about missing `asChild` prop or incompatible props.

## Code Examples

Verified patterns from the project codebase and official sources:

### Glass Effect Nav Bar (Tailwind v4 utilities)
```tsx
// Source: Tailwind CSS v4 docs (backdrop-filter-blur, backdrop-filter-saturate)
// Combined with UI-SPEC exact values
<nav className="fixed top-0 right-0 left-0 z-50 flex h-16 items-center justify-between
                bg-[rgba(10,10,15,0.75)] px-6 backdrop-blur-lg backdrop-saturate-[1.2]
                md:px-12"
     style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
  {/* ... */}
</nav>
```

Notes:
- `backdrop-blur-lg` = `backdrop-filter: blur(16px)` (matches UI-SPEC's `blur(16px)`)
- `backdrop-saturate-[1.2]` = `backdrop-filter: saturate(1.2)` (arbitrary value, UI-SPEC's `saturate(1.2)`)
- `bg-[rgba(10,10,15,0.75)]` = 75% opacity of #0A0A0F (UI-SPEC exact value)
- Border uses `style` prop because `rgba(255, 255, 255, 0.06)` as a border color is cleaner inline than Tailwind's `border-[rgba(255,255,255,0.06)]`
- Alternative for border: `border-b border-white/[0.06]` (Tailwind opacity modifier syntax)

### SVG Logo Rendering
```tsx
// Source: Next.js docs - SVG images, UI-SPEC logo specification
<Link href="/" aria-label="Clickit Story home">
  <img
    src="/brand/Clickit_final_logo.svg"
    alt="Clickit Story"
    className="h-8 w-auto"
    // h-8 = 32px height (UI-SPEC), w-auto preserves aspect ratio
    // viewBox is 485.86x198.93, aspect ratio ~2.44:1
    // At 32px height, rendered width is ~78px
  />
</Link>
```

### Avatar Circle
```tsx
// Source: UI-SPEC avatar specification
<button
  aria-label="User menu"
  aria-haspopup="true"
  className="flex size-9 items-center justify-center rounded-full
             bg-secondary text-sm font-bold text-foreground
             transition-colors hover:bg-border
             focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
>
  {/* size-9 = 36px, matching UI-SPEC */}
  {name.charAt(0).toUpperCase()}
</button>
```

### shadcn DropdownMenu Installation and Usage
```bash
# Source: shadcn/ui docs (https://ui.shadcn.com/docs/components/radix/dropdown-menu)
npx shadcn@latest add dropdown-menu
```

The installed component will appear at `src/components/ui/dropdown-menu.tsx` with these animation classes already configured:
```
data-[state=open]:animate-in data-[state=closed]:animate-out
data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0
data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95
data-[side=bottom]:slide-in-from-top-2
```

These animation classes come from `tw-animate-css` (already installed in `package.json`).

### Root Layout Modification
```tsx
// Source: Current src/app/layout.tsx + UI-SPEC layout shell
// Changes: Add skip-link, Navbar import, <main id="main"> wrapper with pt-16
import { Navbar } from '@/components/layout/navbar'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      <body className="bg-background text-foreground font-sans antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60]
                     focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-foreground"
        >
          Skip to content
        </a>
        <Navbar />
        <main id="main" className="pt-16">
          {children}
        </main>
      </body>
    </html>
  )
}
```

### Sign Out with Destructive Styling
```tsx
// Source: UI-SPEC Sign Out color spec (#DF544A = brand-red-safe)
<DropdownMenuItem
  className="text-brand-red-safe focus:text-brand-red-safe"
  onSelect={handleSignOut}
>
  <LogOut className="mr-2 size-4" />
  Sign Out
</DropdownMenuItem>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tailwindcss-animate` package | `tw-animate-css` package | 2025 | shadcn migrated to tw-animate-css for CSS-native animations. This project already uses tw-animate-css. |
| shadcn `default` style | shadcn `new-york` style (v4 variant) | 2024-2025 | New York uses @base-ui/react for Button (not Radix Slot). This project is on new-york. |
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2024 | Deprecated. Phase 2 uses mock auth, but future phases must use @supabase/ssr. |
| `framer-motion` package | `motion` package | 2024 | Renamed. Not needed in Phase 2 but relevant for future dropdown animation customization. |
| Tailwind v3 config (JS) | Tailwind v4 config (CSS @theme) | Jan 2025 | All tokens in globals.css @theme block. No tailwind.config.js file. |
| `middleware.ts` | `proxy.ts` (Next.js 16) | Oct 2025 | Backward compatible. Not relevant for Phase 2 but good to know for Phase 8 auth middleware. |

**Deprecated/outdated:**
- `@supabase/auth-helpers-nextjs`: Do not use. Replaced by @supabase/ssr.
- `tailwindcss-animate`: Project uses `tw-animate-css` instead.
- Manual `backdrop-filter` CSS: Tailwind v4 utilities handle this natively.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None installed |
| Config file | None |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NAVG-01 | Nav bar renders with logo and auth button | visual/smoke | Manual browser check | N/A |
| NAVG-02 | CIT logo visible on dark background | visual | Manual browser check | N/A |
| NAVG-03 | Responsive at mobile/tablet/desktop | visual | Manual resize or DevTools | N/A |
| NAVG-04 | Dark background on all pages | visual | Manual browser check | N/A |
| NAVG-05 | Sign In button visible; avatar dropdown when "logged in" | functional/visual | Manual click test | N/A |
| DESG-01 | Dark luxury background | visual | Manual browser check | N/A |
| DESG-06 | Glass-effect nav bar | visual | Manual browser check (scroll content behind) | N/A |
| DESG-10 | CIT logo SVG renders correctly | visual | Manual browser check | N/A |

### Sampling Rate
- **Per task commit:** `npm run build` (verify no TypeScript errors, no build failures)
- **Per wave merge:** `npm run build && npm run lint` (full build + lint pass)
- **Phase gate:** Visual inspection at all breakpoints + build pass

### Wave 0 Gaps
- No test framework installed. Phase 2 is primarily visual (layout, CSS, component rendering). Automated visual regression testing would require Playwright + screenshot comparison, which is not in scope for v1.
- Build verification (`next build`) and lint (`eslint`) serve as the automated validation for this phase.
- Manual visual QA is the primary validation method: render at 320px, 768px, and 1440px widths; toggle auth state; verify glass effect with scrollable content behind nav.

## Open Questions

1. **Border bottom approach: Tailwind utility vs style prop**
   - What we know: The UI-SPEC specifies `1px solid rgba(255, 255, 255, 0.06)` for the nav bottom border. Tailwind v4 supports `border-white/[0.06]` opacity modifier syntax.
   - What's unclear: Whether `border-b border-white/[0.06]` produces the exact same visual as the rgba value (it should, but needs verification).
   - Recommendation: Use the Tailwind approach `border-b border-white/[0.06]` first; fall back to style prop if the visual doesn't match.

2. **Mock auth persistence across page navigation**
   - What we know: The mock auth toggle uses `useState` which resets on navigation (full page reload) or layout re-render.
   - What's unclear: Whether the mock toggle should persist (e.g., via localStorage or URL param) or reset on navigation is acceptable for demo purposes.
   - Recommendation: Simple `useState` is sufficient for Phase 2 demo. The toggle lives in the root layout's client island, so it persists across client-side navigations within the same session. Hard refresh resets it, which is acceptable.

## Sources

### Primary (HIGH confidence)
- Project codebase: `src/styles/globals.css` -- all CIT design tokens, verified
- Project codebase: `src/app/layout.tsx` -- current root layout structure, verified
- Project codebase: `src/components/ui/button.tsx` -- shadcn Button (New York, @base-ui/react), verified
- Project codebase: `package.json` -- all installed dependencies, verified (Next.js 16.2.1, React 19.2.4)
- Project codebase: `components.json` -- shadcn config (new-york style, rsc: true), verified
- Project codebase: `public/brand/Clickit_final_logo.svg` -- SVG with viewBox 485.86x198.93, white fills + gradients
- [Tailwind CSS v4 backdrop-blur docs](https://tailwindcss.com/docs/backdrop-filter-blur) -- `backdrop-blur-lg` = 16px
- [Tailwind CSS v4 backdrop-saturate docs](https://tailwindcss.com/docs/backdrop-filter-saturate) -- arbitrary value syntax `backdrop-saturate-[1.2]`
- [shadcn/ui DropdownMenu docs](https://ui.shadcn.com/docs/components/radix/dropdown-menu) -- install command, component API
- [shadcn/ui DropdownMenu registry](https://ui.shadcn.com/r/styles/new-york/dropdown-menu.json) -- exact className strings for all subcomponents
- [Radix UI DropdownMenu API](https://www.radix-ui.com/primitives/docs/components/dropdown-menu) -- align, sideOffset, onSelect props
- Phase 2 UI-SPEC (`.planning/phases/02-app-shell-navigation/02-UI-SPEC.md`) -- visual contract
- Phase 2 CONTEXT.md (`.planning/phases/02-app-shell-navigation/02-CONTEXT.md`) -- locked decisions

### Secondary (MEDIUM confidence)
- [Next.js SVG guidance](https://nextjs.org/docs/app/api-reference/components/image) -- SVGs auto-set unoptimized; plain `<img>` recommended for logos
- [Glassmorphism with Tailwind CSS](https://www.epicweb.dev/tips/creating-glassmorphism-effects-with-tailwind-css) -- pattern verification

### Tertiary (LOW confidence)
- None. All findings verified against primary sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed, versions verified from package.json
- Architecture: HIGH -- component structure defined by UI-SPEC, server/client split follows Next.js 16 best practices
- Pitfalls: HIGH -- all pitfalls are well-documented patterns (Safari backdrop-filter, fixed nav offset, SVG rendering)
- Glass effect: HIGH -- Tailwind v4 docs confirm `backdrop-blur-lg` = 16px, `backdrop-saturate-[1.2]` arbitrary value syntax works
- shadcn DropdownMenu: HIGH -- exact className strings verified from shadcn registry JSON, animation classes use tw-animate-css (installed)

**Research date:** 2026-03-31
**Valid until:** 2026-04-30 (stable -- all dependencies are production releases, no beta APIs)
