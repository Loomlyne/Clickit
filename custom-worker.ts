// Worker entry. Source: opennext.js.org/cloudflare/howtos/custom-worker
// The scheduled handler is added in plan 02-07.
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-ignore generated at build time (npm run cf:build)
import { default as handler } from './.open-next/worker.js'

// @ts-ignore generated at build time (npm run cf:build)
export { DOQueueHandler } from './.open-next/worker.js'

export default {
  fetch: handler.fetch,
}
