'use server'

import { reportPlayerErrorCore } from '@/server/player-error-report'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

/**
 * A signed-in viewer's player hit an error on this episode (D-17). Records one
 * report per user per episode per hour, for allow-listed codes only, and raises
 * the admin flag only once PLAYER_REPORT_THRESHOLD different viewers reported
 * the episode in 24 hours. Advisory: it unpublishes nothing and never calls
 * YouTube. Returns `{ success }` only.
 */
export async function reportPlayerError(
  episodeId: string,
  code: number
): Promise<{ success: boolean }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const result = await reportPlayerErrorCore({
      db: createAdminClient(),
      userId: user?.id ?? null,
      episodeIdRaw: episodeId,
      codeRaw: code,
    })
    if (!result.ok && result.reason === 'failed') {
      console.error('[actions/player-errors] report not stored')
    }
    return { success: result.ok }
  } catch (err) {
    console.error('[actions/player-errors] report failed', err)
    return { success: false }
  }
}
