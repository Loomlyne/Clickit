// YouTube Data API v3 client (pure: fetch is injected, nothing from the app is
// imported). The API key travels only in the x-goog-api-key header, requests
// are never cached, and every failure becomes a YouTubeApiError whose message
// is a fixed plain sentence: no key, URL or response body ever reaches it
// (T-06-14, T-06-15). Callers cap paging (T-06-16); the client never uses the
// 100-unit lookup endpoint and chunks video ids at 50 per call (RESEARCH A4).

const BASE = 'https://www.googleapis.com/youtube/v3'
const MAX_IDS_PER_CALL = 50

export type YouTubeApiErrorCode =
  | 'playlist_private'
  | 'key_rejected'
  | 'api_not_allowed'
  | 'quota'
  | 'network'

export const YOUTUBE_API_ERROR_CODES: readonly YouTubeApiErrorCode[] = [
  'playlist_private',
  'key_rejected',
  'api_not_allowed',
  'quota',
  'network',
]

const ERROR_MESSAGES: Record<YouTubeApiErrorCode, string> = {
  playlist_private: 'The playlist is private, missing or not readable.',
  key_rejected: 'YouTube rejected the API key.',
  api_not_allowed: 'The API key is not allowed to use the YouTube Data API.',
  quota: 'The YouTube API quota for today is used up.',
  network: 'YouTube could not be reached or answered unexpectedly.',
}

// Reason strings the client may keep on the error. Anything else is dropped so
// a response body can never smuggle text into a thrown error.
const KNOWN_REASONS = new Set([
  'quotaExceeded',
  'dailyLimitExceeded',
  'rateLimitExceeded',
  'keyInvalid',
  'accessNotConfigured',
  'forbidden',
  'ipRefererBlocked',
  'playlistNotFound',
  'playlistForbidden',
  'playlistItemsNotAccessible',
  'playlistOperationUnsupported',
  'videoNotFound',
])

export class YouTubeApiError extends Error {
  code: YouTubeApiErrorCode
  httpStatus: number | null
  reason: string | null

  constructor(
    code: YouTubeApiErrorCode,
    httpStatus: number | null,
    reason: string | null
  ) {
    super(ERROR_MESSAGES[code])
    this.name = 'YouTubeApiError'
    this.code = code
    this.httpStatus = httpStatus
    this.reason = reason !== null && KNOWN_REASONS.has(reason) ? reason : null
  }
}

export type YouTubePlaylist = {
  id: string
  title: string
  privacyStatus: string
  itemCount: number
}

export type YouTubePlaylistItem = {
  videoId: string | null
  position: number | null
}

export type YouTubePlaylistItemsPage = {
  items: YouTubePlaylistItem[]
  nextPageToken: string | null
  totalResults: number
}

// Fields the classifiers read from a videos.list item; everything optional
// because the API omits empty parts.
export type YouTubeVideoResource = {
  id: string
  snippet?: {
    title?: string
    description?: string
    liveBroadcastContent?: string
    thumbnails?: Record<string, { url?: string }>
  }
  contentDetails?: {
    duration?: string
    regionRestriction?: { allowed?: string[]; blocked?: string[] }
  }
  status?: {
    uploadStatus?: string
    privacyStatus?: string
    embeddable?: boolean
  }
  liveStreamingDetails?: { scheduledStartTime?: string }
}

export type YouTubeClientLike = {
  getPlaylist(playlistId: string): Promise<YouTubePlaylist>
  listPlaylistItemsPage(
    playlistId: string,
    pageToken?: string
  ): Promise<YouTubePlaylistItemsPage>
  getVideos(ids: string[]): Promise<Map<string, YouTubeVideoResource>>
}

type ErrorBody = {
  error?: { message?: unknown; errors?: Array<{ reason?: unknown }> }
}

function readReason(body: ErrorBody | null): string | null {
  const reason = body?.error?.errors?.[0]?.reason
  return typeof reason === 'string' ? reason : null
}

function readMessage(body: ErrorBody | null): string {
  const message = body?.error?.message
  return typeof message === 'string' ? message : ''
}

const QUOTA_REASONS = ['quotaExceeded', 'dailyLimitExceeded', 'rateLimitExceeded']
const NOT_ALLOWED_REASONS = ['accessNotConfigured', 'forbidden', 'ipRefererBlocked']
const PLAYLIST_REASONS = [
  'playlistNotFound',
  'playlistForbidden',
  'playlistItemsNotAccessible',
  'playlistOperationUnsupported',
]

// HTTP status first, then an allow-list of reason strings (RESEARCH A8).
function mapError(status: number, body: ErrorBody | null): YouTubeApiError {
  const reason = readReason(body)
  const message = readMessage(body)
  const make = (code: YouTubeApiErrorCode) => new YouTubeApiError(code, status, reason)

  if (status >= 500) return make('network')
  if (status >= 400 && message.includes('API key not valid')) return make('key_rejected')
  if (reason === null) return make('network')

  if (status === 400) {
    if (reason === 'keyInvalid') return make('key_rejected')
    if (reason === 'playlistOperationUnsupported') return make('playlist_private')
  } else if (status === 403) {
    if (QUOTA_REASONS.includes(reason)) return make('quota')
    if (NOT_ALLOWED_REASONS.includes(reason)) return make('api_not_allowed')
    if (PLAYLIST_REASONS.includes(reason)) return make('playlist_private')
  } else if (status === 404) {
    if (reason === 'playlistNotFound') return make('playlist_private')
  }
  return make('network')
}

type Doc = Record<string, unknown>

function asDocs(value: unknown): Doc[] {
  return Array.isArray(value)
    ? value.filter((v): v is Doc => typeof v === 'object' && v !== null)
    : []
}

function asDoc(value: unknown): Doc {
  return typeof value === 'object' && value !== null ? (value as Doc) : {}
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function createYouTubeClient(opts: {
  apiKey: string
  fetchImpl?: typeof fetch
}): YouTubeClientLike {
  const fetchImpl = opts.fetchImpl ?? fetch
  const apiKey = opts.apiKey

  // Returns the parsed body. `missingOk` turns a 404 videoNotFound into an
  // empty result instead of an error (videos.list, RESEARCH Pitfall 4).
  async function get(
    path: string,
    params: Record<string, string>,
    missingOk = false
  ): Promise<Doc> {
    if (!apiKey) throw new YouTubeApiError('key_rejected', null, null)
    let res: Response
    try {
      res = await fetchImpl(`${BASE}/${path}?${new URLSearchParams(params).toString()}`, {
        headers: { 'x-goog-api-key': apiKey },
        cache: 'no-store',
      })
    } catch {
      throw new YouTubeApiError('network', null, null)
    }
    if (!res.ok) {
      let body: ErrorBody | null = null
      try {
        body = (await res.json()) as ErrorBody
      } catch {
        body = null
      }
      if (missingOk && res.status === 404 && readReason(body) === 'videoNotFound') {
        return { items: [] }
      }
      throw mapError(res.status, body)
    }
    try {
      return asDoc(await res.json())
    } catch {
      throw new YouTubeApiError('network', res.status, null)
    }
  }

  return {
    async getPlaylist(playlistId) {
      const body = await get('playlists', {
        part: 'snippet,status,contentDetails',
        id: playlistId,
      })
      const first = asDocs(body.items)[0]
      if (!first) throw new YouTubeApiError('playlist_private', 200, null)
      return {
        id: str(first.id) ?? playlistId,
        title: str(asDoc(first.snippet).title) ?? '',
        privacyStatus: str(asDoc(first.status).privacyStatus) ?? '',
        itemCount: num(asDoc(first.contentDetails).itemCount) ?? 0,
      }
    },

    async listPlaylistItemsPage(playlistId, pageToken) {
      const body = await get('playlistItems', {
        part: 'contentDetails,snippet,status',
        playlistId,
        maxResults: String(MAX_IDS_PER_CALL),
        ...(pageToken ? { pageToken } : {}),
      })
      const items = asDocs(body.items).map((item): YouTubePlaylistItem => {
        const snippet = asDoc(item.snippet)
        const resource = asDoc(snippet.resourceId)
        const fromResource =
          resource.kind === 'youtube#video' ? str(resource.videoId) : null
        return {
          videoId: str(asDoc(item.contentDetails).videoId) ?? fromResource,
          position: num(snippet.position),
        }
      })
      return {
        items,
        nextPageToken: str(body.nextPageToken),
        totalResults: num(asDoc(body.pageInfo).totalResults) ?? items.length,
      }
    },

    async getVideos(ids) {
      const out = new Map<string, YouTubeVideoResource>()
      for (let i = 0; i < ids.length; i += MAX_IDS_PER_CALL) {
        const body = await get(
          'videos',
          {
            part: 'snippet,contentDetails,status,liveStreamingDetails',
            id: ids.slice(i, i + MAX_IDS_PER_CALL).join(','),
          },
          true
        )
        for (const video of asDocs(body.items)) {
          const id = str(video.id)
          if (id) out.set(id, video as unknown as YouTubeVideoResource)
        }
      }
      return out
    },
  }
}
