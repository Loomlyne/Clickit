// Constant-time cron Bearer check (PLAT-07, T-02-13). Pure: no imports.
// Both sides are hashed with SHA-256 first, so the comparator always sees two
// 32-byte digests and the secret length cannot leak. The comparator is
// crypto.subtle.timingSafeEqual on workerd; Node has none, so tests inject
// node:crypto's. With neither available the check refuses; it never falls back
// to ===.

type Bytes = ArrayBuffer | ArrayBufferView
export type DigestComparator = (a: Bytes, b: Bytes) => boolean

const encoder = new TextEncoder()

async function sha256(text: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest('SHA-256', encoder.encode(text))
}

function runtimeComparator(): DigestComparator | null {
  const subtle = crypto.subtle as unknown as { timingSafeEqual?: DigestComparator }
  if (typeof subtle.timingSafeEqual === 'function') {
    return (a, b) => subtle.timingSafeEqual!.call(subtle, a, b)
  }
  return null
}

export async function constantTimeDigestEqual(
  a: string,
  b: string,
  compare?: DigestComparator,
): Promise<boolean> {
  const comparator = compare ?? runtimeComparator()
  if (!comparator) return false
  try {
    const [digestA, digestB] = await Promise.all([sha256(a), sha256(b)])
    return comparator(digestA, digestB) === true
  } catch {
    return false
  }
}

export async function cronAuthOk(
  header: string | null | undefined,
  secret: string | undefined,
  compare?: DigestComparator,
): Promise<boolean> {
  const trimmed = typeof secret === 'string' ? secret.trim() : ''
  if (trimmed === '') return false
  if (typeof header !== 'string' || header === '') return false
  return constantTimeDigestEqual(header, `Bearer ${trimmed}`, compare)
}
