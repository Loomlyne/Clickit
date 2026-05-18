# Requirements - v2.3 Safe Ownership Transfer

**Milestone:** v2.3
**Total:** 24 requirements across 6 gated phases
**Generated:** 2026-05-18
**Mode:** gated handoff, no step advances without required details

Source of truth: `.planning/milestones/v2.3-REQUIREMENTS.md`

---

## Required Details Gate

No phase can start until that phase's required details are filled.

Minimum details needed before Phase 35:

- Recipient legal or business name
- Recipient email
- GitHub username or organization
- Vercel account or team slug
- Supabase organization
- Domain registrar account owner
- Secret handoff method outside chat
- Transfer model
- Maintenance window
- Rollback window
- Final approver

## Requirements

### Gate Rules

- [ ] **GATE-01**: Every phase starts with a required-details checklist. Missing details stop the phase.
- [ ] **GATE-02**: No destructive transfer action happens until a tested rollback path exists.
- [ ] **GATE-03**: New-owner systems are verified with temporary URLs before the production domain moves.
- [ ] **GATE-04**: Secrets are never shared in chat or committed to git.

### Ownership Intake

- [ ] **OWN-01**: Confirm recipient identity across GitHub, Vercel, Supabase, and domain registrar.
- [ ] **OWN-02**: Confirm transfer model.
- [ ] **OWN-03**: Confirm maintenance window, rollback window, and final approver.
- [ ] **OWN-04**: Inventory current production state.

### GitHub Handoff

- [ ] **GH-01**: Recipient has accepted GitHub access and can clone the repo.
- [ ] **GH-02**: Recipient can push a harmless branch or transferred repo is visible in their organization.
- [ ] **GH-03**: Branch protection, secrets, deploy keys, and app permissions are documented or recreated.
- [ ] **GH-04**: Original repo remains available until new production is verified.

### Supabase Migration

- [ ] **SB-01**: Recipient Supabase project exists and billing state is confirmed.
- [ ] **SB-02**: Schema, migrations, RLS, functions, triggers, and generated types are migrated.
- [ ] **SB-03**: Production data is exported and imported with row counts checked.
- [ ] **SB-04**: Storage buckets, object paths, and bucket privacy settings are migrated.
- [ ] **SB-05**: Auth settings, redirect URLs, OAuth providers, admin user, and app_config are recreated.
- [ ] **SB-06**: Old Supabase project stays online during rollback window.

### Vercel Migration

- [ ] **VC-01**: Recipient Vercel project is connected to recipient GitHub repo.
- [ ] **VC-02**: Env vars are recreated in the correct Vercel scopes.
- [ ] **VC-03**: Preview deployment builds and loads core pages against recipient Supabase.
- [ ] **VC-04**: Production deployment reaches Ready before domain changes.
- [ ] **VC-05**: Cron routes, deployment protection, framework settings, Node version, and aliases match.

### Domain Cutover

- [ ] **DNS-01**: Current DNS records are captured before edits.
- [ ] **DNS-02**: New Vercel project has the custom domain added and verified.
- [ ] **DNS-03**: DNS cutover happens only after preview verification passes.
- [ ] **DNS-04**: Production domain returns 200 for core verification URLs.

### Final Verification

- [ ] **VERIFY-01**: Viewer flow works.
- [ ] **VERIFY-02**: Auth flow works.
- [ ] **VERIFY-03**: Admin flow works.
- [ ] **VERIFY-04**: Supabase data, storage URLs, auth redirects, and Vercel env vars point to recipient-owned accounts.
- [ ] **VERIFY-05**: Old accounts are kept for rollback, then access is reduced or removed.

## Traceability

| Requirement | Phase |
|---|---|
| GATE-01..04, OWN-01..04 | Phase 35 |
| GH-01..04 | Phase 36 |
| SB-01..06 | Phase 37 |
| VC-01..05 | Phase 38 |
| DNS-01..04 | Phase 39 |
| VERIFY-01..05 | Phase 40 |
