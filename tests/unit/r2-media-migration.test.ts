/* eslint-disable @typescript-eslint/no-explicit-any -- loose fakes for the S3 and Supabase clients */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { test } from 'node:test'
import {
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import sharp from 'sharp'

import {
  assertR2BucketAccess,
  assertManifestSourceOrigin,
  assertManifestDestinationBucket,
  assertWriteGuard,
  createManifest,
  createR2MediaManifest,
  executeManifest,
  runCopy,
  runFfmpegFaststart,
  downloadR2Object,
  downloadSourceObject,
  putR2Object,
  r2DestinationMetadataMatches,
  sourceIdentityMatches,
  validateR2MediaManifest,
  verifyR2DestinationMetadata,
} from '../../scripts/migrate-supabase-media-to-r2.mjs'
import { loadManifestInfo } from '../../scripts/cf/build-target.mjs'
import { isFaststart, topLevelBoxes } from '../../scripts/media/faststart.mjs'
import { manifestFileInfo } from '../../scripts/media/report.mjs'

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

test('R2 migration preflights R2 bucket access before source transfer', async () => {
  const commands: unknown[] = []
  const client = {
    async send(command: unknown) {
      commands.push(command)
      return {}
    },
  }

  await assertR2BucketAccess(client, 'test-r2-bucket')

  assert.equal(commands.length, 1)
  assert.ok(commands[0] instanceof HeadBucketCommand)
  assert.deepEqual((commands[0] as HeadBucketCommand).input, {
    Bucket: 'test-r2-bucket',
  })
})

test('R2 migration includes the downloaded source byte size in metadata', async () => {
  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), 'clickit-r2-migration-')
  )
  const destinationPath = join(temporaryDirectory, 'source-object')
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () =>
    new Response('media', {
      status: 200,
      headers: {
        'content-length': '5',
        'content-type': 'video/mp4',
        'cache-control': 'public, max-age=31536000',
      },
    })

  try {
    const source = await downloadSourceObject(
      {
        sourceBucket: 'site-assets',
        sourceKey: 'hero.mp4',
        destinationKey: 'site-assets/hero.mp4',
        source: {
          size: 5,
          etag: null,
          lastModified: null,
          contentType: 'video/mp4',
          cacheControl: 'public, max-age=31536000',
        },
      },
      'https://example.supabase.co',
      destinationPath
    )

    assert.equal(source.size, 5)
    assert.equal(source.metadata.size, 5)
  } finally {
    globalThis.fetch = originalFetch
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

test('R2 migration retries destination metadata before failing verification', async () => {
  const source = {
    size: 1024,
    contentType: 'video/mp4',
    cacheControl: 'public, max-age=31536000',
    contentDisposition: null,
    contentEncoding: null,
    contentLanguage: 'en',
  }
  const matchingDestination = {
    ContentLength: 1024,
    ContentType: 'video/mp4',
    CacheControl: 'public, max-age=31536000',
    ContentLanguage: 'en',
  }
  const commands: unknown[] = []
  const client = {
    async send(command: unknown) {
      commands.push(command)
      return commands.length === 1
        ? { ...matchingDestination, ContentType: 'application/octet-stream' }
        : matchingDestination
    },
  }

  const destination = await verifyR2DestinationMetadata(
    client,
    'test-r2-bucket',
    'site-assets/hero.mp4',
    source,
    { attempts: 2, delayMs: 0 }
  )

  assert.equal(commands.length, 2)
  assert.ok(commands.every((command) => command instanceof HeadObjectCommand))
  assert.deepEqual(destination, {
    size: 1024,
    contentType: 'video/mp4',
    cacheControl: 'public, max-age=31536000',
    contentDisposition: null,
    contentEncoding: null,
    contentLanguage: 'en',
  })
})

// ---------------------------------------------------------------------------
// Plan 02-08: dry run, variants, remux, idempotency, checksum report
// ---------------------------------------------------------------------------

const ORIGIN = 'https://example.supabase.co'
const CLICKIT_ACCOUNT = 'e329b099b6e4272fc0915a99832e47fe'
const sha256 = (buffer: Uint8Array) =>
  createHash('sha256').update(buffer).digest('hex')

function mp4Box(type: string, payloadLength: number, fill: number) {
  const bytes = Buffer.alloc(8 + payloadLength, fill)
  bytes.writeUInt32BE(bytes.length, 0)
  bytes.write(type, 4, 'latin1')
  return bytes
}
const slowMp4 = () =>
  Buffer.concat([mp4Box('ftyp', 12, 1), mp4Box('mdat', 200, 2), mp4Box('moov', 60, 3)])
const fastMp4 = () =>
  Buffer.concat([mp4Box('ftyp', 12, 1), mp4Box('moov', 60, 3), mp4Box('mdat', 200, 2)])

// Fake ffmpeg: moves moov in front of mdat, otherwise byte-identical boxes.
function fakeRemux(inputPath: string, outputPath: string) {
  const bytes = readFileSync(inputPath)
  const boxes = topLevelBoxes(new Uint8Array(bytes))
  const slice = (type: string) =>
    boxes
      .filter((box: { type: string }) => box.type === type)
      .map((box: { offset: number; size: number }) =>
        bytes.subarray(box.offset, box.offset + box.size)
      )
  const out = Buffer.concat([...slice('ftyp'), ...slice('moov'), ...slice('mdat')])
  return writeFile(outputPath, out)
}

type StoredObject = { body: Buffer; input: Record<string, any> }

function createFakeR2() {
  const objects = new Map<string, StoredObject>()
  const puts: string[] = []
  const calls: string[] = []
  const notFound = () =>
    Object.assign(new Error('NotFound'), {
      name: 'NotFound',
      $metadata: { httpStatusCode: 404 },
    })
  const client = {
    async send(command: any) {
      calls.push(command.constructor.name)
      if (command instanceof HeadBucketCommand) return {}
      if (command instanceof PutObjectCommand) {
        const chunks: Buffer[] = []
        for await (const chunk of command.input.Body as AsyncIterable<Buffer>) {
          chunks.push(Buffer.from(chunk))
        }
        objects.set(command.input.Key as string, {
          body: Buffer.concat(chunks),
          input: { ...command.input, Body: undefined },
        })
        puts.push(command.input.Key as string)
        return {}
      }
      const stored = objects.get((command.input as { Key: string }).Key)
      if (!stored) throw notFound()
      if (command instanceof GetObjectCommand) {
        return { Body: Readable.from([stored.body]) }
      }
      if (command instanceof HeadObjectCommand) {
        return {
          ContentLength: stored.body.length,
          ContentType: stored.input.ContentType,
          CacheControl: stored.input.CacheControl,
          ContentDisposition: stored.input.ContentDisposition,
          ContentEncoding: stored.input.ContentEncoding,
          ContentLanguage: stored.input.ContentLanguage,
          Metadata: stored.input.Metadata ?? {},
          ETag: `"${createHash('md5').update(stored.body).digest('hex')}"`,
        }
      }
      throw new Error(`unexpected command ${command.constructor.name}`)
    },
  }
  return { client, objects, puts, calls }
}

type SourceFile = { body: Buffer; contentType: string }

function createFakeSupabase(files: Record<string, SourceFile>, appConfig: unknown[]) {
  const writes: string[] = []
  const selects: string[] = []
  const list = async (bucket: string, prefix: string) => {
    const base = `${bucket}/${prefix ? `${prefix}/` : ''}`
    const children = new Map<string, any>()
    for (const [path, file] of Object.entries(files)) {
      if (!path.startsWith(base)) continue
      const rest = path.slice(base.length)
      const [name, ...more] = rest.split('/')
      if (more.length) children.set(name, { name, id: null })
      else {
        children.set(name, {
          name,
          id: `id-${name}`,
          metadata: { size: file.body.length, mimetype: file.contentType },
        })
      }
    }
    return { data: [...children.values()], error: null }
  }
  return {
    writes,
    selects,
    storage: { from: (bucket: string) => ({ list: (prefix: string) => list(bucket, prefix) }) },
    from: (table: string) =>
      new Proxy(
        {
          select: (columns: string) => {
            selects.push(`${table}:${columns}`)
            return Promise.resolve({ data: appConfig, error: null })
          },
        },
        {
          get(target, property) {
            if (property === 'select') return target.select
            if (property === 'then') return undefined
            writes.push(String(property))
            return undefined
          },
        }
      ),
  }
}

async function makeFixture() {
  const poster = await sharp({
    create: { width: 1500, height: 300, channels: 3, background: '#445566' },
  })
    .png()
    .toBuffer()
  const small = await sharp({
    create: { width: 500, height: 100, channels: 3, background: '#112233' },
  })
    .png()
    .toBuffer()
  const files: Record<string, SourceFile> = {
    'show-artwork/poster.png': { body: poster, contentType: 'image/png' },
    'show-artwork/small.png': { body: small, contentType: 'image/png' },
    'site-assets/logo.svg': { body: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), contentType: 'image/svg+xml' },
    'site-assets/hero-slow.mp4': { body: slowMp4(), contentType: 'video/mp4' },
    'site-assets/hero-fast.mp4': { body: fastMp4(), contentType: 'video/mp4' },
  }
  const appConfig = [
    {
      footer_content: {
        banner: `${ORIGIN}/storage/v1/object/public/site-assets/missing-banner.jpg?x=1`,
        logo: 'https://media.clickitstory.ae/show-artwork/poster.png',
      },
      hero_description: `See ${ORIGIN}/storage/v1/object/public/avatars/ghost.png.`,
      site_title: 'Clickit',
    },
  ]
  const dir = await mkdtemp(join(tmpdir(), 'clickit-r2-copy-test-'))
  const supabase = createFakeSupabase(files, appConfig)
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: ORIGIN,
    SUPABASE_SERVICE_ROLE_KEY: 'test-only',
    CLOUDFLARE_R2_BUCKET: 'clickit-media',
  }
  const manifestPath = join(dir, 'manifest.json')
  const reportDir = join(dir, 'reports')
  const silent = () => {}

  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (input: any) => {
    const path = decodeURIComponent(new URL(String(input)).pathname)
    const prefix = '/storage/v1/object/public/'
    const file = path.startsWith(prefix) ? files[path.slice(prefix.length)] : undefined
    if (!file) return new Response('missing', { status: 404 })
    return new Response(new Uint8Array(file.body), {
      status: 200,
      headers: {
        'content-type': file.contentType,
        'content-length': String(file.body.length),
      },
    })
  }) as typeof fetch

  return {
    files,
    supabase,
    env,
    dir,
    manifestPath,
    reportDir,
    async dryRun() {
      return createManifest(
        { manifestPath, refresh: true, execute: false, buckets: [] },
        {
          env,
          supabase,
          reportDir,
          log: silent,
          runFfprobe: () => ({ durationSeconds: 12.5, bitRate: 4_000_000 }),
        }
      )
    },
    async copy(r2: ReturnType<typeof createFakeR2>, extra: Record<string, unknown> = {}) {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
      return runCopy({
        manifest,
        bucket: 'clickit-media',
        sourceOrigin: ORIGIN,
        r2Client: r2.client,
        ...manifestFileInfo(manifestPath),
        reportDir,
        runFfmpeg: fakeRemux,
        log: silent,
        ...extra,
      })
    },
    async cleanup() {
      globalThis.fetch = originalFetch
      await rm(dir, { recursive: true, force: true })
    },
  }
}

test('02-08 dry run writes manifest and reports, reads app_config select-only, and makes no R2 call', async () => {
  const fixture = await makeFixture()
  const sendOriginal = S3Client.prototype.send
  let s3Calls = 0
  ;(S3Client.prototype as any).send = function () {
    s3Calls += 1
    throw new Error('R2 must not be called in a dry run')
  }
  try {
    const { report, paths } = await fixture.dryRun()
    assert.equal(s3Calls, 0)
    assert.ok(existsSync(fixture.manifestPath))
    assert.ok(existsSync(paths.jsonPath) && existsSync(paths.mdPath))
    assert.match(paths.jsonPath, /dry-run-.*\.json$/)

    assert.equal(report.manifestObjectCount, Object.keys(fixture.files).length)
    const byKey = Object.fromEntries(
      report.objects.map((object: { key: string }) => [object.key, object])
    )
    const poster = byKey['show-artwork/poster.png']
    assert.equal(poster.contentType, 'image/png')
    assert.equal(poster.size, fixture.files['show-artwork/poster.png'].body.length)
    assert.equal(poster.sha256, sha256(fixture.files['show-artwork/poster.png'].body))
    assert.equal(poster.width, 1500)
    assert.deepEqual(
      [...poster.plannedVariants].sort(),
      [
        '_v/1280/avif/show-artwork/poster.png',
        '_v/1280/webp/show-artwork/poster.png',
        '_v/640/avif/show-artwork/poster.png',
        '_v/640/webp/show-artwork/poster.png',
      ]
    )
    assert.match(byKey['site-assets/logo.svg'].skipReason, /svg/)
    assert.match(byKey['site-assets/hero-slow.mp4'].skipReason, /video/)
    assert.equal(byKey['show-artwork/small.png'].plannedVariants.length, 0)
    assert.equal(byKey['site-assets/hero-slow.mp4'].faststart, false)
    assert.equal(byKey['site-assets/hero-slow.mp4'].willRemux, true)
    assert.equal(byKey['site-assets/hero-fast.mp4'].faststart, true)
    assert.equal(byKey['site-assets/hero-fast.mp4'].durationSeconds, 12.5)
    assert.equal(byKey['site-assets/hero-fast.mp4'].bitRate, 4_000_000)
    assert.equal(report.totals.byType['image/png'].count, 2)
    assert.equal(report.totals.plannedVariants, 4)
    assert.equal(report.totals.remuxPlanned, 1)
    assert.deepEqual(
      report.referencedNotInManifest.map((ref: { bucket: string; key: string }) => `${ref.bucket}/${ref.key}`),
      ['avatars/ghost.png', 'site-assets/missing-banner.jpg']
    )
    assert.ok(
      report.referencedNotInManifest.every((ref: { url: string }) => !ref.url.includes('?'))
    )

    // Supabase: one select on app_config, no youtube_api_key, no write call of any kind.
    assert.equal(fixture.supabase.selects.length, 1)
    assert.doesNotMatch(fixture.supabase.selects[0], /youtube_api_key|admin_user_id/)
    assert.deepEqual(fixture.supabase.writes, [])

    const markdown = await readFile(paths.mdPath, 'utf8')
    assert.match(markdown, /Planned variants: 4/)
    assert.match(markdown, /missing-banner\.jpg/)
    assert.doesNotMatch(markdown, /test-only/)
  } finally {
    ;(S3Client.prototype as any).send = sendOriginal
    await fixture.cleanup()
  }
})

test('02-08 dry run needs no R2 credentials and refuses an existing manifest without --refresh', async () => {
  const fixture = await makeFixture()
  try {
    await fixture.dryRun()
    await assert.rejects(
      createManifest(
        { manifestPath: fixture.manifestPath, refresh: false, execute: false, buckets: [] },
        { env: fixture.env, supabase: fixture.supabase, reportDir: fixture.reportDir, log: () => {} }
      ),
      /Manifest already exists/
    )
  } finally {
    await fixture.cleanup()
  }
})

test('02-08 execute on a fresh bucket copies originals byte-for-byte, writes variants and remux, and reports every row', async () => {
  const fixture = await makeFixture()
  try {
    await fixture.dryRun()
    const r2 = createFakeR2()
    const { report, paths } = await fixture.copy(r2)

    assert.deepEqual(report.failures, [])
    // 5 originals (4 + 1 remuxed), 4 variants, 1 original kept = 10 distinct puts.
    assert.equal(r2.puts.length, 10)
    assert.equal(new Set(r2.puts).size, 10)
    assert.equal(report.summary.originals, report.manifestObjectCount)
    assert.equal(report.summary.variants, 4)
    assert.equal(report.summary.remuxed, 1)
    assert.equal(report.summary.originalsKept, 1)
    assert.equal(report.summary.unverified, 0)
    assert.ok(existsSync(paths.jsonPath) && existsSync(paths.mdPath))

    for (const row of report.rows) {
      assert.ok(row.verified)
      assert.ok(row.dstEtag)
      assert.equal(r2.objects.get(row.dstKey)?.body.length, row.dstSize)
      assert.equal(sha256(r2.objects.get(row.dstKey)!.body), row.dstSha256)
    }
    const originals = report.rows.filter((row: { role: string }) => row.role === 'original')
    assert.equal(originals.length, 4)
    for (const row of originals) assert.equal(row.dstSha256, row.srcSha256)

    const variant = r2.objects.get('_v/640/webp/show-artwork/poster.png')!
    assert.equal(variant.input.Metadata['src-sha256'], sha256(fixture.files['show-artwork/poster.png'].body))
    assert.equal(variant.input.Metadata['variant-spec'], 'v1;w=640;fmt=webp;q=80')
    assert.equal(variant.input.ContentType, 'image/webp')
    assert.equal((await sharp(variant.body).metadata()).width, 640)
    assert.equal((await sharp(r2.objects.get('_v/1280/avif/show-artwork/poster.png')!.body).metadata()).width, 1280)
    assert.equal(r2.objects.has('_v/640/webp/show-artwork/small.png'), false)
    assert.equal(r2.objects.has('_v/640/webp/site-assets/logo.svg'), false)
    assert.equal(r2.objects.has('_orig/site-assets/hero-fast.mp4'), false)
  } finally {
    await fixture.cleanup()
  }
})

test('02-08 a second execute changes nothing and reports every row as skipped (identical)', async () => {
  const fixture = await makeFixture()
  try {
    await fixture.dryRun()
    const r2 = createFakeR2()
    await fixture.copy(r2)
    const putsAfterFirst = r2.puts.length
    const snapshot = new Map([...r2.objects].map(([key, value]) => [key, sha256(value.body)]))

    const { report } = await fixture.copy(r2)
    assert.equal(r2.puts.length, putsAfterFirst)
    assert.equal(report.rows.length, 10)
    assert.ok(report.rows.every((row: { status: string }) => row.status === 'skipped (identical)'))
    assert.equal(report.summary.copiedOrWritten, 0)
    for (const [key, value] of r2.objects) assert.equal(sha256(value.body), snapshot.get(key))
  } finally {
    await fixture.cleanup()
  }
})

test('02-08 changing the variant spec version regenerates only the variants', async () => {
  const fixture = await makeFixture()
  try {
    await fixture.dryRun()
    const r2 = createFakeR2()
    await fixture.copy(r2)
    const before = r2.puts.length
    const { report } = await fixture.copy(r2, { specVersion: 'v2' })

    const newPuts = r2.puts.slice(before)
    assert.equal(newPuts.length, 4)
    assert.ok(newPuts.every((key) => key.startsWith('_v/')))
    assert.equal(
      r2.objects.get('_v/640/webp/show-artwork/poster.png')!.input.Metadata['variant-spec'],
      'v2;w=640;fmt=webp;q=80'
    )
    const rewritten = report.rows.filter((row: { status: string }) => row.status === 'written')
    assert.equal(rewritten.length, 4)
    assert.ok(
      report.rows
        .filter((row: { role: string }) => row.role !== 'variant')
        .every((row: { status: string }) => row.status === 'skipped (identical)')
    )
  } finally {
    await fixture.cleanup()
  }
})

test('02-08 a non-faststart MP4 is remuxed at the served key, the untouched original is kept in _orig, both hashes recorded', async () => {
  const fixture = await makeFixture()
  try {
    await fixture.dryRun()
    const r2 = createFakeR2()
    const { report } = await fixture.copy(r2)
    const source = fixture.files['site-assets/hero-slow.mp4'].body

    const served = r2.objects.get('site-assets/hero-slow.mp4')!
    assert.equal(isFaststart(new Uint8Array(served.body)), true)
    assert.equal(served.input.Metadata.transform, 'ffmpeg:faststart')
    assert.equal(served.input.Metadata['src-sha256'], sha256(source))
    assert.deepEqual(r2.objects.get('_orig/site-assets/hero-slow.mp4')!.body, source)

    const remux = report.rows.find((row: { role: string }) => row.role === 'video-remux')
    assert.equal(remux.transform, 'ffmpeg:faststart')
    assert.equal(remux.status, 'remuxed')
    assert.equal(remux.srcSha256, sha256(source))
    assert.equal(remux.dstSha256, sha256(served.body))
    assert.notEqual(remux.srcSha256, remux.dstSha256)
    const kept = report.rows.find((row: { role: string }) => row.role === 'original-kept')
    assert.equal(kept.dstKey, '_orig/site-assets/hero-slow.mp4')
    assert.equal(kept.dstSha256, sha256(source))

    // A faststart MP4 is copied unchanged.
    assert.deepEqual(
      r2.objects.get('site-assets/hero-fast.mp4')!.body,
      fixture.files['site-assets/hero-fast.mp4'].body
    )
  } finally {
    await fixture.cleanup()
  }
})

test('02-08 a remux that is not faststart is rejected and nothing is served for that key', async () => {
  const fixture = await makeFixture()
  try {
    await fixture.dryRun()
    const r2 = createFakeR2()
    const { report } = await fixture.copy(r2, {
      runFfmpeg: (input: string, output: string) => writeFile(output, readFileSync(input)),
    })
    assert.equal(report.failures.length, 1)
    assert.match(report.failures[0].error, /not faststart/)
    assert.equal(r2.objects.has('site-assets/hero-slow.mp4'), false)
  } finally {
    await fixture.cleanup()
  }
})

test('02-08 a differing existing original is never overwritten and the report is still written', async () => {
  const fixture = await makeFixture()
  try {
    await fixture.dryRun()
    const r2 = createFakeR2()
    r2.objects.set('show-artwork/small.png', {
      body: Buffer.from('someone else'),
      input: { ContentType: 'image/png' },
    })
    const { report, paths } = await fixture.copy(r2)
    assert.equal(report.failures.length, 1)
    assert.match(report.failures[0].error, /Destination conflict/)
    assert.equal(report.failures[0].key, 'show-artwork/small.png')
    assert.equal(r2.objects.get('show-artwork/small.png')!.body.toString(), 'someone else')
    assert.ok(!r2.puts.includes('show-artwork/small.png'))
    assert.ok(existsSync(paths.jsonPath))
    // The other objects were still copied.
    assert.ok(r2.objects.has('show-artwork/poster.png'))
  } finally {
    await fixture.cleanup()
  }
})

test('02-08 a foreign object at a variant key is a conflict, a stale variant of ours is regenerated', async () => {
  const fixture = await makeFixture()
  try {
    await fixture.dryRun()
    const r2 = createFakeR2()
    r2.objects.set('_v/640/avif/show-artwork/poster.png', {
      body: Buffer.from('foreign'),
      input: { ContentType: 'image/avif' },
    })
    const { report } = await fixture.copy(r2)
    assert.equal(report.failures.length, 1)
    assert.match(report.failures[0].error, /Destination conflict for _v\/640\/avif/)
    assert.equal(r2.objects.get('_v/640/avif/show-artwork/poster.png')!.body.toString(), 'foreign')
  } finally {
    await fixture.cleanup()
  }
})

test('02-08 copy and dry-run output agree with the deploy guard manifest identity (loadManifestInfo)', async () => {
  const fixture = await makeFixture()
  try {
    const { report: dry } = await fixture.dryRun()
    const info = loadManifestInfo(fixture.manifestPath)
    assert.equal(dry.manifestSha256, info.manifestSha256)
    assert.equal(dry.manifestObjectCount, info.manifestObjectCount)
    assert.equal(
      info.manifestSha256,
      sha256(readFileSync(fixture.manifestPath))
    )

    const r2 = createFakeR2()
    const { report } = await fixture.copy(r2)
    assert.equal(report.manifestSha256, info.manifestSha256)
    assert.equal(report.manifestObjectCount, info.manifestObjectCount)
    assert.equal(report.summary.originals, info.manifestObjectCount)
    // The copy does not rewrite the manifest, so the identity is stable after a run.
    assert.deepEqual(loadManifestInfo(fixture.manifestPath), info)
    assert.ok((await readdir(fixture.reportDir)).some((name) => name.startsWith('copy-')))
  } finally {
    await fixture.cleanup()
  }
})

test('02-08 the write path needs the ClickitStory account, the clickit-media bucket and no API token', async () => {
  const good = { CLOUDFLARE_ACCOUNT_ID: CLICKIT_ACCOUNT, CLOUDFLARE_R2_BUCKET: 'clickit-media' }
  assert.doesNotThrow(() => assertWriteGuard(good, 'clickit-media'))
  assert.throws(
    () => assertWriteGuard({ ...good, CLOUDFLARE_ACCOUNT_ID: '0'.repeat(32) }, 'clickit-media'),
    /not the ClickitStory account/
  )
  assert.throws(() => assertWriteGuard({}, 'clickit-media'), /not the ClickitStory account/)
  assert.throws(() => assertWriteGuard(good, 'another-bucket'), /must be clickit-media/)
  assert.throws(
    () => assertWriteGuard({ ...good, CLOUDFLARE_API_TOKEN: 'x' }, 'clickit-media'),
    /CLOUDFLARE_API_TOKEN/
  )

  const fixture = await makeFixture()
  try {
    await fixture.dryRun()
    const r2 = createFakeR2()
    await assert.rejects(
      executeManifest(
        { manifestPath: fixture.manifestPath, execute: true, refresh: false, buckets: [] },
        {
          env: { ...fixture.env, CLOUDFLARE_ACCOUNT_ID: '1'.repeat(32), R2_ACCESS_KEY_ID: 'a', R2_SECRET_ACCESS_KEY: 'b' },
          r2Client: r2.client,
          reportDir: fixture.reportDir,
          log: () => {},
        }
      ),
      /not the ClickitStory account/
    )
    assert.equal(r2.calls.length, 0)
  } finally {
    await fixture.cleanup()
  }
})

test('02-08 executeManifest runs end to end through the guard with an injected client', async () => {
  const fixture = await makeFixture()
  try {
    await fixture.dryRun()
    const r2 = createFakeR2()
    const report = await executeManifest(
      { manifestPath: fixture.manifestPath, execute: true, refresh: false, buckets: [] },
      {
        env: {
          ...fixture.env,
          CLOUDFLARE_ACCOUNT_ID: CLICKIT_ACCOUNT,
          R2_ACCESS_KEY_ID: 'a',
          R2_SECRET_ACCESS_KEY: 'b',
        },
        r2Client: r2.client,
        reportDir: fixture.reportDir,
        runFfmpeg: fakeRemux,
        log: () => {},
      }
    )
    assert.equal(report.summary.originals, 5)
    assert.equal(report.failures.length, 0)
  } finally {
    await fixture.cleanup()
  }
})

test('02-08 a missing ffmpeg fails clearly and never downloads anything', () => {
  const previous = process.env.FFMPEG_PATH
  process.env.FFMPEG_PATH = '/nonexistent/ffmpeg-binary'
  try {
    assert.throws(
      () => runFfmpegFaststart('/tmp/in.mp4', '/tmp/out.mp4'),
      /ffmpeg was not found on PATH.*never downloads binaries/
    )
  } finally {
    if (previous === undefined) delete process.env.FFMPEG_PATH
    else process.env.FFMPEG_PATH = previous
  }
})

const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0
test('02-08 real ffmpeg remux makes a non-faststart MP4 faststart without re-encoding', { skip: !hasFfmpeg }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'clickit-r2-ffmpeg-'))
  try {
    const input = join(dir, 'in.mp4')
    const output = join(dir, 'out.mp4')
    const made = spawnSync('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'lavfi', '-i', 'testsrc=duration=1:size=64x64:rate=10',
      '-c:v', 'mpeg4', input,
    ])
    assert.equal(made.status, 0)
    assert.equal(isFaststart(new Uint8Array(readFileSync(input).subarray(0, 65536))), false)
    runFfmpegFaststart(input, output)
    assert.equal(isFaststart(new Uint8Array(readFileSync(output).subarray(0, 65536))), true)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('02-08 the copy script has no .vercel path, no hard-coded object count and no delete call', () => {
  const files = [
    '../../scripts/migrate-supabase-media-to-r2.mjs',
    '../../scripts/media/variants.mjs',
    '../../scripts/media/faststart.mjs',
    '../../scripts/media/report.mjs',
  ]
  for (const file of files) {
    const text = readFileSync(new URL(file, import.meta.url), 'utf8')
    assert.doesNotMatch(text, /\.vercel/, file)
    assert.doesNotMatch(text, /\b86\b/, file)
    assert.doesNotMatch(text, /Delete(Object|Objects)?Command|\.remove\(/, file)
  }
})
