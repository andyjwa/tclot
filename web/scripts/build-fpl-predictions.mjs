/**
 * Compile the file: dependency before the site build.
 * Must not run from that package's `prepare` script: Vercel installs web with
 * production settings, so `tsc` is not on PATH during npm install.
 */
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const pkg = join(dirname(fileURLToPath(import.meta.url)), '../../fpl-predictions')

function run(args) {
  const result = spawnSync('npm', args, { cwd: pkg, stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

run(['ci', '--include=dev', '--ignore-scripts'])
run(['run', 'build'])
