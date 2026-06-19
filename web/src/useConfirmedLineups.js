import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchPulselivePremWindow } from './pulselivePremWindow.js';
import { fetchEspnPremWindow } from './espnPremWindow.js';
import { mergePremWindowSources } from './premWindowMerger.js';
import { computeEspnMatchdayRole } from './espnMatchdayRoleForAutosub.js';

const POLL_MS = 60000;

/**
 * Confirmed matchday roles for the forecast leaderboard.
 *
 * Reuses the live Pulselive (T-75) / ESPN (T-60) lineup layer already used by the
 * Live Scores view, then classifies each forecast player as 'xi' / 'bench' /
 * 'absent' via {@link computeEspnMatchdayRole} (which is conservative: single-GW
 * clubs only, and never infers `absent` unless every published slot resolved to an
 * FPL id). Returns a Map<elementId, role> the panel overlays onto the static forecast.
 *
 * Inert unless an FPL context (`gwFixtures` + `teamById` + `elementById`) is supplied
 * and `enabled` is true. This keeps the Forecast tab free of the heavy live-context
 * fetch by default; a parent that already holds that context can activate it.
 *
 * @param {{
 *   players?: Array<{ id: number, teamId?: number }>,
 *   gwFixtures?: object[] | null,
 *   teamById?: object | null,
 *   elementById?: object | null,
 *   enabled?: boolean,
 * }} opts
 */
export function useConfirmedLineups(opts = {}) {
  const { players, gwFixtures, teamById, elementById, enabled = true } = opts;
  const [premRows, setPremRows] = useState([]);
  const genRef = useRef(0);

  const active =
    enabled &&
    Array.isArray(gwFixtures) &&
    gwFixtures.length > 0 &&
    !!teamById &&
    !!elementById;

  useEffect(() => {
    // When inactive we simply don't poll; `roleMap` already gates on `active`, so any
    // stale rows are ignored (no synchronous setState needed here).
    if (!active) return undefined;
    const gen = ++genRef.current;
    let timer = null;

    const run = async () => {
      try {
        const [pulseRows, espnRows] = await Promise.all([
          fetchPulselivePremWindow({ gwFixtures, teamById, elementById }).catch(() => []),
          fetchEspnPremWindow({ gwFixtures, teamById, elementById }).catch(() => []),
        ]);
        if (gen !== genRef.current) return;
        const merged = mergePremWindowSources(pulseRows, espnRows, {
          primaryLabel: 'pulselive',
          fallbackLabel: 'espn',
        });
        setPremRows(merged);
      } catch {
        if (gen === genRef.current) setPremRows([]);
      }
    };

    void run();
    timer = setInterval(run, POLL_MS);
    return () => {
      genRef.current += 1;
      if (timer) clearInterval(timer);
    };
  }, [active, gwFixtures, teamById, elementById]);

  const roleMap = useMemo(() => {
    const map = new Map();
    if (!active || !Array.isArray(players) || premRows.length === 0) return map;
    for (const p of players) {
      const id = Number(p?.id);
      const teamId = Number(p?.teamId);
      if (!Number.isFinite(id) || !Number.isFinite(teamId)) continue;
      const role = computeEspnMatchdayRole(premRows, gwFixtures, id, teamId);
      if (role) map.set(id, role);
    }
    return map;
  }, [active, players, premRows, gwFixtures]);

  const confirmedCount = useMemo(() => {
    let n = 0;
    for (const r of roleMap.values()) if (r === 'xi') n += 1;
    return n;
  }, [roleMap]);

  return { roleMap, confirmedCount, active: Boolean(active) && roleMap.size > 0 };
}
