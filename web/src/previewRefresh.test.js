import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PREVIEW_DISPATCH_COOLDOWN_MS,
  previewAlreadyPublished,
  shouldDispatchPreview,
} from './previewRefresh.js'

const lock = { id: 4, deadline: '2026-09-12T12:30:00Z' }
const after = Date.parse('2026-09-12T12:40:00Z')

test('preview is unpublished until a post-deadline build includes that GW', () => {
  assert.equal(previewAlreadyPublished(null, lock), false)
  assert.equal(
    previewAlreadyPublished(
      { generatedAt: '2026-09-12T09:47:00Z', previews: [{ gw: 3 }] },
      lock,
    ),
    false,
  )
  assert.equal(
    previewAlreadyPublished(
      { generatedAt: '2026-09-12T12:40:00Z', previews: [{ gw: 1 }, { gw: 2 }, { gw: 3 }] },
      lock,
    ),
    false,
  )
  assert.equal(
    previewAlreadyPublished(
      { generatedAt: '2026-09-12T12:40:00Z', previews: [{ gw: 4, source: 'xi' }] },
      lock,
    ),
    true,
  )
})

test('dispatch while the lock window is open and the preview is still stale', () => {
  assert.equal(
    shouldDispatchPreview({ lock, recaps: null, lastDispatchMs: null, nowMs: after }),
    true,
  )
  assert.equal(
    shouldDispatchPreview({
      lock,
      recaps: { generatedAt: '2026-09-12T12:40:00Z', previews: [{ gw: 4 }] },
      lastDispatchMs: null,
      nowMs: after,
    }),
    false,
  )
  assert.equal(
    shouldDispatchPreview({
      lock,
      recaps: null,
      lastDispatchMs: after - 60_000,
      nowMs: after,
    }),
    false,
  )
  assert.equal(
    shouldDispatchPreview({
      lock: null,
      recaps: null,
      lastDispatchMs: null,
      nowMs: after,
    }),
    false,
  )
  assert.equal(PREVIEW_DISPATCH_COOLDOWN_MS, 20 * 60 * 1000)
})
