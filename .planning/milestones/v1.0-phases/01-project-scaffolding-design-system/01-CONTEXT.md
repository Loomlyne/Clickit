# Phase 1: Project Scaffolding & Design System - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Initialize the Next.js project and codify the CIT visual language into reusable design tokens. Delivers a running app with brand colors (WCAG AA-safe), typography scale, spacing tokens, and a multi-route test page demonstrating the design system. No content, no backend, no navigation — just the foundation every future phase builds on.

</domain>

<decisions>
## Implementation Decisions

### Project Structure
- **D-01:** Use `src/` directory (`--src-dir` flag during `create-next-app`). Layout: `src/app/`, `src/components/`, `src/lib/`, `src/styles/`, `src/fonts/`.
- **D-02:** shadcn/ui components in `src/components/ui/` (default convention). Composed components alongside in `src/components/`.
- **D-03:** Design tokens in `src/styles/globals.css` via Tailwind v4 `@theme` block. CIT logo SVGs in `public/brand/`.

### Font Loading
- **D-04:** Self-hosted via `next/font/local`. Font files in `src/fonts/`.
- **D-05:** Montreal font files are NOT yet available. Use a visually similar Google Font (e.g., Inter or DM Sans) as placeholder. Configure `next/font/local` so swapping to Montreal later is a one-file change.
- **D-06:** Arabic fonts (Daken Black, Avenir Arabic) deferred entirely to v2. Use system Arabic fallback for any Arabic content in v1. No Arabic font config in Phase 1.

### Design Token Format
- **D-07:** Single `globals.css` file with Tailwind v4 `@theme` block. All CIT brand tokens (colors, spacing, typography) defined there. shadcn CSS variables alongside in the same file. Single source of truth.
- **D-08:** Dark-only mode. Force `class="dark"` on `<html>`. No light mode, no toggle, no `next-themes` package needed. The platform is a cinematic dark experience — this is non-negotiable.

### Test Page
- **D-09:** Separate routes per category: `/design-system/colors`, `/design-system/typography`, `/design-system/spacing`, `/design-system/components`. Shared layout with navigation between sections.
- **D-10:** Test page available in production (at `/design-system/*` routes). Useful for client review in early phases. Can be removed or gated later.
- **D-11:** Interactive states demonstrated — buttons show default, hover, focus, disabled states. Proves the design system handles real interactions.

### ESLint & Prettier
- **D-12:** ESLint: `next/core-web-vitals` + `@typescript-eslint/strict`. Strict TypeScript checking enabled.
- **D-13:** Prettier with `prettier-plugin-tailwindcss` for automatic Tailwind class sorting.
- **D-14:** ESLint import order rule enabled. Groups: builtin > external > internal > relative.

### shadcn/ui Initialization
- **D-15:** shadcn/ui style: New York. Sharper, more refined look matching the premium cinematic aesthetic.
- **D-16:** Default border radius: `0.5rem` (8px). Subtle rounding — premium without being too soft.

### Git & Commit Conventions
- **D-17:** Conventional Commits format: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:` prefixes. Already used in this repo's history.
- **D-18:** Comprehensive `.gitignore` covering Next.js (`.next/`), Node (`node_modules/`), environment (`.env*.local`), Supabase (`.supabase/`), Vercel (`.vercel/`), and OS files (`.DS_Store`).

### Claude's Discretion
- Path aliases: Claude picks the best approach (default `@/*` or granular) based on project needs
- App route organization: Claude decides between flat routes and route groups based on the platform's navigation structure
- Specific fallback font choice for Montreal placeholder (Inter, DM Sans, or similar)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design System
- `.planning/phases/01-project-scaffolding-design-system/01-UI-SPEC.md` — UI design contract with exact color values, WCAG-safe tints, typography scale, spacing tokens, and shadcn variable mapping
- `.planning/PROJECT.md` §Design System — CIT brand colors, typography hierarchy, patterns, color harmony rules, logo assets

### Requirements
- `.planning/REQUIREMENTS.md` — FOUN-01 (project init), FOUN-04 (design system tokens)

### Technology Stack
- `CLAUDE.md` §Technology Stack — Full recommended stack with versions, rationale, and alternatives considered

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- No existing code — this is Phase 1 (greenfield project)

### Established Patterns
- No patterns yet — this phase establishes them

### Integration Points
- CIT logo SVG files available at external drive: `/Volumes/Lexar/Work/Freelance/Issam Dridi {Clickit}/Recourses/Clickit logo/`
- Logo variants needed: white-on-dark (primary for the platform)

</code_context>

<specifics>
## Specific Ideas

- Platform must feel like Netflix/streaming service, not a corporate website
- Dark cinematic background is the foundation — every future phase builds on this dark aesthetic
- CIT brand colors are accents only (10% usage) — the platform is predominantly dark with white text
- The design system test page doubles as a client review artifact — make it presentable

</specifics>

<deferred>
## Deferred Ideas

- Arabic fonts and RTL layout — deferred to v2 (I18N requirements)
- Light mode toggle — not needed, platform is dark-only
- Component library documentation (Storybook-style) — overkill for Phase 1, test page suffices

</deferred>

---

*Phase: 01-project-scaffolding-design-system*
*Context gathered: 2026-03-30*
