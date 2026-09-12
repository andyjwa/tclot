import { test } from 'node:test'
import assert from 'node:assert/strict'
import { maybeDispatchPreviewDeploy } from './previewDeploy.js'

const events = [
  { id: 4, deadline_time: '2026-09-12T12:30:00Z', waivers_time: '2026-09-11T12:30:00Z' },
]
const now = Date.parse('2026-09-12T12:50:00Z')

test('skips outside the lineup-lock window', async () => {
  const result = await maybeDispatchPreviewDeploy(
    { GITHUB_DISPATCH_TOKEN: 'tok' },
    { now: Date.parse('2026-09-12T12:00:00Z'), events },
  )
  assert.equal(result.action, 'skip')
  assert.equal(result.reason, 'outside-window')
})

test('skips a locked week when no dispatch credentials are set', async () => {
  const result = await maybeDispatchPreviewDeploy({}, { now, events })
  assert.deepEqual(result, { action: 'skip', reason: 'no-credentials', gw: 4 })
})

test('dispatches once when the preview is still from before the deadline', async () => {
  const calls = []
  const kv = new Map()
  const result = await maybeDispatchPreviewDeploy(
    {
      GITHUB_DISPATCH_TOKEN: 'tok',
      SUBSCRIPTIONS: {
        get: async (key) => kv.get(key) ?? null,
        put: async (key, value) => {
          kv.set(key, value)
        },
      },
    },
    {
      now,
      events,
      recaps: { generatedAt: '2026-09-12T09:47:00Z', previews: [{ gw: 3 }] },
      fetch: async (url) => {
        calls.push(String(url))
        return { status: 204, ok: true }
      },
    },
  )
  assert.equal(result.action, 'dispatched')
  assert.equal(result.via, 'github')
  assert.match(calls[0], /deploy-github-pages.yml\/dispatches$/)
  assert.equal(kv.get('preview-deploy:4'), String(now))
})

test('does not dispatch again inside the cooldown', async () => {
  let fetches = 0
  const result = await maybeDispatchPreviewDeploy(
    { VERCEL_DEPLOY_HOOK: 'https://api.vercel.com/v1/integrations/deploy/example' },
    {
      now,
      events,
      recaps: null,
      lastDispatchMs: now - 60_000,
      fetch: async () => {
        fetches += 1
        return { status: 201, ok: true }
      },
    },
  )
  assert.equal(result.reason, 'cooldown')
  assert.equal(fetches, 0)
})
