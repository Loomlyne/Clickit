-- Phase 3 (MEDIA-08, decision D-11): backup table for the one-time media URL
-- rewrite from Supabase Storage / the Phase 2 media Worker host to
-- https://media.clickitstory.ae.
--
-- This migration only creates the table.
-- The data rewrite is NOT a migration: it is the reviewed ops SQL in scripts/cutover/sql
-- (preflight.sql, rewrite-media-urls.sql, scan-old-hosts.sql, report.sql,
-- reverse-media-urls.sql), run once by the controller after Koss's word
-- (runbook Steps 47-52). This file reaches live only through
-- apply-live-migrations.yml with Koss's approval (runbook Steps 10-12).
--
-- One row per changed value: run id, table, column, primary key, the whole old
-- value and the whole new value as jsonb (a JSON string for text columns, the
-- full document for jsonb columns), and restored_at once the reverse script
-- has put the old value back. The private schema is not exposed through the
-- Data API; RLS is on with no policy and every grant to the API roles is
-- revoked, so only the owner (and roles that bypass RLS) can read it.

create schema if not exists private;

create table if not exists private.media_url_rewrite_backup (
  id bigint generated always as identity primary key,
  run_id uuid not null,
  table_name text not null,
  column_name text not null,
  row_pk jsonb not null,
  old_value jsonb not null,
  new_value jsonb not null,
  created_at timestamptz not null default now(),
  restored_at timestamptz,
  unique (run_id, table_name, column_name, row_pk)
);

comment on table private.media_url_rewrite_backup is
  'MEDIA-08: old and new value of every media URL changed by scripts/cutover/sql/rewrite-media-urls.sql; reverse-media-urls.sql restores a run and sets restored_at.';

alter table private.media_url_rewrite_backup enable row level security;

revoke all on table private.media_url_rewrite_backup from public, anon, authenticated;
