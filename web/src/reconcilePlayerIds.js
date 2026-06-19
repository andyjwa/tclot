/**
 * Cross-checks player element IDs between Regular (classic) FPL and Draft FPL.
 *
 * Both games reference the same underlying PL player database, so the **Opta `code`** field is
 * the stable primary join key — consistent across seasons and across both games, independent of
 * name formatting. Normalised first+second name + team is a fallback only.
 *
 * NOTE: in practice the two games do NOT always serve identical element `id`s for the same
 * player (this league's committed data shows ~10% of code-matched players differ). So an `id`
 * difference is treated as an expected ID-space divergence (informational), not an error. The
 * real data-quality signals are players matched only by name fallback, or not matched at all.
 */

/**
 * Strips accents, hyphens, apostrophes, lowercases. Handles "De Bruyne", "Jörgensen",
 * "O'Brien", "Diallo-Williams".
 * @param {string} firstName @param {string} secondName @param {number|string} teamId
 */
export function normaliseKey(firstName, secondName, teamId) {
  return `${firstName ?? ''}_${secondName ?? ''}_${teamId ?? ''}`
    .toLowerCase()
    .normalize('NFD') // decompose accented chars
    .replace(/[\u0300-\u036f]/g, '') // strip accent marks
    .replace(/[^a-z0-9_]/g, ''); // strip everything else
}

/**
 * @param {object[]} regularElements classic `bootstrap-static` elements (FPL official)
 * @param {object[]} draftElements   draft `bootstrap-static` elements
 * @returns {{
 *   regularToDraftMap: Record<number, number>,
 *   draftToRegularMap: Record<number, number>,
 *   idSpaceDivergences: object[],
 *   nameFallbackMatches: object[],
 *   unmatchedRegular: object[],
 *   counts: object,
 * }}
 */
export function buildReconciliationMaps(regularElements = [], draftElements = []) {
  const draftByCode = new Map();
  const draftByName = new Map();
  for (const p of draftElements) {
    if (p.code != null) draftByCode.set(p.code, p.id);
    draftByName.set(normaliseKey(p.first_name, p.second_name, p.team), p.id);
  }

  const regularToDraftMap = {};
  const draftToRegularMap = {};
  const idSpaceDivergences = [];
  const nameFallbackMatches = [];
  const unmatchedRegular = [];
  let codeMatched = 0;
  let nameMatched = 0;

  for (const p of regularElements) {
    let draftId = p.code != null ? draftByCode.get(p.code) : undefined;
    let matchedBy = 'code';
    if (draftId == null) {
      draftId = draftByName.get(normaliseKey(p.first_name, p.second_name, p.team));
      matchedBy = 'name';
    }

    if (draftId == null) {
      unmatchedRegular.push({
        name: `${p.first_name ?? ''} ${p.second_name ?? ''}`.trim(),
        webName: p.web_name,
        optaCode: p.code ?? null,
        team: p.team,
        regularId: p.id,
      });
      continue;
    }

    regularToDraftMap[p.id] = draftId;
    draftToRegularMap[draftId] = p.id;

    if (matchedBy === 'code') codeMatched += 1;
    else {
      nameMatched += 1;
      nameFallbackMatches.push({
        name: `${p.first_name ?? ''} ${p.second_name ?? ''}`.trim(),
        webName: p.web_name,
        optaCode: p.code ?? null,
        team: p.team,
        regularId: p.id,
        draftId,
      });
    }

    if (p.id !== draftId) {
      idSpaceDivergences.push({
        name: `${p.first_name ?? ''} ${p.second_name ?? ''}`.trim(),
        webName: p.web_name,
        optaCode: p.code ?? null,
        team: p.team,
        regularId: p.id,
        draftId,
        matchedBy,
      });
    }
  }

  return {
    regularToDraftMap,
    draftToRegularMap,
    idSpaceDivergences,
    nameFallbackMatches,
    unmatchedRegular,
    counts: {
      regular: regularElements.length,
      draft: draftElements.length,
      codeMatched,
      nameMatched,
      idSpaceDivergences: idSpaceDivergences.length,
      nameFallbackMatches: nameFallbackMatches.length,
      unmatchedRegular: unmatchedRegular.length,
    },
  };
}
