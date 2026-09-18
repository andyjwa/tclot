import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  PREVIEW_DISPATCH_COOLDOWN_MS,
  previewAlreadyPublished,
  shouldDispatchPreview,
} from './previewRefresh.js'
import { runPreviewRefreshPing } from '../scripts/preview-refresh-ping.mjs'

const lock = { id: 4, deadline: '2026-09-12T12:30:00Z' }
const after = Date.parse('2026-09-12T12:40:00Z')
const pingPath = join(dirname(fileURLToPath(import.meta.url)), '../scripts/preview-refresh-ping.mjs')

test('preview-refresh-ping.mjs is valid JavaScript', () => {
  execFileSync(process.execPath, ['--check', pingPath], { stdio: 'pipe' })
})

test('preview-refresh-ping.mjs does not put cron stars inside a block comment', () => {
  const src = readFileSync(pingPath, 'utf8')
  assert.doesNotMatch(
    src,
    /\/\*[\s\S]*?\*\/\d/,
    'a */N cron example inside a block comment closes it early and crashes parse',
  )
})

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

test('GitHub ping still dispatches 4h after lock when the preview is stale', async () => {
  const deadline = '2026-09-18T17:30:00Z'
  const now = Date.parse(deadline) + 4 * 60 * 60_000
  const calls = []
  const result = await runPreviewRefreshPing({
    now,
    env: { GH_TOKEN: 'tok', GITHUB_REPOSITORY: 'andyjwa/tclot' },
    fetchImpl: async (url) => {
      const href = String(url)
      calls.push(href)
      if (href.includes('bootstrap-static')) {
        return {
          ok: true,
          json: async () => ({
            events: { data: [{ id: 5, deadline_time: deadline }] },
          }),
        }
      }
      if (href.includes('weekly-recaps.json')) {
        return {
          ok: true,
          json: async () => ({
            generatedAt: '2026-09-18T17:10:33Z',
            previews: [{ gw: 4 }],
          }),
        }
      }
      return { status: 204, ok: true, text: async () => '' }
    },
  })
  assert.equal(result.action, 'dispatched')
  assert.equal(result.gw, 5)
  assert.ok(calls.some((u) => u.endsWith('/deploy-github-pages.yml/dispatches')))
})
