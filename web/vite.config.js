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

// GitHub Actions sets VITE_BASE_PATH=./ for Pages; local dev defaults to /TCLOT/
const base = process.env.VITE_BASE_PATH || '/TCLOT/'

export default defineConfig({
  base,
  define: {
    'import.meta.env.VITE_LEAGUE_DATA_REVISION': JSON.stringify(
      process.env.VITE_LEAGUE_DATA_REVISION || '',
    ),
  },
  plugins: [react(), redirectRootToBasePath(base)].filter(Boolean),
  server: {
    host: true,
    // App lives under base `/TCLOT/` — open `http://localhost:5173/TCLOT/` (root URL alone is empty).
    open: '/TCLOT/',
    // Live tab: same-origin `/__fpl/*` when `npm run dev` and VITE_FPL_PROXY_URL is unset
    // (avoids CORS + works without redeploying the Cloudflare worker).
    proxy: {
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
    },
  },
})
