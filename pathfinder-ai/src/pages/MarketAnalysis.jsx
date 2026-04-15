import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Bar } from 'react-chartjs-2'
import api from '../api/client.js'
import { extractChartData, stripChartComment, barOptions, buildBarDataset } from '../utils/chartUtils.js'

// ── Skill tag colours cycling through design system palette ──
const SKILL_COLORS = [
  'bg-primary/10 text-primary border-primary/20',
  'bg-tertiary/10 text-tertiary border-tertiary/20',
  'bg-secondary/10 text-secondary border-secondary/20',
  'bg-primary/10 text-primary border-primary/20',
  'bg-tertiary/10 text-tertiary border-tertiary/20',
  'bg-secondary/10 text-secondary border-secondary/20',
]

const SESSION_KEY = 'marketAnalysis_cache'
function loadCache() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null') } catch { return null }
}

export default function MarketAnalysis() {
  const cache = loadCache()
  const [role, setRole] = useState(cache?.role ?? '')
  const [result, setResult] = useState(cache?.result ?? '')
  const [chartData, setChartData] = useState(cache?.chartData ?? null)
  const [insights, setInsights] = useState(cache?.insights ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (result || insights) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ role, result, chartData, insights }))
    }
  }, [result, insights, chartData, role])

  const handleAnalyze = async () => {
    if (!role.trim() || loading) return
    sessionStorage.removeItem(SESSION_KEY)
    setLoading(true)
    setError('')
    setResult('')
    setChartData(null)
    setInsights(null)
    const timeout = setTimeout(() => {
      setLoading(false)
      setError('Analysis is taking too long. Please try again.')
    }, 60000)
    try {
      const { data } = await api.post('/market-analysis', { subcareer: role })
      setChartData(data.chartData || extractChartData(data.result || ''))
      setInsights(data.insights || null)
      setResult(stripChartComment(data.result || ''))
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong. Please try again.')
    } finally {
      clearTimeout(timeout)
      setLoading(false)
    }
  }

  // Derive display values — live when insights exist, demo otherwise
  const trajectory = insights?.trajectory ?? []
  const salaryEntry  = insights?.salary?.entry  ?? null
  const salaryMedian = insights?.salary?.median ?? null
  const salarySenior = insights?.salary?.senior ?? null
  const salaryTop    = insights?.salary?.top    ?? null
  const growth       = insights?.growth         ?? null
  const confidence   = insights?.confidence     ?? null
  const skills       = insights?.skills         ?? []
  const locations    = insights?.locations      ?? []
  const remotePercent = insights?.remotePercent ?? null
  const isLive = !!insights

  return (
    <div className="max-w-6xl mx-auto">
      {/* Hero Header */}
      <header className="mb-12">
        <h1 className="font-headline text-4xl md:text-5xl font-extrabold tracking-tight text-on-background mb-4">
          Real-Time <span className="text-primary">Market Pulse</span>
        </h1>
        <p className="text-on-surface-variant text-lg max-w-2xl leading-relaxed">
          Analyze global employment trends, shifting demand, and precise salary benchmarks powered by
          Pathfinder AI's live data engine.
        </p>
      </header>

      {/* Search Section */}
      <section className="mb-10">
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-tertiary/20 rounded-2xl blur opacity-75 group-focus-within:opacity-100 transition duration-500"></div>
          <div className="relative flex items-center bg-surface-container-high rounded-xl px-6 py-4 shadow-2xl gap-4">
            <span className="material-symbols-outlined text-primary text-3xl shrink-0">search</span>
            <input
              className="flex-1 bg-transparent border-none text-on-surface placeholder:text-outline focus:ring-0 text-xl font-medium outline-none"
              placeholder="e.g. Senior Data Scientist, DevOps Engineer, UX Designer…"
              type="text"
              value={role}
              onChange={e => setRole(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
            />
            <button
              onClick={handleAnalyze}
              disabled={loading || !role.trim()}
              className="ml-2 bg-gradient-to-r from-primary to-primary-container text-on-primary px-8 py-3 rounded-lg font-bold shadow-lg hover:shadow-primary/25 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin"></span>
                  Analyzing…
                </>
              ) : (
                'Analyze'
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Error */}
      {error && (
        <div className="mb-8 px-5 py-4 rounded-xl bg-error/10 border border-error/20 text-error text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 animate-pulse">
          <div className="md:col-span-8 h-72 bg-surface-container-low rounded-xl"></div>
          <div className="md:col-span-4 bg-surface-container-low rounded-xl p-8 space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-16 bg-surface-container-highest rounded"></div>)}
          </div>
          <div className="md:col-span-6 h-48 bg-surface-container-low rounded-xl"></div>
          <div className="md:col-span-6 h-48 bg-surface-container-low rounded-xl"></div>
          <p className="md:col-span-12 text-center text-on-surface-variant text-sm flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-primary animate-pulse">psychology</span>
            AI is searching live market data — this takes 20–40 seconds…
          </p>
        </div>
      )}

      {/* ── BENTO GRID (demo or live) ─────────────────────────────────────── */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

          {/* ① Employment Trajectory */}
          <div className="md:col-span-8 bg-surface-container-low rounded-xl p-8 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4">
              <span className={`px-3 py-1 rounded-full text-xs font-bold tracking-widest flex items-center gap-2 ${
                isLive ? 'bg-tertiary/10 text-tertiary' : 'bg-outline/10 text-outline'
              }`}>
                <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-tertiary animate-pulse' : 'bg-outline'}`}></span>
                {isLive ? 'LIVE' : 'DEMO'}
              </span>
            </div>
            <h3 className="font-headline text-2xl font-bold mb-6">Employment Trajectory</h3>
            <div className="h-52 flex items-end gap-2 px-2">
              {isLive ? trajectory.map((h, i) => {
                const isLast = i === trajectory.length - 1
                return (
                  <div
                    key={i}
                    className={`flex-1 rounded-t-lg transition-all duration-700 ease-out ${
                      isLast
                        ? 'bg-primary'
                        : i >= trajectory.length - 2
                        ? 'bg-primary-container/80'
                        : 'bg-surface-variant group-hover:bg-primary/40'
                    }`}
                    style={{ height: `${h}%`, transitionDelay: `${i * 60}ms` }}
                  />
                )
              }) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 opacity-30">
                  <span className="material-symbols-outlined text-4xl text-on-surface-variant">bar_chart</span>
                  <p className="text-on-surface-variant text-xs">Search a role to see live trajectory</p>
                </div>
              )}
            </div>
            <div className="flex justify-between text-[10px] text-outline mt-1 px-2">
              {['6M ago', '5M', '4M', '3M', '2M', '1M', 'Now'].map(l => (
                <span key={l} className="flex-1 text-center">{l}</span>
              ))}
            </div>
            <div className="mt-6 flex justify-between items-center border-t border-outline/10 pt-5">
              <div>
                <p className="text-xs text-outline uppercase tracking-wider font-bold">Projected Growth</p>
                <p className="text-2xl font-black text-tertiary">
                  {growth ?? <span className="text-outline opacity-40">—</span>}{' '}
                  {growth && <span className="text-sm font-normal text-on-surface-variant">next 12 months</span>}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-outline uppercase tracking-wider font-bold">Confidence Score</p>
                <p className="text-2xl font-black">
                  {confidence != null ? `${confidence}/100` : <span className="opacity-40">—/100</span>}
                </p>
              </div>
            </div>
          </div>

          {/* ② Salary Benchmarks */}
          <div className="md:col-span-4 bg-surface-container rounded-xl p-8 flex flex-col justify-between">
            <div>
              <span className="material-symbols-outlined text-primary text-4xl mb-4">payments</span>
              <h3 className="font-headline text-xl font-bold mb-2">Salary Benchmarks</h3>
              <p className="text-on-surface-variant text-sm mb-6">
                {isLive ? `Based on live data — ${role}` : 'Search a role to see real salary data.'}
              </p>
            </div>
            <div className="space-y-4">
              <div className={`p-4 rounded-lg transition-all ${isLive ? 'bg-surface-container-lowest' : 'bg-surface-container-lowest opacity-40'}`}>
                <p className="text-xs text-outline font-bold uppercase tracking-widest mb-1">Top 10%</p>
                <p className="text-xl font-bold text-on-background">
                  {salaryTop ?? <span className="text-outline">₹ —</span>}
                </p>
              </div>
              <div className={`p-4 rounded-lg border-l-4 border-primary transition-all ${isLive ? 'bg-surface-container-low' : 'bg-surface-container-low opacity-40'}`}>
                <p className="text-xs text-primary font-bold uppercase tracking-widest mb-1">Senior Range</p>
                <p className="text-xl font-bold text-on-background">
                  {salarySenior ?? <span className="text-outline">₹ —</span>}
                </p>
              </div>
              <div className={`p-4 rounded-lg border-l-4 border-tertiary/40 transition-all ${isLive ? 'bg-surface-container-low' : 'bg-surface-container-low opacity-40'}`}>
                <p className="text-xs text-tertiary font-bold uppercase tracking-widest mb-1">Mid Range</p>
                <p className="text-xl font-bold text-on-background">
                  {salaryMedian ?? <span className="text-outline">₹ —</span>}
                </p>
              </div>
              <div className={`p-4 rounded-lg transition-all ${isLive ? 'bg-surface-container-lowest' : 'bg-surface-container-lowest opacity-40'}`}>
                <p className="text-xs text-outline font-bold uppercase tracking-widest mb-1">Entry Level</p>
                <p className="text-xl font-bold text-on-background">
                  {salaryEntry ?? <span className="text-outline">₹ —</span>}
                </p>
              </div>
            </div>
          </div>

          {/* ③ Skill Demand Heatmap */}
          <div className="md:col-span-6 bg-surface-container-low rounded-xl p-8">
            <h3 className="font-headline text-xl font-bold mb-6">High-Demand Skill Clusters</h3>
            {isLive && skills.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {skills.map((skill, i) => (
                  <div
                    key={skill}
                    className={`px-4 py-2 rounded-full flex items-center gap-2 border text-sm font-medium transition-all duration-300 ${SKILL_COLORS[i % SKILL_COLORS.length]}`}
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    <span className="w-2 h-2 rounded-full bg-current opacity-70"></span>
                    {skill}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-3 opacity-30">
                {['Large Language Models', 'Data Visualisation', 'Strategic Planning', 'Python / SQL', 'Cloud Arch'].map((s, i) => (
                  <div key={s} className={`px-4 py-2 rounded-full flex items-center gap-2 border text-sm ${SKILL_COLORS[i % SKILL_COLORS.length]}`}>
                    <span className="w-2 h-2 rounded-full bg-current opacity-70"></span>
                    {s}
                  </div>
                ))}
              </div>
            )}
            {/* Salary bar chart */}
            {chartData && (
              <div className="mt-8 h-44">
                <Bar data={buildBarDataset(chartData)} options={{ ...barOptions, maintainAspectRatio: false }} />
              </div>
            )}
            {!chartData && !isLive && (
              <div className="mt-8 w-full h-44 bg-surface-container rounded-lg flex items-center justify-center text-on-surface-variant text-sm opacity-30">
                <span className="material-symbols-outlined text-primary mr-2">hub</span>
                Skill Heatmap Visualization
              </div>
            )}
          </div>

          {/* ④ Location Saturation */}
          <div className="md:col-span-6 bg-surface-container-low rounded-xl p-8 grid grid-cols-2 gap-6">
            <div className="col-span-2">
              <h3 className="font-headline text-xl font-bold mb-1">Location Saturation</h3>
              <p className="text-on-surface-variant text-sm">
                {isLive ? `Top hiring hubs for ${role}` : 'Search a role to see live location data.'}
              </p>
            </div>

            {/* Location bars */}
            <div className="space-y-4">
              {isLive && locations.length > 0 ? (
                locations.slice(0, 3).map((loc, i) => (
                  <div key={loc.city}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-on-background text-sm">{loc.city}</span>
                      <span className="text-primary font-bold text-sm">{loc.pct}%</span>
                    </div>
                    <div className="w-full bg-surface-container-highest h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-primary h-full rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${loc.pct}%`, transitionDelay: `${i * 120}ms` }}
                      ></div>
                    </div>
                  </div>
                ))
              ) : (
                [{ city: 'Bangalore', pct: 42 }, { city: 'Mumbai', pct: 28 }, { city: 'Delhi NCR', pct: 18 }].map((loc) => (
                  <div key={loc.city} className="opacity-30">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-on-background text-sm">{loc.city}</span>
                      <span className="text-primary font-bold text-sm">{loc.pct}%</span>
                    </div>
                    <div className="w-full bg-surface-container-highest h-1.5 rounded-full overflow-hidden">
                      <div className="bg-primary h-full rounded-full" style={{ width: `${loc.pct}%` }}></div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Remote-friendly stat */}
            <div className="flex flex-col items-center justify-center border-l border-outline/10 pl-6">
              <div className="text-center">
                <div className={`text-4xl font-black mb-1 ${isLive ? 'text-tertiary' : 'text-outline opacity-30'}`}>
                  {remotePercent != null ? `${remotePercent}%` : '—%'}
                </div>
                <p className="text-xs text-outline uppercase font-bold tracking-tighter">Remote-Friendly</p>
              </div>
              <div className={`mt-4 p-3 rounded-full ${isLive ? 'bg-tertiary/5' : 'bg-surface-container opacity-30'}`}>
                <span className={`material-symbols-outlined text-4xl ${isLive ? 'text-tertiary' : 'text-outline'}`}>public</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full Markdown Report (below bento) */}
      {!loading && result && (
        <div className="mt-8 bg-surface-container-low rounded-xl p-8">
          <div className="flex items-center gap-2 mb-6 pb-4 border-b border-outline/10">
            <span className="material-symbols-outlined text-primary">analytics</span>
            <h2 className="font-headline text-xl font-bold">
              Full Market Report — <span className="text-primary">{role}</span>
            </h2>
          </div>
          <div className="prose-pathfinder">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
          </div>
        </div>
      )}

      {/* Pre-search call-to-action strip */}
      {!loading && !result && !error && (
        <div className="mt-6 bg-surface-container-low rounded-xl p-6 flex items-center gap-4">
          <span className="material-symbols-outlined text-primary text-4xl opacity-40">analytics</span>
          <p className="text-on-surface-variant text-sm">
            Enter any job role above to get live market analysis — salary benchmarks, demand trajectory, top skills, hiring cities, and more.
          </p>
        </div>
      )}
    </div>
  )
}
