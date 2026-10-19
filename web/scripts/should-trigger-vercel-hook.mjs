#!/usr/bin/env node
// Hobby Vercel teams have a 10 GB Deployment Storage cap. Every production
// deploy is kept until retention deletes it (default 30 days). The Pages
// workflow used to POST VERCEL_DEPLOY_HOOK after every successful ingest —
// hourly, burst every 15 min, and on git push (which Vercel already builds from Git).
//
// Pages still deploys on those schedules. Vercel only needs:
//   - the three daily catch-alls (live JSON on tclot.vercel.app)
//   - workflow_dispatch (manual + preview-refresh ping)
// Git push is skipped: Vercel Git integration already creates a production
// deploy. Live scores / waiver claims do not wait on this hook (browser proxy).
//
// Use line comments, not a block comment: a cron example like */15 would close
// a /** ... */ comment early and crash this file on parse.
import process from 'node:process'
import { fileURLToPath } from 'node:url'

/** Cron strings from .github/workflows/deploy-github-pages.yml daily catch-alls. */
export const DAILY_VERCEL_CRONS = ['30 5 * * *', '30 13 * * *', '30 21 * * *']

/**
 * @param {{ eventName?: string, scheduleCron?: string }} [opts]
 * @returns {boolean} true → POST the deploy hook
 */
export function shouldTriggerVercelHook({
  eventName = process.env.GITHUB_EVENT_NAME || '',
  scheduleCron = process.env.SCHEDULE_CRON || '',
} = {}) {
  if (eventName === 'push') return false
  if (eventName === 'schedule') return DAILY_VERCEL_CRONS.includes(scheduleCron)
  return true
}

const invokedDirectly =
  Boolean(process.argv[1]) && fileURLToPath(import.meta.url) === process.argv[1]
if (invokedDirectly) {
  const ok = shouldTriggerVercelHook()
  console.log(
    ok
      ? `trigger Vercel hook (${process.env.GITHUB_EVENT_NAME || 'unknown event'})`
      : `skip Vercel hook (${process.env.GITHUB_EVENT_NAME || 'unknown'}${
          process.env.SCHEDULE_CRON ? ` cron=${process.env.SCHEDULE_CRON}` : ''
        })`,
  )
  process.exit(ok ? 0 : 1)
}
