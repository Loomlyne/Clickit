const AUTH_ERROR_MAP: Record<string, string> = {
  'Invalid login credentials': 'Email or password is incorrect.',
  'Email not confirmed': 'Please check your email to confirm your account.',
  'User already registered': 'An account with this email already exists.',
  'Signup requires a valid password': 'Password must be at least 6 characters.',
  'Password should be at least 6 characters': 'Password must be at least 6 characters.',
  'Email rate limit exceeded': 'Too many attempts. Please try again later.',
  'For security purposes, you can only request this once every 60 seconds':
    'Please wait a moment before trying again.',
}

export function mapAuthError(rawMessage: string): string {
  return AUTH_ERROR_MAP[rawMessage] ?? 'Something went wrong. Please try again.'
}
