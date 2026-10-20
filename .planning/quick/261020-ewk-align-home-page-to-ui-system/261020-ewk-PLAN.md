---
phase: quick-261020-ewk
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/landing/landing-hero.tsx
  - src/components/landing/featured-shorts-strip.tsx
  - src/components/landing/genre-pills.tsx
  - src/components/landing/faq-accordion.tsx
  - src/components/landing/landing-faq.tsx
  - src/messages/en.json
  - src/messages/ar.json
autonomous: true
requirements: [QUICK-261020-ewk]

must_haves:
  truths:
    - "Hero shows two 44px sentence-case buttons: Watch now (primary) and Browse shows (outline) that jumps to #shows"
    - "Hero description is 14px on phones, 16px from md, in ink-2"
    - "Shorts cards use the 11px media radius and a rounded-full 11px 'Short' badge on primary-soft"
    - "Genre pills are 44px neutral outline chips with the category colour only as an 8px dot"
    - "Each FAQ question is a keyboard-operable button with aria-expanded/aria-controls; open shows a minus"
    - "FAQ section has a 16px gutter on phones"
  artifacts:
    - path: "src/components/landing/landing-hero.tsx"
      contains: "heroSecondaryCta"
    - path: "src/components/landing/faq-accordion.tsx"
      contains: "aria-expanded"
    - path: "src/components/landing/genre-pills.tsx"
      contains: "--uis-line-strong"
    - path: "src/messages/en.json"
      contains: "\"heroSecondaryCta\": \"Browse shows\""
    - path: "src/messages/ar.json"
      contains: "\"heroSecondaryCta\": \"تصفح البرامج\""
  key_links:
    - from: "landing-hero.tsx secondary CTA"
      to: "shows-portfolio.tsx section id=\"shows\""
      via: "href=\"#shows\""
      pattern: "href=\"#shows\""
    - from: "faq-accordion.tsx button aria-controls"
      to: "answer region id"
      via: "useId-derived ids"
      pattern: "aria-controls"
---

<objective>
Align the Clickit home page (/[locale]/portfolio) to the UI System tokens from quick 261020-ej8, implementing the four changes Koss signed from the before/after picture on 2026-10-20 (locked decisions 1-5 below).

Purpose: home page matches DESIGN.md (44px targets, sentence case, neutral chips, accessible FAQ, 16px phone gutter).
Output: 5 landing components + 2 message files changed, one code commit. Nothing else.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/koss/Developer/Clickit/CLAUDE.md
@/Users/koss/Developer/Clickit/DESIGN.md
@src/components/landing/landing-hero.tsx
@src/components/landing/featured-shorts-strip.tsx
@src/components/landing/genre-pills.tsx
@src/components/landing/faq-accordion.tsx
@src/components/landing/landing-faq.tsx

Runs on main in the control session, no worktree. Executor commits code only; do NOT stage `.planning/.red-tmp` or any `.planning/` file (orchestrator handles docs).

PRECONDITION FOUND AT PLANNING (2026-10-20): the token commit 93e3a68 ("feat(ui): apply UI System ui.config.json tokens and 44px button target") is on local branch `quick-ui-tokens` only, NOT an ancestor of main (b213b14). On main, src/styles/globals.css has no `--uis-*` block and `--text-dim` is still #a8a8a6. On quick-ui-tokens the needed tokens exist: `--uis-line-strong: #424242`, `--uis-primary-soft: #312915`, `--uis-r-media: 11px`, `--text-dim: #CCCCCC`. This plan uses those tokens; without them the outline borders and badge background render as nothing. Task 1 starts with a gate that stops if they are missing.

<interfaces>
Existing tokens on main (src/styles/globals.css): --bg-2 #1a1a1a, --line, --line-2, --text, --text-dim, --primary #ffcc00, --primary-foreground.
Tokens required from 93e3a68: --uis-line-strong, --uis-primary-soft, --uis-r-media.
Section anchor: src/components/landing/shows-portfolio.tsx renders the section with id="shows" on the same page.
Messages: src/messages/en.json `landing.heroCta` = "Watch now" (already sentence case, no change). src/messages/ar.json `landing.heroCta` (line ~399) = "شاهد الآن" (leave). Note ar.json also has an unrelated "heroCta" around line 129 in another namespace: do not touch it.
featured-shorts-strip.tsx: badge text is the hard-coded literal "SHORT" with static background var(--primary) (no data colour, not a translation key).
genre-pills.tsx: colour = category.color ?? DEFAULT_COLOR ('#8D9CFF'), currently applied inline to border and text.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Hero buttons + i18n key, shorts card restyle</name>
  <files>src/components/landing/landing-hero.tsx, src/messages/en.json, src/messages/ar.json, src/components/landing/featured-shorts-strip.tsx</files>
  <action>
  GATE FIRST: run `grep -q -- '--uis-line-strong' src/styles/globals.css && grep -q -- '--uis-primary-soft' src/styles/globals.css && grep -q -- '--uis-r-media' src/styles/globals.css`. If it fails, make no edits and STOP, reporting "BLOCKED: UI System tokens (commit 93e3a68 on branch quick-ui-tokens) are not on main". Do not merge or cherry-pick it yourself; landing it is the controller's call.

  Hero (per locked decision 1; do not touch HeroBackgroundMedia, the gradients, the logo or data fetching per decision 5):
  - Description p: replace text-[17px] with text-[14px] md:text-[16px]; keep leading-snug and text-[var(--text-dim)] (ink-2).
  - Wrap the CTA in a row: the existing `pointer-events-auto mb-6 md:mb-8` div gets `flex flex-wrap gap-2`.
  - Primary Link (href ctaHref): classes become inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--primary)] px-5 text-[14px] font-medium whitespace-nowrap text-[var(--primary-foreground)] transition-all hover:bg-white. Remove uppercase, tracking-[0.06em], py-3, sm:px-6, sm:py-3.5, sm:text-[15px]. Add aria-hidden="true" to the play svg. Label stays t('heroCta') ("Watch now" already sentence case in en; ar unchanged).
  - Secondary: a plain anchor `<a href="#shows">` (same-page anchor; not the i18n Link, which would prefix a locale path) with classes inline-flex min-h-11 items-center rounded-full border border-[var(--uis-line-strong)] bg-transparent px-5 text-[14px] font-medium whitespace-nowrap text-[var(--text)] transition-colors hover:bg-[var(--bg-2)]. Label t('heroSecondaryCta').
  - Add `"heroSecondaryCta": "Browse shows"` to the `landing` namespace of en.json, and `"heroSecondaryCta": "تصفح البرامج"` to the `landing` namespace of ar.json, placed right after each file's landing `heroCta` key. Keep valid JSON and existing formatting.

  Shorts grid (per locked decision 2):
  - Card div radius rounded-[10px] → rounded-[var(--uis-r-media)] (11px).
  - Badge: replace the inline style and classes with className absolute top-2.5 left-2.5 rounded-full bg-[var(--uis-primary-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--primary)]; text "Short". The label is a hard-coded literal (not a translation key) and has no data colour, so no dot and no message change; update the `{/* SHORT badge */}` comment to `{/* Short badge */}`.
  - Genre line and channel line: text-[10px] text-white/50 → text-[11px] text-[var(--text-dim)]. Keep the `mono` class (decision 5: do not touch fonts).
  - Title div: text-[15px] → text-[14px] md:text-[16px]; keep the display font class.
  </action>
  <verify>
    <automated>cd /Users/koss/Developer/Clickit && node -e "for (const f of ['src/messages/en.json','src/messages/ar.json']) { const j=JSON.parse(require('fs').readFileSync(f,'utf8')); if(!j.landing.heroSecondaryCta) throw f }" && grep -q 'href="#shows"' src/components/landing/landing-hero.tsx && grep -q 'aria-hidden' src/components/landing/landing-hero.tsx && ! grep -nE 'uppercase|text-\[9px\]|text-\[10px\]|text-\[17px\]|tracking-widest|rounded-\[10px\]|SHORT' src/components/landing/landing-hero.tsx src/components/landing/featured-shorts-strip.tsx</automated>
  </verify>
  <done>Gate passed; hero has two 44px sentence-case buttons in a wrap row, the second linking to #shows; both locales have landing.heroSecondaryCta; shorts cards use 11px radius, primary-soft rounded-full 11px "Short" badge, 11px ink-2 meta and 14/16px titles.</done>
</task>

<task type="auto">
  <name>Task 2: Neutral genre chips, accessible FAQ, phone gutter</name>
  <files>src/components/landing/genre-pills.tsx, src/components/landing/faq-accordion.tsx, src/components/landing/landing-faq.tsx</files>
  <action>
  Genre pills (per locked decision 3):
  - Container gap-x-5 gap-y-3 → gap-2.
  - Each Link: className exactly inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--uis-line-strong)] px-4 text-[13px] text-[var(--text-dim)] transition-colors hover:bg-[var(--bg-2)] hover:text-[var(--text)]. Remove mono, uppercase, tracking, hover:opacity-60 and the inline style on the Link.
  - First child of the Link: a span with aria-hidden="true", className size-2 shrink-0 rounded-full, style background = color (category colour is real data, so it stays only as the dot). Then the localized name. Keep DEFAULT_COLOR fallback.

  FAQ accordion (per locked decision 4), keep the 'use client' component and openIdx state (default 0):
  - Import useId from react; const baseId = useId(); per item ids `${baseId}-q-${i}` (button) and `${baseId}-a-${i}` (region).
  - Item wrapper div: remove onClick and cursor-pointer; className border-t border-[var(--line)] py-3 last:border-b.
  - Header: an h3 (heading semantics kept; a button may not contain an h3, so the h3 wraps the button) with className font-[family-name:var(--font-display)] text-[16px] font-medium tracking-[-0.01em] md:text-[20px]. Inside it a `<button type="button">` with id = button id, aria-expanded={openIdx === i}, aria-controls = region id, onClick toggling (openIdx === i ? -1 : i), className flex min-h-14 w-full items-center justify-between gap-6 text-start rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]. Question text in a span with flex-1.
  - Toggle: span aria-hidden="true", className flex size-11 shrink-0 items-center justify-center rounded-full border transition-colors duration-200, open → border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)], closed → border-[var(--line-2)]. Remove rotate-45. Svg width/height 16; path d="M5 12h14" when open (minus), d="M12 5v14M5 12h14" when closed (plus).
  - Answer: the existing grid div gets id = region id, role="region", aria-labelledby = button id, and inert={openIdx !== i} (React 19 boolean; keeps collapsed text out of tab order and the accessibility tree while the grid-rows animation stays). Paragraph text-[16px] → text-[14px] md:text-[16px]; keep max-w, pt-4, leading-relaxed, text-[var(--text-dim)].
  - If tsc rejects inert, use inert={openIdx !== i ? true : undefined}; if still rejected, drop inert and note it in the summary.

  landing-faq.tsx: section px-10 → px-4 sm:px-6 md:px-10. Nothing else changes (data fetching untouched per decision 5).
  </action>
  <verify>
    <automated>cd /Users/koss/Developer/Clickit && grep -q 'type="button"' src/components/landing/faq-accordion.tsx && grep -q 'aria-expanded' src/components/landing/faq-accordion.tsx && grep -q 'aria-controls' src/components/landing/faq-accordion.tsx && grep -q 'role="region"' src/components/landing/faq-accordion.tsx && grep -q 'M5 12h14' src/components/landing/faq-accordion.tsx && ! grep -nE 'rotate-45|text-\[24px\]|cursor-pointer' src/components/landing/faq-accordion.tsx && grep -q 'px-4 sm:px-6 md:px-10' src/components/landing/landing-faq.tsx && ! grep -nE 'uppercase|mono|tracking-|hover:opacity|text-\[9px\]|text-\[10px\]' src/components/landing/genre-pills.tsx && grep -q 'size-2' src/components/landing/genre-pills.tsx</automated>
  </verify>
  <done>Genre chips are 44px neutral outlines with an aria-hidden colour dot; FAQ questions are buttons inside h3s with aria-expanded/aria-controls, regions labelled, 44px toggle showing minus when open; FAQ section has 16px phone gutter.</done>
</task>

<task type="auto">
  <name>Task 3: Gates and single code commit</name>
  <files>src/components/landing/landing-hero.tsx, src/components/landing/featured-shorts-strip.tsx, src/components/landing/genre-pills.tsx, src/components/landing/faq-accordion.tsx, src/components/landing/landing-faq.tsx, src/messages/en.json, src/messages/ar.json</files>
  <action>
  Run sequentially: `npx tsc --noEmit` (must exit 0); `npx eslint` on the five touched .tsx files (must exit 0; do not fix the 137 pre-existing repo-wide lint errors in other files); grep gate across the five landing files for text-[9px], text-[10px], uppercase (must find none). Do not run `npm run build` as a gate: it fails locally at "Collecting page data" with "supabaseUrl is required" because Supabase env vars are absent (pre-existing; do not invent env values). Note this in the summary. Fix only issues introduced by this plan.
  Confirm `git diff --name-only` lists exactly the seven files in files_modified. Commit them as one atomic commit: `feat(landing): align home page to UI System (hero CTAs, shorts, genre chips, FAQ a11y)`, staging the seven files by path only (never `git add -A`; leave `.planning/.red-tmp` untracked).
  </action>
  <verify>
    <automated>cd /Users/koss/Developer/Clickit && npx tsc --noEmit && npx eslint src/components/landing/landing-hero.tsx src/components/landing/featured-shorts-strip.tsx src/components/landing/genre-pills.tsx src/components/landing/faq-accordion.tsx src/components/landing/landing-faq.tsx && ! grep -nE 'text-\[9px\]|text-\[10px\]|uppercase' src/components/landing/landing-hero.tsx src/components/landing/featured-shorts-strip.tsx src/components/landing/genre-pills.tsx src/components/landing/faq-accordion.tsx src/components/landing/landing-faq.tsx && test "$(git show --name-only --format= HEAD | sort | tr '\n' ' ')" = "src/components/landing/faq-accordion.tsx src/components/landing/featured-shorts-strip.tsx src/components/landing/genre-pills.tsx src/components/landing/landing-faq.tsx src/components/landing/landing-hero.tsx src/messages/ar.json src/messages/en.json "</automated>
  </verify>
  <done>tsc exit 0, eslint on touched files exit 0, grep gate clean, one commit containing exactly the seven files; build limitation recorded.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| DB → UI | category.color and FAQ text come from Supabase (admin-entered) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-ewk-01 | Tampering | genre-pills.tsx dot style background | accept | React style object sets one CSS property; no HTML injection; admin-only data, unchanged from current inline border/color usage |
| T-ewk-02 | Information disclosure | faq-accordion.tsx | accept | Rendered as text nodes (no dangerouslySetInnerHTML), public FAQ content |
</threat_model>

<verification>
- Task 3 automated gate passes.
- Manual (UAT by Koss, not self-approved): on /en/portfolio and /ar/portfolio at 375px and desktop: hero shows Watch now + Browse shows, Browse shows scrolls to the shows section; Tab reaches each FAQ question, Enter/Space toggles it, open shows minus; genre chips show a coloured dot with grey text.
</verification>

<success_criteria>
All four signed changes are in code using tokens (no raw hex added), fonts/hero media/data fetching untouched, one commit with seven files, tsc and scoped eslint green.
</success_criteria>

<output>
Create `/Users/koss/Developer/Clickit/.planning/quick/261020-ewk-align-home-page-to-ui-system/261020-ewk-SUMMARY.md` when done (orchestrator commits it).
</output>
