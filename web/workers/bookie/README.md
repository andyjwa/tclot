# TCLOT bookie Worker

Fake-money betting backend for the TCLOT dashboard — a Cloudflare Worker with a
D1 (SQLite) database. Markets are priced by the site's own prediction model
(`web/scripts/build-bookie-markets.mjs` writes `league-data/bookie-markets.json`
on every deploy); this Worker ingests that sheet, takes bets, and settles them
against the official FPL Draft results.

## What it does

- **Weekly H2H markets** — home / draw / away for every league matchup in the
  next gameweek. Open until the FPL deadline; odds freeze when the market is
  first ingested.
- **Player specials per matchup** — *anytime goalscorer* (any pooled
  outfielder from either squad to score, several tickets can win) and *top
  point scorer* (most draft points across both squads, dead heats all pay).
  Priced from the per-player forecasts behind the Players tab; the boards
  print on the first deploy after the previous gameweek banks (the forecast
  has to target the same GW as the H2H board). Settled from the draft
  `event/{gw}/live` feed once the gameweek's football finishes; a pooled
  player who never played (0 minutes) is void — those stakes are refunded.
- **Outright / Titan / Minnow / last place** — priced from Season Predictions
  (title, top 4, bottom 4, last) and repriced after every banked gameweek.
  Bets lock the odds they were placed at. Titan and Minnow can pay four
  tickets; last place pays only 8th.
- **Settlement** — a gameweek counts as final once every Premier League fixture
  for it is finished or provisionally finished, or FPL's bootstrap
  `events[].finished` flag is already true (same rule the site uses), so
  payouts land hours before FPL's own "data checked" flag. Markets stay
  unlocked until the official finish so a bonus-point flip can re-grade a
  ticket (and the bankroll) instead of leaving a provisional result stuck.
  Settled weekly tickets stay on the live bets board (green row) until the
  next gameweek's markets open.
- **Bankroll** — everyone starts a season with 1,000 Clotcoins (the TCLOT
  currency); a 50-Clotcoin stipend
  lands after each settled gameweek only if your bankroll is below 250,
  so going bust is never terminal. Healthy balances are left alone.
  The leaderboard also reports season won (net profit), lost (stake
  written off), and live (open stake), all sortable. Weekly winners
  lists every team that landed a winning H2H or player-special ticket
  that gameweek (not only the single biggest net). Teams fold open like
  the live board; slips use compact odds / stake / P/L text (green wins,
  red losses).
  A one-shot restart (`fresh-start.sql` / `applyFreshStart`) can wipe the
  ticket ledger and put every bankroll back at 1,000 without touching PINs
  or markets. It is gated by the `freshStart:2026-08-27` meta key so it
  cannot run twice.
- **Cash out** — every open ticket carries a live offer: current win
  probability × potential payout, minus an 8% house margin (`src/cashout.js`).
  Pre-deadline that probability is the market's own opening price; once the
  gameweek kicks off, H2H bets re-price from the live score margin blended
  with the opening price (the blend fades as fixtures finish), and the
  outright re-prices off the latest weekly model sheet. Offers suspend when
  the FPL feeds are unreachable rather than pricing blind.
- **Identity** — each manager claims their team once with a 4–8 digit PIN
  (PBKDF2-hashed). Sessions are HMAC-signed bearer tokens.

## One-time setup

```bash
cd web/workers/bookie
npm install

# 1. Create the database, then paste the printed database_id into wrangler.toml
npx wrangler d1 create tclot-bookie

# 2. Create the tables
npm run db:migrate

# 3. Session-signing secret (any long random string, e.g. `openssl rand -hex 32`)
npx wrangler secret put SESSION_SECRET

# 4. Ship it
npm run deploy
```

Then set `VITE_BOOKIE_API_URL` to the deployed Worker URL (e.g.
`https://tclot-bookie.<your-subdomain>.workers.dev`) wherever the site is
built — Vercel project env vars and/or the GitHub Pages workflow — and
redeploy the site. The Bookie tab hides itself when the var is unset.

## Config (wrangler.toml)

| Key             | What                                                          |
| --------------- | ------------------------------------------------------------- |
| `SITE_BASE_URL` | Deployed site origin serving `league-data/bookie-markets.json` |
| `LEAGUE_ID`     | FPL Draft league id, used to settle from official results      |
| `ALLOW_ORIGIN`  | Optional CORS lock to the site origin                          |
| `SESSION_SECRET`| Secret (via `wrangler secret put`) signing session tokens      |

The cron trigger (every 30 min) ingests new markets and settles finished
gameweeks; the Worker also syncs lazily (throttled to 5 min) whenever someone
loads the Bookie tab, so the cron is belt-and-braces rather than load-bearing.

## Local development

```bash
npm run db:migrate:local
npx wrangler dev        # add --var SESSION_SECRET:dev-secret for local auth
```

Local dev reads markets from `SITE_BASE_URL` (the live site) but keeps all
bets/balances in the local D1 file, so you can play freely without touching
production.

## API

| Method | Path            | Body                              | Notes                       |
| ------ | --------------- | --------------------------------- | --------------------------- |
| GET    | `/api/health`   |                                   |                             |
| GET    | `/api/state`    |                                   | + `me` with `Authorization` |
| POST   | `/api/register` | `{ entryId, pin }`                | one claim per team          |
| POST   | `/api/login`    | `{ entryId, pin }`                |                             |
| POST   | `/api/bets`     | `{ marketId, selection, stake }`  | Bearer auth required        |
| GET    | `/api/cashout`  |                                   | offers for my open bets (auth) |
| POST   | `/api/cashout`  | `{ betId, quote? }`               | pays ≥ `quote` or 409s with the new offer |
| POST   | `/api/side-bets` | `{ opponentId, stake, sentence }` | holds the proposer's stake (auth) |
| POST   | `/api/side-bets/:id/accept` | | holds the opponent's matching stake |
| POST   | `/api/side-bets/:id/decline` | | refunds the proposer |
| POST   | `/api/side-bets/:id/cancel` | | proposer only, while still offered |
| POST   | `/api/side-bets/:id/propose` | `{ result: "me" \| "them" \| "void" }` | live bets only; does not pay |
| POST   | `/api/side-bets/:id/confirm` | | the other party confirms; then the pot moves |
| POST   | `/api/side-bets/:id/reject` | | clears a pending result call |

Side bets are not house markets. Two managers, equal stakes, no odds, and
nobody else can join. `/api/state` includes `sideBets`. A winner is paid both
stakes only after the other manager confirms. A void returns both stakes the
same way. Declining or cancelling an unanswered offer returns the proposer's
coins.
