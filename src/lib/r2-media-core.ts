import 'server-only'

import {
  CopyObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type PutObjectCommandInput,
} from '@aws-sdk/client-s3'
import { randomUUID } from 'node:crypto'

const PUBLIC_MEDIA_BUCKETS = new Set(['show-artwork', 'site-assets', 'avatars'])

const R2_ENV_NAMES = [
  'CLOUDFLARE_ACCOUNT_ID',
  'CLOUDFLARE_R2_BUCKET',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
] as const

type R2Environment = Record<string, string | undefined>

type R2Configuration = {
  accountId: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
}

type R2Client = Pick<S3Client, 'send'>

type R2ClientOptions = {
  env?: R2Environment
  client?: R2Client
  transactionId?: string
}

type MirrorPublicMediaObjectInput = {
  bucket: string
  key: string
  body: PutObjectCommandInput['Body']
  contentType?: string
  cacheControl?: string
  contentLength?: number
}

type MirroredMediaDeleteBackup = {
  objectKey: string
  backupKey: string
}

export type MirroredPublicMediaDeletion = {
  commit: () => Promise<boolean>
  rollback: () => Promise<boolean>
}

const R2_DELETE_BACKUP_PREFIX = '__clickit-delete-backups'

function configuredValue(
  env: R2Environment,
  name: (typeof R2_ENV_NAMES)[number]
) {
  const value = env[name]?.trim()
  return value || null
}

function getR2Configuration(env: R2Environment): R2Configuration | null {
  const values = R2_ENV_NAMES.map((name) => configuredValue(env, name))
  if (values.some((value) => !value)) return null

  const [accountId, bucket, accessKeyId, secretAccessKey] = values as string[]
  return { accountId, bucket, accessKeyId, secretAccessKey }
}

function isPublicMediaObject(bucket: string, key: string) {
  return (
    PUBLIC_MEDIA_BUCKETS.has(bucket) &&
    !!key &&
    !key.startsWith('/') &&
    !key.split('/').includes('..')
  )
}

function r2ObjectKey(bucket: string, key: string) {
  if (!isPublicMediaObject(bucket, key)) {
    throw new Error('Invalid public media object path')
  }

  return `${bucket}/${key}`
}

function r2CopySource(bucket: string, key: string) {
  return `${bucket}/${key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')}`
}

function createR2Client(configuration: R2Configuration): R2Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${configuration.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: configuration.accessKeyId,
      secretAccessKey: configuration.secretAccessKey,
    },
  })
}

function mirrorRequired(env: R2Environment) {
  const configuredOrigin = env.NEXT_PUBLIC_MEDIA_ORIGIN?.trim()
  if (!configuredOrigin) return false

  try {
    const origin = new URL(configuredOrigin)
    return (
      origin.protocol === 'https:' &&
      !origin.username &&
      !origin.password &&
      origin.pathname === '/' &&
      !origin.search &&
      !origin.hash
    )
  } catch {
    return false
  }
}

function bodyLength(body: PutObjectCommandInput['Body']) {
  if (typeof body === 'string') return Buffer.byteLength(body)
  if (body instanceof Uint8Array) return body.byteLength
  if (typeof Blob !== 'undefined' && body instanceof Blob) return body.size
  return null
}

async function r2Body(body: PutObjectCommandInput['Body']) {
  if (typeof Blob !== 'undefined' && body instanceof Blob) {
    return Buffer.from(await body.arrayBuffer())
  }
  return body
}

function matchesMirroredObject(
  head: { ContentLength?: number; ContentType?: string; CacheControl?: string },
  input: MirrorPublicMediaObjectInput
) {
  const expectedLength = input.contentLength ?? bodyLength(input.body)
  if (expectedLength !== null && head.ContentLength !== expectedLength) {
    return false
  }
  if (input.contentType && head.ContentType !== input.contentType) return false
  if (input.cacheControl && head.CacheControl !== input.cacheControl)
    return false
  return true
}

export function assertPublicMediaWriteReady(env: R2Environment = process.env) {
  if (mirrorRequired(env) && !getR2Configuration(env)) {
    throw new Error(
      'R2 media mirroring is required while NEXT_PUBLIC_MEDIA_ORIGIN is enabled. Configure CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_R2_BUCKET, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.'
    )
  }
}

export function isR2MediaMirrorConfigured(env: R2Environment = process.env) {
  return getR2Configuration(env) !== null
}

export async function mirrorPublicMediaObject(
  input: MirrorPublicMediaObjectInput,
  options: R2ClientOptions = {}
) {
  const env = options.env ?? process.env
  const configuration = getR2Configuration(env)
  if (!configuration) {
    assertPublicMediaWriteReady(env)
    return false
  }

  const client = options.client ?? createR2Client(configuration)
  try {
    const key = r2ObjectKey(input.bucket, input.key)
    await client.send(
      new PutObjectCommand({
        Bucket: configuration.bucket,
        Key: key,
        Body: await r2Body(input.body),
        ContentType: input.contentType,
        CacheControl: input.cacheControl,
      })
    )

    const head = await client.send(
      new HeadObjectCommand({ Bucket: configuration.bucket, Key: key })
    )
    if (!matchesMirroredObject(head, input)) {
      throw new Error('R2 mirror verification failed')
    }
  } catch {
    throw new Error('Could not mirror public media to R2')
  }

  return true
}

function isR2DeleteFailure(result: unknown) {
  return (
    !!result &&
    typeof result === 'object' &&
    'Errors' in result &&
    Array.isArray(result.Errors) &&
    result.Errors.length > 0
  )
}

function isMissingR2Object(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const r2Error = error as {
    name?: string
    Code?: string
    $metadata?: { httpStatusCode?: number }
  }
  return (
    r2Error.$metadata?.httpStatusCode === 404 ||
    r2Error.name === 'NoSuchKey' ||
    r2Error.name === 'NotFound' ||
    r2Error.Code === 'NoSuchKey'
  )
}

async function deleteR2ObjectKeys(
  client: R2Client,
  configuration: R2Configuration,
  keys: string[]
) {
  if (keys.length === 0) return true

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await client.send(
        new DeleteObjectsCommand({
          Bucket: configuration.bucket,
          Delete: {
            Objects: keys.map((Key) => ({ Key })),
            Quiet: true,
          },
        })
      )
      if (!isR2DeleteFailure(result)) return true
    } catch {
      // Retry once for a transient object-storage failure.
    }
  }

  return false
}

function noOpMirroredPublicMediaDeletion(): MirroredPublicMediaDeletion {
  return {
    commit: async () => true,
    rollback: async () => true,
  }
}

export async function prepareMirroredPublicMediaDeletion(
  bucket: string,
  keys: string[],
  options: R2ClientOptions = {}
): Promise<MirroredPublicMediaDeletion> {
  if (keys.length === 0) return noOpMirroredPublicMediaDeletion()

  const env = options.env ?? process.env
  const configuration = getR2Configuration(env)
  if (!configuration) {
    assertPublicMediaWriteReady(env)
    return noOpMirroredPublicMediaDeletion()
  }

  const client = options.client ?? createR2Client(configuration)
  const transactionId = options.transactionId ?? randomUUID()
  const backups: MirroredMediaDeleteBackup[] = []

  try {
    for (const key of keys) {
      const objectKey = r2ObjectKey(bucket, key)
      const backupKey = `${R2_DELETE_BACKUP_PREFIX}/${transactionId}/${objectKey}`

      try {
        await client.send(
          new CopyObjectCommand({
            Bucket: configuration.bucket,
            Key: backupKey,
            CopySource: r2CopySource(configuration.bucket, objectKey),
            MetadataDirective: 'COPY',
          })
        )
      } catch (error) {
        if (isMissingR2Object(error)) continue
        throw error
      }

      backups.push({ objectKey, backupKey })
    }
  } catch {
    await deleteR2ObjectKeys(
      client,
      configuration,
      backups.map((backup) => backup.backupKey)
    )
    throw new Error('Could not prepare public media deletion in R2')
  }

  return {
    commit: async () => {
      const deleted = await deleteR2ObjectKeys(
        client,
        configuration,
        backups.map((backup) => backup.objectKey)
      )
      if (!deleted) return false

      return deleteR2ObjectKeys(
        client,
        configuration,
        backups.map((backup) => backup.backupKey)
      )
    },
    rollback: () =>
      deleteR2ObjectKeys(
        client,
        configuration,
        backups.map((backup) => backup.backupKey)
      ),
  }
}
