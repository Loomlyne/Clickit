# Phase 2 UI decisions (picture first)

Plans 02-13, 02-17 and 02-18 build exactly what is signed here, nothing else.

## Turnstile placement

- **Signed:** option **turnstile-A**, 2026-10-20 10:21 CET.
- **Koss's words:** "A: box above button (Recommended)".
- **What it means:** a Managed widget, dark theme, full form width, between the last field and the submit button on sign-in, sign-up, forgot-password request and contact. The footer newsletter uses appearance "interaction-only", so its row is unchanged unless Cloudflare needs a click; then the box shows under the row. While the check runs the button is disabled; a failed check shows "Security check failed. Please try again." under the widget. Password fields keep the right-side show/hide eye.
- **Pictures:** turnstile-A.png, turnstile-A-mobile.png (source: turnstile-placement.html?only=A).

## Admin upload progress and errors

- **Signed:** option **upload-M** (Koss's merge of A and B), 2026-10-20 10:25 CET.
- **Koss's words (first answer):** "A progress file with the file name and percentage inside the upload zone, so I can see it being uploaded. Add an animation to that, like change the animation, and keep the toasts, not the inside-the-zone full-zone change. I believe that's better. Merge A and B and add animation to show the progress in that part."
- **Koss's words (sign-off on the merged picture):** "Yes, sign it (Recommended)".
- **What it means:**
  - While uploading, the zone shows the file name, size and percent with an animated #ffcc00 bar (flowing gradient, moving diagonal stripes, soft glow) and a faint pulsing yellow border. Under the bar: "Uploading… then 3 smaller copies" for images, "Uploading…" for video. Animation is off under prefers-reduced-motion.
  - Every message is a sonner toast; the zone never turns red. Too large, wrong type (01.1 SVG text), refused after upload, and not-fast-start are error toasts; a dropped connection or expired link is an error toast with a Retry action; success is an "Uploaded" toast, with the Safari note "This browser cannot make WebP copies; the original will be used." for images.
  - Size caps are today's caps; no new limit.
- **Pictures:** upload-M.png (source: upload-states.html?only=M). Options A and B stay in the file for reference only.

## Gate
- 2026-10-20 10:31 CET: `git status --porcelain` shows only paths under `.planning/`; no app code changed in plan 02-05.
- `npm run gate:local` / lint / unit were not run: this worktree has no `node_modules` (plan 02-01 has not run; `npm ci` waits for its owner package check), and plan 02-05 changed no file they test. The first gate run is in plan 02-01.
