const AUTH_ERROR_MAP: Record<string, string> = {
  'Invalid login credentials': 'Email or password is incorrect.',
  'Email not confirmed': 'Please check your email to confirm your account.',
  'User already registered': 'An account with this email already exists.',
  'Signup requires a valid password': 'Password must be at least 6 characters.',
  'Password should be at least 6 characters': 'Password must be at least 6 characters.',
  'Email rate limit exceeded': 'Too many attempts. Please try again later.',
  'For security purposes, you can only request this once every 60 seconds':
    'Please wait a moment before trying again.',
  'Invalid email or password': 'Email or password is incorrect.',
  'Email link is invalid or has expired': 'This link has expired. Please request a new one.',
  'Request blocked for security. Please try again or contact support if this persists.':
    'Request blocked for security. Please try again or contact support if this persists.',
}

export function mapAuthError(rawMessage: string): string {
  // Check exact match first, then partial match for Supabase error variations
  if (AUTH_ERROR_MAP[rawMessage]) return AUTH_ERROR_MAP[rawMessage]

  const lower = rawMessage.toLowerCase()
  if (lower.includes('invalid') && (lower.includes('credentials') || lower.includes('password'))) {
    return 'Email or password is incorrect.'
  }
  if (lower.includes('rate limit') || lower.includes('too many')) {
    return 'Too many attempts. Please try again later.'
  }
  if (lower.includes('already registered') || lower.includes('already exists')) {
    return 'An account with this email already exists.'
  }

  return rawMessage || 'Something went wrong. Please try again.'
}
