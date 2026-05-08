import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import api from './api/client.js'
import './index.css'

// Wake the Render web service immediately on app load. The backend dyno can
// sleep when idle, and the first request takes 30–60s to spin up. Firing this
// before the user navigates means FastAPI is warm by the time they click anything.
api.get('/health').catch(() => { /* warmup is best-effort */ })

// Clear all page caches on hard refresh (F5 / Ctrl+R).
// sessionStorage survives navigation but a reload should start fresh.
const navEntry = performance.getEntriesByType?.('navigation')?.[0]
if (navEntry?.type === 'reload') {
  const CACHE_KEYS = [
    'careerInsights_cache',
    'marketAnalysis_cache',
    'collegeAdvisor_cache',
    'resumeCoach_cache',
    'jobsInternships_cache',
    'chatAdvisor_cache',
  ]
  CACHE_KEYS.forEach(k => sessionStorage.removeItem(k))
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
