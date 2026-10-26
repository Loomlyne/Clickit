---
phase: 05-accounts-and-email
plan: 28
subsystem: email
tags: [email, outbox, support, newsletter, double-opt-in, forms, tdd]
requires: ["05-11", "05-12", "05-16"]
provides: [supportKeys, newsletterKey, stripHeaderBreaks, supportOutcome, newsletterOutcome, isConfirmedSubscriber, support auto-reply + admin copy via outbox, newsletter confirm via outbox, support confirmation panel, newsletter pending states]
affects: [05-31, 05-39, 05-40]
tech-stack:
  added: []
  patterns: ["save first, then enqueue; a thrown enqueue becomes 'error' and never loses the row", "pure outcome mapping in contact-core, action only wires I/O"]
key-files:
  created:
    - src/server/email/contact-core.ts
    - tests/unit/support-mail.test.ts
  modified:
    - src/app/actions/contact.ts
    - src/lib/contact.ts
    - src/components/support/contact-form.tsx
    - src/components/layout/newsletter-signup-form.tsx
    - src/app/[locale]/admin/inbox/page.tsx
    - .planning/phases/05-accounts-and-email/deferred-items.md
  deleted:
    - src/lib/resend.ts
key-decisions:
  - "05-28: support = insert, then support_ack (sender, page locale, static) and support_admin (adminAll, Reply-To sender); only a thrown enqueue gives saved_email_failed; a thrown admin enqueue marks notification_status failed ('enqueue failed')"
  - "05-28: newsletter confirm key n = epoch seconds of the send; confirm_sent_at written only when the enqueue is queued; confirmed (active + confirmed_at) rows get no write and no email"
  - "05-28: re-signup of a non-active row that still has confirmed_at clears confirmed_at, so the 05-29 confirm (writes only where confirmed_at is null) can confirm again"
  - "05-28: page locale comes from useLocale() in both client forms (no page edits)"
requirements-completed: []
duration: 8min
completed: 2026-10-26
---

# Phase 5 Plan 28: Support and newsletter mail through the outbox Summary

**Support messages are saved first and then outboxed as a static auto-reply to the sender (page language) plus one admin copy per `admins` row with Reply-To = the sender. Newsletter sign-ups become `pending` rows with an outboxed 7-day confirm email and never say "subscribed" before the click. The direct Resend calls, the newsletter admin alert and `src/lib/resend.ts` are gone.**

## Tasks

| # | Task | Commit |
|---|------|--------|
| 1 RED | Failing tests for the contact core | `90f61588` |
| 1 GREEN | `src/server/email/contact-core.ts` | `6d0f6053` |
| 2 | Actions through the outbox, form states, inbox, `resend.ts` removed | `d0957448` |

## What was built

- **`contact-core.ts`** (pure, no imports): `supportKeys`, `newsletterKey` (refuses a non-integer or negative n), `stripHeaderBreaks` (CR/LF runs to one space, trim, 200 cap), `supportOutcome`, `newsletterOutcome`, `isConfirmedSubscriber`.
- **`contact.ts` actions**: zod and `guardAction('support' | 'newsletter', ...)` unchanged (Turnstile + rate limits as Phase 2 built them; `supabaseRateLimitStore(createAdminClient())` kept, an existing test pins it).
  - Support: insert, then `enqueueEmail` `support_ack` (`to: { email, locale }`, `data: {}`), then `support_admin` (`to: { adminAll: true }`, name/email/subject through `stripHeaderBreaks`, message as typed, `replyTo` = sender). Each call is wrapped; a throw logs `[contact] enqueue failed kind=<kind>` only (no error text, which could quote an address).
  - Newsletter: read by `normalized_email`; a confirmed row returns `already_subscribed` with no write. Otherwise upsert `status: 'pending'`, `locale`, merged interests; enqueue `newsletter_confirm` with key `newsletter_confirm:<id>:<epoch seconds>`; `confirm_sent_at` set only when queued.
  - `getContactRecipient`, `escapeHtml`, the `sendTransactionalEmail` import and the "New newsletter signup" admin email are removed.
- **`lib/contact.ts`**: optional `locale` (`en|ar`) on both schemas; newsletter statuses `pending_confirmation | pending_recent | already_subscribed | saved_email_failed`.
- **Contact form** (UI-SPEC 6.13): success replaces the form with the green panel (`role="status"`, `CheckCircle2` 20px, heading `support.sentTitle` takes focus via `tabIndex={-1}`, `support.sentBody` with the email in `<bdi>` and `{hours}` = `SUPPORT_REPLY_HOURS` from `@/lib/email-constants`, outline `support.sendAnother` restores the empty form). No toast on success or saved_email_failed; the orange inline note shows `savedEmailFailedInline`.
- **Newsletter form** (UI-SPEC 6.12): `statusPending` and `statusPendingRecent` ({minutes} = 10) with a 16px `Mail` icon in `--text-dim`; `statusAlreadySubscribed` with the accent `Check`; `statusOfflineSaved` for an enqueue failure; `statusSent`/`statusUpdated` no longer used. Compact button's accessible name is always `newsletter.submitAria`, SVG `aria-hidden`. Typed email stays.
- **Inbox**: subscriber status column shows `confirmed` when `confirmed_at` is set, else `pending` (selects `confirmed_at` instead of `notification_status`). Support rows keep the notification badge (mirrored by `finish_outbox`).

## Verification

Verified:
- Task 1 verify: `support-mail.test.ts` 18 pass, 0 fail (RED first: module not found).
- Task 2 verify chain (tsc, eslint, `resend.ts` absent, no `sendTransactionalEmail|@/lib/resend` in src, 3 `enqueueEmail(` in contact.ts, `guardAction('support'`): exit 0.
- Acceptance greps: no `src/emails|@/emails` in `src/components` or the support page; one `email-constants` line in contact-form; no `statusSent|statusUpdated` in the newsletter form.
- `npm run test:unit`: 2653 pass, 0 fail. `npx tsc --noEmit`: exit 0. eslint on all touched files: 0 errors (one pre-existing `react-hooks/incompatible-library` warning on `watch('terms')` in contact-form).
- Build, detached under the lock with the placeholder public env (`cf:build && cf:bundle-budget`, HEAD `d0957448`): log `/Users/koss/.clickit-checks/p5-28-build.log` ends `exit=0`. The JSON-import stop did not fire. The new action chunk is in `.open-next` (`[contact] enqueue failed` present), "New newsletter signup" absent, `[email/queue-local]` absent from the Next server.

## Worker bundle

```
bundle-budget ok gzip=2974.34 KiB total=14559.35 KiB budget=3000 KiB headroom=25.66 KiB
```

Before (quick 261026-nad): 2,974.94 KiB gzip, headroom 25.06 KiB. This plan: -0.60 KiB gzip (the removed Resend helper and inline HTML outweigh the enqueue import).

Not verified:
- No action ran against the shared local stack or in a browser (no Mailpit auto-reply/admin copy/confirm mail, no real cap hit). 05-31 / 05-39 / 05-40 cover the end-to-end proof.
- RTL look of the support panel and newsletter lines on `/ar` (pictures and UAT).

Failed: none.

## Deviations from Plan

1. **[Rule 1 - Bug] Re-signup of a paused/unsubscribed row with an old `confirmed_at`.** The plan says keep `confirmed_at` as is, but the 05-29 confirm action only writes where `confirmed_at is null`, so such a row would stay `pending` forever and the link would say "already subscribed". The upsert now clears `confirmed_at` for a non-active row that still has one. No code sets those statuses today and live has 0 rows (D-33), so nothing changes for current data. Commit `d0957448`.
2. **[Rule 2 - Correctness] `confirm_sent_at` is written only when the confirm email is queued** (not before the enqueue), so a capped or failed attempt does not move the timestamp. Key n is still the epoch seconds of the send, as planned.
3. **[Rule 2 - Correctness] A thrown admin-copy enqueue marks the message `notification_status = 'failed'`, `notification_error = 'enqueue failed'`**, because no outbox row exists for `finish_outbox` to mirror; the inbox badge would otherwise stay `pending`.
4. **[Rule 2 - Security] `name` and `email` in the admin-copy payload also go through `stripHeaderBreaks`** (name reaches the preheader; email is the Reply-To source). The message text is kept as typed.
5. **[Minor] `isConfirmedSubscriber` extra pure export** (tested), used by the action before any write.
6. **[Minor] Locale from `useLocale()`** inside both client forms instead of a page prop, so the two page files did not change.
7. **[Minor] No toast on saved_email_failed either**; the inline note carries it (UI-SPEC 6.13 "no toast"). `support.messageSent` and `support.savedEmailFailedToast` are now unused (deferred-items).
8. **[Minor] Confirmed rows get no interests merge** (old code updated interests and said `updated_preferences`, which the plan removed).

## NEEDS KOSS

NEEDS KOSS: the Admin Inbox "Notification receiver" panel no longer routes any email (support admin copies now go to each admin's sign-in email, the newsletter alert is gone); it only edits the footer contact address, and its copy ("Support messages and newsletter signup alerts are sent to this email.") is now wrong. Remove the panel, or keep it as "Footer contact email" with new wording? (Logged in deferred-items.md; not changed here.)

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. T-05-28-01 (Turnstile + limits unchanged, RPC caps, static auto-reply), T-05-28-02 (`stripHeaderBreaks`, zod email, enqueue-core CR/LF and email checks), T-05-28-03 (pending until the 05-29 button confirm), T-05-28-04 (admin copy only to admins rows via `adminAll`; queue messages carry `{ outboxId }` only) are in place.

## Requirements

MAIL-05 and MAIL-06 stay Pending until a real send is proven (local Mailpit run and live UAT); this plan builds the sending half.

## Self-Check: PASSED

Files exist (`contact-core.ts`, `support-mail.test.ts`; `resend.ts` absent) and commits `90f61588`, `6d0f6053`, `d0957448` are in `git log`.
