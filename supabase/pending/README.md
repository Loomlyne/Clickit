# supabase/pending

Migrations that are written, reviewed and proven now but must not reach the live
database yet, because their order around the deploy matters (Phase 5, D-16 / D-40).

| File | What | Goes live when |
|------|------|----------------|
| `m2_admin_aal2.sql` | `private.is_admin()` = row in `public.admins` AND `aal = 'aal2'`; the inline `Admin manage site-assets` storage policy now calls `private.is_admin()` | after the Phase 5 deploy and after both admins rows are inserted and read back (05-36); TOTP enrolment follows |
| `m3_close_anon_youtube.sql` | anon loses EXECUTE on `get_public_youtube_video_id(uuid)` and SELECT on `episodes_view`; authenticated and service_role keep both | after the catalog client (05-05) is deployed |

## Why a separate folder

`apply-live-migrations.yml` applies every pending file in `supabase/migrations` in one
approval. Keeping M2 and M3 here keeps them out of the first PR's live apply.

- The Supabase CLI (`supabase db push`, `migration up`, `db reset`) only reads
  `supabase/migrations`, so it ignores this folder.
- The migration guard (`scripts/migration-guard.mjs`) only scans `supabase/migrations`.
  The files still follow its rules (every `drop` / `delete from` / `truncate` line carries
  `-- safe-drop: <reason>`), so they pass once copied.

## Where they run today

- `scripts/db-proof.sh` applies `supabase/pending/*.sql` in name order (M2, then M3) in
  its scratch database, after every migration, the seed and the `0*` / `m*` tests, prints
  `pending_applied=<n>` and then runs `supabase/tests/pending_*.sql`
  (`pending_admin_aal2`, `pending_anon_revoke`).
- `npm run seed:local-admin` (05-17) applies `m2_admin_aal2.sql` to the local stack only,
  so local admin pages behave as they will after M2: the admin must pass TOTP first.
  Never run it against the live project.

## How they ship

The second PR (05-41) copies each file verbatim, byte for byte, into
`supabase/migrations/<new timestamp>_phase5_m2_admin_aal2.sql` and
`supabase/migrations/<new timestamp>_phase5_m3_close_anon_youtube.sql` (timestamps
greater than every file then in `supabase/migrations`, M2 before M3). 05-37 applies both
in one approval, after the dry-run read. Do not edit these files after review without
re-running the proof.
