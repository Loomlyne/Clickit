---
last_mapped_commit: de36f69
---
# Architecture

**Analysis Date:** 2026-07-19

## System Overview

```text
Browser request
  -> `src/proxy.ts` locale, session, coming-soon, and access gates
  -> Next.js App Router in `src/app/`
     -> localized viewer routes, admin routes, or full-screen watch route
     -> Server Components call `src/lib/queries.ts` and `src/lib/config.ts`
     -> typed Supabase clients in `src/lib/supabase/`
  -> Supabase Postgres, Auth, and Storage defined by `supabase/migrations/`

Client interactions
  -> client components, hooks, Server Actions, or protected Route Handlers
  -> Supabase browser client or server-only service-role client
  -> cache invalidation through `revalidatePath` and `updateTag`
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Request boundary | Applies locale redirects, refreshes Supabase cookies, gates coming-soon and protected/admin routes. | `src/proxy.ts` |
| Locale shell | Validates locale, supplies translations, direction, fonts, global styles, metadata, analytics, and toast UI. | `src/app/[locale]/layout.tsx` |
| Viewer shell | Renders public navigation/footer chrome and loads config plus session claims. | `src/app/[locale]/(viewer)/layout.tsx` |
| Watch experience | Uses a separate full-screen route group and supplies serialized episode, show, progress, and preference data to the interactive player shell. | `src/app/[locale]/(watch)/watch/[episodeId]/page.tsx`, `src/components/watch/watch-shell.tsx` |
| Admin experience | Enforces server-side admin identity then renders content-editor UI and mutation actions. | `src/app/[locale]/admin/layout.tsx`, `src/app/[locale]/admin/actions.ts` |
| Read model | Executes typed, cache-aware Supabase reads and maps database rows into viewer shapes. | `src/lib/queries.ts` |
| Configuration model | Reads, normalizes, caches, and exposes the single `app_config` row without confidential integration fields. | `src/lib/config.ts` |
| Persistence boundary | Creates request-scoped, browser, public, middleware, and service-role Supabase clients. | `src/lib/supabase/` |

## Pattern Overview

**Overall:** Next.js App Router with server-rendered feature pages, a Supabase backend, and client islands for media playback and immediate user preferences.

**Key Characteristics:**

- Use route groups to choose viewer chrome in `src/app/[locale]/(viewer)/`, a no-chrome player in `src/app/[locale]/(watch)/`, and the admin shell in `src/app/[locale]/admin/` without changing public URLs.
- Keep database-to-UI shape translation in `src/lib/queries.ts`. Pages request `ViewShow`, `ViewEpisode`, and related types instead of exposing raw database rows to components.
- Keep writes close to their route domain: site-wide contact mutations are in `src/app/actions/contact.ts`, viewer auth/profile mutations are under the corresponding viewer route, and editorial operations are in `src/app/[locale]/admin/actions.ts`.
- Use Supabase RLS for user-owned browser mutations, and use `createAdminClient()` only after server-side authorization for privileged workflows.

## Layers

**Routing and request policy:**

- Purpose: Resolve `/en/*` and `/ar/*`, preserve session cookies, and apply access rules before page rendering.
- Location: `src/proxy.ts`, `src/i18n/routing.ts`, `src/i18n/navigation.ts`.
- Depends on: `next-intl`, `src/lib/supabase/middleware.ts`, `src/lib/config.ts`.
- Used by: Every matched page request, except static assets and root metadata routes excluded in `src/proxy.ts`.

**Rendering and composition:**

- Purpose: Fetch server data, build SEO metadata, and compose feature components.
- Location: `src/app/[locale]/`, `src/components/`.
- Depends on: `src/lib/queries.ts`, `src/lib/config.ts`, `src/lib/locale-server.ts`.
- Used by: Viewer, watch, and admin browser routes.

**Domain reads and configuration:**

- Purpose: Cache catalog/config reads, localize fields, and map database rows to stable view models.
- Location: `src/lib/queries.ts`, `src/lib/config.ts`, `src/lib/scheduling.ts`, `src/lib/locale.ts`.
- Depends on: Server or cookie-free public Supabase clients.
- Used by: Pages, layouts, sitemap generation, and server actions.

**Mutation and integration boundary:**

- Purpose: Validate inputs, authorize requests, perform privileged edits/uploads, communicate with third-party services, and invalidate cache.
- Location: `src/app/[locale]/admin/actions.ts`, `src/app/actions/contact.ts`, `src/app/api/`.
- Depends on: Zod, BotID, Resend, Supabase Admin, YouTube, and Next cache APIs.
- Used by: Client forms and Vercel cron jobs.

**Persistence:**

- Purpose: Store catalog, user data, admin configuration, and media references; enforce authorization in the database.
- Location: `supabase/migrations/`, generated TypeScript schema at `src/lib/database.types.ts`.
- Contains: Postgres tables/views, RLS policies, storage rules, indexes, and migration-managed scheduled-content support.

## Data Flow

### Localized catalog request

1. `src/proxy.ts` redirects missing locale prefixes and refreshes Supabase session cookies before evaluating public and protected routes.
2. `src/app/[locale]/layout.tsx` validates the segment, sets the request locale, loads message JSON from `src/i18n/request.ts`, and provides locale/direction context.
3. A viewer page, such as `src/app/[locale]/(viewer)/series/[slug]/page.tsx`, calls catalog functions from `src/lib/queries.ts`.
4. `src/lib/queries.ts` uses `src/lib/supabase/public.ts` for shared cacheable catalog data, applies `unstable_cache`, then maps raw rows to locale-aware `View*` models.
5. Feature components in `src/components/series/` and `src/components/shows/` render the mapped models.

### Playback and preference updates

1. `src/app/[locale]/(watch)/watch/[episodeId]/page.tsx` loads the episode graph, session, progress, watchlist state, and likes state.
2. `src/components/watch/watch-shell.tsx` receives this initial server state and mounts the YouTube player plus client hooks.
3. `src/hooks/use-progress-tracker.ts` upserts user progress to `watch_progress` every ten seconds, on tab hide, and on unmount using `src/lib/supabase/client.ts`.
4. `src/hooks/use-watchlist.ts` and `src/hooks/use-likes.ts` optimistically mutate the RLS-protected `watchlist` and `likes` tables, reverting UI on error.

### Editorial update

1. Admin UI in `src/components/admin/` invokes a Server Action from `src/app/[locale]/admin/actions.ts`.
2. Each admin action calls the local `assertAdmin()` helper, validates input with Zod, and creates the service-role client only after authorization.
3. The action writes catalog/config/storage state, logs relevant operations through `src/lib/audit.ts`, then calls `revalidatePath` and `updateTag` to refresh reads.
4. Viewer pages reload their cached catalog or `app_config` data through `src/lib/queries.ts` and `src/lib/config.ts`.

### Scheduled operations

1. Vercel schedules defined in `vercel.json` call `src/app/api/cron/publish-scheduled/route.ts` daily and `src/app/api/cron/cleanup-media/route.ts` weekly.
2. Each handler verifies the bearer secret before creating `src/lib/supabase/admin.ts`'s service-role client.
3. Publish jobs promote due episodes/shows and invalidate catalog tags. Cleanup jobs identify unreferenced storage objects and remove only scoped, aged media.

**State Management:**

- Durable shared state is Supabase. User-owned rows are mutated directly from browser hooks under RLS.
- Server-derived page state is passed as props to client islands. Local interaction state stays in React hooks in `src/hooks/` and client components.
- Catalog/config reads use React `cache()` plus Next `unstable_cache`; mutations explicitly revalidate paths and tags.

## Key Abstractions

**Typed Supabase client family:**

- Purpose: Make the minimum-privilege client explicit at each call site.
- Examples: `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`, `src/lib/supabase/public.ts`, `src/lib/supabase/admin.ts`, `src/lib/supabase/middleware.ts`.
- Pattern: Use `server.ts` for request-aware Server Components/actions, `public.ts` inside cacheable public reads, `client.ts` inside browser code, and `admin.ts` only in authorized server code or protected cron handlers.

**View models:**

- Purpose: Separate SQL row names/statuses from component props and apply locale/media/scheduling derivations once.
- Examples: `ViewShow`, `ViewEpisode`, `ViewSeason`, and mapping functions in `src/lib/queries.ts`.
- Pattern: Add new viewer-facing domain data to the mapped view type and its query, then consume that type in components.

**App configuration:**

- Purpose: Centralize editable branding, content, feature flags, integrations, and marketing fields in `app_config` row `id = 1`.
- Examples: `src/lib/config.ts`, `src/components/admin/settings/`, `src/app/[locale]/admin/actions.ts`.
- Pattern: Read public-safe fields through `getAppConfig()`; retain confidential fields in server-only selectors such as `getYouTubeApiKey()`.

## Entry Points

**HTTP request gate:**

- Location: `src/proxy.ts`.
- Triggers: Matched browser/API/OAuth requests.
- Responsibilities: Locale routing, session cookie refresh, coming-soon checks, authentication, and admin-route authorization.

**App root and locale layout:**

- Location: `src/app/layout.tsx`, `src/app/[locale]/layout.tsx`.
- Triggers: All App Router renders.
- Responsibilities: Root handoff plus document shell, locale validation, global providers, metadata, analytics, and security-aware inline integration identifiers.

**Metadata routes:**

- Location: `src/app/sitemap.ts`, `src/app/robots.ts`.
- Triggers: `/sitemap.xml` and `/robots.txt`.
- Responsibilities: Generate crawler metadata outside locale routing.

**OAuth callback:**

- Location: `src/app/auth/callback/route.ts`.
- Triggers: Supabase OAuth return.
- Responsibilities: Exchange callback parameters for session cookies and redirect into a locale-aware app route.

## Architectural Constraints

- **Locale prefixes:** All user-facing routes require `/en` or `/ar`, configured in `src/i18n/routing.ts`; keep root API, OAuth callback, sitemap, and robots locale-free.
- **Authorization:** `src/proxy.ts` is the first access gate, but admin layouts/actions repeat server-side identity checks. Preserve this defense-in-depth boundary.
- **Service role:** `src/lib/supabase/admin.ts` bypasses RLS. Do not import it into client code or unauthenticated Route Handlers.
- **Cached reads:** `unstable_cache` callbacks cannot use request cookies/headers, hence catalog/config cacheable reads use `src/lib/supabase/public.ts` rather than `src/lib/supabase/server.ts`.
- **Global state:** There is no application store. Module-level cache wrappers in `src/lib/queries.ts` and `src/lib/config.ts` are the shared read cache layer.
- **Circular imports:** Not detected in the inspected routing, query, component, and Supabase boundaries.

## Anti-Patterns

### Bypassing view-model mapping

**What happens:** A page or component consumes database rows directly.
**Why it's wrong:** It duplicates localization, status normalization, schedule visibility, and media URL normalization.
**Do this instead:** Add the data to the typed mapping path in `src/lib/queries.ts`, then pass `View*` types to `src/components/`.

### Using the service-role client for normal viewer data

**What happens:** Server code reaches for `src/lib/supabase/admin.ts` outside admin or cron workflows.
**Why it's wrong:** It bypasses database RLS and makes authorization errors application-level rather than database-enforced.
**Do this instead:** Use `src/lib/supabase/server.ts`, `src/lib/supabase/public.ts`, or `src/lib/supabase/client.ts` according to context.

## Error Handling

**Strategy:** Route-level loading/error/not-found files provide rendering fallbacks, while actions and Route Handlers return structured errors or JSON status responses after validation and authorization checks.

**Patterns:**

- Use `notFound()` and `redirect()` in data-dependent pages, as shown by `src/app/[locale]/(watch)/watch/[episodeId]/page.tsx`.
- Return `ActionResult` from editorial mutations in `src/app/[locale]/admin/actions.ts`.
- Return explicit HTTP status codes from `src/app/api/youtube-meta/route.ts` and cron handlers.
- Maintain route-level boundaries through `loading.tsx`, `error.tsx`, and `not-found.tsx` colocated beneath `src/app/[locale]/`.

## Cross-Cutting Concerns

**Logging:** Admin audit records flow through `src/lib/audit.ts`; operational/API failures use server-side console logging in `src/app/api/`.

**Validation:** Zod schemas validate form/action payloads in `src/app/[locale]/admin/actions.ts` and `src/app/actions/contact.ts`; URL/media helpers reside in `src/lib/`.

**Authentication:** Supabase Auth sessions are refreshed in `src/lib/supabase/middleware.ts`, browser identity is accessed through typed clients, and database RLS policies are declared in `supabase/migrations/`.

---

*Architecture analysis: 2026-07-19*
