// One HTTP(S) request that can be pinned to an IP address without any DNS change
// (the equivalent of curl --resolve). Used by proof-check and keys-check.
//
// The TLS servername and the Host header stay the URL's host, so the certificate
// the edge presents is checked against the real name. Redirects are never followed.
// No secret is read or written here; callers decide what headers to send.

import http from 'node:http'
import https from 'node:https'
import { isIP } from 'node:net'

const DEFAULT_TIMEOUT_MS = 15_000
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024

/**
 * @param {string} rawUrl http(s) URL
 * @param {{ ip?: string|null, method?: string, headers?: Record<string,string>, body?: string|null,
 *           timeoutMs?: number, readBody?: boolean, maxBytes?: number }} [options]
 * @returns {Promise<{ status: number, headers: Record<string, string>,
 *   certificate: { validTo: string, issuer: string, subjectaltname: string } | null, body?: string }>}
 */
export function pinnedRequest(rawUrl, options = {}) {
  const {
    ip = null,
    method = 'GET',
    headers = {},
    body = null,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    readBody = false,
    maxBytes = DEFAULT_MAX_BYTES,
  } = options
  const url = new URL(rawUrl)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return Promise.reject(new Error('pinnedRequest needs an http(s) URL'))
  }
  if (ip !== null && isIP(ip) === 0) return Promise.reject(new Error(`not an IP address: ${ip}`))
  const lib = url.protocol === 'https:' ? https : http

  // A fresh agent per request with no TLS session cache: on a resumed session
  // getPeerCertificate() returns an empty object, and the certificate is a proof.
  const agent =
    url.protocol === 'https:'
      ? new https.Agent({ keepAlive: false, maxCachedSessions: 0 })
      : new http.Agent({ keepAlive: false })

  const requestOptions = {
    agent,
    method,
    headers: { 'accept-encoding': 'identity', 'user-agent': 'clickit-cutover-proof/1', ...headers },
    timeout: timeoutMs,
  }
  if (ip !== null) {
    const family = isIP(ip)
    // Node may ask for one address or for all of them (autoSelectFamily).
    requestOptions.lookup = (_host, lookupOptions, callback) => {
      if (lookupOptions && lookupOptions.all) callback(null, [{ address: ip, family }])
      else callback(null, ip, family)
    }
  }

  return new Promise((resolve, reject) => {
    const req = lib.request(url, requestOptions, (res) => {
      let certificate = null
      if (url.protocol === 'https:' && res.socket && typeof res.socket.getPeerCertificate === 'function') {
        const peer = res.socket.getPeerCertificate()
        if (peer && peer.valid_to) {
          certificate = {
            validTo: peer.valid_to,
            issuer: peer.issuer ? Object.entries(peer.issuer).map(([k, v]) => `${k}=${v}`).join(', ') : '',
            subjectaltname: peer.subjectaltname ?? '',
          }
        }
      }
      const outHeaders = {}
      for (const [name, value] of Object.entries(res.headers)) {
        outHeaders[name] = Array.isArray(value) ? value.join(', ') : String(value ?? '')
      }
      const result = { status: res.statusCode ?? 0, headers: outHeaders, certificate }
      if (!readBody) {
        res.destroy()
        resolve(result)
        return
      }
      const chunks = []
      let size = 0
      res.on('data', (chunk) => {
        size += chunk.length
        if (size > maxBytes) {
          res.destroy(new Error(`response larger than ${maxBytes} bytes`))
          return
        }
        chunks.push(chunk)
      })
      res.on('end', () => resolve({ ...result, body: Buffer.concat(chunks).toString('utf8') }))
      res.on('error', reject)
    })
    req.on('timeout', () => req.destroy(new Error(`timeout after ${timeoutMs} ms`)))
    req.on('error', reject)
    if (body !== null) req.write(body)
    req.end()
  })
}
