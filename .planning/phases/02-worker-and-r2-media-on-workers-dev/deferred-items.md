# Deferred items (phase 02)

Found during plan 02-01. Out of scope for that plan; not fixed.

1. **Unknown path under an allow-listed prefix returns 500.** `GET /en/auth/sign-in` (no such route) gives 500 on `next start` (Next 16.4.2, local Supabase) and under OpenNext preview; live site gives 404. Likely the root `src/app/not-found.tsx` (`getTranslations` without a locale in the request context). Unknown whether the Next 16.2.9 to 16.4.2 upgrade caused it. Static misses (`/_next/static/x.js`) become 500 under preview for the same reason. Look at it before any gate test asserts 404.
2. **Four `react-hooks/set-state-in-effect` findings** (now warnings): `src/components/admin/shorts-table.tsx:73`, `src/components/admin/shows-table.tsx:87,126`, `src/components/ui/carousel.tsx:103`. Refactor and restore the rule to error.
3. **npm `supabase` package binary is killed on start (exit 137)** in this worktree; Homebrew `supabase` works. Check the install-script approval (npm 11 `allowScripts`) before relying on `npx supabase`.

Found during plan 02-13 (out of scope; not fixed).

4. **Newsletter form without `?show=` never submits.** `NewsletterSignupForm` registers hidden inputs `interestSlug` / `interestTitle` with `value=""`; `newsletterSignupSchema` has `.min(1).optional()` on both, so an empty string fails validation and `handleSubmit` stops silently (only the email error is rendered). Seen on local preview at `/en/updates` (no status, no network call); with `/en/updates?show=<slug>` the same form submits and shows the status line. Fix: send `undefined` (not `""`) for empty hidden values, or accept `""` in the schema. Predates 02-13.
5. **`/en/updates` (the only page that renders `NewsletterSignupForm` today) is behind the sign-in gate.** There is no footer newsletter on this branch, so the signed "footer newsletter" placement is applied through the shared form component and was checked on `/en/updates` only.
6. **Local preview CSP blocks the local Supabase** (`connect-src` / `img-src` allow only `https://*.supabase.co`), so browser-side Supabase calls (password reset request) and Supabase-hosted images fail on `cf:preview` against the local stack. 02-14 owns the CSP builder: add the local origin for preview builds only.

_Item 6 resolved by plan 02-14: the preview build CSP now carries the local Supabase and loopback media origins (preview target only)._

Found during plan 02-16 (out of scope; not fixed).

7. **`removePreloaderVideo` still deletes a Supabase Storage original.** It uses `stageMirroredPublicMediaDeletion` (Supabase remove plus R2 mirror), so removing a preloader video that still points at Supabase deletes the Supabase object. `removeHeroVideo` and `setHeroVideoUrl` no longer do (R2-only ports, 02-16). MEDIA-07 says Supabase is emptied only after Koss approves. Move it onto the R2 ports (a `removePreloaderVideoCore` next to the hero one) when the old preloader actions go (02-19) or earlier if the admin can reach it before the cutover.
8. **Between 02-16 and 02-18 the admin hero upload button fails.** `saveHeroVideoUpload` (legacy) now calls the R2 core, which refuses a Supabase-signed-upload path with "Invalid upload key". The old `createPreloaderVideoUpload`/`savePreloaderVideoUpload` and `createShowVideoUpload`/`saveShowVideoUpload` are untouched and still work against Supabase until 02-19. 02-18 switches the clients to `finalize*VideoUpload`; nothing is deployed from this branch before that.
9. **A `moov` box larger than 4 MiB is only partly scanned for the audio track.** Finalize reads the first 4 MiB. `moovBytes` returns what is inside that window; a hero video whose `moov` is bigger than that and whose sound track starts after the window would be refused as "no audio track". A 50 MB cap makes this very unlikely (a 4 MiB `moov` is an hours-long file); if it ever happens, read the `moov` range exactly in a second range read.

Found during plan 02-17 (out of scope; not fixed).

10. **Every admin server action and `/en/admin/settings` return 500 on the Worker (cf:preview) until plan 02-19 removes `import sharp from 'sharp'` from `src/app/[locale]/admin/actions.ts`.** The Worker log (local explorer `observability/query`, table `logs`) shows `Failed to load external module sharp-...: Could not load the "sharp" module using the linuxnull-x64 runtime`. The plain `Internal Server Error` page has no stack, which hid it. `next start` is fine. The 02-17 preview checks ran with that one import stubbed in a throw-away, uncommitted edit (restored; `git status` clean). 02-19 must keep its guard test (no `sharp` import under `src/`) and re-run an admin action on preview; 02-22 must not skip an admin page on workers.dev. Until 02-19 lands, no admin page that SSRs a client component reaching the actions module works on a deployed Worker.
11. **Social icon and avatar are small round or square controls with no zone**, so the signed in-zone progress bar has no room there. They keep their existing spinner and use the signed toasts. If Koss wants a bar there too, that is a new picture to sign.
12. **Orphaned R2 object when an image uploads and the next step fails.** Cast editor: the image uploads and finalizes, then `addCastMember` can fail; the object stays in R2 (same as the old flow left a Supabase object). Admin artwork and hero image in a drawer that is then cancelled: the new object (committed `commit:false`) is not written to the row, so it is also orphaned until a sweep exists. The scheduled media sweep (Phase 3) should list `show-artwork/shows/<id>/...` keys not referenced by any row.

_Item 8 resolved for the clients by plan 02-18: the hero, preloader and show-drawer video components call `finalize*VideoUpload`. The old `create*VideoUpload` / `save*VideoUpload` actions now have no caller; 02-19 deletes them._

Found during plan 02-18 (out of scope; not fixed).

13. **Stale warning text in `hero-video-manager.tsx`.** For a hero MP4 over 8 MB the toast still says "large hero clips drive Supabase cached egress". Videos now live in R2, so the reason is wrong. New wording needs Koss's text (and Arabic); left as it was.
14. **Orphaned R2 video when the show drawer is cancelled after an upload** (`finalizeShowVideoUpload` with `commit:false`, same as deferred item 12 for images). The scheduled media sweep (Phase 3) should list `site-assets/shows/<id>/hero-*` keys no row references.
15. **The hero-video-manager client audio probe still runs before upload** (`probeLocalMp4HasAudio`), so a clip with no sound never reaches R2; the show drawer and preloader have no such probe and rely on finalize (show-video: no audio rule, preloader: none by design). Not changed.

_Items 7 and 10 resolved by plan 02-19: `removePreloaderVideo`, `removeSiteImage`, `deleteCastMember`, `deleteShowPermanently` and the cleanup cron now delete R2 objects only (`src/server/r2-delete.ts`); a Supabase original is never removed by any admin action. `sharp` and `@aws-sdk/*` are no longer imported by any file under `src/`; the Worker preview serves every admin page and server action (checked on a real `cf:build:preview` build with no stub)._

Found during plan 02-19 (out of scope; not fixed).

16. **Local sign-up logs `[auth] signUp profile upsert failed: new row violates row-level security policy for table "profiles"`** (Worker observability log, seen on every sign-up in the preview checks, also before 02-19). Sign-up and sign-in still work; the profile row is probably written by a DB trigger. Check whether the upsert in the sign-up action is redundant or needs the service client.
17. **Dead library code after the action deletions:** `saveHeroVideoCore`, `createHeroVideoPath`, `isHeroVideoUploadPath` (`src/lib/admin/hero-video.ts`), `checkImageUpload`, `checkHeroVideoSize`, `SITE_IMAGE_MIME_EXT`, `SOCIAL_ICON_MIME_EXT` (`src/lib/admin/media-guards.ts`) have no caller under `src/` any more, only tests (`admin-hero-video.test.ts`, `admin-media-guards.test.ts`). The 01.1 guards they carried live on the finalize path (`finalizeUploadedObject`, `saveVideoCore`), which has its own tests. Remove with their tests in a later cleanup.
18. **`deleteShowPermanently` and `deleteCastMember` no longer delete Supabase originals** (MEDIA-07). A show or cast portrait that still points at a Supabase Storage URL leaves that object behind. The post-approval Supabase emptying step covers it.
19. **`sharp` is still installed in `node_modules` as an optional dependency of `next` and a dependency of `miniflare`** (via `wrangler`). That is Next's own image optimizer, unused with the custom loader, and it is not in the Worker bundle (`grep sharp .open-next/server-functions/default/handler.mjs` finds nothing).
20. **`/en/admin/shows` has no page** (the shows list is `/en/admin`), so it returns the unknown-route 500 of item 1 on the Worker; not a regression.
