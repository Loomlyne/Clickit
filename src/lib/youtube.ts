const YOUTUBE_REGEX = /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/

/**
 * Extract 11-character YouTube video ID from various URL formats:
 * - https://www.youtube.com/watch?v=dQw4w9WgXcQ
 * - https://youtu.be/dQw4w9WgXcQ
 * - https://www.youtube.com/embed/dQw4w9WgXcQ
 * - https://www.youtube.com/shorts/dQw4w9WgXcQ
 * - https://www.youtube.com/live/dQw4w9WgXcQ
 * - https://youtube.com/watch?v=dQw4w9WgXcQ&t=120
 */
export function extractYouTubeId(url: string): string | null {
  if (!url) return null
  const match = url.match(YOUTUBE_REGEX)
  return match?.[1] ?? null
}

export function getYouTubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
}

// ---------------------------------------------------------------------------
// YouTube IFrame API — duration detection
// ---------------------------------------------------------------------------

let apiReady = false
let apiLoading = false
const readyCallbacks: (() => void)[] = []

export function loadYouTubeAPI(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  return new Promise((resolve) => {
    if (apiReady) { resolve(); return }
    readyCallbacks.push(resolve)
    if (apiLoading) return
    apiLoading = true
    ;(window as unknown as Record<string, unknown>).onYouTubeIframeAPIReady = () => {
      apiReady = true
      readyCallbacks.forEach((cb) => cb())
      readyCallbacks.length = 0
    }
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(tag)
  })
}

/**
 * Get video duration in seconds using a hidden YouTube player.
 * Returns null if detection fails within 10 seconds.
 */
export function getVideoDuration(videoId: string): Promise<number | null> {
  if (typeof window === 'undefined') return Promise.resolve(null)
  return new Promise(async (resolve) => {
    const timeout = setTimeout(() => { cleanup(); resolve(null) }, 10_000)

    function cleanup() {
      clearTimeout(timeout)
      try { player?.destroy() } catch { /* ignore */ }
      container?.remove()
    }

    await loadYouTubeAPI()

    const container = document.createElement('div')
    container.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;'
    document.body.appendChild(container)

    let player: YT.Player | null = null
    player = new YT.Player(container, {
      videoId,
      width: 1,
      height: 1,
      playerVars: { autoplay: 0, controls: 0 },
      events: {
        onReady: () => {
          const dur = player?.getDuration?.() ?? 0
          cleanup()
          resolve(dur > 0 ? dur : null)
        },
        onError: () => {
          cleanup()
          resolve(null)
        },
      },
    })
  })
}
