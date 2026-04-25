import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { AuthProvider } from './AuthContext'
import { BusyOverlayProvider } from './components/busy/BusyOverlayProvider'
import './index.css'

const el = document.getElementById('root')
if (!el) {
  throw new Error('root element not found')
}

createRoot(el).render(
  <StrictMode>
    <BrowserRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <AuthProvider>
        <BusyOverlayProvider>
          <App />
        </BusyOverlayProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
)

if (import.meta.env.PROD) {
  // Service worker: virtual module is only resolved in production builds. Dev leaves SW off
  // (VitePWA devOptions.enabled: false) so HMR and API proxy stay reliable.
  void import('virtual:pwa-register')
    .then(({ registerSW }) => {
      registerSW({ immediate: true })
    })
    .catch(() => {})
}
