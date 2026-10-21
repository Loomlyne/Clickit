// Cron string -> internal route map (PLAT-04). Pure. The strings are the same
// UTC schedules that wrangler.jsonc gets at the Phase 3 cutover (the retired
// vercel.json carried the first two; youtube-recheck came with Phase 6); keep CRON_EXPRESSIONS_FOR_PHASE_3 in step.

export const CRON_ROUTES: Readonly<Record<string, string>> = Object.freeze({
  '0 1 * * *': '/api/cron/publish-scheduled',
  '0 4 * * 1': '/api/cron/cleanup-media',
  '30 1 * * *': '/api/cron/youtube-recheck',
})

export function cronPathFor(cron: string): string | null {
  return Object.prototype.hasOwnProperty.call(CRON_ROUTES, cron) ? CRON_ROUTES[cron] : null
}
