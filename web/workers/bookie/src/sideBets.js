/**
 * Peer side bets — two managers, one sentence, matching stakes, no odds.
 *
 * The house markets stay in `bets`. A side bet escrows the proposer's stake
 * on offer, the opponent's matching stake on accept, and only moves the pot
 * when the other party confirms a winner or a void. Pure helpers live here
 * so the money rules can be tested without D1.
 */

export const SIDE_MIN_STAKE = 10;
export const SIDE_MAX_STAKE = 1000;
export const SIDE_SENTENCE_MIN = 8;
export const SIDE_SENTENCE_MAX = 240;

const RESULTS = new Set(['me', 'them', 'void']);

export function normalizeSentence(raw) {
  const text = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (text.length < SIDE_SENTENCE_MIN || text.length > SIDE_SENTENCE_MAX) return null;
  if (/[\u0000-\u001f\u007f]/.test(text)) return null;
  return text;
}

/** Whole coins in range, or null. */
export function parseStake(raw) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < SIDE_MIN_STAKE || n > SIDE_MAX_STAKE) return null;
  return n;
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Accept a D1 row (snake_case) or a test object (camelCase). */
export function asSideBet(row) {
  if (!row) return null;
  return {
    id: num(row.id),
    proposerId: num(row.proposerId ?? row.proposer_id),
    proposerName: String(row.proposerName ?? row.proposer_name ?? ''),
    opponentId: num(row.opponentId ?? row.opponent_id),
    opponentName: String(row.opponentName ?? row.opponent_name ?? ''),
    stake: num(row.stake),
    sentence: String(row.sentence ?? ''),
    status: String(row.status ?? ''),
    winnerId: num(row.winnerId ?? row.winner_id),
    proposedBy: num(row.proposedBy ?? row.proposed_by),
    proposedResult: row.proposedResult ?? row.proposed_result ?? null,
  };
}

export function publicSideBet(row) {
  const bet = asSideBet(row);
  if (!bet) return null;
  return {
    id: bet.id,
    proposerId: bet.proposerId,
    proposerName: bet.proposerName,
    opponentId: bet.opponentId,
    opponentName: bet.opponentName,
    stake: bet.stake,
    sentence: bet.sentence,
    status: bet.status,
    winnerId: bet.winnerId,
    proposedBy: bet.proposedBy,
    proposedResult: bet.proposedResult,
    createdAt: row.created_at ?? row.createdAt ?? null,
    updatedAt: row.updated_at ?? row.updatedAt ?? null,
  };
}

function fail(error, status) {
  return { ok: false, error, status };
}

function isParty(bet, actorId) {
  return actorId === bet.proposerId || actorId === bet.opponentId;
}

/**
 * What a confirm/decline/etc should do. The Worker applies `debit` before
 * the status claim and `credits` only after the claim matches a row.
 *
 * @returns {{ ok: true, kind: string, status?: string, winnerId?: number | null,
 *   proposedBy?: number | null, proposedResult?: string | null,
 *   debit?: { entryId: number, amount: number },
 *   credits: { entryId: number, amount: number }[],
 *   expectProposedBy?: number, expectProposedResult?: string }
 *   | { ok: false, error: string, status: number }}
 */
export function planSideAction(row, actorId, action, body = null) {
  const bet = asSideBet(row);
  const actor = Number(actorId);
  if (!bet || !Number.isFinite(actor)) return fail('unknown side bet', 404);
  if (!isParty(bet, actor)) return fail('not your bet', 403);

  if (action === 'decline') {
    if (bet.status !== 'offered') return fail('bet is not waiting on an answer', 409);
    if (actor !== bet.opponentId) return fail('only the other manager can decline', 403);
    return {
      ok: true,
      kind: 'status',
      from: 'offered',
      status: 'declined',
      credits: [{ entryId: bet.proposerId, amount: bet.stake }],
    };
  }

  if (action === 'cancel') {
    if (bet.status !== 'offered') return fail('bet is not waiting on an answer', 409);
    if (actor !== bet.proposerId) return fail('only the manager who offered can cancel', 403);
    return {
      ok: true,
      kind: 'status',
      from: 'offered',
      status: 'cancelled',
      credits: [{ entryId: bet.proposerId, amount: bet.stake }],
    };
  }

  if (action === 'accept') {
    if (bet.status !== 'offered') return fail('bet is not waiting on an answer', 409);
    if (actor !== bet.opponentId) return fail('only the other manager can accept', 403);
    return {
      ok: true,
      kind: 'status',
      from: 'offered',
      status: 'accepted',
      debit: { entryId: bet.opponentId, amount: bet.stake },
      credits: [],
    };
  }

  if (action === 'propose') {
    if (bet.status !== 'accepted') return fail('bet is not live', 409);
    const result = String(body?.result ?? '');
    if (!RESULTS.has(result)) return fail('result must be me, them, or void', 400);
    let proposedResult = 'void';
    if (result !== 'void') {
      const actorIsProposer = actor === bet.proposerId;
      const actorWins = result === 'me';
      proposedResult = actorIsProposer === actorWins ? 'proposer' : 'opponent';
    }
    return {
      ok: true,
      kind: 'propose',
      proposedBy: actor,
      proposedResult,
      credits: [],
    };
  }

  if (action === 'reject') {
    if (bet.status !== 'accepted' || !bet.proposedResult) return fail('nothing to reject', 409);
    return { ok: true, kind: 'clear-proposal', credits: [] };
  }

  if (action === 'confirm') {
    if (bet.status !== 'accepted' || !bet.proposedResult || bet.proposedBy == null) {
      return fail('nobody has called a result yet', 409);
    }
    if (actor === bet.proposedBy) return fail('the other manager has to confirm', 403);
    if (bet.proposedResult === 'void') {
      return {
        ok: true,
        kind: 'settle',
        status: 'void',
        winnerId: null,
        expectProposedBy: bet.proposedBy,
        expectProposedResult: 'void',
        credits: [
          { entryId: bet.proposerId, amount: bet.stake },
          { entryId: bet.opponentId, amount: bet.stake },
        ],
      };
    }
    const winnerId = bet.proposedResult === 'proposer' ? bet.proposerId : bet.opponentId;
    return {
      ok: true,
      kind: 'settle',
      status: 'settled',
      winnerId,
      expectProposedBy: bet.proposedBy,
      expectProposedResult: bet.proposedResult,
      credits: [{ entryId: winnerId, amount: bet.stake * 2 }],
    };
  }

  return fail('unknown action', 400);
}

/** Open escrow and settled P/L for one row, split per manager. */
export function ledgerAddends(row) {
  const bet = asSideBet(row);
  if (!bet || !Number.isFinite(bet.stake) || bet.stake <= 0) return [];
  if (bet.status === 'offered') {
    return [{ entryId: bet.proposerId, won: 0, lost: 0, live: bet.stake }];
  }
  if (bet.status === 'accepted') {
    return [
      { entryId: bet.proposerId, won: 0, lost: 0, live: bet.stake },
      { entryId: bet.opponentId, won: 0, lost: 0, live: bet.stake },
    ];
  }
  if (bet.status === 'settled' && (bet.winnerId === bet.proposerId || bet.winnerId === bet.opponentId)) {
    const loserId = bet.winnerId === bet.proposerId ? bet.opponentId : bet.proposerId;
    return [
      { entryId: bet.winnerId, won: bet.stake, lost: 0, live: 0 },
      { entryId: loserId, won: 0, lost: bet.stake, live: 0 },
    ];
  }
  return [];
}

/** Fold side-bet addends into the house-bet ledger map (mutates `map`). */
export function mergeSideBetLedger(map, rows) {
  for (const row of rows ?? []) {
    for (const add of ledgerAddends(row)) {
      const cur = map.get(add.entryId) ?? { won: 0, lost: 0, live: 0 };
      map.set(add.entryId, {
        won: cur.won + add.won,
        lost: cur.lost + add.lost,
        live: cur.live + add.live,
      });
    }
  }
  return map;
}
