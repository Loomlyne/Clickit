/**
 * Two-letter initials for an avatar. Prefers the profile display name, falls
 * back to the email local part. Returns null when neither gives a letter so
 * the caller can show an icon instead of a made-up letter.
 */
export function viewerInitials(
  displayName?: string | null,
  email?: string | null
): string | null {
  const name = displayName?.trim() || email?.split('@')[0]?.trim() || ''
  if (!name) return null
  const parts = name.split(/[\s._-]+/).filter(Boolean)
  const letters =
    parts.length > 1
      ? parts[0][0] + parts[1][0]
      : Array.from(name).slice(0, 2).join('')
  return letters.toUpperCase()
}
