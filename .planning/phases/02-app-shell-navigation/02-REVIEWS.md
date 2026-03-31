---
phase: 02
reviewers: [codex]
reviewed_at: 2026-04-01T00:00:00Z
plans_reviewed: [02-01-PLAN.md, 02-02-PLAN.md]
---

# Cross-AI Plan Review — Phase 02

## Codex Review

**Plan 01 Review**

**Summary**
Plan 01 is mostly well-scoped for the shell work: it cleanly separates layout chrome from later auth behavior, uses existing design tokens, and keeps the navbar as a server component. The main weaknesses are traceability drift against the original NAVG-01 success criteria, brittle test strategy, and a tendency to validate implementation details instead of user-visible outcomes.

**Strengths**
- Clear separation of concerns: shell first, auth interactivity later.
- Uses the existing stack correctly: App Router, Tailwind v4, shadcn, existing tokens.
- Good accessibility baseline with `nav` landmark, skip link, and `main#main`.
- Sensible fixed-nav offset with `pt-16`, which avoids the most common overlap bug.
- Avoids overcomplicating the navbar with scroll listeners or client-side layout state.
- Good choice to keep the navbar itself server-rendered.

**Concerns**
- HIGH: The plan does not actually satisfy the literal phase success criterion that calls for links to `Home`, `Series`, `Coming Soon`, `My List`, `Search`, and `Profile placeholder`. It satisfies the later design decision, not the original criterion. That needs explicit reconciliation in roadmap/requirements, not just plan prose.
- MEDIUM: Playwright is added early, but the tests are mostly checking class names like `backdrop-blur-lg`, `fixed`, `pt-16`, and `bg-background`. That is fragile and not strong evidence that the UI behaves correctly.
- MEDIUM: `webServer.command: 'npm run dev'` is convenient locally but less stable for repeatable E2E runs than testing against a built app.
- MEDIUM: The plan adds test infrastructure but does not define where it fits in CI or whether it is meant to be temporary local-only validation.
- LOW: The home page placeholder is enough for shell verification, but it does not strongly support the stated "feels like a real streaming platform" goal.

**Suggestions**
- Update the requirement or success criteria first if the minimal-nav decision is final. Do not leave a contradiction between plan and spec.
- Change E2E assertions to focus more on behavior and computed visibility, less on exact utility classes.
- Prefer Playwright against `next start` for reliable verification, even if local authoring still uses `next dev`.
- Add one screenshot or visual regression checkpoint if "premium glass effect" is a real acceptance criterion.
- Clarify whether Playwright is phase infrastructure for the project or only for this phase.

**Risk Assessment**
MEDIUM. The implementation path is straightforward, but the plan has a spec mismatch and weak verification strategy. It will likely produce the intended UI, but not with strong traceability.

---

**Plan 02 Review**

**Summary**
Plan 02 completes the shell interaction cleanly and keeps the client surface narrow, which is good. The biggest issue is that it introduces fake auth behavior as a blocker for phase completion without clearly marking it as demo-only UI, and it still under-tests the actual interactive behavior it claims to validate. It also conflicts with the project's operating rule about live deployment verification by relying on localhost human QA.

**Strengths**
- Good server/client boundary: navbar stays server-side, auth becomes a small client island.
- Reuses existing primitives instead of hand-rolling menus or buttons.
- Mock auth state is simple and easy to replace later.
- Dropdown content matches the intended IA for future personalization.
- The blocking human verification step is useful for a visual phase.

**Concerns**
- HIGH: The plan claims "all E2E tests pass" as a success criterion, but it does not add the missing E2E coverage for the actual auth interactions: Sign In toggle, avatar dropdown open, menu items visible, Sign Out toggle back.
- HIGH: The plan relies on localhost for human verification, which conflicts with the project instruction to verify via real deployed infrastructure and never give localhost URLs.
- MEDIUM: The mock auth state is UI-only, but the plan does not explicitly define a replacement seam for Supabase auth in Phase 8. Temporary UI can become sticky debt if not isolated behind a stable interface.
- MEDIUM: Dropdown items `My List` and `Profile` are presented as active actions even though those routes/features are not implemented in this phase. That creates a UX trap unless they are disabled or clearly placeholder-only.
- LOW: `UserAvatar` is a button rendered inside `DropdownMenuTrigger asChild`; that is fine, but it should ideally include `type="button"` to avoid accidental form-submit behavior if reused elsewhere.

**Suggestions**
- Add explicit E2E tests for auth interactions.
- Mark auth components as demo-only in code comments or naming so future replacement is obvious.
- Either disable placeholder dropdown items or wire them to safe placeholder routes to avoid dead interactions.
- Replace localhost-only verification with a deployment verification step on Vercel.
- Add `type="button"` to the avatar trigger component.

**Risk Assessment**
MEDIUM. The build itself is simple, but the validation gap is real, and the localhost-only checkpoint is misaligned with project operating constraints.

---

## Consensus Summary

### Key Concerns (from Codex)
1. **Spec drift** — Plans satisfy design decisions but not original success criteria literally
2. **Brittle E2E tests** — Testing CSS class names rather than user-visible behavior
3. **Localhost-only verification** — Conflicts with project rule to verify on deployed Vercel URLs
4. **Missing auth interaction tests** — No E2E coverage for Sign In/Out toggle, dropdown behavior
5. **Placeholder dead-ends** — My List, Profile dropdown items lead nowhere

### Strengths
- Clean server/client boundary (navbar server, auth island client)
- Correct use of existing design system tokens and primitives
- Good accessibility foundation (landmarks, skip link)
- Simple mock auth state easy to replace in Phase 8

### Actionable Items for Future Phases
- Prefer behavior-based E2E assertions over class-name checks
- Always verify on Vercel deployment, never localhost
- Define replacement seams when adding temporary/mock functionality
- Reconcile plan decisions with original success criteria in ROADMAP
