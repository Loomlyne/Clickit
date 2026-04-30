# Phase 1: Project Scaffolding & Design System - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-30
**Phase:** 01-project-scaffolding-design-system
**Areas discussed:** Project Structure, Font Loading Strategy, Design Token Format, Test Page Design, ESLint & Prettier, shadcn/ui Initialization, Git & Commit Conventions

---

## Project Structure

| Option | Description | Selected |
|--------|-------------|----------|
| src/ with grouped modules | src/app/, src/components/, src/lib/, src/styles/ — standard Next.js convention | ✓ |
| Root app/ (no src/) | Everything at root level, flatter | |
| Feature-based modules | src/features/ per feature | |

**User's choice:** src/ with grouped modules
**Notes:** Standard convention, keeps root clean for config files

| Option | Description | Selected |
|--------|-------------|----------|
| src/components/ui/ for shadcn | shadcn default: primitives in ui/, composed alongside | ✓ |
| src/components/ flat | All components flat | |
| You decide | Claude picks | |

**User's choice:** src/components/ui/ for shadcn

| Option | Description | Selected |
|--------|-------------|----------|
| src/styles/ for CSS, public/ for assets | Tailwind tokens in globals.css, logos in public/brand/ | ✓ |
| Dedicated src/design-system/ | Tokens + assets in one folder | |
| You decide | Claude picks | |

**User's choice:** src/styles/ for CSS, public/ for assets

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, use --src-dir | Creates src/ directory during init | ✓ |
| No src/ directory | Everything at root | |

**User's choice:** Yes, use --src-dir

| Option | Description | Selected |
|--------|-------------|----------|
| Just @/* (default) | Single alias covers 99% of cases | |
| Multiple aliases | More granular tsconfig setup | |
| You decide | Claude picks | ✓ |

**User's choice:** You decide (Claude's discretion)

| Option | Description | Selected |
|--------|-------------|----------|
| Flat top-level routes | Simple, matches URL structure | |
| Route groups for layout separation | (public)/ vs (admin)/ | |
| You decide | Claude picks | ✓ |

**User's choice:** You decide (Claude's discretion)

---

## Font Loading Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Self-hosted via next/font/local | Font files in src/fonts/, best performance | ✓ |
| Google Fonts via next/font/google | CDN-cached, zero setup | |
| You decide | Claude picks | |

**User's choice:** Self-hosted via next/font/local

| Option | Description | Selected |
|--------|-------------|----------|
| Defer entirely to v2 | UI is English-first, system Arabic fallback | ✓ |
| Set up Arabic font config now | Configure now, requires licensing check | |
| System fallback with placeholder config | System fonts but define CSS variable names | |

**User's choice:** Defer Arabic fonts to v2

| Option | Description | Selected |
|--------|-------------|----------|
| I have the font files | Can provide Montreal .woff2 files | |
| Use a similar fallback for now | Visually similar Google Font as placeholder | ✓ |
| Not sure | Need to check | |

**User's choice:** Use a similar fallback for now

---

## Design Token Format

| Option | Description | Selected |
|--------|-------------|----------|
| Single globals.css with @theme | All tokens in one @theme block, single source of truth | ✓ |
| Separate tokens file imported into globals | src/styles/tokens.css, cleaner separation | |
| You decide | Claude picks | |

**User's choice:** Single globals.css with @theme

| Option | Description | Selected |
|--------|-------------|----------|
| Dark-only, no toggle | Force dark mode, no light, no next-themes | ✓ |
| Dark default with light mode toggle | Dark default, users can switch | |
| System preference with dark default | Respect OS preference | |

**User's choice:** Dark-only, no toggle

---

## Test Page Design

| Option | Description | Selected |
|--------|-------------|----------|
| Single scrollable page | One page at /design-system with sections | |
| Tabbed sections on one page | Tab navigation between categories | |
| Separate routes per category | /design-system/colors, /design-system/typography, etc. | ✓ |

**User's choice:** Separate routes per category

| Option | Description | Selected |
|--------|-------------|----------|
| Available in dev and production | At /design-system route, useful for client review | ✓ |
| Dev-only (behind env flag) | Only visible with env flag | |
| You decide | Claude picks | |

**User's choice:** Available in dev and production

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, show all states | Buttons show default, hover, focus, disabled | ✓ |
| Static only | Render without interactive state demos | |
| You decide | Claude picks | |

**User's choice:** Yes, show all states

---

## ESLint & Prettier Config

| Option | Description | Selected |
|--------|-------------|----------|
| Next.js defaults + strict TypeScript | next/core-web-vitals + @typescript-eslint/strict | ✓ |
| Minimal (Next.js defaults only) | Just next/core-web-vitals | |
| You decide | Claude picks | |

**User's choice:** Next.js defaults + strict TypeScript

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, use prettier-plugin-tailwindcss | Auto-sorts Tailwind classes | ✓ |
| No auto-sorting | Manual class ordering | |
| You decide | Claude picks | |

**User's choice:** Yes, prettier-plugin-tailwindcss

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, with ESLint import order rule | Groups: builtin > external > internal > relative | ✓ |
| No import sorting | Manual import ordering | |
| You decide | Claude picks | |

**User's choice:** Yes, ESLint import order

---

## shadcn/ui Initialization

| Option | Description | Selected |
|--------|-------------|----------|
| New York | Sharper edges, more refined, premium look | ✓ |
| Default | Rounder, softer, more casual | |
| You decide | Claude picks | |

**User's choice:** New York

| Option | Description | Selected |
|--------|-------------|----------|
| 0.5rem (8px) — subtle rounding | Premium without being too sharp or soft | ✓ |
| 0.75rem (12px) — more rounded | Softer, more approachable | |
| 0.25rem (4px) — near-sharp | Very subtle, editorial feel | |
| You decide | Claude picks | |

**User's choice:** 0.5rem (8px)

---

## Git & Commit Conventions

| Option | Description | Selected |
|--------|-------------|----------|
| Conventional Commits | feat:, fix:, docs:, chore:, refactor: prefixes | ✓ |
| Free-form messages | No enforced format | |
| You decide | Claude picks | |

**User's choice:** Conventional Commits

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, comprehensive for Next.js + Supabase | Covers .next/, node_modules/, .env*.local, .supabase/, .vercel/ | ✓ |
| Basic (Next.js default only) | Just default .gitignore | |
| You decide | Claude picks | |

**User's choice:** Comprehensive .gitignore

---

## Claude's Discretion

- Path aliases (default @/* vs granular)
- App route organization (flat vs route groups)
- Specific fallback font for Montreal placeholder

## Deferred Ideas

- Arabic fonts and RTL layout — v2
- Light mode toggle — not needed
- Component library documentation (Storybook) — test page suffices for Phase 1
