# Roadmap: Clickit Recovery

## Overview

This milestone first establishes recovery delivery guardrails, then runs three isolated implementation lanes for egress and media, database security and integrity, and runtime quality and CI. Those lanes can proceed in parallel from current `origin/main` without sharing a recovery pull request. Production verification closes the milestone only after all three implementation lanes are complete.

## Phases

- [ ] **Phase 1: Delivery Guardrails** - Recovery concerns have isolated review boundaries and remain owner-controlled.
- [ ] **Phase 2: Egress and Media Recovery** - Public media preserves byte ranges, avoids unnecessary downloads, and keeps existing playback working.
- [ ] **Phase 3: Database Security and Integrity** - Public database exposure is restricted while admin access and episode ordering remain correct.
- [ ] **Phase 4: Runtime Quality and CI** - Runtime regressions are cleared and automated checks protect every recovery branch.
- [ ] **Phase 5: Production Verification** - The deployed Clickit project and its projected monthly egress are verified from production evidence.

## Phase Details

### Phase 1: Delivery Guardrails
**Goal**: Recovery changes can be reviewed and released independently without an automatic production merge.
**Depends on**: Nothing (first phase)
**Requirements**: SHIP-01, SHIP-05
**Success Criteria** (what must be TRUE):
  1. Each recovery concern appears in an isolated pull request based on current `origin/main`, with no unrelated recovery concern bundled into it.
  2. Every recovery pull request remains unmerged until the product owner explicitly reviews and approves it.
**Plans**: TBD

### Phase 2: Egress and Media Recovery
**Goal**: Visitors receive only the media bytes they need while existing public media and YouTube playback remain functional.
**Depends on**: Phase 1
**Requirements**: EGR-01, EGR-02, EGR-04
**Success Criteria** (what must be TRUE):
  1. A visitor or HTTP client requesting a byte range through the storage proxy receives HTTP 206, the requested range headers, and only the requested bytes.
  2. Public pages do not fetch large Supabase Storage media until that media is visibly required for the current experience.
  3. Existing public media URLs continue to load in both Arabic and English experiences after the egress fix.
  4. Visitors can still start and use YouTube episode playback after the media delivery changes.
**Plans**: TBD
**UI hint**: yes

### Phase 3: Database Security and Integrity
**Goal**: Public database access reveals only approved published data, while administrators retain safe and atomic editorial workflows.
**Depends on**: Phase 1
**Requirements**: SEC-01, SEC-02, SEC-03, SEC-04, DATA-01, DATA-02, DATA-03
**Success Criteria** (what must be TRUE):
  1. An anonymous database client cannot read secret-bearing application configuration columns.
  2. An anonymous database client cannot read unpublished or base episode video identifiers outside the approved public projection.
  3. An authorized administrator can still read and manage the configuration and episode data required by the existing admin experience.
  4. Reordering multiple episodes either completes as one atomic change or preserves the original order, and the admin interface visibly reports a database failure.
  5. Every database change has a reversible migration and verification query, and generated TypeScript types expose every live column used by the application.
**Plans**: TBD
**UI hint**: yes

### Phase 4: Runtime Quality and CI
**Goal**: Recovery branches meet the application quality baseline and cannot merge without stable automated verification.
**Depends on**: Phase 1
**Requirements**: QUAL-01, QUAL-02, QUAL-03, QUAL-04, SHIP-02, SHIP-03
**Success Criteria** (what must be TRUE):
  1. The production build and strict TypeScript checks pass on each recovery branch.
  2. Lint passes in the touched runtime scope without global rule suppression.
  3. Interactive controls changed during recovery have accessible names and work by keyboard.
  4. Stable end-to-end flows pass for public browsing, episode playback, admin authentication, and admin episode reordering in the supported test environment.
  5. Pull requests run build, typecheck, lint, unit tests, and the stable end-to-end smoke suite, while main-branch protection and security automation are enabled or present an exact owner action when access blocks configuration.
**Plans**: TBD
**UI hint**: yes

### Phase 5: Production Verification
**Goal**: The owner can prove which Clickit revision is live and that its media behavior stays within the Supabase free-plan egress allowance.
**Depends on**: Phases 2, 3, and 4
**Requirements**: EGR-03, SHIP-04
**Success Criteria** (what must be TRUE):
  1. The production operator can verify the Vercel project owner, GitHub linkage, environment variable names, and deployed commit without exposing any secret value.
  2. The production operator can rerun a recorded media measurement that projects Supabase cached egress below 5 GB for a billing cycle.
**Plans**: TBD

## Parallelization

- Phase 1 is the shared prerequisite for all implementation work.
- Phases 2, 3, and 4 are isolated lanes and may execute in parallel through separate pull requests.
- Phase 5 begins only when Phases 2, 3, and 4 have completed verification and the required production-owner access is available.

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Delivery Guardrails | 0/TBD | Not started | - |
| 2. Egress and Media Recovery | 0/TBD | Not started | - |
| 3. Database Security and Integrity | 0/TBD | Not started | - |
| 4. Runtime Quality and CI | 0/TBD | Not started | - |
| 5. Production Verification | 0/TBD | Not started | - |
