const SLUG_MAX_LENGTH = 60

export function generateSlug(title: string, fallback?: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/, '')
  return base || fallback || ''
}

export function dedupeSlug(base: string, takenSlugs: Set<string>): string {
  if (!takenSlugs.has(base)) return base
  for (let i = 2; ; i++) {
    const candidate = `${base}-${i}`
    if (!takenSlugs.has(candidate)) return candidate
  }
}
