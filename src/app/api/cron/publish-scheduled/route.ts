import { NextResponse } from 'next/server'
import { revalidatePath, updateTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Scheduled publish sweep.
 *
 * Flips coming-soon episodes whose `publish_at` has passed to `published`, and
 * promotes their parent show from `coming-soon` to `now-streaming` once it has a
 * live episode. Runs on the service-role client so it bypasses RLS.
 *
 * Note on timing: viewer-facing "is it live?" is computed lazily at read time
 * (see lib/scheduling.isEpisodeLive), so an episode is watchable at the exact
 * scheduled minute regardless of when this cron runs. This sweep persists the
 * status change so search, admin views, and the Now Streaming / Coming Soon rail
 * placement stay correct. Daily is sufficient (Vercel Hobby plan limit).
 *
 * Schedule: see vercel.json. Auth: Vercel sends `Authorization: Bearer
 * ${CRON_SECRET}` automatically.
 *   Local dev: curl -H "Authorization: Bearer $CRON_SECRET" \
 *     localhost:3000/api/cron/publish-scheduled
 */
export async function GET(req: Request) {
  // --- Auth guard ----------------------------------------------------------
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET?.trim()
  const expected = `Bearer ${cronSecret}`
  if (!cronSecret || authHeader !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const admin = createAdminClient()
    const nowIso = new Date().toISOString()

    // --- Step 1: publish due episodes --------------------------------------
    const { data: published, error: epError } = await admin
      .from('episodes')
      .update({ status: 'published' })
      .eq('status', 'coming-soon')
      .eq('archived', false)
      .not('publish_at', 'is', null)
      .lte('publish_at', nowIso)
      .select('id, show_id')

    if (epError) {
      console.error('[cron/publish-scheduled] episode update failed', epError)
      return NextResponse.json(
        { ok: false, error: epError.message },
        { status: 500 }
      )
    }

    const episodeIds = (published ?? []).map((e) => e.id)
    const showIds = [...new Set((published ?? []).map((e) => e.show_id))]

    // --- Step 2: promote parent shows that are still coming-soon ------------
    let promotedSlugs: string[] = []
    if (showIds.length > 0) {
      const { data: promoted, error: showError } = await admin
        .from('shows')
        .update({ status: 'now-streaming' })
        .in('id', showIds)
        .eq('status', 'coming-soon')
        .eq('archived', false)
        .select('slug')

      if (showError) {
        console.error('[cron/publish-scheduled] show update failed', showError)
      } else {
        promotedSlugs = (promoted ?? []).map((s) => s.slug)
      }
    }

    // --- Step 3: invalidate caches so rails + series pages refresh ----------
    if (episodeIds.length > 0) {
      updateTag('episodes')
      updateTag('shows')
      revalidatePath('/')
      revalidatePath('/coming-soon')
    }

    return NextResponse.json({
      ok: true,
      publishedEpisodes: episodeIds.length,
      promotedShows: promotedSlugs.length,
    })
  } catch (err) {
    console.error('[cron/publish-scheduled] unhandled failure', err)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown failure' },
      { status: 500 }
    )
  }
}
