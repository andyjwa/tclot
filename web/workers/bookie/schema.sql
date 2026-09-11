-- TCLOT bookie — D1 schema.
-- Apply with: npx wrangler d1 execute tclot-bookie --remote --file=schema.sql
-- (drop --remote to set up the local wrangler-dev database)

CREATE TABLE IF NOT EXISTS users (
  entry_id   INTEGER NOT NULL,          -- FPL Draft league_entry id
  season     TEXT    NOT NULL,          -- e.g. '2026-27' (coins reset per season)
  name       TEXT    NOT NULL,          -- team name, from the market sheet roster
  pin_hash   TEXT    NOT NULL,          -- PBKDF2-SHA256 hex
  pin_salt   TEXT    NOT NULL,          -- random hex salt
  balance    INTEGER NOT NULL,          -- whole coins
  created_at TEXT    NOT NULL,
  PRIMARY KEY (entry_id, season)
);

CREATE TABLE IF NOT EXISTS markets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  season      TEXT    NOT NULL,
  market_key  TEXT    NOT NULL UNIQUE,  -- '2026-27:gw2:4259-4898' | '2026-27:gw2:scorer:4259-4898' | '2026-27:outright'
  kind        TEXT    NOT NULL,         -- 'h2h' | 'scorer' | 'toppoints' | 'outright' | 'titan' | 'minnow' | 'last'
  gw          INTEGER,                  -- NULL for outright
  closes_at_ms INTEGER NOT NULL,        -- betting deadline (epoch ms)
  status      TEXT    NOT NULL DEFAULT 'open',  -- 'open' | 'settled' | 'void'
  payload     TEXT    NOT NULL,         -- JSON: names + current odds per selection
  result      TEXT,                     -- winning selection ('home'|'draw'|'away' | entry id)
  settled_at  TEXT
);

CREATE INDEX IF NOT EXISTS idx_markets_open ON markets (season, status, closes_at_ms);
CREATE INDEX IF NOT EXISTS idx_markets_gw ON markets (season, gw);

CREATE TABLE IF NOT EXISTS bets (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  season     TEXT    NOT NULL,
  entry_id   INTEGER NOT NULL,
  market_id  INTEGER NOT NULL REFERENCES markets (id),
  selection  TEXT    NOT NULL,          -- 'home'|'draw'|'away', an entry id (season) or element id (player specials)
  stake      INTEGER NOT NULL,          -- whole coins
  odds       REAL    NOT NULL,          -- decimal odds locked at bet time
  status     TEXT    NOT NULL DEFAULT 'open',  -- 'open' | 'won' | 'lost' | 'void' | 'cashed_out'
  payout     INTEGER,                   -- whole coins credited (stake × odds, or the cash-out taken)
  placed_at  TEXT    NOT NULL,
  settled_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_bets_user ON bets (season, entry_id);
CREATE INDEX IF NOT EXISTS idx_bets_market ON bets (market_id);

-- Small key/value ledger: sync throttle, one-shot stipend markers, etc.
CREATE TABLE IF NOT EXISTS meta (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL
);

-- Peer side bets. Not a house market: equal stakes, no odds, no one else
-- can join. Proposer's stake is escrowed on offer; opponent's on accept.
-- Settlement pays the pot only after the other party confirms a winner
-- or a void. Names are stored so an unclaimed opponent still shows.
CREATE TABLE IF NOT EXISTS side_bets (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  season          TEXT    NOT NULL,
  proposer_id     INTEGER NOT NULL,
  proposer_name   TEXT    NOT NULL,
  opponent_id     INTEGER NOT NULL,
  opponent_name   TEXT    NOT NULL,
  stake           INTEGER NOT NULL,
  sentence        TEXT    NOT NULL,
  status          TEXT    NOT NULL DEFAULT 'offered', -- offered | accepted | declined | cancelled | settled | void
  winner_id       INTEGER,
  proposed_by     INTEGER,
  proposed_result TEXT,                               -- 'proposer' | 'opponent' | 'void'
  created_at      TEXT    NOT NULL,
  updated_at      TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_side_bets_season ON side_bets (season, id);
