# Deploy slowly — data + team logos

Two separate things ship to GitHub Pages: **JSON league data** and **PNG logos**.

---

## 1. League data (standings, fixtures, waivers)

The live site reads **`league-data/details.json`** (and other JSON next to it).

### Path A — automatic (recommended)

1. Put the current Draft league number in the committed **`league-id`** file (26/27 = **1577**). That file is the source of truth — not the GitHub secret.
2. Optional fallback: GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **`FPL_LEAGUE_ID`**. The name is case-sensitive. If you also have a **github-pages Environment** secret of the same name, **it overrides the repository secret**. A leftover **6802** there ingested a stranger's league after the 26/27 rollover; keep Environment and repository values in sync, or delete the Environment copy and rely on `league-id`.
3. Push any commit (or run the workflow).

On each build, GitHub runs **`ingest.py`** with the committed id, then builds the site.

**Scheduled builds are gated** (`web/scripts/waiver-refresh-gate.mjs`): the hourly cron only deploys during ~36h after each FPL `waivers_time`, during **05:26–05:45 / 13:26–13:45 / 21:26–21:45 UTC** daily catch-alls, every **3 hours** in the **24h** before the next `waivers_time`, from each GW **lineup deadline until +3h** (so locked XIs and the weekly Preview publish at lock, not two hours later), or from **2h after a GW deadline** until **3h before the next GW deadline** (does **not** wait for FPL's lagging event `finished` flag) — so H2H `details.json` can update when a week ends, not only when waivers run. A separate **`*/15` burst cron** deploys during the **~90 min after each `waivers_time`** and during the **3h after each lineup deadline** (and skips at all other times) so freshly processed waivers and locked-XI previews appear within minutes. **Pushes to `main` and manual “Run workflow” always deploy.** If the live site looks a week behind, run the workflow or push after `python3 ingest.py` + `npm run publish-real-league`; open `deploy-check.json` on the site and confirm `details.json` reflects the latest finished GW.

**Vercel live site:** Scheduled Actions deploy to GitHub Pages. The public site at **tclot.vercel.app** only rebuilds on git push unless you add a **Deploy Hook**: Vercel → Project → Settings → Git → Deploy Hooks → create one, then save the URL as repository (or `github-pages` Environment) secret **`VERCEL_DEPLOY_HOOK`**. The deploy workflow POSTs that hook after every successful Pages deploy so scheduled post-deadline / waiver refreshes reach Vercel too.

**H2H “finished” lag:** FPL Draft often leaves `details.matches[].finished` (and event `finished` / `data_checked`) false for many hours after the football ends, even while provisional points are already on every match. The build (`copy-data.js`) and the app (`useLeagueData`) promote those rows to finished once every Premier League fixture for that GW is `finished` or `finished_provisional`, so standings / form / schedule / weekly recaps update when the gameweek closes instead of waiting for FPL’s “data checked” step.

### Waiver visibility latency

TCLOT does **not** process waivers — FPL Draft does. Successful claims show on Moves → Waivers in two layers:

1. **Live overlay (browser)** — after each `waivers_time`, the Waivers tab polls the FPL Draft `transactions` feed every **30 seconds** (via the same CORS proxy as Live scores) until that GW is in the deployed JSON. Claims appear as soon as FPL publishes them (usually within **~10 min**). Player GW points stay blank until ingest.
2. **Static ingest (GitHub Actions)** — `ingest.py` writes `transactions.json` / `drops-gw-live.json` and deploys. A `*/15` burst cron runs for the first **90 min** after `waivers_time`, then hourly for ~36h. This is what fills GW points and the rest of the site.

| Stage | Typical delay |
| --- | --- |
| FPL publishes successful claims | Usually within **~10 min** of `waivers_time` |
| Waivers tab (live overlay) | **Seconds after FPL publishes** — 30s poll, no deploy wait |
| Static ingest + GW points | **≤~15–20 min** during the burst window (`*/15` cron; GitHub jitter adds a few min); hourly after that |

A tighter GitHub cron does **not** make claims appear faster: scheduled workflows already jitter, and each run is a full ingest + Vite build. The live overlay is the fast path. Manual **Actions → Deploy site to Pages → Run workflow** (or any push to `main`) still refreshes the durable JSON.

**Note on GitHub cron jitter:** scheduled workflows are not punctual — under load they can run several minutes late or be dropped entirely, so a `*/15` or top-of-hour slot is not a promise. That is why the Waivers tab polls FPL directly. The weekly Preview cannot be built in the browser (it needs locked XIs baked into `weekly-recaps.json`), so a dropped schedule used to leave the Recap tab on last week. Two backup clocks cover that: **Preview refresh** (`.github/workflows/preview-refresh.yml`, :12 and :42) dispatches a full deploy when lineups just locked and the live JSON is still from before that deadline, and the push-api Worker cron (every 5 min) does the same if `GITHUB_DISPATCH_TOKEN` or `VERCEL_DEPLOY_HOOK` is set on the Worker. The main deploy workflow also has an **:08 / :38** schedule, offset from the slots GitHub drops most often.

**Why last season felt huge:** the site used to sit on old committed JSON for **hours to days** between rare scheduled refreshes (once-daily catch-all, hourly cron only inside post-waiver windows). Mitigations since then: hourly post-waiver window (Apr 2026), post-deadline hourly ingest (May 2026), thrice-daily catch-alls + pre-waiver 3-hourly refresh (Aug 2026), and the `*/15` post-waiver burst cron. Constants live in [`web/src/waiverRefreshSchedule.js`](web/src/waiverRefreshSchedule.js); live overlay helpers in [`web/src/liveWaiverMoves.js`](web/src/liveWaiverMoves.js). The Waivers tab shows a banner while it is polling FPL or showing live rows that are not in the deployed JSON yet ([`web/src/waiverDataFreshness.js`](web/src/waiverDataFreshness.js)).

You can also set **Repository variable** `FPL_LEAGUE_ID` (Settings → Variables) if you prefer — same name.

**⚠ Season rollover — update `league-id` every August.** FPL Draft issues a **new league id each season** and recycles old numbers, so last season's id starts resolving to a **stranger's league** on the API. `ingest.py` also compares the fetched managers' last names with the committed `web/public/league-data/details.json` and **fails the build** on a mismatch. When that happens, update `league-id` (and any `FPL_LEAGUE_ID` secrets, including the **github-pages** Environment) to the new number from `draft.premierleague.com/league/<ID>`. Genuinely switching leagues? Set `ALLOW_LEAGUE_ID_OVERRIDE=1` / `ALLOW_LEAGUE_IDENTITY_MISMATCH=1` for one run (or replace the committed league-data via Path B).

### Path B — commit files

```bash
python3 ingest.py YOUR_LEAGUE_ID
cd web && npm run publish-real-league
git add web/public/league-data/
git commit -m "League data" && git push
```

---

## 1b. Live tab — FPL CORS proxy (Cloudflare Worker)

GitHub Pages cannot call `fantasy.premierleague.com` from the browser (CORS). The **Live** tab needs a tiny **proxy**.

1. Deploy the worker once (free Cloudflare account):

   ```bash
   cd web/workers/fpl-proxy
   npx wrangler login
   npx wrangler deploy
   ```

2. Copy the URL Wrangler prints (e.g. `https://tclot-fpl-proxy.yourname.workers.dev`).

3. Add **`VITE_FPL_PROXY_URL`** (no trailing slash). Name must match **exactly**. Use one of:

   - **Settings → Secrets and variables → Actions** → **Secrets** → New repository secret  
   - Or **Variables** on that page (same name) — the workflow reads both.
   - If the build still shows the value empty: **Settings → Environments → `github-pages` → Environment secrets** → add **`VITE_FPL_PROXY_URL`** (the deploy job uses that environment).

4. **Re-run the deploy workflow** after saving (**Actions → Run workflow** or push a commit).  
   Existing site JS **does not** update until a new build runs — `VITE_*` is baked in at build time.

5. Check **`https://YOUR_USER.github.io/YOUR_REPO/deploy-check.json`**: **`liveProxyConfigured`** should be **`true`**.  
   On **FPL Live**, you should **not** see the red banner **“No proxy in this JavaScript build.”** — if it appears, `VITE_FPL_PROXY_URL` was missing at build time.

### CI gate (won’t silently ship a broken Live tab)

On **every** push to `main` / scheduled deploy, **`deploy-github-pages.yml` fails early** unless `VITE_FPL_PROXY_URL` is configured (repository secret or variable, same as above). That stops a Pages build where the bundle would otherwise call `https://fantasy.premierleague.com/api` directly and break with CORS/HTML instead of JSON.

**Demo/fork repos** without a Worker can opt out by setting repository Variable **`FPL_PROXY_OPTIONAL`** to **`true`** (the workflow then skips this check).

Optional: in `web/workers/fpl-proxy/wrangler.toml`, set `[vars] ALLOW_ORIGIN = "https://YOUR_USER.github.io"` to restrict CORS.

---

## 1c. Bookie — fake-money betting (Cloudflare Worker + D1)

The **Bookie** tab needs a second Worker with a **D1 database** (both on Cloudflare's free tier) for shared balances and bets. Full details in [`web/workers/bookie/README.md`](web/workers/bookie/README.md); the short version:

1. Create the database and paste its id into the worker config:

   ```bash
   cd web/workers/bookie
   npm install
   npx wrangler login
   npm run db:create              # prints a database_id
   ```

   Put that id in `wrangler.toml` under `[[d1_databases]] database_id`.

2. Apply the schema and set the session-signing secret:

   ```bash
   npm run db:migrate             # runs schema.sql against remote D1
   npx wrangler secret put SESSION_SECRET   # any long random string
   ```

3. Check `[vars]` in `wrangler.toml`:

   - **`SITE_BASE_URL`** — the deployed site the Worker pulls `league-data/bookie-markets.json` from (default `https://tclot.vercel.app`). The odds sheet is built by `build-bookie-markets.mjs` on every site deploy; the Worker's `*/30` cron ingests it, opens markets, and settles finished gameweeks against the official FPL APIs.
   - **`LEAGUE_ID`** — must match the committed `league-id` file. **Update it at every season rollover**, same as section 1.
   - Optional **`ALLOW_ORIGIN`** — lock CORS to your site origin.

4. Deploy and copy the URL Wrangler prints:

   ```bash
   npm run deploy                 # e.g. https://tclot-bookie.yourname.workers.dev
   ```

5. Add **`VITE_BOOKIE_API_URL`** (no trailing slash) exactly like `VITE_FPL_PROXY_URL` in section 1b — repository secret or variable, plus the `github-pages` Environment if needed — then **re-run the deploy workflow**. Without it the Bookie tab shows setup instructions instead of markets. There is **no CI gate** for this one: a missing `VITE_BOOKIE_API_URL` degrades gracefully.

Sanity check after deploy: `curl https://YOUR-WORKER.workers.dev/api/health` → `{"ok":true,...}`, and `/api/state` should list the open markets once the cron (or first `/api/state` hit) has ingested the sheet.

---

## 1d. Web push notifications (optional)

Managers can opt in from **Settings → Push notifications** once a push worker is deployed. Full details in [`web/workers/push-api/README.md`](web/workers/push-api/README.md).

1. Deploy the push worker:
   ```bash
   cd web/workers/push-api
   npm install
   npm run generate-vapid
   npx wrangler kv:namespace create SUBSCRIPTIONS   # paste id into wrangler.toml
   npx wrangler secret put VAPID_SUBJECT            # mailto:you@example.com
   npx wrangler secret put VAPID_SERVER_PUBLIC_KEY
   npx wrangler secret put VAPID_SERVER_PRIVATE_KEY
   npx wrangler secret put PUSH_INTERNAL_SECRET     # random string for CI notify
   npm run deploy
   ```
2. Bake into the web build (repository secret or variable, same pattern as the FPL proxy; also add them on **Vercel → Project → Settings → Environment Variables** for `tclot.vercel.app`):
   - **`VITE_PUSH_API_URL`** — worker origin, no trailing slash (e.g. `https://tclot-push-api.your-subdomain.workers.dev`)
   - **`VITE_VAPID_PUBLIC_KEY`** — public key from `npm run generate-vapid`
3. Optional CI hook after waiver ingest: set **`PUSH_INTERNAL_SECRET`** (same value as the worker secret) so the deploy workflow can POST `/internal/notify`.

If these env vars are missing, the Settings toggle shows **“Push is not configured for this deploy”** and the rest of the site is unaffected.

---

## 2. Team logos (PNG)

Logos are **not** fetched from FPL. They only exist if **you** put files in the repo.

1. Put images in **`web/public/team-logos/`**
2. Name them **`{id}.png`** where `id` is each team’s **`league_entries[].id`** from `details.json`
3. Commit and push:

```bash
git add web/public/team-logos/
git commit -m "Logos" && git push
```

The build generates **`team-logos-web/`** from those PNGs. No PNGs in git → site shows letter bubbles only.

---

## 3. Check what actually deployed

After a successful deploy, open (replace with your site):

**`https://YOUR_USER.github.io/YOUR_REPO/deploy-check.json`**

You’ll see something like:

```json
{
  "leagueName": "...",
  "teamCount": 8,
  "isDemoData": false,
  "teamLogosPngInDist": 0,
  ...
}
```

- **`isDemoData: true`** → data path A or B above isn’t wired yet  
- **`teamLogosPngInDist: 0`** → no PNGs were in the repo at build time  

In **Actions → latest run → build job log**, look for:

- `Ingest: league ID is configured` vs `No FPL_LEAGUE_ID`
- `Team logo PNGs in build: N`

---

## 4. Common mistakes

| Symptom | Cause |
|--------|--------|
| **Only README / Markdown, not the dashboard** | **Pages → Build and deployment** is set to **Deploy from a branch**. Switch **Source** to **GitHub Actions** so the workflow’s `dist/` upload is what gets published. |
| **Totally blank / white page** | Wrong URL or **missing trailing slash**. Use **Settings → Pages** “Visit site” link. Must look like `https://USER.github.io/REPO/` (**slash at the end**). |
| Demo league / yellow banner | No `FPL_LEAGUE_ID` and no real committed `league-data` |
| Wrong league | Wrong ID in secret |
| Letter avatars only | `team-logos/*.png` not committed |
