import 'server-only'

/**
 * The YouTube Data API key is an application secret, not site configuration.
 * It must be configured as `YOUTUBE_API_KEY` in the server runtime only.
 */
export function getYouTubeApiKey(): string | null {
  const key = process.env.YOUTUBE_API_KEY?.trim()
  return key || null
}

export function hasYouTubeApiKey(): boolean {
  return getYouTubeApiKey() !== null
}
