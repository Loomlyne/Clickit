---
last_mapped_commit: de36f69
---
# Codebase Structure

**Analysis Date:** 2026-07-19

## Directory Layout

```text
Clickit/
├── src/
│   ├── app/                 # App Router pages, layouts, actions, API routes
│   ├── components/          # Feature UI, shared primitives, and shadcn-style UI
│   ├── hooks/               # Client-side media and preference hooks
│   ├── i18n/                # next-intl routing, navigation, request config
│   ├── lib/                 # Domain queries, config, Supabase clients, utilities
│   ├── messages/            # English and Arabic translation dictionaries
│   ├── styles/              # Global Tailwind CSS entry point
│   └── proxy.ts             # Request-time locale/session/access policy
├── supabase/
│   ├── migrations/          # Database, RLS, Storage, and data evolution SQL
│   └── config.toml          # Supabase local project configuration
├── tests/
│   ├── e2e/                 # Playwright user-flow specifications
│   └── unit/                # Focused unit tests
├── public/                  # Static brand assets and favicon
├── scripts/                 # One-off operational and content maintenance scripts
├── next.config.ts           # Next, BotID, next-intl, CSP, and image config
├── vercel.json              # Regional deployment and cron schedule declaration
└── playwright.config.ts     # Playwright runner configuration
```

## Directory Purposes

**`src/app/`:**

- Purpose: Own route segments, layouts, server actions, metadata routes, and Route Handlers.
- Contains: Server Components by default, client boundaries where feature components require interaction, `loading.tsx`, `error.tsx`, and `not-found.tsx` boundaries.
- Key files: `src/app/layout.tsx`, `src/app/[locale]/layout.tsx`, `src/app/actions/contact.ts`, `src/app/api/youtube-meta/route.ts`.

**`src/app/[locale]/(viewer)/`:**

- Purpose: Group viewer-facing screens behind a shared scroll/navigation/footer shell without adding a URL segment.
- Contains: Portfolio, browse, series, support, profile, auth, legal, and content page routes.
- Key files: `src/app/[locale]/(viewer)/layout.tsx`, `src/app/[locale]/(viewer)/series/[slug]/page.tsx`, `src/app/[locale]/(viewer)/profile/actions.ts`.

**`src/app/[locale]/(watch)/`:**

- Purpose: Keep the player experience full-screen and intentionally separate from viewer shell chrome.
- Contains: Watch layout, watch page, and route-specific error/loading states.
- Key files: `src/app/[locale]/(watch)/layout.tsx`, `src/app/[locale]/(watch)/watch/[episodeId]/page.tsx`.

**`src/app/[locale]/admin/`:**

- Purpose: Own protected editorial routes and their Server Actions.
- Contains: Dashboard, catalog, archive, reviews, inbox, settings, shorts, and category screens.
- Key files: `src/app/[locale]/admin/layout.tsx`, `src/app/[locale]/admin/actions.ts`, `src/app/[locale]/admin/settings/page.tsx`.

**`src/components/`:**

- Purpose: Compose UI by feature rather than mirroring route paths.
- Contains: Feature directories including `admin/`, `series/`, `watch/`, `layout/`, `home/`, `landing/`, `profile/`, `shows/`, and shared `ui/`/`primitives/`.
- Key files: `src/components/watch/watch-shell.tsx`, `src/components/admin/show-form.tsx`, `src/components/layout/viewer-shell.tsx`, `src/components/ui/button.tsx`.

**`src/lib/`:**

- Purpose: Hold framework-neutral domain helpers and server-side data boundary code.
- Contains: Queries, config, generated database types, localization/media/scheduling helpers, and dedicated Supabase client constructors.
- Key files: `src/lib/queries.ts`, `src/lib/config.ts`, `src/lib/database.types.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/admin.ts`.

**`supabase/migrations/`:**

- Purpose: Version the full persistence contract.
- Contains: Schema, policies, storage, indexes, views, constraints, seed changes, and feature migrations.
- Key files: `supabase/migrations/20260401000000_create_schema.sql`, `supabase/migrations/20260401000001_create_rls_policies.sql`, `supabase/migrations/20260619000000_episodes_view_show_title_ar.sql`.

**`tests/`:**

- Purpose: Maintain automated behavior checks separate from application source.
- Contains: Route-level Playwright flows in `tests/e2e/` and smaller logic tests in `tests/unit/`.
- Key files: `tests/e2e/watch-page.spec.ts`, `tests/e2e/series-detail.spec.ts`, `tests/unit/hero-media.test.ts`.

## Key File Locations

**Entry Points:**

- `src/proxy.ts`: Request gate for locale, session refresh, feature gates, and authorization redirects.
- `src/app/layout.tsx`: Required minimal App Router root layout.
- `src/app/[locale]/layout.tsx`: HTML/body, translation provider, global styles, metadata, analytics, and toast root.
- `src/app/auth/callback/route.ts`: Locale-free OAuth callback endpoint.

**Configuration:**

- `next.config.ts`: Build plugins, headers/CSP, images, React compiler, and Server Action body limit.
- `vercel.json`: Vercel region and cron invocation schedule.
- `src/i18n/routing.ts`: Supported locales and forced locale-prefix policy.
- `src/lib/config.ts`: Application-level editable config schema, defaults, and cached readers.
- `supabase/config.toml`: Supabase local development settings.

**Core Logic:**

- `src/lib/queries.ts`: Catalog, episode, category, user-state, short, FAQ, legal, cache, and mapping reads.
- `src/app/[locale]/admin/actions.ts`: Privileged editorial mutations and asset workflows.
- `src/app/actions/contact.ts`: Support and newsletter form mutations.
- `src/lib/supabase/`: Typed client construction per runtime trust boundary.

**Testing:**

- `playwright.config.ts`: Browser test runner definition.
- `tests/e2e/`: User-visible navigation, layout, catalog, player, hero-media, and coming-soon specs.
- `tests/unit/`: Focused behavior tests for navigation and hero-media helpers.

## Naming Conventions

**Files:**

- Use lowercase kebab-case for multiword components and utilities, such as `src/components/series/series-detail-content.tsx` and `src/lib/supabase-media.ts`.
- Use Next.js reserved names for routes and boundaries, such as `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`, `route.ts`, and `actions.ts`.
- Keep one primary React component per component file; exported component names are PascalCase, such as `WatchShell` in `src/components/watch/watch-shell.tsx`.

**Directories:**

- Group UI by product feature under `src/components/`, such as `src/components/admin/` and `src/components/watch/`.
- Use App Router dynamic segments for data identity, such as `src/app/[locale]/(viewer)/series/[slug]/` and `src/app/[locale]/(watch)/watch/[episodeId]/`.
- Use parenthesized App Router route groups only when shared layout differs without changing the URL, as in `src/app/[locale]/(viewer)/` and `src/app/[locale]/(watch)/`.

## Where to Add New Code

**New viewer feature:**

- Primary route: `src/app/[locale]/(viewer)/<feature>/page.tsx`.
- Route boundary: colocate `loading.tsx`, `error.tsx`, or `not-found.tsx` under the same route subtree when the feature needs one.
- Feature UI: `src/components/<feature>/`.
- Read model: extend `src/lib/queries.ts` when the page needs catalog/database data.
- Mutation: colocate `actions.ts` under the relevant route subtree when the mutation is only used by that domain.

**New watch/player behavior:**

- Page data assembly: `src/app/[locale]/(watch)/watch/[episodeId]/page.tsx`.
- Interactive UI: `src/components/watch/`.
- Browser persistence or media behavior: `src/hooks/`.
- Shared schedule/media handling: `src/lib/scheduling.ts` or `src/lib/supabase-media.ts`.

**New admin editor capability:**

- Page: `src/app/[locale]/admin/<feature>/page.tsx`.
- UI: `src/components/admin/<feature>.tsx`, or `src/components/admin/settings/` for configuration tabs.
- Privileged operation: add a validated, `assertAdmin()`-guarded action to `src/app/[locale]/admin/actions.ts`.
- Data contract: add a migration to `supabase/migrations/` before updating `src/lib/database.types.ts` and query/action code.

**New API integration:**

- Request handler: `src/app/api/<integration>/route.ts`.
- Server-only integration/config helper: `src/lib/<integration>.ts` or `src/lib/config.ts`.
- Do not put normal first-party form mutations in API routes. Use a Server Action under `src/app/` unless the caller is external, webhook-based, or cron-based.

**Utilities:**

- Shared UI primitives: `src/components/primitives/`.
- Reusable shadcn-style controls: `src/components/ui/`.
- Runtime-agnostic helpers and domain functions: `src/lib/`.
- Client-only React behavior: `src/hooks/`.

## Special Directories

**`src/lib/supabase/`:**

- Purpose: Isolate Supabase trust-context setup.
- Generated: No.
- Committed: Yes.
- Constraint: Keep `src/lib/supabase/admin.ts` server-only. Use its service-role client only after an explicit server authorization check.

**`src/messages/`:**

- Purpose: Store locale dictionaries loaded by `src/i18n/request.ts`.
- Generated: No.
- Committed: Yes.
- Constraint: Maintain matching message keys in `src/messages/en.json` and `src/messages/ar.json`.

**`public/brand/`:**

- Purpose: Provide static logo, preloader video, and brand image assets directly from the app origin.
- Generated: No.
- Committed: Yes.

**`scripts/`:**

- Purpose: Store targeted maintenance commands for slug rewriting, translation backfill, duplicate cleanup, and hero-media checks/uploads.
- Generated: No.
- Committed: Yes.
- Constraint: Treat these as explicit operational tools, not request-time application modules.

**`.next/` and `test-results/`:**

- Purpose: Local Next.js build/cache output and Playwright artifacts.
- Generated: Yes.
- Committed: No.

---

*Structure analysis: 2026-07-19*
