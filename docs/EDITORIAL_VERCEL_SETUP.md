# Editorial Variant — Vercel Deployment Guide

This guide walks you through standing up a **second Vercel project** that
deploys the editorial design variant from the same git branch as
production, so you can A/B compare both designs on live URLs.

Production (`clickit-cit`) stays untouched. The new project (`clickit-editorial`)
sets `NEXT_PUBLIC_DESIGN=editorial` and redeploys automatically alongside it.

## Prerequisites

- Vercel CLI installed and logged in
- Access to the same GitHub repo that `clickit-cit` uses
- All Supabase + cron env vars from the current production project

## Steps

### 1. Get the current env vars from the production project

From the repo root:

```bash
# Pull current clickit-cit env vars into a local .env.production file
vercel env pull .env.production --environment=production
```

Review the file — you'll reuse every value except `NEXT_PUBLIC_DESIGN`.

### 2. Create the new Vercel project

Two ways — pick whichever matches your preference.

**Option A — Vercel CLI (recommended):**

```bash
# From the repo root, but NOT in the clickit-cit worktree
cd /tmp && git clone https://github.com/Loomlyne/Clickit.git clickit-editorial-src
cd clickit-editorial-src

# Link to a NEW Vercel project (answer: new project, name it "clickit-editorial")
vercel link
```

**Option B — Vercel dashboard:**

1. Go to <https://vercel.com/new>
2. Import the same `Loomlyne/Clickit` repo
3. Name the project `clickit-editorial`
4. Do NOT deploy yet — skip to step 3 first

### 3. Set environment variables on the new project

Paste every variable from `.env.production` into the new project via:

```bash
# Run each of these from inside the clickit-editorial linked directory
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add CRON_SECRET production
# ...plus any others from .env.production
```

Then set the design flag that makes this project editorial:

```bash
vercel env add NEXT_PUBLIC_DESIGN production
# When prompted, type: editorial
# Repeat for preview + development if you want the editorial design on
# preview URLs too:
vercel env add NEXT_PUBLIC_DESIGN preview
vercel env add NEXT_PUBLIC_DESIGN development
```

### 4. Deploy

From inside the `clickit-editorial` linked directory:

```bash
vercel --prod
```

Copy the deployment URL printed at the end.

### 5. Assign a memorable alias

Per project memory note: Vercel aliases do **not** auto-update. You have
to set the alias explicitly after each production deploy:

```bash
vercel alias set <deployment-url> clickit-editorial.vercel.app
```

From now on, every push to `main` will trigger a redeploy on BOTH projects
(`clickit-cit` with the default design, `clickit-editorial` with the
editorial design). The production domain stays on `clickit-cit`.

### 6. A/B verify

- Open `https://clickit-cit.vercel.app` — should render the current
  rounded-glassmorphic design (Plus Jakarta + Cairo, rounded-[24px] cards).
- Open `https://clickit-editorial.vercel.app` — should render the editorial
  monochrome design (Newsreader serif display, Space Grotesk UI, JetBrains
  Mono eyebrows, `#ffcc00` accent, sharp 4–8px radii).

Quick DevTools sanity check on the editorial URL:

```js
getComputedStyle(document.documentElement).getPropertyValue('--accent')
// → "#ffcc00"

document.documentElement.getAttribute('data-design')
// → "editorial"
```

## Rollback

If the editorial deploy has a problem, `clickit-cit` is completely unaffected.
To disable editorial on its own URL without taking the project down:

```bash
# From inside the clickit-editorial linked dir
vercel env rm NEXT_PUBLIC_DESIGN production
vercel --prod
```

This redeploys editorial without the flag, which means it renders the
current rounded design (identical to `clickit-cit`).

## Re-pointing production later

If the editorial variant wins the comparison and you want to promote it to
production, just flip `NEXT_PUBLIC_DESIGN=editorial` on the existing
`clickit-cit` project and redeploy. No code changes, no branch switch.

## Known open items (Wave 7+)

- Continue-watching data for the editorial browse page is currently empty
  (`[]` placeholder). Wire `getContinueWatchingEpisodes` + the adapter to
  land this before A/B testing with real signed-in users.
- Full YouTube IFrame API progress tracking on the editorial watch page
  currently falls back to a simple iframe. Swap `WatchPageContent` into
  the `playerSlot` in `src/app/(viewer)/watch/[episodeId]/page.tsx` once
  it's adapted to render inside the editorial chrome.
- `editorial_accent` admin-tunable color: blocked on a Supabase schema
  migration. `#ffcc00` is hardcoded for v1.
