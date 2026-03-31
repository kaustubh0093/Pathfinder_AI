import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import CareerInsights from './pages/CareerInsights'
import MarketAnalysis from './pages/MarketAnalysis'
import CollegeAdvisor from './pages/CollegeAdvisor'
import ResumeCoach from './pages/ResumeCoach'
import ChatAdvisor from './pages/ChatAdvisor'
import JobsInternships from './pages/JobsInternships'

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/career-insights" replace />} />
        <Route path="career-insights" element={<CareerInsights />} />
        <Route path="market-analysis" element={<MarketAnalysis />} />
        <Route path="college-advisor" element={<CollegeAdvisor />} />
        <Route path="resume-coach" element={<ResumeCoach />} />
        <Route path="chat-advisor" element={<ChatAdvisor />} />
        <Route path="jobs" element={<JobsInternships />} />
      </Route>
    </Routes>
  )
}

export default App
