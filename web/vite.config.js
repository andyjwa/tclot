import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** When `base` is an absolute path (e.g. `/TCLOT/`), redirect `/` so local dev isn’t a blank page. */
function redirectRootToBasePath(base) {
  const b = String(base || '/TCLOT/')
  if (!b.startsWith('/') || b === '/') return null
  const target = b.endsWith('/') ? b : `${b}/`
  return {
    name: 'tclot-redirect-root-to-base',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathOnly = req.url?.split('?')[0] ?? ''
        if (pathOnly === '/' || pathOnly === '/index.html') {
          res.writeHead(302, { Location: target })
          res.end()
          return
        }
        next()
      })
    },
  }
}

/** Production / static deploy: subpath on GitHub Pages. Local `vite`/`npm run dev:vite` uses `/` so http://localhost:5173/ and #/players work. */
const productionBase = process.env.VITE_BASE_PATH || '/TCLOT/'

/** Dev + `vite preview`: Live / ESPN / FotMob / Pulselive same-origin proxies (`fplDraftUrl.js` uses `/__fpl` on localhost). */
const fplRelatedProxy = {
  '^/__fpl/draft/': {
    target: 'https://draft.premierleague.com',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/__fpl\/draft/, '/api'),
  },
  '^/__fpl/': {
    target: 'https://fantasy.premierleague.com',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/__fpl/, '/api'),
  },
  '^/__fotmob/': {
    target: 'https://www.fotmob.com',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/__fotmob/, '/api'),
  },
  '^/__espn/': {
    target: 'https://site.api.espn.com',
    changeOrigin: true,
    rewrite: (path) =>
      path.replace(/^\/__espn/, '/apis/site/v2/sports/soccer/eng.1'),
  },
  '^/__pulselive/': {
    target: 'https://footballapi.pulselive.com',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/__pulselive/, '/football'),
    /** Pulselive returns HTTP 401 without `Account: premierleague`; `Origin`/`Referer`
     *  match the worker so dev and prod talk to the same upstream. */
    configure: (proxy) => {
      proxy.on('proxyReq', (proxyReq) => {
        proxyReq.setHeader('Origin', 'https://www.premierleague.com')
        proxyReq.setHeader('Referer', 'https://www.premierleague.com/')
        proxyReq.setHeader('Account', 'premierleague')
      })
    },
  },
}

export default defineConfig(({ command }) => {
  const base = command === 'serve' ? '/' : productionBase
  return {
  base,
  define: {
    'import.meta.env.VITE_LEAGUE_DATA_REVISION': JSON.stringify(
      process.env.VITE_LEAGUE_DATA_REVISION || '',
    ),
  },
  plugins: [react(), redirectRootToBasePath(base)].filter(Boolean),
  server: {
    host: true,
    /** Avoid clash with bowls-web (and other Vite apps) on default 5173 — use http://127.0.0.1:5175/ */
    port: 5175,
    strictPort: true,
    // Dev: root is the app (`base: '/'`). Build: open still useful if someone runs preview with subpath.
    open: command === 'serve' ? '/' : '/TCLOT/',
    // Live tab: same-origin `/__fpl/*` when `npm run dev` and VITE_FPL_PROXY_URL is unset
    // (avoids CORS + works without redeploying the Cloudflare worker).
    proxy: fplRelatedProxy,
  },
  preview: {
    port: 5175,
    strictPort: true,
    proxy: fplRelatedProxy,
  },
  }
})
