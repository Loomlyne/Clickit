import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { test } from 'node:test'
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'

import {
  assertManifestSourceOrigin,
  assertManifestDestinationBucket,
  createR2MediaManifest,
  downloadR2Object,
  putR2Object,
  r2DestinationMetadataMatches,
  sourceIdentityMatches,
  validateR2MediaManifest,
} from '../../scripts/migrate-supabase-media-to-r2.mjs'

test('R2 migration manifest keeps the Supabase bucket and object key unchanged', () => {
  const manifest = createR2MediaManifest({
    sourceOrigin: 'https://example.supabase.co/path-that-is-not-kept',
    destinationBucket: 'test-r2-bucket',
    objects: [
      {
        sourceBucket: 'site-assets',
        sourceKey: 'hero/video.mp4',
        source: {
          size: 1024,
          contentType: 'video/mp4',
          cacheControl: 'public, max-age=31536000',
          etag: 'source-etag',
          lastModified: '2026-07-24T12:00:00.000Z',
        },
      },
      {
        sourceBucket: 'show-artwork',
        sourceKey: 'shows/a/poster.webp',
        source: {
          size: 512,
          contentType: 'image/webp',
          cacheControl: null,
          etag: null,
          lastModified: null,
        },
      },
    ],
  })

  assert.equal(manifest.sourceOrigin, 'https://example.supabase.co')
  assert.deepEqual(
    manifest.objects.map((object) => object.destinationKey),
    ['show-artwork/shows/a/poster.webp', 'site-assets/hero/video.mp4']
  )
  assert.equal('delete' in manifest.objects[0], false)
  assert.doesNotThrow(() => validateR2MediaManifest(manifest))
})
test('R2 migration refuses manifests whose destination differs from source bucket and key', () => {
  const manifest = createR2MediaManifest({
    sourceOrigin: 'https://example.supabase.co',
    objects: [
      {
        sourceBucket: 'avatars',
        sourceKey: 'user.png',
        source: {
          size: 1,
          contentType: null,
          cacheControl: null,
          etag: null,
          lastModified: null,
        },
      },
    ],
  })
  manifest.objects[0].destinationKey = 'another-bucket/user.png'

  assert.throws(
    () => validateR2MediaManifest(manifest),
    /Unexpected destination key/
  )
})

test('R2 migration execution is bound to the reviewed destination bucket', () => {
  const manifest = createR2MediaManifest({
    sourceOrigin: 'https://example.supabase.co',
    destinationBucket: 'test-r2-bucket',
    objects: [],
  })

  assert.doesNotThrow(() =>
    assertManifestDestinationBucket(manifest, 'test-r2-bucket')
  )
  assert.throws(
    () => assertManifestDestinationBucket(manifest, 'another-bucket'),
    /does not match the reviewed manifest/
  )
  assert.throws(
    () =>
      assertManifestDestinationBucket(
        { ...manifest, destinationBucket: null },
        'test-r2-bucket'
      ),
    /does not match the reviewed manifest/
  )
})

test('R2 migration execution is bound to the current Supabase source origin', () => {
  const manifest = createR2MediaManifest({
    sourceOrigin: 'https://example.supabase.co',
    destinationBucket: 'test-r2-bucket',
    objects: [],
  })

  assert.equal(
    assertManifestSourceOrigin(manifest, 'https://example.supabase.co/'),
    'https://example.supabase.co'
  )
  assert.throws(
    () => assertManifestSourceOrigin(manifest, 'https://other.supabase.co'),
    /NEXT_PUBLIC_SUPABASE_URL does not match the reviewed manifest source origin/
  )
})

test('R2 migration rejects same-length source changes from ETag or last-modified', () => {
  const manifestSource = {
    size: 1024,
    etag: '"source-v1"',
    lastModified: '2026-07-24T12:00:00.000Z',
  }

  assert.equal(
    sourceIdentityMatches(manifestSource, {
      etag: 'source-v1',
      lastModified: 'Fri, 24 Jul 2026 12:00:00 GMT',
    }),
    true
  )
  assert.equal(
    sourceIdentityMatches(manifestSource, {
      etag: 'source-v2',
      lastModified: 'Fri, 24 Jul 2026 12:00:00 GMT',
    }),
    false
  )
  assert.equal(
    sourceIdentityMatches(manifestSource, {
      etag: 'source-v1',
      lastModified: 'Sat, 25 Jul 2026 12:00:00 GMT',
    }),
    false
  )
  assert.equal(
    sourceIdentityMatches(
      { ...manifestSource, etag: null },
      { etag: 'source-v1' }
    ),
    false
  )
})

test('R2 migration compares Last-Modified at HTTP second precision', () => {
  assert.equal(
    sourceIdentityMatches(
      {
        size: 1024,
        etag: '"source-v1"',
        lastModified: '2026-07-24T12:00:00.574Z',
      },
      {
        etag: 'source-v1',
        lastModified: 'Fri, 24 Jul 2026 12:00:00 GMT',
      }
    ),
    true
  )
})

test('R2 migration rejects source responses missing reviewed identity headers', () => {
  const manifestSource = {
    size: 1024,
    etag: 'source-v1',
    lastModified: '2026-07-24T12:00:00.000Z',
  }

  assert.equal(
    sourceIdentityMatches(manifestSource, {
      lastModified: 'Fri, 24 Jul 2026 12:00:00 GMT',
    }),
    false
  )
  assert.equal(
    sourceIdentityMatches(manifestSource, { etag: 'source-v1' }),
    false
  )
})

test('R2 migration allows an identity-less manifest only without source validators', () => {
  const manifestSource = {
    size: 1024,
    etag: null,
    lastModified: null,
  }

  assert.equal(sourceIdentityMatches(manifestSource), true)
  assert.equal(
    sourceIdentityMatches(manifestSource, { etag: 'source-v1' }),
    false
  )
})

test('R2 migration uses S3 commands for direct object transfer', async () => {
  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), 'clickit-r2-migration-')
  )
  const sourcePath = join(temporaryDirectory, 'source-object')
  const destinationPath = join(temporaryDirectory, 'destination-object')
  const commands: unknown[] = []
  const client = {
    async send(command: unknown) {
      commands.push(command)
      if (command instanceof GetObjectCommand) {
        return { Body: Readable.from(['media']) }
      }
      return {}
    },
  }

  try {
    await writeFile(sourcePath, 'media')
    await putR2Object(
      client,
      'test-r2-bucket',
      'site-assets/hero.mp4',
      sourcePath,
      {
        size: 5,
        contentType: 'video/mp4',
        cacheControl: 'public, max-age=31536000',
        contentDisposition: null,
        contentEncoding: null,
        contentLanguage: 'en',
      }
    )
    assert.equal(
      await downloadR2Object(
        client,
        'test-r2-bucket',
        'site-assets/hero.mp4',
        destinationPath
      ),
      true
    )

    assert.equal(await readFile(destinationPath, 'utf8'), 'media')
    assert.equal(commands.length, 2)
    assert.ok(commands[0] instanceof PutObjectCommand)
    assert.ok(commands[1] instanceof GetObjectCommand)
    assert.deepEqual(
      (commands[0] as PutObjectCommand).input.Bucket,
      'test-r2-bucket'
    )
    assert.deepEqual(
      (commands[0] as PutObjectCommand).input.Key,
      'site-assets/hero.mp4'
    )
    assert.equal((commands[0] as PutObjectCommand).input.ContentLength, 5)
    assert.equal(
      (commands[0] as PutObjectCommand).input.ContentType,
      'video/mp4'
    )
    assert.deepEqual((commands[1] as GetObjectCommand).input, {
      Bucket: 'test-r2-bucket',
      Key: 'site-assets/hero.mp4',
    })
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true })
  }
})

test('R2 migration rejects matching bytes with mismatched destination metadata', () => {
  const source = {
    size: 1024,
    contentType: 'video/mp4',
    cacheControl: 'public, max-age=31536000',
    contentDisposition: null,
    contentEncoding: null,
    contentLanguage: 'en',
  }
  const destination = {
    ContentLength: 1024,
    ContentType: 'video/mp4',
    CacheControl: 'public, max-age=31536000',
    ContentDisposition: undefined,
    ContentEncoding: undefined,
    ContentLanguage: 'en',
  }

  assert.equal(r2DestinationMetadataMatches(source, destination), true)
  assert.equal(
    r2DestinationMetadataMatches(source, {
      ...destination,
      ContentType: 'application/octet-stream',
    }),
    false
  )
})
