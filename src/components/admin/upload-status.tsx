'use client'

// Signed upload UI (plan 02-05, mockups/DECISIONS.md, option M):
//  - while uploading, the zone shows file name, size and percent with an
//    animated #ffcc00 bar (flowing gradient, moving stripes, soft glow) and a
//    faintly pulsing yellow border; animation stops under reduced motion;
//  - every message is a sonner toast, the zone never turns red; a dropped
//    connection or expired link is an error toast with a Retry action;
//    success is an "Uploaded" toast, with the Safari note for images.
// English texts are the signed ones; Arabic is pending Koss's signature.

import { toast } from 'sonner'
import { formatBytes, uploadProgressLine } from '@/lib/browser-variants'
import { UPLOAD_MESSAGES, type UploadError, type UploadProgress } from '@/lib/browser-upload'

const STYLES = `
@keyframes cs-upload-flow { from { background-position: 200% 0; } to { background-position: 0 0; } }
@keyframes cs-upload-stripes { from { background-position: 0 0; } to { background-position: 22px 0; } }
@keyframes cs-upload-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgb(var(--primary-rgb) / 0); }
  50% { box-shadow: 0 0 0 4px rgb(var(--primary-rgb) / 0.08); }
}
.cs-upload-zone { border-color: rgb(var(--primary-rgb) / 0.35); animation: cs-upload-pulse 1.6s ease-in-out infinite; }
.cs-upload-fill {
  /* The signed deep and light yellows, derived from --primary (90% with black, 60% with white). */
  --upload-yellow-deep: color-mix(in srgb, var(--primary) 90%, black);
  --upload-yellow-light: color-mix(in srgb, var(--primary) 60%, white);
  position: relative; overflow: hidden; height: 100%; border-radius: 999px;
  background: linear-gradient(90deg, var(--upload-yellow-deep), var(--primary) 40%, var(--upload-yellow-light) 50%, var(--primary) 60%, var(--upload-yellow-deep));
  background-size: 200% 100%;
  animation: cs-upload-flow 1.4s linear infinite;
  box-shadow: 0 0 12px rgb(var(--primary-rgb) / 0.45);
  transition: width 0.4s ease;
}
.cs-upload-fill::after {
  content: ""; position: absolute; inset: 0;
  background: repeating-linear-gradient(45deg, rgb(var(--ink-legacy-rgb) / 0.18) 0 8px, transparent 8px 16px);
  background-size: 22px 22px;
  animation: cs-upload-stripes 0.8s linear infinite;
}
@media (prefers-reduced-motion: reduce) {
  .cs-upload-zone, .cs-upload-fill, .cs-upload-fill::after { animation: none; }
}
`

/** The zone while a file uploads (replaces the empty or preview state of the zone). */
export function UploadStatus({
  progress,
  kind = 'image',
  className = '',
}: {
  progress: UploadProgress
  kind?: 'image' | 'video'
  className?: string
}) {
  const line =
    progress.phase === 'saving'
      ? kind === 'image'
        ? 'Saving…'
        : 'Checking fast-start…'
      : uploadProgressLine(kind, progress.variantCount)
  return (
    <div
      className={`cs-upload-zone flex flex-col items-center gap-2 rounded-lg border border-dashed bg-[var(--bg-2)] p-4 ${className}`}
    >
      <style>{STYLES}</style>
      <div className="flex w-full justify-between gap-3 text-xs text-[var(--text-dim)]">
        <span className="min-w-0 truncate">
          {progress.fileName} · {formatBytes(progress.fileSize)}
        </span>
        <span className="shrink-0 font-bold text-[var(--accent)]">{progress.percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-label={progress.fileName}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.percent}
        className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-2)]"
      >
        <div className="cs-upload-fill" style={{ width: `${progress.percent}%` }} />
      </div>
      <p aria-live="polite" className="text-[13px] text-[var(--text-dim)]">
        {line}
      </p>
    </div>
  )
}

// Sonner's action button is 24px by default; the signed Retry must be a 44px target.
const RETRY_BUTTON_STYLE = { minHeight: '44px', minWidth: '44px', fontSize: '13px' } as const

/**
 * Error toast for any upload failure. `tooLargeMessage` lets a component keep
 * its own localized "too large" text (same cap, same wording as before).
 * A dropped connection or expired link gets a Retry action.
 */
export function notifyUploadError(
  error: UploadError,
  options: { retry?: () => void; tooLargeMessage?: string } = {}
) {
  if (error.kind === 'network' && options.retry) {
    toast.error(error.message, {
      duration: 12000,
      action: { label: 'Retry', onClick: options.retry },
      actionButtonStyle: RETRY_BUTTON_STYLE,
    })
    return
  }
  if (error.kind === 'too-large' && options.tooLargeMessage) {
    toast.error(options.tooLargeMessage)
    return
  }
  toast.error(error.message)
}

/**
 * "Uploaded" toast. With the Safari note when the browser could not make WebP
 * copies. Pass no `message` when the screen already shows its own success text:
 * then only the note (if any) is shown.
 */
export function notifyUploaded({ message, safariFallback }: { message?: string; safariFallback: boolean }) {
  if (safariFallback) {
    toast.info(message ?? 'Uploaded', { description: UPLOAD_MESSAGES.safari })
    return
  }
  if (message) toast.success(message)
}
