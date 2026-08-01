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

export class R2MediaRollbackError extends Error {
  constructor() {
    super('Could not restore public media in R2')
    this.name = 'R2MediaRollbackError'
  }
}

const R2_DELETE_BACKUP_PREFIX = '__clickit-delete-backups'
const R2_WRITE_BACKUP_PREFIX = '__clickit-write-backups'

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
  if (env.NEXT_PUBLIC_MEDIA_CUTOVER_READY?.trim() !== 'verified') {
    return false
  }

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
  let objectKey: string | null = null
  let backupKey: string | null = null
  let writeStarted = false

  try {
    objectKey = r2ObjectKey(input.bucket, input.key)
    backupKey = await createR2WriteBackup(
      client,
      configuration,
      objectKey,
      options.transactionId ?? randomUUID()
    )

    writeStarted = true
    await client.send(
      new PutObjectCommand({
        Bucket: configuration.bucket,
        Key: objectKey,
        Body: await r2Body(input.body),
        ContentType: input.contentType,
        CacheControl: input.cacheControl,
      })
    )

    const head = await client.send(
      new HeadObjectCommand({ Bucket: configuration.bucket, Key: objectKey })
    )
    if (!matchesMirroredObject(head, input)) {
      throw new Error('R2 mirror verification failed')
    }

    if (
      backupKey &&
      !(await deleteR2ObjectKeys(client, configuration, [backupKey]))
    ) {
      throw new Error('R2 write backup cleanup failed')
    }
  } catch {
    if (objectKey && writeStarted) {
      const rolledBack = await rollbackR2Write(
        client,
        configuration,
        objectKey,
        backupKey
      )
      if (!rolledBack) throw new R2MediaRollbackError()
    }
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

async function createR2WriteBackup(
  client: R2Client,
  configuration: R2Configuration,
  objectKey: string,
  transactionId: string
) {
  const backupKey = `${R2_WRITE_BACKUP_PREFIX}/${transactionId}/${objectKey}`

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
    if (isMissingR2Object(error)) return null
    throw error
  }

  return backupKey
}

async function rollbackR2Write(
  client: R2Client,
  configuration: R2Configuration,
  objectKey: string,
  backupKey: string | null
) {
  if (!backupKey) {
    return deleteR2ObjectKeys(client, configuration, [objectKey])
  }

  try {
    await client.send(
      new CopyObjectCommand({
        Bucket: configuration.bucket,
        Key: objectKey,
        CopySource: r2CopySource(configuration.bucket, backupKey),
        MetadataDirective: 'COPY',
      })
    )
  } catch {
    return false
  }

  return deleteR2ObjectKeys(client, configuration, [backupKey])
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
        if (isMissingR2Object(error)) {
          throw new Error('R2 mirror object is missing')
        }
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
