// Cron string -> internal route map (PLAT-04). Pure. The strings are the same
// UTC schedules that vercel.json carries today and that wrangler.jsonc gets at
// the Phase 3 cutover; keep the three in step.

export const CRON_ROUTES: Readonly<Record<string, string>> = Object.freeze({
  '0 1 * * *': '/api/cron/publish-scheduled',
  '0 4 * * 1': '/api/cron/cleanup-media',
})

export function cronPathFor(cron: string): string | null {
  return Object.prototype.hasOwnProperty.call(CRON_ROUTES, cron) ? CRON_ROUTES[cron] : null
}
