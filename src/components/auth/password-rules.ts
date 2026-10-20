/**
 * Minimum length for any password a person sets (sign-up, reset, profile).
 * Sign-in only checks "not empty": older accounts may predate the minimum.
 */
export const PASSWORD_MIN = 8
/** Minimum display-name length at sign-up. */
export const NAME_MIN = 2

/** Number of satisfied strength criteria, 0-4. */
export function passwordScore(value: string): number {
  return [
    value.length >= PASSWORD_MIN,
    /[A-Z]/.test(value),
    /[0-9]/.test(value),
    /[^A-Za-z0-9]/.test(value),
  ].filter(Boolean).length
}

export type PasswordStrength = 'weak' | 'good' | 'strong'

export function passwordStrength(score: number): PasswordStrength {
  return score < 2 ? 'weak' : score < 4 ? 'good' : 'strong'
}

/** Values the zod message keys in `errors.*` interpolate. */
export function errorParams(key: string): Record<string, number> | undefined {
  if (key === 'passwordMin') return { min: PASSWORD_MIN }
  if (key === 'nameMin') return { min: NAME_MIN }
  return undefined
}
