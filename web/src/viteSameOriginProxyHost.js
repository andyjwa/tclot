/**
 * True when the SPA is served from a loopback hostname where Vite’s dev server or
 * `vite preview` provides same-origin proxies (`/__fpl`, `/__espn`, `/__fotmob`).
 * Production bundles set `import.meta.env.DEV` to false, so we mirror `fplApiBase()`
 * routing here without duplicating hostname checks everywhere.
 */
export function viteSameOriginProxyHost() {
  if (typeof window === 'undefined') return false
  const h = window.location.hostname
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]'
}
