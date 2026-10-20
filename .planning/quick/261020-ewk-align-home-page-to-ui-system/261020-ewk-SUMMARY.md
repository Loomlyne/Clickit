---
status: complete
quick_id: 261020-ewk
commit: 2941fa8
branch: ui-system-home
---
# 261020-ewk: Align home page to UI System

Signed by Koss 2026-10-20 (all four sections) from the before/after picture.

- Hero: sentence-case 44px "Watch now" + new outline "Browse shows" (#shows anchor; i18n `landing.heroSecondaryCta` en/ar); description 14/16px.
- Shorts grid: 11px media radius, "Short" pill badge (primary-soft), meta 11px ink-2, titles 14/16px.
- Genre chips: 44px neutral outline pills, 13px ink-2 text, category colour as an 8px dot (coloured text failed contrast).
- FAQ: real `<button>` with aria-expanded/aria-controls, region answers, 44px toggle with plus/minus, 16px phone gutter.

Gates: tsc exit 0; eslint on the 5 touched files exit 0; no text-[9px]/text-[10px]/uppercase left in them.
Not run: `npm run build` / visual render (no Supabase env locally; pre-existing). Visual check needs a preview with env.
