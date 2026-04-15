import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import api from '../api/client.js'

const LOCATIONS = [
  'India (All Regions)',
  'Maharashtra',
  'Karnataka',
  'Tamil Nadu',
  'Delhi NCR',
  'West Bengal',
  'Telangana',
  'Gujarat',
  'Rajasthan',
  'Uttar Pradesh',
]

const FEATURED_IMG =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuD-W8N1WsCPdonqIZEwqYdMz9q3ix76dxaN9QMvVPMvquGdi0FWpILhNqeUf2Nf36g_RAajAeOo4tz8gTpfJkaJfsqd9TKhSFc3IEqIxEP-P7uizEjm4kCHhtFqSQjkpa8r-4Hxb_Fi40JukcAqoccemX1Ydrp_fCW3llSYTKxgq004kxUHK6QdIMOnZ9IziAIxM1C_8cXFk9xY_isiCwfXyOraX9Skd6MXbIEgjEYk-We68uBMBUFRXnk-jBBjvkHL3mCpscB1bfY'

const SESSION_KEY = 'collegeAdvisor_cache'
function loadCache() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null') } catch { return null }
}

export default function CollegeAdvisor() {
  const cache = loadCache()
  const [careerPath, setCareerPath] = useState(cache?.careerPath ?? '')
  const [location, setLocation] = useState(cache?.location ?? 'India (All Regions)')
  const [district, setDistrict] = useState(cache?.district ?? '')
  const [result, setResult] = useState(cache?.result ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (result) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ careerPath, location, district, result }))
    }
  }, [result, careerPath, location, district])

  const handleRecommend = async () => {
    if (!careerPath.trim() || loading) return
    sessionStorage.removeItem(SESSION_KEY)
    setLoading(true)
    setError('')
    setResult('')
    try {
      const { data } = await api.post('/college-recommendations', {
        subcareer: careerPath,
        location: location === 'India (All Regions)' ? '' : location,
        district: district.trim() || null,
      })
      setResult(data.result || '')
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-12">
      {/* Hero Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 mb-4">
            <span className="bg-tertiary/20 text-tertiary px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-tertiary shadow-[0_0_8px_#26fedc]"></span>
              AI Intelligence Active
            </span>
          </div>
          <h1 className="font-headline text-5xl font-extrabold text-on-surface tracking-tighter leading-tight mb-4">
            Discover Your <span className="text-gradient">Future Campus</span>
          </h1>
          <p className="text-on-surface-variant text-lg max-w-xl font-light">
            Personalized higher education consulting powered by deep learning. We analyze thousands
            of metrics to find where you truly belong.
          </p>
        </div>

        {/* Search Controls */}
        <div className="w-full md:w-auto space-y-3">
          {/* Career Path Input */}
          <div className="bg-surface-container p-4 rounded-xl">
            <label className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold block mb-2">
              Your Career Goal *
            </label>
            <input
              type="text"
              value={careerPath}
              onChange={e => setCareerPath(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRecommend()}
              placeholder="e.g. AI Engineer, Data Scientist…"
              className="w-full min-w-[260px] bg-surface-container-highest border-none text-on-surface rounded-lg py-3 px-4 focus:ring-2 focus:ring-primary focus:outline-none transition-all text-sm"
            />
          </div>

          {/* Location Filter */}
          <div className="bg-surface-container p-4 rounded-xl">
            <label className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold block mb-2">
              Filter by State
            </label>
            <div className="relative min-w-[260px]">
              <select
                value={location}
                onChange={e => setLocation(e.target.value)}
                className="w-full bg-surface-container-highest border-none text-on-surface rounded-lg py-3 pl-4 pr-10 appearance-none focus:ring-2 focus:ring-primary focus:outline-none transition-all cursor-pointer text-sm"
              >
                {LOCATIONS.map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-primary text-sm">
                expand_more
              </span>
            </div>
          </div>

          {/* District Filter */}
          <div className="bg-surface-container p-4 rounded-xl">
            <label className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold block mb-2">
              Filter by District <span className="normal-case text-on-surface-variant/50">(optional)</span>
            </label>
            <input
              type="text"
              value={district}
              onChange={e => setDistrict(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRecommend()}
              placeholder="e.g. Pune, Coimbatore…"
              className="w-full min-w-[260px] bg-surface-container-highest border-none text-on-surface rounded-lg py-3 px-4 focus:ring-2 focus:ring-primary focus:outline-none transition-all text-sm"
            />
          </div>

          <button
            onClick={handleRecommend}
            disabled={loading || !careerPath.trim()}
            className="w-full bg-gradient-primary text-on-primary py-3 rounded-xl font-bold shadow-lg hover:shadow-primary/25 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin"></span>
                Finding colleges…
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-sm">school</span>
                Find Colleges
              </>
            )}
          </button>
        </div>
      </header>

      {/* Error */}
      {error && (
        <div className="px-5 py-4 rounded-xl bg-error/10 border border-error/20 text-error text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 auto-rows-[240px] animate-pulse">
            <div className="md:col-span-8 md:row-span-2 bg-surface-container-low rounded-xl"></div>
            <div className="md:col-span-4 bg-surface-container-low rounded-xl"></div>
            <div className="md:col-span-4 bg-surface-container-low rounded-xl"></div>
          </div>
          <p className="text-center text-on-surface-variant text-sm flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-tertiary animate-pulse">psychology</span>
            AI is curating top institutions — this takes 15–30 seconds…
          </p>
        </div>
      )}

      {/* Results */}
      {!loading && result && (
        <div className="bg-surface-container-low rounded-xl p-8 animate-[fadeIn_0.4s_ease]">
          <div className="flex items-center gap-2 mb-6 pb-4 border-b border-outline/10">
            <span className="material-symbols-outlined text-primary">school</span>
            <h2 className="font-headline text-xl font-bold">
              College Recommendations for{' '}
              <span className="text-primary">{careerPath}</span>
              {district.trim() && (
                <span className="text-on-surface-variant font-normal"> · {district.trim()}</span>
              )}
              {location !== 'India (All Regions)' && (
                <span className="text-on-surface-variant font-normal">{district.trim() ? ', ' : ' · '}{location}</span>
              )}
            </h2>
          </div>
          <div className="prose-pathfinder">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
          </div>
        </div>
      )}

      {/* Empty State Bento */}
      {!loading && !result && !error && (
        <section className="grid grid-cols-1 md:grid-cols-12 gap-6 auto-rows-[240px]">
          {/* Featured College Demo */}
          <div className="md:col-span-8 md:row-span-2 group relative overflow-hidden rounded-xl bg-surface-container-low">
            <div className="absolute inset-0 bg-gradient-to-t from-[#121416] via-transparent to-transparent z-10 opacity-80"></div>
            <img
              alt="IIT Bombay campus"
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              src={FEATURED_IMG}
            />
            <div className="absolute bottom-0 left-0 p-8 z-20 w-full">
              <div className="flex items-center gap-3 mb-3">
                <span className="bg-primary-container/80 backdrop-blur-md text-on-primary-container text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-tighter">
                  Enter a career goal above
                </span>
              </div>
              <h3 className="text-3xl font-headline font-bold text-white mb-2">
                AI-Powered College Matching
              </h3>
              <p className="text-on-surface-variant/90 max-w-lg mb-6 line-clamp-2">
                Tell us your career goal and location preference — our AI will surface the top
                institutions across India with fees, NIRF rankings, and placement packages.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => document.querySelector('input[type="text"]')?.focus()}
                  className="px-6 py-2 bg-gradient-primary rounded-lg text-on-primary font-bold transition-transform hover:scale-105 cursor-pointer"
                >
                  Get Started
                </button>
              </div>
            </div>
          </div>

          {/* AI Insight Card Demo */}
          <div className="md:col-span-4 md:row-span-1 bg-surface-container-high rounded-xl p-6 relative overflow-hidden">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-tertiary/10 rounded-full blur-3xl"></div>
            <span
              className="material-symbols-outlined text-tertiary mb-4"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              auto_awesome
            </span>
            <h4 className="text-xl font-headline font-bold mb-2">Regional Market Shift</h4>
            <p className="text-on-surface-variant text-sm leading-relaxed">
              AI will predict placement trends and regional demand shifts for your chosen career path
              across Indian states.
            </p>
          </div>

          {/* Acceptance Probability Demo */}
          <div className="md:col-span-4 md:row-span-1 bg-surface-container rounded-xl p-6 flex flex-col justify-between">
            <h4 className="text-sm font-bold text-on-surface-variant uppercase tracking-widest mb-4">
              Acceptance Probability
            </h4>
            <div className="flex items-end gap-2 mb-2">
              <span className="text-5xl font-headline font-black text-primary opacity-30">—%</span>
            </div>
            <div className="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden">
              <div className="bg-primary h-full rounded-full w-0"></div>
            </div>
            <p className="text-[10px] text-on-surface-variant/60 mt-4 leading-tight">
              Enter your career goal to see AI-estimated acceptance probabilities.
            </p>
          </div>
        </section>
      )}
    </div>
  )
}
