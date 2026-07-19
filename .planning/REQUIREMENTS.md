# Requirements: Clickit Recovery

**Defined:** 2026-07-19
**Core Value:** The live Clickit experience must remain available and correct while monthly Supabase cached egress stays within the 5 GB free-plan allowance.

## v1 Requirements

### Egress and Media

- [ ] **EGR-01**: A byte-range request through the application storage proxy returns HTTP 206 and only the requested byte range.
- [ ] **EGR-02**: Public application pages do not download large Supabase Storage media that is not visibly required.
- [ ] **EGR-03**: Production media behavior has a repeatable measurement showing projected cached egress below 5 GB per billing cycle.
- [ ] **EGR-04**: Existing public media URLs and YouTube episode playback remain functional after the egress fix.

### Database Security

- [ ] **SEC-01**: Anonymous users cannot read secret-bearing application configuration columns.
- [ ] **SEC-02**: Anonymous users cannot read unpublished or base episode video identifiers outside the approved public projection.
- [ ] **SEC-03**: Authorized administrators retain required configuration and episode-management access.
- [ ] **SEC-04**: Every database change includes an explicit reversible migration and verification query.

### Data Integrity

- [ ] **DATA-01**: Reordering multiple episodes completes atomically or leaves the original order unchanged.
- [ ] **DATA-02**: The admin interface surfaces a failed reorder instead of reporting success.
- [ ] **DATA-03**: Generated TypeScript database types include every live column used by the application.

### Runtime Quality

- [ ] **QUAL-01**: The production build and TypeScript checks pass on the recovery branches.
- [ ] **QUAL-02**: Existing lint errors are fixed in the touched runtime scope without suppressing rules globally.
- [ ] **QUAL-03**: Interactive controls changed by the recovery work have accessible names and keyboard behavior.
- [ ] **QUAL-04**: End-to-end tests for public browsing, episode playback, admin authentication, and admin reorder pass against the supported test environment.

### Delivery Safety

- [ ] **SHIP-01**: Each recovery concern is delivered through an isolated pull request based on current `origin/main`.
- [ ] **SHIP-02**: CI runs build, typecheck, lint, unit tests, and the stable end-to-end smoke suite before merge.
- [ ] **SHIP-03**: GitHub main-branch protection and security automation are enabled or their access blocker is documented with exact owner action.
- [ ] **SHIP-04**: The Vercel production project owner, GitHub linkage, environment names, and deployed commit are verified without exposing secret values.
- [ ] **SHIP-05**: No recovery pull request is merged automatically.

## v2 Requirements

### Infrastructure Portability

- **PORT-01**: The application has a rehearsed Supabase export and restore procedure for a future account move.
- **PORT-02**: Storage assets have a verified manifest and checksum process for provider migration.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Immediate transfer to another Supabase account | It resets counters but does not repair the egress multiplier and creates avoidable downtime risk |
| Self-hosted episode video | Existing architecture and cost control require YouTube embeds |
| Product redesign | The milestone targets operational correctness and safety |
| Automatic PR merge or production database mutation | Review and authenticated owner verification are required first |

## Traceability

Roadmap generation will map every v1 requirement to one phase.

**Coverage:**
- v1 requirements: 20 total
- Mapped to phases: 0
- Unmapped: 20

---
*Requirements defined: 2026-07-19*
*Last updated: 2026-07-19 after initial definition*
