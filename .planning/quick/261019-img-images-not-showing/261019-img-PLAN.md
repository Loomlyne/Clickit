---
phase: quick-261019-img
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - next.config.ts
autonomous: false
requirements: [QUICK-IMG]
must_haves:
  truths:
    - "Images load when the build points at any Supabase project, not only lajguozmtissnnfccmej"
    - "No image goes through /_next/image (no sharp on Workers, no transform quota)"
    - "npm run lint, npm run test:unit and npm run build pass"
    - "No live DB write, no secret, no deploy without Koss"
---

Koss approved in chat (2026-10-19): "Do the necessary".

1. `images.unoptimized: true` in next.config.ts.
2. Supabase image host derived from NEXT_PUBLIC_SUPABASE_URL; the legacy host stays allowed.
3. CSP img-src gains the Supabase origin only when it is local http.
4. Gate: lint, unit tests, build.

Out of scope: R2 loader and resizing (Phase 4), data or bucket copies (owner-gated).
