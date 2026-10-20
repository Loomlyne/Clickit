# Deferred items (phase 02)

Found during plan 02-01. Out of scope for that plan; not fixed.

1. **Unknown path under an allow-listed prefix returns 500.** `GET /en/auth/sign-in` (no such route) gives 500 on `next start` (Next 16.4.2, local Supabase) and under OpenNext preview; live site gives 404. Likely the root `src/app/not-found.tsx` (`getTranslations` without a locale in the request context). Unknown whether the Next 16.2.9 to 16.4.2 upgrade caused it. Static misses (`/_next/static/x.js`) become 500 under preview for the same reason. Look at it before any gate test asserts 404.
2. **Four `react-hooks/set-state-in-effect` findings** (now warnings): `src/components/admin/shorts-table.tsx:73`, `src/components/admin/shows-table.tsx:87,126`, `src/components/ui/carousel.tsx:103`. Refactor and restore the rule to error.
3. **npm `supabase` package binary is killed on start (exit 137)** in this worktree; Homebrew `supabase` works. Check the install-script approval (npm 11 `allowScripts`) before relying on `npx supabase`.
