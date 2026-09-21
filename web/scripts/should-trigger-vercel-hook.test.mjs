import assert from 'node:assert/strict'
import test from 'node:test'
import { shouldTriggerVercelHook } from './should-trigger-vercel-hook.mjs'

test('shouldTriggerVercelHook — skip git push (Vercel Git already deploys)', () => {
  assert.equal(shouldTriggerVercelHook({ eventName: 'push' }), false)
})

test('shouldTriggerVercelHook — skip hourly and burst crons', () => {
  assert.equal(
    shouldTriggerVercelHook({ eventName: 'schedule', scheduleCron: '0 * * * *' }),
    false,
  )
  assert.equal(
    shouldTriggerVercelHook({
      eventName: 'schedule',
      scheduleCron: '*/15 * * * *',
    }),
    false,
  )
  assert.equal(
    shouldTriggerVercelHook({
      eventName: 'schedule',
      scheduleCron: '8,38 * * * *',
    }),
    false,
  )
})

test('shouldTriggerVercelHook — keep the three daily catch-alls', () => {
  for (const cron of ['30 5 * * *', '30 13 * * *', '30 21 * * *']) {
    assert.equal(
      shouldTriggerVercelHook({ eventName: 'schedule', scheduleCron: cron }),
      true,
      cron,
    )
  }
})

test('shouldTriggerVercelHook — keep manual / preview-refresh dispatch', () => {
  assert.equal(shouldTriggerVercelHook({ eventName: 'workflow_dispatch' }), true)
})
