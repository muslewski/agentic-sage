import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PassThrough } from 'node:stream'
import { readStdinWithDeadline } from '../lib/stdin.mjs'

test('write + end resolves with the full content (closed-pipe path)', async () => {
  const stream = new PassThrough()
  const p = readStdinWithDeadline(1000, stream)
  stream.write('hello ')
  stream.end('world')
  assert.equal(await p, 'hello world')
})

test('write without end resolves with the partial content once the deadline lapses', async () => {
  const stream = new PassThrough()
  const p = readStdinWithDeadline(50, stream)
  stream.write('partial')
  // deliberately never end() the stream — the deadline is the only backstop
  assert.equal(await p, 'partial')
})
