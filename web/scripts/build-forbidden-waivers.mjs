#!/usr/bin/env node
/**
 * Forbidden Waivers (league rule): any player ADDED to the FPL Draft game
 * after the committed baseline (2026-08-18 3:22 PM EST) and before the end of
 * GW7 cannot be added by any team.
 *
 * Every deploy refetches bootstrap_draft.json, so the list is a stateless
 * set-difference: current elements minus the baseline's element ids. New ids
 * are appended by FPL, but membership — not id order — is what's checked.
 *
 * Window close: once every GW <= 7 match in details.json is finished, the
 * list FREEZES — the previously committed forbidden-waivers.json is kept
 * verbatim (players added to the game after GW7 are normal waiver fodder).
 * Near the end of GW7 the committed list should be refreshed one last time
 * so late additions aren't lost to the freeze (the script warns about this).
 *
 * Reads:  public/league-data/forbidden-waivers-baseline.json,
 *         bootstrap_draft.json, details.json
 * Writes: public/league-data/forbidden-waivers.json
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = join(root, 'public/league-data')
const outPath = join(dataDir, 'forbidden-waivers.json')
const read = (f) => JSON.parse(readFileSync(join(dataDir, f), 'utf8'))

let baseline
let boot
let details
try {
  baseline = read('forbidden-waivers-baseline.json')
  boot = read('bootstrap_draft.json')
  details = read('details.json')
} catch (err) {
  console.warn('build-forbidden-waivers: skip —', err.message)
  process.exit(0)
}

const WINDOW_GW = Number(baseline.windowClosesAfterGw) || 7
const gwMatches = (details.matches ?? []).filter((m) => Number(m.event) <= WINDOW_GW)
const windowClosed = gwMatches.length > 0 && gwMatches.every((m) => m.finished === true)

if (windowClosed) {
  // Freeze: keep the committed list, only flipping the open flag.
  let existing = null
  if (existsSync(outPath)) {
    try {
      existing = JSON.parse(readFileSync(outPath, 'utf8'))
    } catch {
      existing = null
    }
  }
  const frozen = {
    ...(existing ?? { players: [] }),
    windowOpen: false,
    windowClosesAfterGw: WINDOW_GW,
    baselineCapturedAt: baseline.capturedAt,
    frozenNote:
      `GW${WINDOW_GW} is finished — this list is frozen from the last committed build. ` +
      'Players added to the game from here on are normal waiver fodder.',
  }
  writeFileSync(outPath, JSON.stringify(frozen, null, 1))
  console.log(
    `forbidden-waivers.json frozen (GW${WINDOW_GW} done): ${frozen.players.length} player(s). ` +
      'If the committed list predates the GW7 finish, refresh + commit it once to capture late additions.',
  )
  process.exit(0)
}

const baselineIds = new Set(baseline.elementIds.map(Number))
const teamShort = new Map((boot.teams ?? []).map((t) => [Number(t.id), t.short_name]))
const teamCode = new Map((boot.teams ?? []).map((t) => [Number(t.id), t.code]))
const POS = { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' }

const players = (boot.elements ?? [])
  .filter((e) => !baselineIds.has(Number(e.id)))
  .map((e) => ({
    id: Number(e.id),
    webName: e.web_name,
    fullName: `${e.first_name} ${e.second_name}`.trim(),
    team: teamShort.get(Number(e.team)) ?? String(e.team),
    teamCode: teamCode.get(Number(e.team)) ?? null,
    position: POS[Number(e.element_type)] ?? 'MID',
  }))
  .sort((a, b) => a.id - b.id)

const output = {
  generatedAt: new Date().toISOString(),
  windowOpen: true,
  windowClosesAfterGw: WINDOW_GW,
  baselineCapturedAt: baseline.capturedAt,
  baselineCapturedAtLocal: baseline.capturedAtLocal,
  baselineElementCount: baseline.elementCount,
  currentElementCount: (boot.elements ?? []).length,
  players,
}

writeFileSync(outPath, JSON.stringify(output, null, 1))
console.log(
  `forbidden-waivers.json written: ${players.length} forbidden player(s)` +
    (players.length ? ` — ${players.map((p) => p.webName).join(', ')}` : ''),
)
