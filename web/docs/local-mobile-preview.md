# Local dev and mobile preview

## Run the dashboard locally

From the `web/` directory:

```bash
npm run dev
```

This installs data steps and starts Vite. The dev server listens on **[http://localhost:5175/](http://localhost:5175/)** (`vite.config.js` sets port `5175` and enables `host: true`).

For a quicker start without the data pipeline (if assets are already present):

```bash
npm run dev:vite
```

## Preview on your phone (same Wi‑Fi)

1. Ensure your Mac and phone share the **same LAN**.
2. When Vite starts, the terminal prints **Network** URLs (e.g. `http://192.168.x.x:5175/`). Open that URL on the phone’s browser.

If routing or API calls behave oddly:

- Prefer the machine’s LAN IP (`192.168.x.x`), not only `localhost` on the phone.
- Firewall: allow inbound connections on port **5175** for Node/Vite if prompted.

## Optional: simulated mobile in the desktop browser

Chrome or Edge DevTools → **Toggle device toolbar** (Ctrl+Shift+M / ⌘⇧M) → pick a handset profile.

## Production-like local check

After `npm run build`:

```bash
npm run preview
```

Preview also uses port **5175** and the same proxies as dev when configured.
