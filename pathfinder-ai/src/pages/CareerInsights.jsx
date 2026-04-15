import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Radar } from 'react-chartjs-2'
import api from '../api/client.js'
import { extractChartData, stripChartComment, radarOptions, buildRadarDataset } from '../utils/chartUtils.js'

// ── Palette cycling for skill bars ───────────────────────────────────────────
const SKILL_COLORS = [
  { bar: 'bg-primary',   text: 'text-primary',   bg: 'bg-primary/10'   },
  { bar: 'bg-tertiary',  text: 'text-tertiary',  bg: 'bg-tertiary/10'  },
  { bar: 'bg-secondary', text: 'text-secondary', bg: 'bg-secondary/10' },
  { bar: 'bg-primary',   text: 'text-primary',   bg: 'bg-primary/10'   },
  { bar: 'bg-tertiary',  text: 'text-tertiary',  bg: 'bg-tertiary/10'  },
]

// ── Badge colour per ladder rung ──────────────────────────────────────────────
const BADGE_STYLES = {
  Entry:  'bg-outline/20 text-on-surface-variant',
  Mid:    'bg-secondary/20 text-secondary',
  Senior: 'bg-primary/20 text-primary',
  Lead:   'bg-tertiary/20 text-tertiary',
}

// ── Roadmap stage accent ──────────────────────────────────────────────────────
const STAGE_ACCENT = [
  { border: 'border-outline/20',   icon: 'text-on-surface-variant', num: 'bg-surface-container-highest text-on-surface-variant' },
  { border: 'border-primary/30',   icon: 'text-primary',            num: 'bg-primary/10 text-primary'                          },
  { border: 'border-tertiary/30',  icon: 'text-tertiary',           num: 'bg-tertiary/10 text-tertiary'                        },
]

// ── Demo placeholder data (shown dim before first search) ─────────────────────
const DEMO_SKILLS = [
  { name: 'Core Technical Skill', score: 92 },
  { name: 'Domain Knowledge',     score: 85 },
  { name: 'Tooling & Platforms',  score: 78 },
  { name: 'Soft Skills',          score: 70 },
  { name: 'Communication',        score: 65 },
]
const DEMO_ROADMAP = [
  { stage: 'Beginner',     desc: 'Build fundamentals — courses, personal projects, internships.', icon: 'school'      },
  { stage: 'Intermediate', desc: 'Ship real work — freelance, open-source, certifications.',       icon: 'trending_up' },
  { stage: 'Advanced',     desc: 'Lead teams, architect solutions, drive business impact.',         icon: 'star'        },
]
const DEMO_LADDER = [
  { role: 'Junior Role',  salary: '4–8 LPA',   badge: 'Entry'  },
  { role: 'Mid Role',     salary: '10–18 LPA', badge: 'Mid'    },
  { role: 'Senior Role',  salary: '18–30 LPA', badge: 'Senior' },
  { role: 'Lead Role',    salary: '30–55 LPA', badge: 'Lead'   },
]
const DEMO_RESOURCES = [
  'Foundational Online Course — Coursera / Udemy',
  'Industry Certification — Vendor or Institute',
  'Canonical Book — O\'Reilly / Manning',
]


const SESSION_KEY = 'careerInsights_cache'

function loadCache() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null') } catch { return null }
}

export default function CareerInsights() {
  const cache = loadCache()

  const [careers, setCareers]     = useState({})
  const [category, setCategory]   = useState(cache?.category   ?? '')
  const [subcareer, setSubcareer] = useState(cache?.subcareer  ?? '')
  const [result, setResult]       = useState(cache?.result     ?? '')
  const [chartData, setChartData] = useState(cache?.chartData  ?? null)
  const [insights, setInsights]   = useState(cache?.insights   ?? null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  // Persist result state across navigation
  useEffect(() => {
    if (result || insights) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ category, subcareer, result, chartData, insights }))
    }
  }, [result, insights, chartData, category, subcareer])

  useEffect(() => {
    api.get('/careers')
      .then(res => {
        setCareers(res.data)
        // Only set defaults if nothing is cached
        if (!cache?.category) {
          const firstCat = Object.keys(res.data)[0]
          if (firstCat) {
            setCategory(firstCat)
            setSubcareer(res.data[firstCat][0] || '')
          }
        }
      })
      .catch(() => setError('Failed to load career list. Please refresh the page.'))
  }, [])

  const handleAnalyze = async () => {
    if (!category || !subcareer || loading) return
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
      const { data } = await api.post('/career-insights', { category, subcareer })
      setInsights(data.insights || null)
      setChartData(data.chartData || extractChartData(data.result || ''))
      setResult(stripChartComment(data.result || ''))
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong. Please try again.')
    } finally {
      clearTimeout(timeout)
      setLoading(false)
    }
  }

  const subcareers = category ? (careers[category] || []) : []
  const isLive = !!insights

  // Resolved values — live when insights exist, demo otherwise
  const skills    = insights?.skills        ?? DEMO_SKILLS
  const roadmap   = insights?.roadmap       ?? DEMO_ROADMAP
  const ladder    = insights?.careerLadder  ?? DEMO_LADDER
  const resources = insights?.resources     ?? DEMO_RESOURCES
  const outlook   = insights?.outlook       ?? null

  return (
    <div className="max-w-6xl mx-auto">

      {/* ── Hero Header ─────────────────────────────────────────────────────── */}
      <header className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <span className="px-3 py-1 bg-tertiary/20 text-tertiary rounded-full text-xs font-bold flex items-center gap-2 shadow-[0_0_12px_rgba(38,254,220,0.2)]">
            <span className="w-1.5 h-1.5 bg-tertiary rounded-full animate-pulse"></span>
            AI ANALYTICS ACTIVE
          </span>
        </div>
        <h1 className="font-headline text-4xl md:text-5xl font-extrabold tracking-tight text-on-background mb-4">
          Career{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-tertiary">
            Insights
          </span>
        </h1>
        <p className="text-on-surface-variant text-lg max-w-2xl leading-relaxed">
          Deep-dive roadmaps, skill blueprints, salary ladders, and growth outlook for any career — powered by AI.
        </p>
      </header>

      {/* ── Career Selector ──────────────────────────────────────────────────── */}
      <section className="mb-10">
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-tertiary/20 rounded-2xl blur opacity-75 group-focus-within:opacity-100 transition duration-500"></div>
          <div className="relative bg-surface-container-high rounded-xl px-6 py-5 shadow-2xl flex flex-col sm:flex-row items-stretch sm:items-end gap-4">
            <div className="flex-1">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2 block">
                Industry
              </label>
              <select
                value={category}
                onChange={e => {
                  setCategory(e.target.value)
                  setSubcareer(careers[e.target.value]?.[0] || '')
                  setResult('')
                  setInsights(null)
                  setChartData(null)
                  sessionStorage.removeItem(SESSION_KEY)
                }}
                className="w-full bg-surface-container-lowest border border-outline/20 rounded-lg px-4 py-3 text-on-surface text-sm focus:outline-none focus:border-primary transition-colors"
              >
                {Object.keys(careers).map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2 block">
                Career Role
              </label>
              <select
                value={subcareer}
                onChange={e => setSubcareer(e.target.value)}
                className="w-full bg-surface-container-lowest border border-outline/20 rounded-lg px-4 py-3 text-on-surface text-sm focus:outline-none focus:border-primary transition-colors"
              >
                {subcareers.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <button
              onClick={handleAnalyze}
              disabled={loading || !category || !subcareer}
              className="bg-gradient-to-r from-primary to-primary-container text-on-primary px-8 py-3 rounded-lg font-bold shadow-lg hover:shadow-primary/25 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shrink-0"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin"></span>
                  Analyzing…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-base">insights</span>
                  Analyze
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* ── Error ────────────────────────────────────────────────────────────── */}
      {error && (
        <div className="mb-8 px-5 py-4 rounded-xl bg-error/10 border border-error/20 text-error text-sm">
          {error}
        </div>
      )}

      {/* ── Loading skeleton ─────────────────────────────────────────────────── */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 animate-pulse">
          <div className="md:col-span-4 h-40 bg-surface-container-low rounded-xl"></div>
          <div className="md:col-span-4 h-40 bg-surface-container-low rounded-xl"></div>
          <div className="md:col-span-4 h-40 bg-surface-container-low rounded-xl"></div>
          <div className="md:col-span-8 h-64 bg-surface-container-low rounded-xl"></div>
          <div className="md:col-span-4 h-64 bg-surface-container-low rounded-xl"></div>
          <div className="md:col-span-12 h-44 bg-surface-container-low rounded-xl"></div>
          <p className="md:col-span-12 text-center text-on-surface-variant text-sm flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-primary animate-pulse">psychology</span>
            AI is generating your career roadmap — this may take 15–30 seconds…
          </p>
        </div>
      )}

      {/* ── Bento Grid (demo + live) ─────────────────────────────────────────── */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

          {/* ① Roadmap Stage Cards — full width, 3 across */}
          {roadmap.map((step, i) => {
            const accent = STAGE_ACCENT[i] ?? STAGE_ACCENT[0]
            return (
              <div
                key={step.stage}
                className={`md:col-span-4 bg-surface-container-low rounded-xl p-6 border ${accent.border} relative overflow-hidden
                            hover:translate-y-[-4px] transition-transform duration-300
                            ${!isLive ? 'opacity-30 pointer-events-none' : ''}`}
                style={{ transitionDelay: `${i * 60}ms` }}
              >
                {/* glow blob */}
                <div className="absolute -top-8 -right-8 w-28 h-28 bg-primary/5 rounded-full blur-2xl pointer-events-none"></div>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-black mb-4 ${accent.num}`}>
                  0{i + 1}
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`material-symbols-outlined text-xl ${accent.icon}`}>{step.icon}</span>
                  <h3 className="font-headline font-bold text-base text-on-background">{step.stage}</h3>
                </div>
                <p className="text-on-surface-variant text-sm leading-relaxed">{step.desc}</p>
              </div>
            )
          })}

          {/* ② Critical Skills — col-span-8 */}
          <section className="md:col-span-8 bg-surface-container-low rounded-xl p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-56 h-56 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
            <div className="flex justify-between items-start mb-8 relative z-10">
              <div>
                <h2 className="font-headline text-2xl font-bold text-primary mb-1">Critical Skills</h2>
                <p className="text-on-surface-variant text-sm">
                  {isLive ? `Demand-weighted for ${subcareer}` : 'Search a role to see live skill scores'}
                </p>
              </div>
              {isLive && (
                <span className="px-3 py-1 bg-surface-container text-xs rounded-full text-on-surface-variant">
                  Live data
                </span>
              )}
            </div>
            <div className={`space-y-5 relative z-10 ${!isLive ? 'opacity-30' : ''}`}>
              {skills.map((skill, i) => {
                const col = SKILL_COLORS[i % SKILL_COLORS.length]
                return (
                  <div key={skill.name} className="group">
                    <div className="flex justify-between text-xs mb-2">
                      <span className="font-bold text-on-surface uppercase tracking-wider">{skill.name}</span>
                      <span className={col.text}>{skill.score}%</span>
                    </div>
                    <div className="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden">
                      <div
                        className={`h-full ${col.bar} rounded-full transition-all duration-700 ease-out`}
                        style={{ width: isLive ? `${skill.score}%` : `${skill.score}%`, transitionDelay: `${i * 80}ms` }}
                      ></div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* ③ Radar Chart — col-span-4 */}
          <section className="md:col-span-4 bg-surface-container rounded-xl p-8 flex flex-col">
            <h2 className="font-headline text-xl font-bold mb-1">Skill Profile</h2>
            <p className="text-on-surface-variant text-sm mb-6">
              {isLive
                ? <span>Importance weights for <span className="text-on-surface font-medium">{subcareer}</span></span>
                : 'Radar chart appears after analysis'}
            </p>
            {chartData ? (
              <div className="flex-1 min-h-[240px]">
                <Radar data={buildRadarDataset(chartData)} options={{ ...radarOptions, maintainAspectRatio: false }} />
              </div>
            ) : (
              <div className="flex-1 min-h-[240px] flex flex-col items-center justify-center bg-surface-container-lowest rounded-xl gap-3">
                <span className="material-symbols-outlined text-4xl text-outline opacity-30">radar</span>
                <p className="text-on-surface-variant text-xs opacity-40 text-center px-4">
                  Skill radar will appear<br/>after you run an analysis
                </p>
              </div>
            )}
          </section>

          {/* ④ Career Ladder Cards — full width */}
          <section className="md:col-span-12 bg-surface-container-low rounded-xl p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div>
                <h2 className="font-headline text-2xl font-bold mb-1">Career Ladder</h2>
                <p className="text-on-surface-variant text-sm">
                  {isLive ? `Role progression & salary milestones for ${subcareer}` : 'Run an analysis to see the live career ladder'}
                </p>
              </div>
              {isLive && (
                <span className="px-3 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-bold">
                  Indian Market · INR LPA
                </span>
              )}
            </div>
            <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 ${!isLive ? 'opacity-30' : ''}`}>
              {ladder.map((rung, i) => {
                const badgeStyle = BADGE_STYLES[rung.badge] ?? BADGE_STYLES.Entry
                const icons = ['person', 'trending_up', 'workspace_premium', 'architecture']
                const iconColors = ['text-on-surface-variant', 'text-secondary', 'text-primary', 'text-tertiary']
                const bgColors   = ['bg-surface-container-highest/60', 'bg-secondary/10', 'bg-primary/10', 'bg-tertiary/10']
                return (
                  <div
                    key={rung.role}
                    className="bg-surface-container-high rounded-xl p-6 hover:translate-y-[-4px] transition-transform duration-300 flex flex-col gap-4"
                    style={{ transitionDelay: `${i * 60}ms` }}
                  >
                    <div className="flex items-start justify-between">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${bgColors[i % bgColors.length]}`}>
                        <span className={`material-symbols-outlined ${iconColors[i % iconColors.length]}`}>
                          {icons[i % icons.length]}
                        </span>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${badgeStyle}`}>
                        {rung.badge}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-on-background leading-tight mb-1">{rung.role}</h3>
                      <p className="text-xs text-on-surface-variant uppercase tracking-wider">Salary Range</p>
                      <p className="font-bold text-on-surface mt-0.5">{rung.salary}</p>
                    </div>
                    {/* progress dots */}
                    <div className="flex gap-1 mt-auto">
                      {[...Array(4)].map((_, dot) => (
                        <div
                          key={dot}
                          className={`h-1 flex-1 rounded-full ${dot <= i ? (i === 3 ? 'bg-tertiary' : 'bg-primary') : 'bg-surface-container-highest'}`}
                        ></div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* ⑤ Full markdown report — col-span-8 */}
          {result && (
            <section className="md:col-span-8 bg-surface-container-low rounded-xl p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
              <div className="flex items-center gap-2 mb-6 pb-4 border-b border-outline/10 relative z-10">
                <span className="material-symbols-outlined text-primary">description</span>
                <h2 className="font-headline text-xl font-bold">
                  Full Report — <span className="text-primary">{subcareer}</span>
                </h2>
              </div>
              <div className="prose-pathfinder relative z-10">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
              </div>
            </section>
          )}

          {/* ⑥ Resources + Outlook — col-span-4 */}
          {(result || isLive) && (
            <div className="md:col-span-4 flex flex-col gap-6">

              {/* Outlook card */}
              {outlook && (
                <div className="bg-gradient-to-br from-surface-container-low to-surface-container rounded-xl p-6 border border-tertiary/10">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="material-symbols-outlined text-tertiary text-xl">bolt</span>
                    <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Outlook</span>
                  </div>
                  <p className="text-on-surface-variant text-sm leading-relaxed">{outlook}</p>
                </div>
              )}

              {/* Resources cards */}
              <div className={`bg-surface-container rounded-xl p-6 flex flex-col gap-1 ${!isLive ? 'opacity-30' : ''}`}>
                <h3 className="font-headline font-bold text-lg mb-4">Top Resources</h3>
                <div className="space-y-3">
                  {resources.map((res, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-3 bg-surface-container-lowest rounded-lg hover:bg-surface-container-high transition-colors duration-200"
                    >
                      <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${
                        i === 0 ? 'bg-primary/10' : i === 1 ? 'bg-tertiary/10' : 'bg-secondary/10'
                      }`}>
                        <span className={`material-symbols-outlined text-sm ${
                          i === 0 ? 'text-primary' : i === 1 ? 'text-tertiary' : 'text-secondary'
                        }`}>
                          {i === 0 ? 'play_circle' : i === 1 ? 'verified' : 'menu_book'}
                        </span>
                      </div>
                      <p className="text-sm text-on-surface-variant leading-snug">{res}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ── Pre-search CTA ───────────────────────────────────────────────────── */}
      {!loading && !result && !error && (
        <div className="mt-6 bg-surface-container-low rounded-xl p-6 flex items-center gap-4">
          <span className="material-symbols-outlined text-primary text-4xl opacity-40">insights</span>
          <p className="text-on-surface-variant text-sm">
            Select an industry and career role above, then click{' '}
            <span className="text-on-surface font-semibold">Analyze</span> to unlock your personalized
            roadmap — skill scores, salary ladder, top resources, and growth outlook.
          </p>
        </div>
      )}

    </div>
  )
}
