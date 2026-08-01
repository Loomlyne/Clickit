import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import {
  CopyObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3'
const require = createRequire(import.meta.url)
const serverOnlyPath = require.resolve('server-only')
require.cache[serverOnlyPath] = {
  id: serverOnlyPath,
  filename: serverOnlyPath,
  loaded: true,
  exports: {},
}

const {
  assertPublicMediaWriteReady,
  mirrorPublicMediaObject,
  prepareMirroredPublicMediaDeletion,
  R2MediaRollbackError,
} = await import('../../src/lib/r2-media-core.ts')

const configuredEnv = {
  NEXT_PUBLIC_MEDIA_ORIGIN: 'https://media.example.com',
  NEXT_PUBLIC_MEDIA_CUTOVER_READY: 'verified',
  CLOUDFLARE_ACCOUNT_ID: 'account-id',
  CLOUDFLARE_R2_BUCKET: 'test-r2-bucket',
  R2_ACCESS_KEY_ID: 'access-key',
  R2_SECRET_ACCESS_KEY: 'secret-key',
}

test('mirrors public media to the matching R2 key and verifies metadata', async () => {
  const commands: unknown[] = []
  const client = {
    async send(command: unknown) {
      commands.push(command)
      if (command instanceof CopyObjectCommand) {
        throw { name: 'NoSuchKey' }
      }
      if (command instanceof HeadObjectCommand) {
        return {
          ContentLength: 3,
          ContentType: 'image/webp',
          CacheControl: '31536000',
        }
      }
      return {}
    },
  }

  const mirrored = await mirrorPublicMediaObject(
    {
      bucket: 'show-artwork',
      key: 'shows/show-1/poster.webp',
      body: new Uint8Array([1, 2, 3]),
      contentType: 'image/webp',
      cacheControl: '31536000',
    },
    { env: configuredEnv, client: client as never }
  )

  assert.equal(mirrored, true)
  assert.equal(commands.length, 3)
  assert.ok(commands[0] instanceof CopyObjectCommand)
  assert.ok(commands[1] instanceof PutObjectCommand)
  assert.deepEqual((commands[1] as PutObjectCommand).input, {
    Bucket: 'test-r2-bucket',
    Key: 'show-artwork/shows/show-1/poster.webp',
    Body: new Uint8Array([1, 2, 3]),
    ContentType: 'image/webp',
    CacheControl: '31536000',
  })
  assert.ok(commands[2] instanceof HeadObjectCommand)
  assert.deepEqual((commands[2] as HeadObjectCommand).input, {
    Bucket: 'test-r2-bucket',
    Key: 'show-artwork/shows/show-1/poster.webp',
  })
})

test('removes a newly-written R2 object when mirror verification fails', async () => {
  const commands: unknown[] = []
  const client = {
    async send(command: unknown) {
      commands.push(command)
      if (command instanceof CopyObjectCommand) {
        throw { name: 'NoSuchKey' }
      }
      if (command instanceof HeadObjectCommand) {
        return {
          ContentLength: 2,
          ContentType: 'image/webp',
          CacheControl: '31536000',
        }
      }
      return {}
    },
  }

  await assert.rejects(
    mirrorPublicMediaObject(
      {
        bucket: 'show-artwork',
        key: 'shows/show-1/poster.webp',
        body: new Uint8Array([1, 2, 3]),
        contentType: 'image/webp',
        cacheControl: '31536000',
      },
      { env: configuredEnv, client: client as never }
    ),
    /Could not mirror public media to R2/
  )

  assert.ok(commands[3] instanceof DeleteObjectsCommand)
  assert.deepEqual((commands[3] as DeleteObjectsCommand).input.Delete, {
    Objects: [{ Key: 'show-artwork/shows/show-1/poster.webp' }],
    Quiet: true,
  })
})

test('restores an overwritten R2 object when mirror verification fails', async () => {
  const commands: unknown[] = []
  const client = {
    async send(command: unknown) {
      commands.push(command)
      if (command instanceof HeadObjectCommand) {
        return {
          ContentLength: 2,
          ContentType: 'image/webp',
          CacheControl: '31536000',
        }
      }
      return {}
    },
  }

  await assert.rejects(
    mirrorPublicMediaObject(
      {
        bucket: 'show-artwork',
        key: 'shows/show-1/poster.webp',
        body: new Uint8Array([1, 2, 3]),
        contentType: 'image/webp',
        cacheControl: '31536000',
      },
      { env: configuredEnv, client: client as never, transactionId: 'write-1' }
    ),
    /Could not mirror public media to R2/
  )

  assert.equal(commands.length, 5)
  assert.ok(commands[0] instanceof CopyObjectCommand)
  assert.deepEqual((commands[0] as CopyObjectCommand).input, {
    Bucket: 'test-r2-bucket',
    Key: '__clickit-write-backups/write-1/show-artwork/shows/show-1/poster.webp',
    CopySource: 'test-r2-bucket/show-artwork/shows/show-1/poster.webp',
    MetadataDirective: 'COPY',
  })
  assert.ok(commands[3] instanceof CopyObjectCommand)
  assert.deepEqual((commands[3] as CopyObjectCommand).input, {
    Bucket: 'test-r2-bucket',
    Key: 'show-artwork/shows/show-1/poster.webp',
    CopySource:
      'test-r2-bucket/__clickit-write-backups/write-1/show-artwork/shows/show-1/poster.webp',
    MetadataDirective: 'COPY',
  })
  assert.ok(commands[4] instanceof DeleteObjectsCommand)
})

test('signals an R2 rollback failure without treating the mirror as cleaned up', async () => {
  const commands: unknown[] = []
  const client = {
    async send(command: unknown) {
      commands.push(command)
      if (command instanceof CopyObjectCommand) {
        throw { name: 'NoSuchKey' }
      }
      if (command instanceof HeadObjectCommand) {
        return {
          ContentLength: 2,
          ContentType: 'image/webp',
          CacheControl: '31536000',
        }
      }
      if (command instanceof DeleteObjectsCommand) {
        return { Errors: [{ Key: 'show-artwork/shows/show-1/poster.webp' }] }
      }
      return {}
    },
  }

  await assert.rejects(
    mirrorPublicMediaObject(
      {
        bucket: 'show-artwork',
        key: 'shows/show-1/poster.webp',
        body: new Uint8Array([1, 2, 3]),
        contentType: 'image/webp',
        cacheControl: '31536000',
      },
      { env: configuredEnv, client: client as never }
    ),
    R2MediaRollbackError
  )

  assert.equal(
    commands.filter((command) => command instanceof DeleteObjectsCommand).length,
    2
  )
})

test('normalizes Blob media bodies to a Node Buffer before PutObject', async () => {
  const commands: unknown[] = []
  const client = {
    async send(command: unknown) {
      commands.push(command)
      if (command instanceof HeadObjectCommand) {
        return {
          ContentLength: 3,
          ContentType: 'image/webp',
          CacheControl: '31536000',
        }
      }
      return {}
    },
  }

  await mirrorPublicMediaObject(
    {
      bucket: 'show-artwork',
      key: 'shows/show-1/poster.webp',
      body: new Blob(['abc'], { type: 'image/webp' }),
      contentType: 'image/webp',
      cacheControl: '31536000',
    },
    { env: configuredEnv, client: client as never }
  )

  const put = commands.find(
    (command): command is PutObjectCommand => command instanceof PutObjectCommand
  )
  assert.ok(put)
  assert.ok(put.input.Body instanceof Buffer)
  assert.equal((put.input.Body as Buffer).toString(), 'abc')
})

test('fails closed before a public-media write when cutover lacks R2 credentials', () => {
  assert.throws(
    () =>
      assertPublicMediaWriteReady({
        NEXT_PUBLIC_MEDIA_ORIGIN: 'https://media.example.com',
        NEXT_PUBLIC_MEDIA_CUTOVER_READY: 'verified',
      }),
    /R2 media mirroring is required/
  )
  assert.doesNotThrow(() => assertPublicMediaWriteReady({}))
  assert.doesNotThrow(() =>
    assertPublicMediaWriteReady({
      NEXT_PUBLIC_MEDIA_ORIGIN: 'https://media.example.com',
    })
  )
})

test('fails closed before source deletion when cutover lacks R2 credentials', async () => {
  let sourceRemovalCalls = 0

  await assert.rejects(
    (async () => {
      const deletion = await prepareMirroredPublicMediaDeletion(
        'site-assets',
        ['hero/video.mp4'],
        {
          env: {
            NEXT_PUBLIC_MEDIA_ORIGIN: 'https://media.example.com',
            NEXT_PUBLIC_MEDIA_CUTOVER_READY: 'verified',
          },
        }
      )
      sourceRemovalCalls += 1
      await deletion.commit()
    })(),
    /R2 media mirroring is required/
  )
  assert.equal(sourceRemovalCalls, 0)
})

test('retains source media when its R2 mirror is missing', async () => {
  let sourceRemovalCalls = 0
  const client = {
    async send(command: unknown) {
      if (command instanceof CopyObjectCommand) {
        throw { name: 'NoSuchKey' }
      }
      return {}
    },
  }

  await assert.rejects(
    (async () => {
      const deletion = await prepareMirroredPublicMediaDeletion(
        'site-assets',
        ['hero/video.mp4'],
        { env: configuredEnv, client: client as never }
      )
      sourceRemovalCalls += 1
      await deletion.commit()
    })(),
    /Could not prepare public media deletion in R2/
  )
  assert.equal(sourceRemovalCalls, 0)
})

test('stages R2 media before deletion without removing the live object', async () => {
  const commands: unknown[] = []
  const client = {
    async send(command: unknown) {
      commands.push(command)
      return {}
    },
  }

  const deletion = await prepareMirroredPublicMediaDeletion(
    'site-assets',
    ['hero/video.mp4'],
    {
      env: configuredEnv,
      client: client as never,
      transactionId: 'transaction-1',
    }
  )

  assert.equal(commands.length, 1)
  assert.ok(commands[0] instanceof CopyObjectCommand)
  assert.deepEqual((commands[0] as CopyObjectCommand).input, {
    Bucket: 'test-r2-bucket',
    Key: '__clickit-delete-backups/transaction-1/site-assets/hero/video.mp4',
    CopySource: 'test-r2-bucket/site-assets/hero/video.mp4',
    MetadataDirective: 'COPY',
  })
  assert.equal(await deletion.rollback(), true)
  assert.equal(commands.length, 2)
  assert.ok(commands[1] instanceof DeleteObjectsCommand)
  assert.deepEqual((commands[1] as DeleteObjectsCommand).input, {
    Bucket: 'test-r2-bucket',
    Delete: {
      Objects: [
        {
          Key: '__clickit-delete-backups/transaction-1/site-assets/hero/video.mp4',
        },
      ],
      Quiet: true,
    },
  })
})

test('deletes R2 media only when the dependent deletion commits', async () => {
  const commands: unknown[] = []
  const client = {
    async send(command: unknown) {
      commands.push(command)
      return {}
    },
  }

  const deletion = await prepareMirroredPublicMediaDeletion(
    'avatars',
    ['user-1/avatar.webp'],
    {
      env: configuredEnv,
      client: client as never,
      transactionId: 'transaction-commit',
    }
  )

  assert.equal(await deletion.commit(), true)
  assert.equal(commands.length, 3)
  assert.ok(commands[1] instanceof DeleteObjectsCommand)
  assert.deepEqual((commands[1] as DeleteObjectsCommand).input.Delete, {
    Objects: [{ Key: 'avatars/user-1/avatar.webp' }],
    Quiet: true,
  })
  assert.ok(commands[2] instanceof DeleteObjectsCommand)
  assert.deepEqual((commands[2] as DeleteObjectsCommand).input.Delete, {
    Objects: [
      {
        Key: '__clickit-delete-backups/transaction-commit/avatars/user-1/avatar.webp',
      },
    ],
    Quiet: true,
  })
})

test('retains the staged backup when committed R2 deletion fails', async () => {
  const commands: unknown[] = []
  const client = {
    async send(command: unknown) {
      commands.push(command)
      if (command instanceof DeleteObjectsCommand) {
        const key = command.input.Delete?.Objects?.[0]?.Key
        if (key === 'site-assets/hero/video.mp4') {
          return { Errors: [{ Key: key }] }
        }
      }
      return {}
    },
  }
  const deletion = await prepareMirroredPublicMediaDeletion(
    'site-assets',
    ['hero/video.mp4'],
    {
      env: configuredEnv,
      client: client as never,
      transactionId: 'transaction-2',
    }
  )
  assert.equal(await deletion.commit(), false)
  assert.equal(commands.length, 3)
  assert.ok(commands[0] instanceof CopyObjectCommand)
  assert.ok(commands[1] instanceof DeleteObjectsCommand)
  assert.ok(commands[2] instanceof DeleteObjectsCommand)
})
