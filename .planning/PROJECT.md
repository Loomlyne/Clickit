# Clickit Recovery

## What This Is

Clickit is a bilingual Arabic and English story platform with a public episode experience and an authenticated admin system for managing stories, episodes, media, and site configuration. This recovery milestone fixes the current bandwidth, security, data-integrity, deployment, and quality failures without disrupting the live product.

## Core Value

The live Clickit experience must remain available and correct while monthly Supabase cached egress stays within the 5 GB free-plan allowance.

## Requirements

### Validated

- ✓ Visitors can browse published stories and episodes in Arabic and English, existing
- ✓ Visitors can play episode video through YouTube embeds, existing
- ✓ Authorized administrators can manage stories, episodes, characters, and configuration, existing
- ✓ The application uses Supabase for authentication, PostgreSQL, and storage, existing
- ✓ The production web application deploys through Vercel from GitHub, existing

### Active

- [ ] Stop the storage proxy from converting small range requests into full-object downloads
- [ ] Reduce recurring Supabase cached egress below 5 GB per billing cycle
- [ ] Remove anonymous access to sensitive configuration and unpublished video identifiers
- [ ] Make episode reordering atomic and surface database failures
- [ ] Regenerate database types so application types match the live schema
- [ ] Fix current lint, accessibility, and end-to-end regressions without product redesign
- [ ] Add CI and repository protections that catch regressions before deployment
- [ ] Verify the production deployment owner, project linkage, and deployed commit

### Out of Scope

- Moving the project to a second account as the first response, it hides the traffic defect and risks downtime
- Self-hosted video infrastructure, the product standard is YouTube embeds
- New product features or visual redesign, this milestone is operational recovery
- Destructive database or storage migration without a verified rollback path

## Context

- Supabase project `lajguozmtissnnfccmej` reported 8.351 GB cached egress against a 5 GB free allowance.
- A 1 KB Range request through `/api/cdn/storage` returned the full 40 to 50 MB object, while the same request directly to Supabase returned HTTP 206 with 1024 bytes.
- Anonymous database reads expose the `youtube_api_key` configuration column and base `episodes.youtube_video_id` field.
- Generated TypeScript database types are missing live schema columns.
- Episode reordering performs multiple non-transactional updates and ignores errors.
- Baseline build, typecheck, and unit tests pass. Lint and the full end-to-end suite do not.
- GitHub repository protection and security automation are incomplete.
- Local Vercel CLI access is not currently authenticated to the Clickit owner account.

## Constraints

- **Availability**: Every change ships through an isolated branch and pull request, main is not edited directly.
- **Budget**: Supabase cached egress must stay below 5 GB monthly on the free plan.
- **Compatibility**: Existing public URLs, bilingual content, admin workflows, and YouTube playback must continue working.
- **Security**: No credential values may be printed, committed, or moved into browser-readable configuration.
- **Data safety**: Database changes must be additive or reversible and verified before production application.
- **Deployment**: Vercel changes require authenticated access to the `clickitstory@gmail.com` owner account.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Fix the Range proxy before considering an account transfer | The proxy defect multiplies traffic and would follow the application to another account | — Pending |
| Keep video on YouTube embeds | This is the existing product standard and avoids storage egress | — Pending |
| Split work into independently reviewable PRs | Egress, database, and runtime fixes have different rollback and verification paths | — Pending |
| Do not merge automatically | The live product must not change before review and checks | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition**:
1. Move invalidated requirements to Out of Scope with the reason.
2. Move verified requirements to Validated with the phase reference.
3. Add newly discovered requirements to Active.
4. Record decisions and their outcomes.
5. Confirm that What This Is still matches the product.

**After each milestone**:
1. Review all sections.
2. Confirm the Core Value remains the priority.
3. Recheck Out of Scope decisions.
4. Update Context with current production evidence.

---
*Last updated: 2026-07-19 after recovery initialization*
