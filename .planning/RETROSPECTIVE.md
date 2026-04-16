# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — CIT Streaming Platform

**Shipped:** 2026-04-16
**Phases:** 11 | **Plans:** 27 | **Timeline:** 16 days

### What Was Built
- Netflix-style cinematic streaming platform with dark UI, auto-rotating hero, content rails, and per-brand color glow effects
- Full watch experience: YouTube IFrame API player, prev/next navigation, cross-season autoplay with countdown, resume from saved position
- Supabase backend with 7 tables, RLS, admin auth, and all 15 CIT programs seeded
- Complete admin dashboard: show/season/episode CRUD, artwork upload, archive with conflict resolution
- Personalization: watchlist, continue watching rail, progress tracking, profile with watch history
- Search via Postgres FTS, broadcast schedule, genre filtering, catalog-aware empty states

### What Worked
- **Frontend-first approach** — building UI with mock data before backend let the client validate the visual direction early. Mock-to-real migration (Phase 8) was clean because component interfaces were already stable
- **Phase granularity** — 10 fine-grained phases kept each deliverable focused and verifiable. Average plan execution was ~10 minutes
- **Brand color static maps** — solving Tailwind v4 dynamic class limitation once (Phase 3) prevented recurring issues in every subsequent phase
- **Hybrid YouTube strategy** — lite embed for catalog (saves ~500KB), full IFrame API for watch page. Clean separation, no over-engineering
- **Server/client component boundaries** — establishing RSC patterns early (Phase 2 AuthSection as client island) made every subsequent phase consistent

### What Was Inefficient
- **Phase 6.1 insertion** — cinematic redesign should have been part of Phase 3 or planned from the start. Inserting a decimal phase mid-milestone added coordination overhead
- **07-04 summary gap** — one plan executed without writing its SUMMARY.md, requiring retroactive cleanup at milestone close
- **Verification gaps** — Phases 6.1 and 7 never got VERIFICATION.md files. Caught by audit but should have been caught in-flow
- **Nyquist compliance** — only 2/11 phases fully compliant. Validation infrastructure exists but wasn't consistently used

### Patterns Established
- `brandColorBgMap`/`TextMap`/`HexMap` static maps for Tailwind v4 dynamic colors
- Server component with client island pattern (AuthSection, ShowCard hover)
- `createPublicClient()` for `unstable_cache` compatibility (no cookies)
- Three-step swap for episode reorder (avoids unique constraint violation)
- `getCatalogStage()` pattern for adaptive empty states

### Key Lessons
1. Write SUMMARY.md immediately after plan execution — never defer
2. Run verification as part of plan completion, not as a separate step later
3. Frontend-first with mock data is the right approach for client-facing visual platforms
4. 10-minute average plan execution proves fine granularity works for this project size
5. Decimal phase insertions (6.1) work but should be the exception, not the pattern

### Cost Observations
- 286 commits across 16 days
- 13,259 LOC TypeScript shipped
- ~27 plans at ~10 min avg = ~4.5 hours total execution time
- Biggest phases by time: Phase 9 (personalization), Phase 7 (admin CRUD)

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Avg Plan Time | Verification Coverage |
|-----------|--------|-------|---------------|----------------------|
| v1.0 | 11 | 27 | ~10 min | 9/11 phases verified |

### Recurring Issues
- Summary/verification gaps when plans are pre-implemented or verified-only
- Nyquist validation infrastructure underused

### Patterns That Persisted
- Frontend-first approach
- Fine-grained phases (1-3 plans each)
- Brand color static maps
- Server/client island boundaries
