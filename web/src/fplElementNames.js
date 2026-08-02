import { useEffect, useState } from 'react';
import { leagueDataBase } from './seasonArchive.js';

/**
 * FPL official first + last from bootstrap — for ESPN/FotMob matching, not primary UI.
 */
export function fplElementFullName(el, elementId) {
  if (!el) return `Player #${elementId}`;
  const p = [el.first_name, el.second_name]
    .map((s) => (typeof s === 'string' ? s.trim() : ''))
    .filter(Boolean);
  if (p.length) return p.join(' ');
  return el.web_name?.trim() || `Player #${elementId}`;
}

/**
 * Short fantasy name — FPL `web_name` (in-game UI label).
 */
export function fplElementWebName(el, elementId) {
  if (!el) return `Player #${elementId}`;
  const w = el.web_name?.trim();
  if (w) return w;
  return fplElementFullName(el, elementId);
}

/**
 * FPL `known_name` — wire player detail hero + compare headings only.
 * Fallback: full official name, then fantasy `web_name`.
 */
export function fplElementKnownName(el, elementId) {
  if (!el) return `Player #${elementId}`;
  const kn = el.known_name?.trim();
  if (kn) return kn;
  return fplElementFullName(el, elementId);
}

/** Alias — fantasy `web_name` for all UI labels except detail/compare heroes. */
export function fplElementDisplayName(el, elementId) {
  return fplElementWebName(el, elementId);
}

/** @param {object} classicBoot bootstrap_fpl / classic bootstrap-static JSON */
export function knownNameByElementIdFromClassicBootstrap(classicBoot) {
  const m = new Map();
  for (const el of classicBoot?.elements || []) {
    const id = Number(el?.id);
    const kn = el?.known_name?.trim();
    if (Number.isFinite(id) && kn) m.set(id, kn);
  }
  return m;
}

/** @param {object} el @param {Map<number, string>} knownMap */
export function enrichElementWithKnownName(el, knownMap) {
  if (!el || !knownMap?.size) return el;
  const kn = knownMap.get(Number(el.id));
  if (!kn || el.known_name?.trim()) return el;
  return { ...el, known_name: kn };
}

/** @param {object} boot draft bootstrap @param {Map<number, string>} knownMap */
export function enrichBootstrapElements(boot, knownMap) {
  if (!boot?.elements?.length || !knownMap?.size) return boot;
  return {
    ...boot,
    elements: boot.elements.map((el) => enrichElementWithKnownName(el, knownMap)),
  };
}

let knownNameMapPromise = null;

/** Loads `known_name` index from committed `bootstrap_fpl.json` (draft API omits it). */
export function fetchKnownNameMap(cacheKey = '') {
  if (!knownNameMapPromise) {
    knownNameMapPromise = (async () => {
      try {
        const base = `${leagueDataBase()}/bootstrap_fpl.json`;
        const url =
          cacheKey.trim() !== ''
            ? `${base}?v=${encodeURIComponent(cacheKey.trim())}`
            : base;
        const r = await fetch(url, cacheKey ? { cache: 'no-store' } : undefined);
        if (!r.ok) return new Map();
        return knownNameByElementIdFromClassicBootstrap(await r.json());
      } catch {
        return new Map();
      }
    })();
  }
  return knownNameMapPromise;
}

/** @returns {boolean} */
export function useNarrow560() {
  const [narrow, setNarrow] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 560px)').matches,
  );
  useEffect(() => {
    const q = window.matchMedia('(max-width: 560px)');
    const f = () => setNarrow(q.matches);
    f();
    q.addEventListener('change', f);
    return () => q.removeEventListener('change', f);
  }, []);
  return narrow;
}
