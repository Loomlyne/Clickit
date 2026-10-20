# Phase 3: Production Cutover - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-20
**Phase:** 03-production-cutover
**Mode:** work session cannot ask Koss directly (control-session rule). All gray areas selected; the recommended option was taken for each and marked PENDING KOSS. Questions with options: `03-DISCUSS-QUESTIONS.md` (relayed by the controller as NEEDS KOSS).
**Areas:** Vercel and rollback (Q1–Q4), Domain (Q5–Q6), Media (Q7–Q9), Crons and CAPTCHA (Q10–Q11), Email (Q12–Q15).

| Q | Area | Options | Taken (pending Koss) |
|---|------|---------|----------------------|
| 1 | Vercel access | A one sign-in from the owner / B plan without access | A, with B as the built-in fallback |
| 2 | When Vercel loses the DB | A at proof-window close / B right after the flip | A |
| 3 | Proof window | A 7 days / B 14 / C 3 | A |
| 4 | Rollback authority | A pre-approved on named triggers / B always his step | A |
| 5 | Apex | A keep 301 to www / B Worker serves apex | A |
| 6 | Flip time | A Tue–Thu 10:00 Dubai / B late night | A |
| 7 | R2-first media | A before the flip / B at the flip | A |
| 8 | DB rewrite timing | A after old keys off / B during window after a read-only proof | A |
| 9 | picsum posters | A leave, list / B empty them | A |
| 10 | Worker crons | A publish on at 00:55, refresh every run, cleanup off / B both off | A |
| 11 | Supabase CAPTCHA | A at window close / B at flip | A |
| 12 | Resend account | A account of current key / B new client account | A |
| 13 | Resend region | A eu-west-1 / B us-east-1 | A |
| 14 | DMARC | A p=none 2 weeks then quarantine (Phase 5) / B quarantine now | A |
| 15 | Contact sender | A no-reply@ / B hello@ | A |

## Claude's discretion recorded
- D-07 flip by Worker route + proxy switch, not custom domain (no NXDOMAIN gap; one-switch rollback).
- D-11 backup table through a normal migration and the approved workflow; rewrite as a reviewed SQL file after a local pg_dump.

## Facts that shaped the questions
Vercel crons call `*.vercel.app` (not www); cleanup-media keeps only Supabase-URL-referenced files; Supabase legacy keys switch off together; Vercel cert stops renewing after DNS leaves; custom domain needs the CNAME deleted first. Sources in 03-DISCUSS-QUESTIONS.md.
