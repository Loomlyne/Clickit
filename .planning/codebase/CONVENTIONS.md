---
last_mapped_commit: de36f69b4405113cfc2d12b445fed3f8566a5dad
---
# Coding Conventions

**Analysis Date:** 2026-07-19

## Naming Patterns

**Files:**
- Use kebab-case filenames throughout `src/`, such as `src/lib/auth-navigation.ts`, `src/components/admin/show-form.tsx`, and `src/app/actions/contact.ts`.
- Name Next.js special files by framework convention, including `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, and route-handler `route.ts` under `src/app/`.

**Functions:**
- Use camelCase for functions and exports. Pure helper names state the result, for example `getSafeAuthNextPath` in `src/lib/auth-navigation.ts` and `resolveHeroMedia` in `src/lib/hero-media.ts`.
- Use action verbs for Server Actions, for example `createShow`, `updateEpisode`, and `uploadArtwork` in `src/app/[locale]/admin/actions.ts`.

**Variables:**
- Use camelCase for local values and descriptive result names such as `parsed`, `profileError`, `fieldErrors`, and `isEdit` in `src/app/actions/contact.ts` and `src/components/admin/show-form.tsx`.
- Use SCREAMING_SNAKE_CASE for module constants, such as `LOCALE_PREFIX_RE` in `src/lib/auth-navigation.ts` and `DEFAULT_FOOTER` in `src/lib/config.ts`.

**Types:**
- Use PascalCase for component props, input types, and result unions, for example `ShowFormData` in `src/components/admin/show-form.tsx` and `AuthResult` in `src/app/[locale]/(viewer)/auth/actions.ts`.
- Infer types from Zod schemas with `z.infer<typeof schema>` when a schema is the source of truth, as in `src/lib/contact.ts`.

## Code Style

**Formatting:**
- Run Prettier with the settings in `.prettierrc`: two-space indentation, single quotes, no semicolons, trailing commas where valid, and Tailwind class sorting through `prettier-plugin-tailwindcss`.
- Keep TypeScript strict. `tsconfig.json` sets `strict: true`, `noEmit: true`, bundler resolution, and the `@/*` alias for `src/*`.

**Linting:**
- Run `npm run lint`, which invokes the flat ESLint configuration in `eslint.config.mjs` with Next Core Web Vitals, Next TypeScript, and Prettier compatibility.
- Keep generated and planning output out of lint scope as configured in `eslint.config.mjs`, notably `.next/`, `.vercel/`, `out/`, `build/`, and `.planning/`.
- Use a tightly scoped `eslint-disable-next-line` only for typed interop that cannot be expressed otherwise, as in the Supabase JSON casts in `src/app/[locale]/admin/actions.ts`; do not blanket-disable rules.

## Import Organization

**Order:**
1. React, framework, and third-party imports, for example `react-hook-form`, Zod, and `sonner` in `src/components/support/contact-form.tsx`.
2. Internal absolute imports using `@/`, grouped by component, application action, and library use.
3. Type-only imports using `import type`, such as `Database` in `src/components/admin/show-form.tsx` and `Json` in `src/app/actions/contact.ts`.

**Path Aliases:**
- Import source modules with `@/` rather than long relative paths. The alias is defined in `tsconfig.json`, and is used consistently in `src/app/actions/contact.ts` and `src/components/admin/show-form.tsx`.
- Unit tests use relative imports to the source under test, for example `../../src/lib/hero-media.ts` in `tests/unit/hero-media.test.ts`.

## Error Handling

**Patterns:**
- For user-facing Server Actions, validate first, then return serializable discriminated results such as `{ ok: false, code, message }` or `{ success: false, error }`. Follow `src/app/actions/contact.ts` and `src/app/[locale]/admin/actions.ts`.
- Use Zod on both client forms and mutation boundaries. `src/components/support/contact-form.tsx` uses `zodResolver(contactSchema)` while `src/app/actions/contact.ts` re-validates with `supportMessageSchema.safeParse(input)`.
- For query-page absence, use `notFound()` or `redirect()` in route pages, such as `src/app/[locale]/(watch)/watch/[episodeId]/page.tsx`.
- Throw only where a Server Action must stop an impossible or unauthorized flow, as in `src/app/[locale]/(viewer)/profile/actions.ts`; callers otherwise receive result objects.
- Preserve an in-app recovery UI using segment-level error boundaries in `src/app/[locale]/(viewer)/error.tsx`, `src/app/[locale]/(watch)/error.tsx`, and `src/app/[locale]/admin/error.tsx`.

## Logging

**Framework:** `console`

**Patterns:**
- Prefix contextual failures with a stable subsystem label, such as `[auth]` in `src/app/[locale]/(viewer)/auth/actions.ts`, `[contact]` in `src/app/actions/contact.ts`, and `[admin/actions]` in `src/app/[locale]/admin/actions.ts`.
- Log operational failures server-side and return safe action results to the UI. Do not put environment values or credential contents in log messages.

## Comments

**When to Comment:**
- Document non-obvious policy, security, and fallback behavior directly above the branch it explains. Examples include the BotID availability policy in `src/app/[locale]/(viewer)/auth/actions.ts` and the mobile media priority chain in `src/lib/hero-media.ts`.
- Use requirement IDs sparingly in E2E tests, as in `tests/e2e/home.spec.ts`, when they trace a concrete product or design check.

**JSDoc/TSDoc:**
- Use block comments for exported pure functions with a non-obvious contract or fallback order, as in `src/lib/hero-media.ts`. Ordinary components and simple helpers rely on clear names and types.

## Function Design

**Size:**
- Keep pure transformations isolated in `src/lib/` and renderable components in `src/components/`. Large mutation collections are centralized in `src/app/[locale]/admin/actions.ts`, grouped by resource and schema.

**Parameters:**
- Accept typed objects for multi-field data. Use explicit primitives only for focused operations, such as `getSafeAuthNextPath(raw, fallback)` in `src/lib/auth-navigation.ts`.

**Return Values:**
- Return `null` for an expected absent optional result, as `resolveHeroMedia` does in `src/lib/hero-media.ts`.
- Return a typed status union for expected mutation failures, and include field errors when form inputs need inline feedback, as in `src/lib/contact.ts` and `src/app/actions/contact.ts`.

## Module Design

**Exports:**
- Export concrete symbols directly from their source file. There are no application barrel files. Import from paths such as `@/components/ui/button` and `@/lib/supabase/server`.
- Mark client-interactive modules with `'use client'` at the top, for example `src/components/support/contact-form.tsx`; mark Server Action modules with `'use server'`, for example `src/app/actions/contact.ts`.

**Barrel Files:**
- Not used. Add new modules as direct, kebab-case files and import them directly.

---

*Convention analysis: 2026-07-19*
