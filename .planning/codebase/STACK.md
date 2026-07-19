---
last_mapped_commit: de36f69
---
# Technology Stack

**Analysis Date:** 2026-07-19

## Languages

**Primary:**
- TypeScript 5.9.3, strict mode, for the Next.js application in `src/`, API routes in `src/app/api/`, and server actions in `src/app/`.
- SQL, PostgreSQL dialect, for the Supabase schema and policy history in `supabase/migrations/`.

**Secondary:**
- JavaScript ES modules for maintenance scripts in `scripts/`.
- CSS through Tailwind CSS v4 and its source stylesheet at `src/styles/globals.css`.

## Runtime

**Environment:**
- Node.js, version not pinned by `.nvmrc` or `.node-version`, runs the Next.js 16.2.9 application declared in `package.json`.
- Vercel Functions and Edge-compatible middleware run the application configured by `vercel.json` and `src/proxy.ts`.

**Package Manager:**
- npm, selected by committed `package-lock.json`.
- Lockfile: present, `package-lock.json`.

## Frameworks

**Core:**
- Next.js 16.2.9, App Router with React 19.2.4, application routes under `src/app/`.
- TypeScript 5.9.3 with `strict: true` and `@/*` resolving to `src/*`, configured by `tsconfig.json`.
- Tailwind CSS 4.2.2 with shadcn UI configuration in `components.json` and PostCSS in `postcss.config.mjs`.
- next-intl 4.13.0, English and Arabic routing and request configuration in `src/i18n/` and locale layouts in `src/app/[locale]/`.

**Testing:**
- Node's built-in test runner for unit tests via `npm run test:unit`, targeting `tests/unit/**/*.test.ts`.
- Playwright 1.58.2 is installed for browser testing; no Playwright config file is detected.

**Build/Dev:**
- `next dev`, `next build`, and `next start` scripts in `package.json`.
- React Compiler is enabled in `next.config.ts`; bundle analysis is available through `npm run analyze` and `@next/bundle-analyzer`.
- ESLint 9 with `eslint-config-next` is run by `npm run lint`; Prettier 3 with `prettier-plugin-tailwindcss` is installed.

## Key Dependencies

**Critical:**
- `@supabase/ssr` 0.10.0 and `@supabase/supabase-js` 2.101.0, typed browser, server, middleware, and service-role clients in `src/lib/supabase/`.
- `react-hook-form` 7.72.0 plus `zod` 4.3.6 and `@hookform/resolvers`, form validation in `src/components/auth/` and `src/components/admin/`.
- `next-intl` 4.13.0, localized URL and messages infrastructure in `src/i18n/`.
- `botid` 1.5.11, Vercel BotID configuration in `next.config.ts` and sign-in/up verification in `src/app/[locale]/(viewer)/auth/actions.ts`.

**Infrastructure:**
- `@vercel/analytics` 2.0.1 and `@vercel/speed-insights` 2.0.0, mounted from `src/app/[locale]/layout.tsx`.
- `sharp` 0.34.5, server-side image processing imported by `src/app/[locale]/admin/actions.ts`.
- `motion` 12.38.0, `embla-carousel-react` 8.6.0, and `lenis` 1.3.23 for viewer interaction and motion components in `src/components/`.
- `lucide-react` 1.7.0, `radix-ui` 1.4.3, `vaul` 1.1.2, `sonner` 2.0.7, and `class-variance-authority` 0.7.1 for the UI primitives under `src/components/ui/`.

## Configuration

**Environment:**
- Environment configuration is loaded by Next.js from `.env.local`, which is present and intentionally not read.
- Application runtime requires `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` for Supabase clients in `src/lib/supabase/`.
- Feature-specific server configuration uses `CRON_SECRET`, `GOOGLE_TRANSLATE_API_KEY`, `RESEND_API_KEY`, and optional `RESEND_FROM_EMAIL`, referenced from `src/app/api/` and `src/lib/`.
- Deployment-derived URLs use `NEXT_PUBLIC_SITE_URL`, `VERCEL_PROJECT_PRODUCTION_URL`, and `VERCEL_URL` through `src/lib/site-url.ts`.

**Build:**
- `next.config.ts` enables React Compiler, CSP/security headers, image optimization remote patterns, BotID, next-intl, and optional bundle analysis.
- `vercel.json` deploys in `fra1` and schedules cron routes.
- `supabase/config.toml` configures the local Supabase CLI stack, PostgreSQL 17, Auth, Storage, Realtime, and Studio.

## Platform Requirements

**Development:**
- Node.js with npm, a Supabase project or local Supabase CLI environment, and the environment variable names referenced in `src/lib/supabase/*.ts`.
- Use `npm run gen-types` after schema changes to refresh `src/lib/database.types.ts` from the configured Supabase project.

**Production:**
- Vercel hosts the Next.js application in Frankfurt (`fra1`) as set by `vercel.json`.
- Supabase supplies PostgreSQL, Auth, Storage, and Realtime. GitHub Actions applies migrations from `supabase/migrations/` using `.github/workflows/supabase-migrations.yml`.

---

*Stack analysis: 2026-07-19*
