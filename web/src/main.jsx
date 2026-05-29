import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { Mockup } from './Mockup.jsx'

// Local-only design preview (no production impact).
// Visit `?mockup=1` to render the design system mockup instead of the live app.
const isMockup =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('mockup') === '1'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isMockup ? <Mockup /> : <App />}
  </StrictMode>,
)
