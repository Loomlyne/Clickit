import { localMp4HasAudioTrack, mp4BytesHasAudioTrack } from '@/lib/mp4-audio'

export const YT_EMBED_ORIGIN = 'https://www.youtube-nocookie.com'

export function sendYouTubeCommand(
  iframe: HTMLIFrameElement,
  func: string,
  args: unknown[] = []
) {
  iframe.contentWindow?.postMessage(
    JSON.stringify({ event: 'command', func, args }),
    YT_EMBED_ORIGIN
  )
}

/**
 * Unmute / mute and ensure playback within the same user-gesture turn.
 * Call play() synchronously — deferring via setState can break autoplay policy.
 */
export function syncMp4Playback(video: HTMLVideoElement, shouldMute: boolean) {
  video.muted = shouldMute
  video.volume = shouldMute ? video.volume : 1
  void video.play().catch(() => {})
}

export function kickMutedAutoplay(video: HTMLVideoElement) {
  video.muted = true
  void video.play().catch(() => {})
}

export function probeLocalMp4HasAudio(file: File): Promise<boolean> {
  return localMp4HasAudioTrack(file)
}

export { mp4BytesHasAudioTrack }
