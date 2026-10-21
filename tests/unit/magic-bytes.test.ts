import assert from 'node:assert/strict'
import test from 'node:test'
import { sniffMediaType } from '../../src/server/magic-bytes.ts'

const enc = (s: string) => new TextEncoder().encode(s)
const ftyp = (brand: string) =>
  new Uint8Array([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, ...enc(brand), 0, 0, 0, 0])

test('JPEG, PNG, WebP, GIF, ICO signatures', () => {
  assert.equal(sniffMediaType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0])), 'image/jpeg')
  assert.equal(
    sniffMediaType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])),
    'image/png'
  )
  assert.equal(
    sniffMediaType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50])),
    'image/webp'
  )
  assert.equal(sniffMediaType(enc('GIF89a....')), 'image/gif')
  assert.equal(sniffMediaType(new Uint8Array([0, 0, 1, 0, 1, 0])), 'image/x-icon')
})

test('RIFF without WEBP (a WAV or AVI) is not WebP', () => {
  assert.equal(
    sniffMediaType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45])),
    null
  )
})

test('ftyp avif/avis is AVIF', () => {
  assert.equal(sniffMediaType(ftyp('avif')), 'image/avif')
  assert.equal(sniffMediaType(ftyp('avis')), 'image/avif')
})

test('ftyp mp4 brands are video/mp4', () => {
  for (const brand of ['isom', 'mp42', 'mp41', 'avc1', 'iso2', 'M4V ']) {
    assert.equal(sniffMediaType(ftyp(brand)), 'video/mp4', brand)
  }
})

test('ftyp with an unknown brand is not accepted', () => {
  assert.equal(sniffMediaType(ftyp('heic')), null)
  assert.equal(sniffMediaType(ftyp('qt  ')), null)
})

test('SVG, XML and HTML are text/markup', () => {
  assert.equal(sniffMediaType(enc('<svg xmlns="http://www.w3.org/2000/svg"/>')), 'text/markup')
  assert.equal(sniffMediaType(enc('<?xml version="1.0"?><svg/>')), 'text/markup')
  assert.equal(sniffMediaType(enc('<!doctype html><script>')), 'text/markup')
  assert.equal(sniffMediaType(enc('  \n\t<svg/>')), 'text/markup')
  assert.equal(sniffMediaType(new Uint8Array([0xef, 0xbb, 0xbf, 0x3c, 0x73, 0x76, 0x67])), 'text/markup')
})

test('plain text, empty and short input are unknown', () => {
  assert.equal(sniffMediaType(enc('hello world')), null)
  assert.equal(sniffMediaType(new Uint8Array(0)), null)
  assert.equal(sniffMediaType(new Uint8Array([0xff, 0xd8])), null)
})

test('an ftyp-looking string not at offset 4 is not MP4', () => {
  assert.equal(sniffMediaType(enc('ftypisom.......')), null)
})
