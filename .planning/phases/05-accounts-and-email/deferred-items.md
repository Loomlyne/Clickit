# Phase 5 deferred items (out of scope for the plan that found them)

## Found in 05-11 (2026-10-21)

- **Shell footer lines 1 and 2 keep the light footer colour in dark mode.** `src/emails/components.ts` `Footer` renders "Clickit Story · Spacelight Studios ..." and "Help: ..." as `<p style="color:#767676">` with no `cs-footer` class. The dark rule `.cs-footer{color:#A1A1A1 !important}` sits on the parent `<td>`, and the inline colour on the `<p>` wins over inheritance, so in `prefers-color-scheme: dark` those two lines stay #767676 on the #101010 card (about 4.2:1, under 4.5:1). The help link and the 05-11 extra footer lines (digest reason, unsubscribe/Profile, postal line) carry `cs-footer` and switch correctly. Fix belongs to the signed 05-07 shell: add `className: 'cs-footer'` to the two `<p>` in `Footer`, then rebuild `supabase/templates` (05-10) and `src/generated/app-email-templates.json` (05-11). Not changed in 05-11 (shell owned by 05-07; changes the signed look's dark footer).

## Found in 05-28 (2026-10-26)

- **Admin Inbox "Notification receiver" panel no longer controls any email.** Since 05-28 the support admin copy goes to every `admins` row's sign-in email (D-31) and the newsletter admin alert is dropped (D-32), so `InboxRecipientForm` on `/admin/inbox` only edits `footer_content.contactEmail` (the footer's contact address). Its copy (`admin.inboxPage.receiverDescription` "Support messages and newsletter signup alerts are sent to this email.", `receiverLabel`, `receiverFallback`) is now wrong. Remove the panel, or keep it as "Footer contact email" with new copy: needs Koss's word and wording (owner-visible). Not changed in 05-28 (not in the plan's file list; copy not signed).
- **`support.messageSent` and `support.savedEmailFailedToast` message keys are unused** after the 05-28 contact form change (UI-SPEC 6.13: no toast). Left in en/ar JSON; remove in a messages clean-up.
