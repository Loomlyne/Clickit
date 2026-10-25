// Marks every response the Worker serves, so a Worker answer and a proxied
// answer from the old host can be told apart from outside (proof-check).
// Pure: no I/O. 03-04 / DNS-02.

export const RUNTIME_HEADER = 'x-clickit-runtime'
export const RUNTIME_VALUE = 'workers'

type MaybeSocketResponse = Response & { webSocket?: unknown }

/**
 * Returns the response with `x-clickit-runtime: workers` set.
 *
 * - The response is copied (`new Response(body, response)`), never mutated:
 *   responses from fetch() and Response.redirect() have immutable headers.
 *   The body stream is handed over as is, so streaming is kept.
 * - A 101 upgrade or a response that carries a webSocket is returned
 *   untouched: copying it would drop the socket.
 * - Any upstream value of the header is overwritten.
 */
export function withRuntimeHeader(response: Response): Response {
  const candidate = response as MaybeSocketResponse
  if (candidate.status === 101 || candidate.webSocket) return response
  const copy = new Response(response.body, response)
  copy.headers.set(RUNTIME_HEADER, RUNTIME_VALUE)
  return copy
}
