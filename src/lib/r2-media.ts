import 'server-only'

export {
  assertPublicMediaWriteReady,
  isR2MediaMirrorConfigured,
  mirrorPublicMediaObject,
  prepareMirroredPublicMediaDeletion,
} from '@/lib/r2-media-core'
export type { MirroredPublicMediaDeletion } from '@/lib/r2-media-core'
