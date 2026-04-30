# Phase 1: Project Scaffolding & Design System - Research

**Researched:** 2026-03-30
**Domain:** Next.js 16 project initialization, Tailwind CSS v4 design tokens, shadcn/ui theming, font loading
**Confidence:** HIGH

## Summary

Phase 1 initializes a greenfield Next.js 16 project and codifies the CIT brand into Tailwind CSS v4 design tokens. The core technical domains are: (1) scaffolding a Next.js 16 App Router project with `create-next-app` in an existing git repository that already contains files, (2) configuring Tailwind CSS v4's CSS-first `@theme` block with CIT brand colors, (3) initializing shadcn/ui with New York style and overriding its CSS variables with CIT-branded values in OKLCH format, (4) setting up `next/font/local` for self-hosted fonts with a placeholder until Montreal files are available, and (5) configuring ESLint 9 flat config with `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript` + Prettier.

The biggest technical risk is that `create-next-app` refuses to run in a directory containing existing files -- it errors with "The directory contains files that could conflict." Since the project root already has `.planning/`, `.git/`, and `CLAUDE.md`, the plan must scaffold into a temporary directory then merge files back, or move existing files aside temporarily.

**Primary recommendation:** Scaffold Next.js into a temp directory, copy generated files into the project root (preserving existing `.planning/` and `CLAUDE.md`), then run `npx shadcn@latest init` to set up the component system, and finally manually override the generated CSS with CIT brand tokens from the UI-SPEC.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Use `src/` directory (`--src-dir` flag during `create-next-app`). Layout: `src/app/`, `src/components/`, `src/lib/`, `src/styles/`, `src/fonts/`.
- **D-02:** shadcn/ui components in `src/components/ui/` (default convention). Composed components alongside in `src/components/`.
- **D-03:** Design tokens in `src/styles/globals.css` via Tailwind v4 `@theme` block. CIT logo SVGs in `public/brand/`.
- **D-04:** Self-hosted via `next/font/local`. Font files in `src/fonts/`.
- **D-05:** Montreal font files are NOT yet available. Use a visually similar Google Font (e.g., Inter or DM Sans) as placeholder. Configure `next/font/local` so swapping to Montreal later is a one-file change.
- **D-06:** Arabic fonts (Daken Black, Avenir Arabic) deferred entirely to v2. Use system Arabic fallback for any Arabic content in v1. No Arabic font config in Phase 1.
- **D-07:** Single `globals.css` file with Tailwind v4 `@theme` block. All CIT brand tokens (colors, spacing, typography) defined there. shadcn CSS variables alongside in the same file. Single source of truth.
- **D-08:** Dark-only mode. Force `class="dark"` on `<html>`. No light mode, no toggle, no `next-themes` package needed. The platform is a cinematic dark experience -- this is non-negotiable.
- **D-09:** Separate routes per category: `/design-system/colors`, `/design-system/typography`, `/design-system/spacing`, `/design-system/components`. Shared layout with navigation between sections.
- **D-10:** Test page available in production (at `/design-system/*` routes). Useful for client review in early phases. Can be removed or gated later.
- **D-11:** Interactive states demonstrated -- buttons show default, hover, focus, disabled states. Proves the design system handles real interactions.
- **D-12:** ESLint: `next/core-web-vitals` + `@typescript-eslint/strict`. Strict TypeScript checking enabled.
- **D-13:** Prettier with `prettier-plugin-tailwindcss` for automatic Tailwind class sorting.
- **D-14:** ESLint import order rule enabled. Groups: builtin > external > internal > relative.
- **D-15:** shadcn/ui style: New York. Sharper, more refined look matching the premium cinematic aesthetic.
- **D-16:** Default border radius: `0.5rem` (8px). Subtle rounding -- premium without being too soft.
- **D-17:** Conventional Commits format: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:` prefixes. Already used in this repo's history.
- **D-18:** Comprehensive `.gitignore` covering Next.js (`.next/`), Node (`node_modules/`), environment (`.env*.local`), Supabase (`.supabase/`), Vercel (`.vercel/`), and OS files (`.DS_Store`).

### Claude's Discretion
- Path aliases: Claude picks the best approach (default `@/*` or granular) based on project needs
- App route organization: Claude decides between flat routes and route groups based on the platform's navigation structure
- Specific fallback font choice for Montreal placeholder (Inter, DM Sans, or similar)

### Deferred Ideas (OUT OF SCOPE)
- Arabic fonts and RTL layout -- deferred to v2 (I18N requirements)
- Light mode toggle -- not needed, platform is dark-only
- Component library documentation (Storybook-style) -- overkill for Phase 1, test page suffices
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOUN-01 | Next.js project initialized with App Router, Tailwind CSS, and Supabase client | `create-next-app` scaffolding research, Tailwind v4 CSS-first config, `@supabase/supabase-js` + `@supabase/ssr` packages (install only, no config needed for Phase 1) |
| FOUN-04 | Design system established with CIT brand colors (WCAG-safe tints for dark backgrounds), typography (Montreal/Avenir Arabic), and spacing tokens | Tailwind v4 `@theme` block with CIT color tokens from UI-SPEC, `next/font/local` placeholder font, shadcn CSS variable overrides, spacing scale mapped to default Tailwind units |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Stack**: Next.js 16.2.x (App Router) + Supabase + Tailwind CSS 4.2.x, deployed on Vercel
- **shadcn/ui**: Latest vendored components, New York style, Radix UI primitives
- **Icons**: lucide-react (tree-shakable, shadcn default)
- **No next-themes**: Dark-only mode -- hardcode `class="dark"` on `<html>`
- **No Prisma**: Supabase JS client only
- **No framer-motion package name**: Use `motion` package with `motion/react` imports
- **No Tailwind v3**: v4 CSS-first config only
- **No Next.js 15**: Use 16.2.x
- **Conventional Commits**: Already established in repo history

## Standard Stack

### Core (Phase 1 only)

| Library | Version (verified) | Purpose | Why Standard |
|---------|-------------------|---------|--------------|
| next | 16.2.1 | App Router framework | Current stable. Turbopack default, React Compiler, `use cache` directive |
| react | 19.x | UI library | Ships with Next.js 16 |
| typescript | 5.x (registry: 6.0.2 but Next.js pins ~5.x) | Type safety | Required by Next.js tooling |
| tailwindcss | 4.2.2 | CSS-first utility framework | `@theme` block for design tokens, no JS config file |
| @tailwindcss/postcss | 4.2.2 | PostCSS integration | Required for Tailwind v4 with Next.js |

### UI Components

| Library | Version (verified) | Purpose | Why Standard |
|---------|-------------------|---------|--------------|
| shadcn (CLI) | latest | Component distribution CLI | Generates components.json, adds vendored components |
| class-variance-authority | 0.7.1 | Component variant API | Required by shadcn Button, Badge components |
| clsx | 2.1.1 | Conditional classnames | Used in shadcn `cn()` utility |
| tailwind-merge | 3.5.0 | Tailwind class deduplication | Used in shadcn `cn()` utility |
| tw-animate-css | 1.4.0 | CSS animations for Tailwind v4 | Replaces deprecated `tailwindcss-animate` plugin |
| lucide-react | 1.7.0 | Icons | Tree-shakable SVG icons, shadcn default |

### Dev Tooling

| Library | Version (verified) | Purpose | Why Standard |
|---------|-------------------|---------|--------------|
| eslint | 10.1.0 | Linting | Flat config format (ESLint 9+) |
| eslint-config-next | latest | Next.js ESLint rules | Includes `core-web-vitals` + `typescript` configs |
| eslint-config-prettier | latest | Prettier compatibility | Disables ESLint rules that conflict with Prettier |
| prettier | 3.8.1 | Code formatting | Consistent style |
| prettier-plugin-tailwindcss | 0.7.2 | Tailwind class sorting | Auto-sorts classes in canonical order |

### Supabase (install only in Phase 1)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | ^2.100.x | JS client | FOUN-01 requires it installed. Actual configuration in Phase 6 |
| @supabase/ssr | ^0.9.x | SSR auth integration | FOUN-01 requires it installed. Actual configuration in Phase 6 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inter (placeholder font) | DM Sans, Roboto | Inter is the most widely used geometric sans-serif on Google Fonts with excellent variable font support. DM Sans is slightly more geometric. Both are visually close to Montreal. **Recommendation: Use Inter** -- it has the best variable font support (single file for all weights), is the closest match to Montreal's clean neo-grotesque aesthetic, and is the default Google Font in Next.js scaffolding. |
| Manual ESLint plugin config | eslint-config-next (spread) | Direct plugin config gives more control but eslint-config-next handles plugin composition automatically. Use eslint-config-next since it is the officially supported approach in Next.js 16. |
| OKLCH colors | HSL colors | shadcn/ui v4 uses OKLCH by default. CIT brand colors are hex. Converting hex to OKLCH in CSS variables is straightforward. Use OKLCH for shadcn semantic tokens but keep hex in `@theme` for CIT brand tokens (Tailwind `@theme` accepts any CSS color format). |

**Installation (Phase 1 packages only):**

```bash
# After create-next-app scaffolding (which installs next, react, typescript, tailwindcss, eslint, eslint-config-next):
npm install @supabase/supabase-js @supabase/ssr
npm install -D prettier prettier-plugin-tailwindcss eslint-config-prettier

# shadcn/ui (run after project scaffold + Tailwind configured):
npx shadcn@latest init
npx shadcn@latest add button badge
```

## Architecture Patterns

### Recommended Project Structure

```
Clickit/
├── .planning/           # GSD planning artifacts (already exists)
├── public/
│   └── brand/           # CIT logo SVGs
├── src/
│   ├── app/
│   │   ├── layout.tsx         # Root layout (font loading, dark class, globals.css)
│   │   ├── page.tsx           # Home page (placeholder for Phase 2)
│   │   └── design-system/
│   │       ├── layout.tsx     # Shared layout with section nav
│   │       ├── page.tsx       # Overview/redirect to colors
│   │       ├── colors/
│   │       │   └── page.tsx   # Color swatch grid
│   │       ├── typography/
│   │       │   └── page.tsx   # Typography scale demo
│   │       ├── spacing/
│   │       │   └── page.tsx   # Spacing token demo
│   │       └── components/
│   │           └── page.tsx   # Button + Badge variants
│   ├── components/
│   │   └── ui/                # shadcn/ui vendored components
│   ├── fonts/                 # Self-hosted font files (.woff2)
│   ├── lib/
│   │   └── utils.ts           # cn() helper from shadcn
│   └── styles/
│       └── globals.css        # Tailwind + CIT tokens + shadcn vars
├── CLAUDE.md                  # Project instructions (already exists)
├── components.json            # shadcn/ui configuration
├── eslint.config.mjs          # ESLint flat config
├── next.config.ts             # Next.js configuration
├── package.json
├── postcss.config.mjs         # PostCSS config for Tailwind v4
├── tsconfig.json
└── .prettierrc                # Prettier configuration
```

### Pattern 1: Font Loading with CSS Variable for Tailwind v4

**What:** Load a self-hosted font (or Google Font placeholder) via `next/font/local` or `next/font/google`, expose it as a CSS variable, and map it to Tailwind's `--font-sans` in `@theme inline`.

**When to use:** Always -- this is the standard pattern for Next.js + Tailwind v4 font integration.

**Example:**

```typescript
// src/app/layout.tsx
import localFont from 'next/font/local'
// OR for placeholder: import { Inter } from 'next/font/google'

// When Montreal files are available:
const montreal = localFont({
  src: [
    { path: '../fonts/Montreal-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/Montreal-Bold.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-montreal',
  display: 'swap',
})

// Placeholder (Phase 1):
// const inter = Inter({
//   subsets: ['latin'],
//   variable: '--font-inter',
//   display: 'swap',
// })

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${montreal.variable}`}>
      <body className="bg-background text-foreground font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
```

```css
/* src/styles/globals.css -- font mapping */
@theme inline {
  --font-sans: var(--font-montreal), system-ui, -apple-system, sans-serif;
}
```

**Key insight:** The `variable` option on `next/font` creates a CSS custom property on the element where the font's `className` or `variable` class is applied. `@theme inline` then maps this to Tailwind's `--font-sans` namespace, enabling `font-sans` utility class. When Montreal files become available, change the `localFont` `src` array -- nothing else changes.

Source: [Next.js Font Optimization Docs](https://nextjs.org/docs/app/getting-started/fonts), [Tailwind CSS v4 Theme Docs](https://tailwindcss.com/docs/theme), [Tailwind Discussion #15923](https://github.com/tailwindlabs/tailwindcss/discussions/15923)

### Pattern 2: Tailwind v4 `@theme` with shadcn CSS Variables

**What:** Define CIT brand tokens in `@theme` block and shadcn semantic tokens as CSS custom properties, connected via `@theme inline`.

**When to use:** Always for this project -- the single `globals.css` file is the source of truth for all design tokens.

**Example:**

```css
/* src/styles/globals.css */
@import "tailwindcss";
@import "tw-animate-css";

/* Dark-only: define shadcn semantic variables directly (no :root/.dark split needed) */
@custom-variant dark (&:is(.dark *));

:root {
  /* shadcn semantic tokens -- CIT dark theme values */
  --background: oklch(0.07 0.01 270);    /* #0A0A0F */
  --foreground: oklch(1 0 0);            /* #FFFFFF */
  --card: oklch(0.14 0.01 270);          /* #1A1A22 */
  --card-foreground: oklch(1 0 0);       /* #FFFFFF */
  --popover: oklch(0.14 0.01 270);       /* #1A1A22 */
  --popover-foreground: oklch(1 0 0);    /* #FFFFFF */
  --primary: oklch(0.30 0.08 260);       /* #2C3569 */
  --primary-foreground: oklch(1 0 0);    /* #FFFFFF */
  --secondary: oklch(0.19 0.01 270);     /* #242430 */
  --secondary-foreground: oklch(1 0 0);  /* #FFFFFF */
  --muted: oklch(0.14 0.01 270);         /* #1A1A22 */
  --muted-foreground: oklch(0.72 0.03 270); /* #A1A1B5 */
  --accent: oklch(0.19 0.01 270);        /* #242430 */
  --accent-foreground: oklch(1 0 0);     /* #FFFFFF */
  --destructive: oklch(0.55 0.20 25);    /* #DB3F34 */
  --destructive-foreground: oklch(1 0 0); /* #FFFFFF */
  --border: oklch(0.21 0.01 270);        /* #2A2A36 */
  --input: oklch(0.21 0.01 270);         /* #2A2A36 */
  --ring: oklch(0.59 0.05 260);          /* #7C82A2 */
  --radius: 0.5rem;
  --chart-1: oklch(0.55 0.20 25);        /* Crimson Red */
  --chart-2: oklch(0.62 0.15 145);       /* Oasis Green */
  --chart-3: oklch(0.55 0.17 310);       /* Royal Purple */
  --chart-4: oklch(0.70 0.16 65);        /* Sunset Orange */
  --chart-5: oklch(0.83 0.16 90);        /* Desert Sand */
}

/* Dark class override: since we are dark-only, .dark mirrors :root */
.dark {
  --background: oklch(0.07 0.01 270);
  --foreground: oklch(1 0 0);
  /* ... identical to :root for dark-only mode ... */
}

/* Map shadcn tokens to Tailwind color utilities */
@theme inline {
  /* Font */
  --font-sans: var(--font-montreal), system-ui, -apple-system, sans-serif;

  /* shadcn semantic colors */
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);

  /* Radius scale */
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
  --radius-2xl: calc(var(--radius) * 1.8);
}

/* CIT brand colors (non-shadcn) */
@theme {
  /* Original brand hex (decorative use only) */
  --color-brand-blue: #2C3569;
  --color-brand-purple: #9F54A0;
  --color-brand-green: #50A258;
  --color-brand-red: #DB3F34;
  --color-brand-orange: #EA8C2E;
  --color-brand-yellow: #F8C623;

  /* WCAG AA-safe tints (text on dark backgrounds) */
  --color-brand-blue-safe: #7C82A2;
  --color-brand-purple-safe: #AC6CAD;
  --color-brand-green-safe: #50A258;
  --color-brand-red-safe: #DF544A;
  --color-brand-orange-safe: #EA8C2E;
  --color-brand-yellow-safe: #F8C623;

  /* Dark surfaces */
  --color-surface-1: #111116;
  --color-surface-2: #1A1A22;
  --color-surface-3: #242430;

  /* Text hierarchy */
  --color-text-primary: #FFFFFF;
  --color-text-secondary: #A1A1B5;
  --color-text-muted: #6B6B80;
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

Source: [Tailwind v4 - shadcn/ui](https://ui.shadcn.com/docs/tailwind-v4), [shadcn/ui Theming](https://ui.shadcn.com/docs/theming), [Tailwind CSS Theme Variables](https://tailwindcss.com/docs/theme)

### Pattern 3: Dark-Only Mode Without next-themes

**What:** Force dark mode by hardcoding `class="dark"` on the `<html>` element. No theme provider, no toggle, no `next-themes` package.

**When to use:** When the platform is permanently dark-themed (streaming services, cinematic UIs).

**Example:**

```typescript
// src/app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${fontVariable}`}>
      <body className="bg-background text-foreground font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
```

**Key insight:** Since both `:root` and `.dark` in globals.css contain identical values for a dark-only platform, shadcn components "just work" in dark mode without any provider. The `@custom-variant dark (&:is(.dark *));` line in the CSS ensures Tailwind's `dark:` variant resolves based on the `.dark` class.

### Pattern 4: ESLint 9 Flat Config for Next.js 16

**What:** ESLint 9+ uses `eslint.config.mjs` with flat config format. Next.js 16 removed `next lint` -- use `npx eslint .` directly.

**When to use:** All Next.js 16 projects.

**Example:**

```javascript
// eslint.config.mjs
import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import prettier from 'eslint-config-prettier/flat'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    rules: {
      // Import ordering
      'import/order': ['warn', {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc' },
      }],
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
])

export default eslintConfig
```

**Key changes from previous Next.js versions:**
- `next lint` is removed in Next.js 16 -- use `npx eslint .` or `eslint --cache .`
- The `eslint` option in `next.config.js` is no longer needed
- `eslint-config-next/typescript` adds `@typescript-eslint/recommended` rules
- For strict TypeScript, consider `typescript-eslint` `strictTypeChecked` configs (requires `projectService: true`)

Source: [Next.js ESLint Config Docs](https://nextjs.org/docs/app/api-reference/config/eslint)

### Anti-Patterns to Avoid

- **Using `tailwind.config.js`:** Tailwind v4 is CSS-first. All configuration goes in `globals.css` via `@theme`. There is no `tailwind.config.js` file.
- **Using `@layer base` for :root variables that should be in @theme:** CSS variables intended to generate Tailwind utilities MUST be in `@theme` or `@theme inline`. Variables in `:root` alone do not create utility classes.
- **Installing `next-themes` for dark-only mode:** Adds 3KB of JavaScript and a ThemeProvider for functionality you do not need. Hardcode `class="dark"` instead.
- **Installing `tailwindcss-animate`:** Deprecated for Tailwind v4. Use `tw-animate-css` (pure CSS, no JS plugin).
- **Using `@supabase/auth-helpers-nextjs`:** Deprecated. The correct package is `@supabase/ssr`.
- **Running `next lint`:** Removed in Next.js 16. Use `npx eslint .` directly.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Class name merging | Custom `classNames()` utility | `cn()` from `clsx` + `tailwind-merge` | shadcn's `cn()` handles Tailwind specificity conflicts automatically |
| Component variants | Manual conditional classes | `class-variance-authority` (cva) | Type-safe variant API, used by all shadcn components |
| Font optimization | Manual `<link>` preload | `next/font/local` or `next/font/google` | Zero layout shift, automatic subsetting, self-hosted on same domain |
| Dark mode | Custom theme context | Hardcoded `class="dark"` on `<html>` | Zero JS cost for dark-only mode |
| Animation CSS | Custom keyframes | `tw-animate-css` | Pre-built animation utilities compatible with Tailwind v4 |
| Accessible button/badge | Custom ARIA management | shadcn `Button` + `Badge` components | Built on Radix primitives, WAI-ARIA compliant |

**Key insight:** Phase 1 has very few custom components. Most of the work is configuration and token definition, not component building.

## Common Pitfalls

### Pitfall 1: create-next-app Refuses Non-Empty Directories

**What goes wrong:** Running `npx create-next-app@latest .` in the project root fails with "The directory contains files that could conflict" because `.planning/`, `CLAUDE.md`, and `.DS_Store` already exist.

**Why it happens:** `create-next-app` checks for existing files and refuses to overwrite them as a safety measure.

**How to avoid:** Scaffold into a temporary directory, then copy generated files into the project root:
```bash
# 1. Scaffold into temp directory
npx create-next-app@latest /tmp/clickit-scaffold --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --disable-git --yes

# 2. Copy generated files (excluding .git) into project root
cp -r /tmp/clickit-scaffold/* /path/to/Clickit/
cp /tmp/clickit-scaffold/.gitignore /path/to/Clickit/
cp /tmp/clickit-scaffold/.eslintrc* /path/to/Clickit/ 2>/dev/null
cp /tmp/clickit-scaffold/tsconfig.json /path/to/Clickit/
# ... etc

# 3. Clean up
rm -rf /tmp/clickit-scaffold

# 4. Install dependencies
cd /path/to/Clickit && npm install
```

**Warning signs:** The error message "Either try using a new directory name, or remove the files listed above" when running `create-next-app .`.

### Pitfall 2: globals.css Location Mismatch

**What goes wrong:** `create-next-app --src-dir` puts `globals.css` at `src/app/globals.css`, but D-03 specifies `src/styles/globals.css`. shadcn init may reference the wrong path in `components.json`.

**Why it happens:** Default scaffolding and user preference differ on file location.

**How to avoid:** After scaffolding, move `globals.css` from `src/app/` to `src/styles/`, update the import in `src/app/layout.tsx` to `import '@/styles/globals.css'`, and ensure `components.json` has `"css": "src/styles/globals.css"` in the `tailwind` section.

**Warning signs:** Styles not loading, shadcn components unstyled, build errors about missing CSS file.

### Pitfall 3: @theme vs @theme inline Confusion

**What goes wrong:** Using `@theme` for shadcn CSS variables that reference other CSS custom properties (e.g., `--color-background: var(--background)`) causes Tailwind to not resolve the variables properly.

**Why it happens:** `@theme` generates CSS custom properties at build time. If the value references another CSS variable defined in `:root`, it may not resolve correctly. `@theme inline` tells Tailwind to keep the `var()` reference as-is for runtime resolution.

**How to avoid:** Use `@theme inline` for shadcn semantic token mappings (which reference `:root` variables), and use `@theme` (without inline) for CIT brand tokens that have static hex values.

**Warning signs:** Colors appearing as fallback/transparent, Tailwind utilities like `bg-background` not working.

### Pitfall 4: OKLCH Conversion Inaccuracy

**What goes wrong:** Converting CIT hex colors (#2C3569, #0A0A0F, etc.) to OKLCH values imprecisely, resulting in visible color differences.

**Why it happens:** OKLCH is a perceptually uniform color space with different gamut than sRGB. Manual conversion can introduce rounding errors.

**How to avoid:** Use a reliable conversion tool (e.g., oklch.com, CSS Color 4 spec converters). Cross-check converted values by rendering side-by-side with original hex. For CIT brand colors in `@theme`, use hex directly (Tailwind accepts any CSS color format) -- OKLCH is only needed for shadcn semantic tokens.

**Warning signs:** Brand colors look "off" compared to the CIT brand guideline PDF.

### Pitfall 5: Font Variable Not Resolving in Tailwind

**What goes wrong:** `font-sans` utility class does not apply the custom font, falling back to system fonts.

**Why it happens:** The CSS variable from `next/font` (e.g., `--font-inter` or `--font-montreal`) must be applied to the `<html>` element via the font's `variable` class. If only `className` is used (instead of `variable`), the CSS custom property is not set.

**How to avoid:** Always use the `variable` option on `next/font`, apply it to `<html>` via `className={fontInstance.variable}`, and map it in `@theme inline` with `--font-sans: var(--font-inter), system-ui, sans-serif`.

**Warning signs:** Text renders in system font, DevTools shows `--font-inter` as undefined.

### Pitfall 6: shadcn init Overwriting Custom globals.css

**What goes wrong:** Running `npx shadcn@latest init` after manually configuring globals.css overwrites the file with shadcn defaults.

**Why it happens:** shadcn init generates a fresh globals.css with its default color scheme.

**How to avoid:** Run shadcn init FIRST (or early), then override the generated CSS with CIT brand tokens. Alternatively, answer the init prompts to match your css path and then selectively apply CIT overrides after.

**Warning signs:** CIT brand colors disappearing after adding shadcn components.

## Code Examples

### shadcn components.json for CIT Project

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/styles/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

Source: [shadcn/ui components.json](https://ui.shadcn.com/docs/components-json)

### Prettier Configuration

```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

### Design System Test Page Layout

```typescript
// src/app/design-system/layout.tsx
import Link from 'next/link'

const sections = [
  { href: '/design-system/colors', label: 'Colors' },
  { href: '/design-system/typography', label: 'Typography' },
  { href: '/design-system/spacing', label: 'Spacing' },
  { href: '/design-system/components', label: 'Components' },
]

export default function DesignSystemLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-8 py-6">
        <h1 className="text-2xl font-bold text-foreground">CIT Design System</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Color palette, typography scale, and component primitives for the
          Clickit Story streaming platform.
        </p>
        <nav className="mt-4 flex gap-4">
          {sections.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="text-sm text-brand-blue-safe hover:text-foreground transition-colors"
            >
              {s.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="px-8 py-8">{children}</main>
    </div>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tailwind.config.js` | `@theme` directive in CSS | Tailwind v4.0 (Jan 2025) | No JS config file; all tokens in CSS |
| `tailwindcss-animate` plugin | `tw-animate-css` pure CSS | March 2025 | No JS plugin; `@import "tw-animate-css"` |
| `next lint` CLI command | `npx eslint .` directly | Next.js 16 (Oct 2025) | `next lint` removed entirely |
| `.eslintrc.json` | `eslint.config.mjs` flat config | ESLint 9 (2024) | Flat config is now default |
| `framer-motion` package | `motion` package | 2024 | Import from `motion/react` |
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2024 | Old package deprecated |
| shadcn `default` style | shadcn `new-york` style | Feb 2025 | `default` deprecated, `new-york` is default |
| HSL colors in shadcn | OKLCH colors | Feb 2025 (Tailwind v4 update) | Better perceptual uniformity |
| `middleware.ts` | `proxy.ts` (backward compatible) | Next.js 16 | Both work; proxy.ts is the new name |

## Open Questions

1. **Import order ESLint plugin availability**
   - What we know: D-14 requires ESLint import ordering (builtin > external > internal > relative). The `eslint-plugin-import` package provides this, but its compatibility with ESLint 9 flat config has historically been problematic.
   - What's unclear: Whether `eslint-plugin-import` works cleanly with ESLint 9 flat config and `eslint-config-next`, or whether `@typescript-eslint/no-restricted-imports` or simple naming conventions should be used instead.
   - Recommendation: Try `eslint-plugin-import` first. If it causes issues with flat config, fall back to `eslint-plugin-simple-import-sort` which has proven ESLint 9 compatibility. This is a LOW-risk item -- import ordering is a style preference, not a correctness requirement.

2. **Exact OKLCH values for CIT hex colors**
   - What we know: CIT brand colors are defined in hex. shadcn/ui with Tailwind v4 prefers OKLCH format.
   - What's unclear: The exact OKLCH equivalents for all CIT colors. Conversion must be precise.
   - Recommendation: Use a programmatic converter (CSS `color()` function or oklch.com) during implementation. For CIT brand tokens in `@theme` (non-shadcn), use hex directly since Tailwind accepts any CSS color format. Only convert to OKLCH for the shadcn semantic variables in `:root`.

3. **Inter vs DM Sans as Montreal placeholder**
   - What we know: Both are clean geometric sans-serifs similar to PP Neue Montreal. Inter has excellent variable font support (single file covers all weights). DM Sans has slightly more geometric character shapes.
   - What's unclear: Which is the closest visual match to Montreal for the specific CIT aesthetic.
   - Recommendation: Use **Inter** -- it is the default Next.js font, has a single variable font file (smaller payload), and its metrics are close to Montreal. When Montreal files become available, swapping is a one-file change in the font configuration.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js 16 | Yes | 22.20.0 | -- |
| npm | Package management | Yes | 10.9.3 | -- |
| npx | create-next-app, shadcn CLI | Yes | 10.9.3 | -- |
| git | Version control | Yes | (pre-existing repo) | -- |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

Step 2.6: All external dependencies available. No issues.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected -- greenfield project |
| Config file | none -- see Wave 0 |
| Quick run command | `npm run build` (type-check + build verification) |
| Full suite command | `npm run build && npx eslint .` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FOUN-01 | Next.js app runs locally with App Router and Tailwind CSS configured | smoke | `npm run dev` (manual verification: localhost:3000 loads) | Wave 0 |
| FOUN-04 | CIT brand colors defined as design tokens with WCAG AA-safe tints | manual | Visual inspection of `/design-system/colors` page | Wave 0 |
| FOUN-04 | Typography scale configured with Montreal/placeholder + fallbacks | manual | Visual inspection of `/design-system/typography` page | Wave 0 |
| FOUN-04 | Test page renders sample components (headings, body text, color swatches, buttons) | manual | Navigate to `/design-system/components` and verify rendering | Wave 0 |

### Sampling Rate

- **Per task commit:** `npm run build` (catches TypeScript errors and build failures)
- **Per wave merge:** `npm run build && npx eslint .`
- **Phase gate:** Successful `npm run build`, `npx eslint .` passes, all 4 `/design-system/*` routes render correctly

### Wave 0 Gaps

- [ ] No test framework needed for Phase 1 -- validation is build success + visual inspection
- [ ] `npm run build` serves as the automated quality gate (TypeScript checking + Next.js build)
- [ ] `npx eslint .` serves as the lint quality gate
- [ ] Manual visual verification of `/design-system/*` routes against UI-SPEC color values

*(Phase 1 is scaffolding and design token configuration. Automated component tests would be premature -- the design system test pages ARE the validation artifact.)*

## Sources

### Primary (HIGH confidence)
- [Next.js 16 create-next-app CLI Docs](https://nextjs.org/docs/app/api-reference/cli/create-next-app) - Full flag reference, verified 2026-03-25
- [Next.js 16 Font Optimization Docs](https://nextjs.org/docs/app/getting-started/fonts) - next/font/local + next/font/google patterns, verified 2026-03-25
- [Next.js 16 ESLint Config Docs](https://nextjs.org/docs/app/api-reference/config/eslint) - Flat config setup, `next lint` removal, verified 2026-03-25
- [Tailwind CSS v4 Theme Variables](https://tailwindcss.com/docs/theme) - @theme directive syntax and namespaces
- [shadcn/ui Tailwind v4 Guide](https://ui.shadcn.com/docs/tailwind-v4) - @theme inline pattern, updated components
- [shadcn/ui Theming](https://ui.shadcn.com/docs/theming) - CSS variable list, OKLCH format
- [shadcn/ui Manual Installation](https://ui.shadcn.com/docs/installation/manual) - Dependencies: shadcn, cva, clsx, tailwind-merge, tw-animate-css, lucide-react
- [shadcn/ui components.json](https://ui.shadcn.com/docs/components-json) - Configuration structure

### Secondary (MEDIUM confidence)
- [Tailwind CSS v4 + next/font Integration](https://github.com/tailwindlabs/tailwindcss/discussions/15923) - @theme inline font mapping pattern
- [Next.js 16 ESLint 9 Flat Config Tutorial](https://chris.lu/web_development/tutorials/next-js-16-linting-setup-eslint-9-flat-config) - typescript-eslint strict setup
- [PP Neue Montreal Font Alternatives](https://pangrampangram.com/blogs/journal/google-font-alternatives-part2) - Inter/Roboto as placeholders

### Tertiary (LOW confidence)
- OKLCH color values for CIT hex colors are estimated -- must be verified with a proper converter during implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All versions verified against npm registry on 2026-03-30
- Architecture: HIGH - Patterns verified against official Next.js 16, Tailwind v4, and shadcn/ui documentation
- Pitfalls: HIGH - The `create-next-app` non-empty directory issue was reproduced locally

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (30 days -- stable ecosystem, no major releases expected)
