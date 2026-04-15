import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

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
