# FPL Draft League Data Ingestion

Fetch and store all data from your [Fantasy Premier League Draft](https://draft.premierleague.com) league for analysis, dashboards, or custom tools.

## Quick Start

### 1. Find your League ID

- Open your league in a browser: `https://draft.premierleague.com/league`
- Your league ID is in the URL: `draft.premierleague.com/league/**12345**`
- Or open DevTools → Network tab while loading the league page and look for requests to `.../league/XXXXX/details`

### 2. Install

```bash
cd TCLOT
pip install -r requirements.txt
```

### 3. Ingest data

```bash
python ingest.py 12345
```

Or use an environment variable:

```bash
export LEAGUE_ID=12345
python ingest.py
```

### 4. Export to CSV (optional)

```bash
python export_csv.py
```

Exports will be in the `exports/` folder.

## What gets fetched

| File | Description |
|------|-------------|
| `details.json` | League info, teams, standings, H2H matches |
| `element_status.json` | Which players are owned by which teams |
| `transactions.json` | Draft picks, waiver moves, trades |
| `bootstrap_draft.json` | Draft player pool + **canonical element ids** (names, teams, types) |
| `fixtures.json` | Premier League fixture list (classic API — schedule only) |

All data is saved under `data/`.

## Data structure

- **Standings**: Rank, total points, gameweek points
- **League entries**: Team names, manager names, waiver order
- **Element status**: Player ID → owner (entry_id)
- **Transactions**: Transfers, draft picks, trades with timestamps

Merge `element_status` with **`bootstrap_draft.json`** `elements` for player names (draft ids — **not** the same numbering as classic FPL). Use `league_entries` to map `entry_id` to team names.

## Example: Load in Python

```python
from pathlib import Path
import json

with open("data/details.json") as f:
    details = json.load(f)

standings = details["standings"]
teams = {e["id"]: e["entry_name"] for e in details["league_entries"]}

for s in standings:
    print(f"#{s['rank']} {teams[s['league_entry']]}: {s['total']} pts")
```

## Website

**Deploying to GitHub Pages (data + logos):** see **[DEPLOY.md](./DEPLOY.md)** and open **`/deploy-check.json`** on your live site to verify the build.

A simple web dashboard to view standings and form:

```bash
cd web
npm install
npm run dev
```

Open **http://localhost:5173/TCLOT/** (or the path Vite prints).

### Local league data (recommended)

`data/` is gitignored, so without it the app may use **old committed** `web/public/league-data/` (wrong season).

The current season's Draft league number is pinned in the committed **`league-id`** file at the repo root (26/27 = **1577**). `npm run dev` / `npm run build` download that league into `data/` and copy it into `web/public/league-data/`.

To point at a different league locally, put the id in **`.fpl-league-id`** (gitignored) and set **`ALLOW_LEAGUE_ID_OVERRIDE=1`**, or run `python3 ingest.py YOUR_ID`.

Optional: **`SKIP_LEAGUE_FETCH=1`** skips the download (uses existing `data/` or committed files).

### Wrong teams / not your league?

**Fix:** confirm **`league-id`** is the current season's number, or from the repo root:

```bash
python3 ingest.py YOUR_LEAGUE_ID
cd web && npm run dev
```

### Dashboard data (waivers, player names)

`copy-data` builds **`fpl-mini.json`** from **`bootstrap_draft.json`** (player + team names for **Most waivered** and trades UI). Ensure **`transactions.json`** and **`bootstrap_draft.json`** exist (`ingest.py`). Then `cd web && npm run dev`.

**Pickup / drop / trades analytics:** **`build-waiver-gw-analytics.mjs`** runs on each dev/build, calls **draft** **`/api/event/{GW}/live`** (no trailing slash) for every finished GW, then writes **`drops-gw-live.json`**, **`pickups-tenure.json`**, and **`trades-panel.json`**. Requires **`transactions.json`** and/or **`trades.json`**. Skip live fetches with **`SKIP_WAIVER_GW_SCORES=1`**.

### GitHub Pages — link the live site to your league

The deploy workflow ingests the id in committed **`league-id`** (currently **1577**). Update that file each August when FPL issues a new league number.

`FPL_LEAGUE_ID` is only a fallback for forks. If you do set it, use the exact name **`FPL_LEAGUE_ID`** (case-sensitive) on **both** repository secrets **and** **Settings → Environments → github-pages** — environment secrets override repo secrets of the same name, which is how a leftover **6802** ingested a stranger's league in 26/27.

Each deploy runs `ingest.py`, then builds with real standings, fixtures, and waivers. Re-push or **Actions → Deploy site to Pages → Run workflow** to refresh.

**Waiver timing:** moves appear only after a deploy ingests FPL’s `transactions` API — not in real time. On waiver day expect **~15–35 minutes** after `waivers_time` (a `*/15` burst cron deploys for the first 90 min after waivers; ~10 min FPL grace + build). See **[DEPLOY.md § Waiver visibility latency](./DEPLOY.md#waiver-visibility-latency)** for why last season lagged and how to force a refresh.

### Team logos (replace letter bubbles)

Copy images into **`web/public/team-logos/`**. Name each file **`{id}.png`** where `id` is the FPL `league_entries[].id` (see `web/public/team-logos/README.md`), or add a **`manifest.json`** mapping ids to filenames. No upload step — files on disk are served by the dev server and included in `npm run build`.

Build for production: `npm run build` (output in `web/dist/`).

## Notes

- No login required: league data is publicly accessible if you have the league ID.
- The FPL Draft API is unofficial; structure may change between seasons.
