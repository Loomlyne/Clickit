# AGENTS.md

## Cursor Cloud specific instructions

### Product overview

Clickit Story (CIT) is a Next.js 16 streaming platform (viewer + admin) backed by Supabase. See `CLAUDE.md` for stack and architecture.

### Services

| Service | Required? | Notes |
|---------|-----------|-------|
| **Next.js dev server** | Yes | `npm run dev` → http://localhost:3000 |
| **Supabase** | Yes | Hosted project **or** local via Docker (`npx supabase start`) |
| **Docker** | For local Supabase only | Cloud VMs do not start Docker automatically |

### First-time / manual setup (not in update script)

1. **Docker daemon** — if using local Supabase, start Docker before `supabase start`:
   ```bash
   sudo dockerd > /tmp/dockerd.log 2>&1 &
   sudo chmod 666 /var/run/docker.sock   # until user is in docker group
   ```
2. **Local Supabase** — from repo root:
   ```bash
   npx supabase start          # applies migrations + seed on first run
   npx supabase status -o env  # copy ANON_KEY, SERVICE_ROLE_KEY, API_URL
   ```
3. **`.env.local`** (gitignored) — minimum:
   ```
   NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase status>
   SUPABASE_SERVICE_ROLE_KEY=<from supabase status>
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```
   For hosted Supabase, use the Vercel-linked project (`lajguozmtissnnfccmej` in `package.json` `gen-types` script) and pull keys from the dashboard or Vercel env.

### CSP + local Supabase caveat

`next.config.ts` CSP `connect-src` allows `https://*.supabase.co` but **not** `http://localhost:54321`. Server-rendered pages work against local Supabase; **browser-side** Supabase calls (sign-in form, reviews realtime, watchlist toggles) fail with "Failed to fetch" until you either:

- use a **hosted** Supabase URL (matches `*.supabase.co`), or
- extend CSP `connect-src` for dev to include `http://localhost:54321` / `http://127.0.0.1:54321`.

Auth-gated routes (`/watch`, `/browse`, `/series/*`, episode watch) require a signed-in session. Public routes include `/portfolio`, `/auth`, `/about`, `/support`.

### Standard commands

See `package.json` scripts:

| Task | Command |
|------|---------|
| Install deps | `npm install` |
| Dev server | `npm run dev` |
| Lint | `npm run lint` (pre-existing errors in repo) |
| Unit tests | `npm run test:unit` |
| Production build | `npm run build` |
| E2E tests | `npx playwright test` (needs Playwright browsers: `npx playwright install chromium`; assumes live Supabase + seeded data) |

### Dev server in Cloud Agent VMs

Use a named tmux session so the server survives across tool calls:

```bash
SESSION_NAME="next-dev-server"
tmux -f /exec-daemon/tmux.portal.conf has-session -t "=$SESSION_NAME" 2>/dev/null \
  || tmux -f /exec-daemon/tmux.portal.conf new-session -d -s "$SESSION_NAME" -c "$PWD" -- "${SHELL:-zsh}" -l
tmux -f /exec-daemon/tmux.portal.conf send-keys -t "$SESSION_NAME:0.0" 'npm run dev' C-m
```

### Hello-world verification flow

With Supabase seeded and an authenticated session:

1. `/en/portfolio` — public landing (FAQ, branding)
2. `/en/series/last-call` — series detail with seeded episodes
3. `/en/watch/<episode-uuid>` — episode player (YouTube embed; seed uses `dQw4w9WgXcQ`)

Demo user for local Supabase: create via Auth API or sign-up UI (if CSP allows). Example: `demo@clickit.local` / `DemoPass123!`.
