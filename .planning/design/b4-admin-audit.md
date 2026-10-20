# B4 admin: token audit

Scope: every `admin/*` page and `src/components/admin/**` (67 files). Rules: `ui.config.json`, `src/styles/globals.css`, DESIGN.md (44px targets, nothing under 11px, 4.5:1 contrast, radius roles). Regex scan of the branch after merging phase 1.1 and PR #17 tokens, 2026-10-20. Paths are repo-relative.

| Rule | Hits | Note |
|---|---|---|
| Text under 11px | 9 | all `text-[10px]` |
| Contrast under 4.5:1 | 10 | `text-white/20..40` on `--bg-2` (1.9 to 3.8:1) |
| Off-token colour literals | 20 | hex / rgba in components (21 more are show-identity brand pickers, kept) |
| Tailwind palette colours (not tokens) | 98 | emerald/amber/sky/red/yellow status colours in 20 files |
| Controls under 44px | 94 | Button sm/icon-sm + size-5..9 overrides (checkbox is 16px from 640px up, in shared ui/) |
| Radius off role | 90 | panels/cards at 8px (`rounded-lg`) or ad-hoc 12px; role is card 12 / panel 16 / field 8 |
| Off-token surface alpha | 249 | `bg-white/[0.0x]`, `border-white/8` (= `--line`) instead of `--bg-*` / `--line` |

### Shared components, not edited by B4 (report to controller)
- `src/components/ui/button.tsx`: sizes `xs`/`sm`/`icon`/`icon-xs`/`icon-sm` are 28 to 36px with no 44px hit area. Proposal: add `dense` (36px visual, 44px hit area) and make `icon` 44px on touch.
- `src/components/ui/checkbox.tsx`: 16px from 640px up, `rounded-[10px]`. Proposal: 20px visual, 6px radius, 44px hit area.
- `src/components/ui/select.tsx`: `bg-[#11151d]/98` popover, `rounded-lg` trigger, `white/[0.04]` fill. Proposal: `--popover`, 8px field radius.
- `src/components/ui/table.tsx`: `h-12` header, `py-4` cells, `tracking-[0.18em]`, `white/[0.0x]` fills. Proposal: `h-10`, `py-2.5`, 0.12em, token fills (dense admin tables).
- `src/components/ui/badge.tsx`: uppercase 11px with 0.14em tracking; StatusBadge overrides it locally.

## Text under 11px (9)
- `src/components/admin/admin-header.tsx`: 175 `text-[10px]`
- `src/components/admin/hero-media-picker.tsx`: 234 `text-[10px]`, 287 `text-[10px]`
- `src/components/admin/cast-editor.tsx`: 274 `text-[10px]`
- `src/components/admin/reviews-table.tsx`: 235 `text-[10px]`
- `src/components/admin/episode-form-drawer.tsx`: 334 `text-[10px]`
- `src/components/admin/settings/preloader-video-field.tsx`: 115 `text-[10px]`
- `src/components/admin/settings/genre-color-editor.tsx`: 123 `text-[10px]`
- `src/app/[locale]/admin/audit/page.tsx`: 138 `text-[10px]`

## Contrast under 4.5:1 (10)
White at 20/30/40% on #191919 gives 1.9 / 2.7 / 3.8:1; 50% gives 5.2:1 and passes.
- `src/components/admin/hero-video-manager.tsx`: 92 `text-white/40`, 100 `text-white/40`
- `src/components/admin/settings/footer-editor.tsx`: 299 `text-white/40`
- `src/components/admin/settings/faqs-editor.tsx`: 124 `text-white/20`, 125 `text-white/40`, 149 `text-white/30`
- `src/components/admin/settings/legal-pages-editor.tsx`: 154 `text-white/20`, 155 `text-white/40`
- `src/components/admin/settings/genre-color-editor.tsx`: 126 `text-white/30`
- `src/app/[locale]/admin/audit/page.tsx`: 138 `text-white/40`

## Off-token colour literals (20)
- `src/components/admin/show-form.tsx`: 385 `rgba(`, 395 `#11151d`, 395 `rgba(`, 509 `rgba(`, 519 `#11151d`, 519 `rgba(`
- `src/components/admin/admin-header.tsx`: 123 `rgba(`, 123 `rgba(`, 151 `rgba(`
- `src/components/admin/inbox-recipient-form.tsx`: 46 `rgba(`
- `src/components/admin/cast-editor.tsx`: 161 `rgba(`, 161 `rgba(`
- `src/components/admin/admin-shell.tsx`: 8 `rgba(`, 11 `rgba(`
- `src/app/[locale]/admin/shows/[id]/page.tsx`: 102 `#2e2e2e`, 102 `#171717`
- `src/app/[locale]/admin/shows/[id]/edit/page.tsx`: 33 `#0f0f0f`, 107 `#2e2e2e`, 107 `#171717`, 128 `#0f0f0f`

## Brand-identity hex (allowed: show/category colour data) (21)
- `src/components/admin/categories-manager.tsx`: 107 `#f00`, 107 `#ff0`, 107 `#0f0`, 107 `#0ff`, 107 `#00f`, 107 `#f0f`, 107 `#f00`, 112 `#000000`, 122 `#F8C623`
- `src/components/admin/settings/genre-color-editor.tsx`: 23 `#2C3569`, 24 `#9F54A0`, 25 `#50A258`, 26 `#DB3F34`, 27 `#EA8C2E`, 28 `#F8C623`
- `src/app/[locale]/admin/shows/[id]/edit/page.tsx`: 16 `#2C3569`, 17 `#9F54A0`, 18 `#50A258`, 19 `#DB3F34`, 20 `#EA8C2E`, 24 `#6073FF`

## Tailwind palette colours (98)
- `src/components/admin/show-form.tsx`: 116 `text-red-400`, 119 `text-red-400`
- `src/components/admin/archive-table.tsx`: 451 `text-amber-500`, 463 `border-amber-500/20`, 463 `bg-amber-500/5`, 477 `text-amber-400`, 497 `text-amber-400`, 509 `border-amber-500/20`, 509 `bg-amber-500/5`, 520 `text-amber-400`
- `src/components/admin/shows-table.tsx`: 248 `text-emerald-200`, 253 `text-amber-100`, 396 `text-amber-200`, 497 `fill-amber-300`, 497 `text-amber-300`
- `src/components/admin/cast-editor.tsx`: 280 `text-red-400`, 280 `text-red-300`
- `src/components/admin/schedule-episodes-button.tsx`: 123 `border-amber-500/25`, 123 `bg-amber-500/10`, 123 `text-amber-200`, 141 `text-amber-400`
- `src/components/admin/categories-manager.tsx`: 685 `text-red-400`, 685 `text-red-300`
- `src/components/admin/status-badge.tsx`: 10 `border-emerald-400/25`, 10 `bg-emerald-500/14`, 10 `text-emerald-200`, 10 `bg-emerald-500/14`, 15 `border-amber-400/25`, 15 `bg-amber-500/14`, 15 `text-amber-100`, 15 `bg-amber-500/14`, 25 `border-sky-400/25`, 25 `bg-sky-500/14`, 25 `text-sky-100`, 25 `bg-sky-500/14`, 30 `border-red-400/25`, 30 `bg-red-500/14`, 30 `text-red-100`, 30 `bg-red-500/14`
- `src/components/admin/shorts-table.tsx`: 356 `text-red-400`, 367 `text-yellow-400`, 367 `text-yellow-300`, 367 `text-yellow-400`, 377 `fill-yellow-400`, 437 `text-red-400`, 437 `text-red-300`
- `src/components/admin/hero-video-manager.tsx`: 94 `text-emerald-400`, 100 `text-emerald-400`, 111 `bg-emerald-500`
- `src/components/admin/reviews-table.tsx`: 175 `border-amber-500/20`, 175 `bg-amber-500/10`, 175 `text-amber-100`, 275 `text-red-400`, 275 `text-red-300`
- `src/components/admin/short-form-drawer.tsx`: 232 `text-red-400`, 275 `text-red-400`, 283 `text-red-400`
- `src/components/admin/settings/footer-editor.tsx`: 173 `text-red-300`, 295 `text-red-300`
- `src/components/admin/settings/advanced-tab.tsx`: 352 `text-orange-300`
- `src/components/admin/settings/faqs-editor.tsx`: 172 `text-red-300`
- `src/components/admin/settings/legal-pages-editor.tsx`: 197 `text-red-300`
- `src/components/admin/settings/top-ticker-editor.tsx`: 207 `text-red-300`
- `src/components/admin/settings/auth-page-editor.tsx`: 155 `bg-emerald-500`
- `src/components/admin/settings/branding-tab.tsx`: 72 `text-amber-300/80`, 96 `text-sky-300/80`
- `src/app/[locale]/admin/archive/page.tsx`: 74 `border-yellow-500/20`, 74 `bg-yellow-500/8`, 75 `text-yellow-400`, 77 `text-yellow-100`, 80 `text-yellow-100/65`
- `src/app/[locale]/admin/audit/page.tsx`: 64 `bg-emerald-500/10`, 64 `text-emerald-300`, 64 `border-emerald-500/20`, 65 `bg-sky-500/10`, 65 `text-sky-300`, 65 `border-sky-500/20`, 66 `bg-amber-500/10`, 66 `text-amber-300`, 66 `border-amber-500/20`, 67 `bg-purple-500/10`, 67 `text-purple-300`, 67 `border-purple-500/20`, 68 `bg-rose-500/10`, 68 `text-rose-300`, 68 `border-rose-500/20`, 69 `bg-indigo-500/10`, 69 `text-indigo-300`, 69 `border-indigo-500/20`, 70 `bg-cyan-500/10`, 70 `text-cyan-300`, 70 `border-cyan-500/20`, 71 `bg-orange-500/10`, 71 `text-orange-300`, 71 `border-orange-500/20`, 97 `border-rose-500/20`, 97 `bg-rose-500/10`, 97 `text-rose-200`

## Controls under 44px (excludes loading skeletons) (94)
- `src/components/admin/archive-table.tsx`: 293 `size="sm"`, 305 `size="sm"`, 385 `size="sm"`, 402 `size="sm"`, 451 `size-5`, 539 `h-8`
- `src/components/admin/edit-show-button.tsx`: 15 `size="sm"`
- `src/components/admin/archive-episodes-table.tsx`: 155 `size="sm"`, 174 `size="sm"`
- `src/components/admin/season-tabs.tsx`: 172 `size="sm"`, 185 `size="sm"`, 127 `h-8`
- `src/components/admin/hero-media-picker.tsx`: 348 `size="sm"`, 279 `size-6`, 318 `size-6`, 327 `size-6`
- `src/components/admin/shows-table.tsx`: 320 `size="sm"`, 433 `size="icon-sm"`, 453 `size="icon-sm"`, 473 `size="icon-sm"`, 512 `size="icon-sm"`, 527 `size="icon-sm"`
- `src/components/admin/episodes-table.tsx`: 207 `size="icon-sm"`, 223 `size="icon-sm"`, 241 `size="sm"`, 254 `size="sm"`
- `src/components/admin/cast-editor.tsx`: 139 `size="sm"`, 231 `size="sm"`, 241 `size="sm"`, 179 `size-5`, 181 `size-5`, 189 `h-6`, 280 `h-6`
- `src/components/admin/schedule-episodes-button.tsx`: 102 `size="sm"`
- `src/components/admin/categories-manager.tsx`: 188 `size="icon-sm"`, 631 `size="icon-sm"`, 652 `size="icon-sm"`, 673 `size="icon-sm"`, 684 `size="icon-sm"`, 101 `size-8`, 144 `size-5`
- `src/components/admin/hero-video-manager.tsx`: 299 `size="sm"`, 378 `size="sm"`, 110 `h-6`, 115 `size-5`, 341 `size-5`, 348 `size-5`
- `src/components/admin/settings/footer-editor.tsx`: 188 `size="sm"`, 284 `size-9`, 293 `size-6`, 299 `size-9`
- `src/components/admin/settings/advanced-tab.tsx`: 156 `size="sm"`, 343 `size-8`, 377 `h-6`, 382 `size-5`
- `src/components/admin/settings/faqs-editor.tsx`: 116 `size="sm"`, 127 `size="sm"`, 124 `size-8`, 163 `size-8`, 172 `size-8`
- `src/components/admin/settings/legal-pages-editor.tsx`: 146 `size="sm"`, 156 `size="sm"`, 154 `size-8`, 188 `size-8`, 197 `size-8`
- `src/components/admin/settings/preloader-video-field.tsx`: 124 `size="sm"`, 135 `size-5`, 140 `size-5`
- `src/components/admin/settings/top-ticker-editor.tsx`: 136 `size="sm"`, 116 `h-6`, 121 `size-5`
- `src/components/admin/settings/genre-color-editor.tsx`: 86 `size="sm"`, 111 `size-6`
- `src/components/admin/settings/image-upload-field.tsx`: 100 `size="sm"`
- `src/app/[locale]/admin/inbox/page.tsx`: 94 `size="sm"`
- `src/app/[locale]/admin/shows/[id]/edit/page.tsx`: 99 `size="sm"`, 49 `size-9`
- `src/components/admin/admin-header.tsx`: 136 `h-6`, 136 `h-7`, 165 `size-5`
- `src/components/admin/shorts-table.tsx`: 367 `size-8`, 388 `size-8`, 407 `size-8`, 426 `size-8`, 437 `size-8`
- `src/components/admin/reviews-table.tsx`: 235 `h-7`, 275 `size-8`
- `src/components/admin/artwork-upload-zone.tsx`: 110 `size-6`, 136 `size-8`, 174 `size-6`
- `src/components/admin/admin-profile-card.tsx`: 32 `size-5`
- `src/components/admin/settings/auth-page-editor.tsx`: 154 `h-6`, 159 `size-5`
- `src/app/[locale]/admin/archive/page.tsx`: 75 `size-5`

## Radius off role (90)
- `src/components/admin/show-form.tsx`: 376 `rounded-lg`, 385 `rounded-lg`, 509 `rounded-lg`, 395 `rounded-[12px]`, 405 `rounded-[12px]`, 433 `rounded-[12px]`, 519 `rounded-[12px]`, 538 `rounded-[12px]`
- `src/components/admin/archive-table.tsx`: 463 `rounded-lg`, 509 `rounded-lg`
- `src/components/admin/hero-media-picker.tsx`: 344 `rounded-lg`
- `src/components/admin/shows-table.tsx`: 291 `rounded-lg`
- `src/components/admin/inbox-recipient-form.tsx`: 46 `rounded-lg`, 70 `rounded-[12px]`
- `src/components/admin/cast-editor.tsx`: 150 `rounded-lg`, 254 `rounded-lg`, 295 `rounded-lg`
- `src/components/admin/schedule-episodes-button.tsx`: 123 `rounded-lg`, 133 `rounded-lg`
- `src/components/admin/categories-manager.tsx`: 174 `rounded-lg`, 251 `rounded-lg`
- `src/components/admin/hero-video-manager.tsx`: 88 `rounded-lg`, 267 `rounded-lg`, 277 `rounded-lg`, 340 `rounded-lg`, 347 `rounded-lg`, 373 `rounded-lg`
- `src/components/admin/reviews-table.tsx`: 175 `rounded-lg`
- `src/components/admin/artwork-upload-zone.tsx`: 109 `rounded-lg`, 122 `rounded-lg`, 173 `rounded-lg`
- `src/components/admin/short-form-drawer.tsx`: 240 `rounded-lg`
- `src/components/admin/episode-form-drawer.tsx`: 325 `rounded-lg`
- `src/components/admin/admin-shell.tsx`: 8 `rounded-lg`, 11 `rounded-lg`
- `src/components/admin/settings/advanced-tab.tsx`: 283 `rounded-lg`, 308 `rounded-lg`, 341 `rounded-lg`
- `src/components/admin/settings/preloader-video-field.tsx`: 104 `rounded-lg`, 134 `rounded-lg`, 139 `rounded-lg`
- `src/components/admin/settings/top-ticker-editor.tsx`: 102 `rounded-lg`, 149 `rounded-lg`, 165 `rounded-[12px]`, 182 `rounded-[12px]`, 199 `rounded-[12px]`
- `src/components/admin/settings/genre-color-editor.tsx`: 101 `rounded-lg`
- `src/components/admin/settings/auth-page-editor.tsx`: 140 `rounded-lg`, 107 `rounded-[12px]`, 117 `rounded-[12px]`
- `src/components/admin/settings/image-upload-field.tsx`: 87 `rounded-lg`, 112 `rounded-lg`, 117 `rounded-lg`
- `src/components/admin/settings/branding-tab.tsx`: 61 `rounded-lg`, 70 `rounded-lg`, 94 `rounded-lg`
- `src/app/[locale]/admin/archive/page.tsx`: 74 `rounded-lg`
- `src/app/[locale]/admin/inbox/[id]/page.tsx`: 62 `rounded-lg`, 67 `rounded-lg`
- `src/app/[locale]/admin/shows/[id]/edit/page.tsx`: 33 `rounded-lg`
- `src/components/admin/settings/footer-editor.tsx`: 79 `rounded-[12px]`, 92 `rounded-[12px]`, 105 `rounded-[12px]`, 136 `rounded-[12px]`, 165 `rounded-[12px]`, 284 `rounded-[8px]`, 299 `rounded-[8px]`
- `src/components/admin/settings/faqs-editor.tsx`: 209 `rounded-[12px]`, 223 `rounded-[12px]`, 241 `rounded-[12px]`, 259 `rounded-[12px]`, 281 `rounded-[12px]`
- `src/components/admin/settings/legal-pages-editor.tsx`: 230 `rounded-[12px]`, 246 `rounded-[12px]`, 261 `rounded-[12px]`, 277 `rounded-[12px]`, 289 `rounded-[12px]`, 305 `rounded-[12px]`
- `src/components/admin/settings/site-metadata-editor.tsx`: 106 `rounded-[12px]`, 123 `rounded-[12px]`
- `src/components/admin/settings/portfolio-tab.tsx`: 103 `rounded-[12px]`, 121 `rounded-[12px]`
- `src/components/admin/settings/cta-copy-editor.tsx`: 89 `rounded-[12px]`, 98 `rounded-[12px]`, 112 `rounded-[12px]`, 122 `rounded-[12px]`, 133 `rounded-[12px]`, 146 `rounded-[12px]`, 157 `rounded-[12px]`, 167 `rounded-[12px]`
