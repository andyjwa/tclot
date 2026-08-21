# FPL API CORS proxy (Cloudflare Worker)

The **Live** tab calls FPL from the browser. Many hosts (e.g. GitHub Pages) hit **CORS** blocks. This worker mirrors public APIs and adds `Access-Control-Allow-*` headers:

- **`/*`** → `https://fantasy.premierleague.com/api/*` (bootstrap-static, event live, etc.)
- **`/draft/*`** → `https://draft.premierleague.com/api/*` (draft GW lineups — **not** classic `/entry/.../picks/`)
- **`/fotmob/*`** → `https://www.fotmob.com/api/*` (unofficial read-only JSON used for Live **Player Points** ordering — not affiliated with FotMob; respect their terms and rate limits)
- **`/espn/*`** → `https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/*` (open scoreboard + summary; lineups ~T-60)
- **`/pulselive/*`** → `https://footballapi.pulselive.com/football/*` (official PL backend; team sheets ~T-75 + wallclock events; the worker adds the required `Account: premierleague` header)

Draft leagues must use the draft host for picks; classic picks would show the wrong XI for each manager.

### HTML 404 on a prefix (`/pulselive/...`, `/espn/...`, `/draft/...`) after an app update

**This worker only updates when someone runs `npm run deploy`.** Unrecognised prefixes fall through to `fantasy.premierleague.com`, so a **stale deploy** turns a newly-added prefix into a confusing **404 with `Content-Type: text/html`** (Django error page — note `Vary: Cookie` / `X-Frame-Options: DENY` in the response headers). The upstream feed is fine; the proxy simply doesn't know the route yet.

Check which prefixes the **deployed** worker actually knows:

```bash
curl https://tclot-fpl-proxy.<you>.workers.dev/__health
```

If a prefix you expect is missing from `upstreams`, redeploy from `web/workers/fpl-proxy/`:

```bash
npm run deploy
```

Whenever you add a new upstream prefix to `src/index.js`, **redeploy** — a frontend deploy alone does not update this worker.

**Local dev without redeploying:** in `web/.env.local`, **remove or comment out** `VITE_FPL_PROXY_URL` and use `npm run dev` — Vite proxies `/__fpl/*` and `/__fotmob/*` automatically (see `web/vite.config.js`).

## One-time setup

**Use a local Wrangler** (no `sudo`, avoids `EACCES` on `npm install -g`):

```bash
cd web/workers/fpl-proxy
npm install
npm run login    # opens browser — complete OAuth in the browser window
npm run deploy
```

**Local web app (`npm run dev` / `npx vite`):** Vite does not read GitHub secrets. From `web/`, run  
`cp .env.local.example .env.local`, put your Worker URL in `VITE_FPL_PROXY_URL`, restart Vite.

**Do not** run `npm install wrangler@4` here unless you know how to fix native `sharp` builds. This project stays on **Wrangler 3.x** on purpose; it deploys the same Worker and avoids `node-gyp` errors on macOS.

Run **`login`** and **`deploy` as two separate commands** (press Enter between them). If you paste `login` and `npx` on the same line without a newline, the shell can glue them into garbage like `loginnpx` and nothing runs correctly.

### If `npm install -g wrangler` failed with `EACCES`

That tries to write under `/usr/local/`. **Don’t use `-g` here** — the `npm install` inside this folder puts Wrangler in `./node_modules` only.

### If `npm install` fails on `sharp` / `node-gyp`

This repo pins **Wrangler 3.x** so install works without compiling native addons. If you upgrade to Wrangler 4 and hit `sharp` errors, use Node 20+ LTS and Xcode Command Line Tools (`xcode-select --install`), or stay on the committed lockfile.

### Alternative: `npx` (no `package.json` install)

```bash
cd web/workers/fpl-proxy
npx --yes wrangler login
npx --yes wrangler deploy
```

Again: **two lines**, not `login` and `npx` stuck together.

2. Wrangler prints a URL like `https://tclot-fpl-proxy.<you>.workers.dev`.

3. **Wire the site** — set Vite env at **build** time (value = worker origin, **no** trailing slash):

   ```bash
   # Local test
   echo 'VITE_FPL_PROXY_URL=https://tclot-fpl-proxy.your-subdomain.workers.dev' >> web/.env.local
   cd web && npm run dev
   ```

4. **GitHub Pages** — add a **Repository secret** or variable:

   - Name: `VITE_FPL_PROXY_URL`
   - Value: `https://tclot-fpl-proxy.your-subdomain.workers.dev`

   The deploy workflow passes it into `npm run build` so the SPA embeds the proxy URL.

## Optional: restrict CORS origin

Edit `wrangler.toml` and set:

```toml
[vars]
ALLOW_ORIGIN = "https://YOUR_USER.github.io"
```

Redeploy. If unset, the worker echoes the request `Origin` or falls back to `*`.

## Limits

- **GET/HEAD only** — matches what the Live tab needs.
- No API keys; same public data as the FPL site.
