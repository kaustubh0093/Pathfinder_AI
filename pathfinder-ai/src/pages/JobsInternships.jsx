import { useState, useEffect } from 'react'
import api from '../api/client.js'

const LOCATIONS = [
  'India',
  'Bangalore',
  'Mumbai',
  'Delhi NCR',
  'Hyderabad',
  'Pune',
  'Chennai',
  'Remote (India)',
]

const JOB_TYPES = ['All', 'Internship', 'Full-time']

// Fallback static cards shown before first search
const DEMO_JOBS = [
  {
    title: 'Senior Product Designer',
    company: 'Synthetix AI Lab',
    companyColor: 'text-primary',
    salary: '$140k – $180k',
    location: 'San Francisco, CA',
    desc: 'Lead end-to-end design for next-gen AI-powered SaaS products.',
    tagColor: 'bg-primary/10 text-primary',
    tag: 'Design',
  },
  {
    title: 'AI Research Intern',
    company: 'Nexus Core Systems',
    companyColor: 'text-tertiary',
    salary: '$12k / mo',
    location: 'Remote & Global',
    desc: 'Work alongside ML researchers building foundation models for enterprise-scale knowledge retrieval.',
    tagColor: 'bg-tertiary/10 text-tertiary',
    tag: 'AI / ML',
  },
  {
    title: 'Full-Stack Architect',
    company: 'Aether Dynamics',
    companyColor: 'text-secondary',
    salary: '$165k – $210k',
    location: 'New York, NY',
    desc: 'Design scalable distributed systems for a high-growth fintech platform processing $2B+ daily.',
    tagColor: 'bg-secondary/10 text-secondary',
    tag: 'Engineering',
  },
]

const SESSION_KEY = 'jobsInternships_cache'
function loadCache() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null') } catch { return null }
}

export default function JobsInternships() {
  const cache = loadCache()
  const [searchRole, setSearchRole] = useState(cache?.searchRole ?? '')
  const [location, setLocation] = useState(cache?.location ?? 'India')
  const [jobTypeFilter, setJobTypeFilter] = useState(cache?.jobTypeFilter ?? 'All')
  const [jobs, setJobs] = useState(cache?.jobs ?? [])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(cache?.searched ?? false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (searched) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ searchRole, location, jobTypeFilter, jobs, searched }))
    }
  }, [searched, jobs, searchRole, location, jobTypeFilter])

  const handleSearch = async () => {
    if (!searchRole.trim() || loading) return
    sessionStorage.removeItem(SESSION_KEY)
    setLoading(true)
    setError('')
    setJobs([])
    setSearched(false)
    const timeout = setTimeout(() => {
      setLoading(false)
      setError('Search is taking too long. Please try again.')
    }, 60000)
    try {
      const effectiveRole =
        jobTypeFilter === 'All'
          ? searchRole
          : `${searchRole} ${jobTypeFilter}`
      const { data } = await api.post('/jobs', { role: effectiveRole, location })
      setJobs(data || [])
      setSearched(true)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to fetch jobs. Please try again.')
    } finally {
      clearTimeout(timeout)
      setLoading(false)
    }
  }

  const showDemo = !loading && !searched && !error

  return (
    <div className="max-w-7xl mx-auto space-y-10">
      {/* Hero Header */}
      <header>
        <div className="flex items-center gap-2 mb-5">
          <span className="bg-tertiary/10 text-tertiary px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-tertiary shadow-[0_0_8px_#26fedc] animate-pulse"></span>
            AI Matching Active
          </span>
        </div>
        <h1 className="font-headline text-4xl md:text-5xl font-extrabold tracking-tight leading-tight mb-4">
          Discover your next <span className="text-primary">milestone</span>
        </h1>
        <p className="text-on-surface-variant text-lg max-w-2xl">
          AI-curated live opportunities via Google Jobs — matched to your skills in real time.
        </p>
      </header>

      {/* Search / Filter Panel */}
      <section className="bg-surface-container-low rounded-xl p-6 space-y-5">
        <p className="text-on-surface-variant text-sm font-medium">Search for live job openings</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Role Input */}
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-2">
              Role / Keywords
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-sm">
                search
              </span>
              <input
                type="text"
                value={searchRole}
                onChange={e => setSearchRole(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="e.g. Data Scientist, DevOps…"
                className="w-full bg-surface-container-highest border-none text-on-surface placeholder:text-outline rounded-xl py-3 pl-10 pr-4 focus:ring-2 focus:ring-primary/40 outline-none transition-all text-sm"
              />
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-2">
              Location
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-sm">
                location_on
              </span>
              <select
                value={location}
                onChange={e => setLocation(e.target.value)}
                className="w-full bg-surface-container-highest border-none text-on-surface rounded-xl py-3 pl-10 pr-10 appearance-none focus:ring-2 focus:ring-primary/40 outline-none transition-all text-sm cursor-pointer"
              >
                {LOCATIONS.map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-outline text-sm">
                expand_more
              </span>
            </div>
          </div>

          {/* Job Type */}
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-2">
              Job Type
            </label>
            <div className="flex gap-2">
              {JOB_TYPES.map(t => (
                <button
                  key={t}
                  onClick={() => setJobTypeFilter(t)}
                  className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                    jobTypeFilter === t
                      ? 'bg-gradient-primary text-on-primary shadow-lg shadow-primary/20'
                      : 'bg-surface-container-highest text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={handleSearch}
          disabled={loading || !searchRole.trim()}
          className="bg-gradient-primary text-on-primary px-8 py-3 rounded-xl font-bold shadow-lg hover:shadow-primary/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin"></span>
              Searching jobs…
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-sm">work</span>
              Find Jobs & Internships
            </>
          )}
        </button>
      </section>

      {/* Error */}
      {error && (
        <div className="px-5 py-4 rounded-xl bg-error/10 border border-error/20 text-error text-sm">
          {error}
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 animate-pulse">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-surface-container-low rounded-xl overflow-hidden">
              <div className="h-28 bg-surface-container-highest"></div>
              <div className="p-5 space-y-3">
                <div className="h-4 bg-surface-container-highest rounded w-3/4"></div>
                <div className="h-3 bg-surface-container-highest rounded w-1/2"></div>
                <div className="h-3 bg-surface-container-highest rounded w-full"></div>
                <div className="h-3 bg-surface-container-highest rounded w-5/6"></div>
                <div className="h-8 bg-surface-container-highest rounded-lg mt-2"></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Live Results */}
      {!loading && searched && jobs.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-5">
            <p className="text-on-surface-variant text-sm">
              Found{' '}
              <span className="text-on-surface font-semibold">{jobs.length}</span> listings for{' '}
              <span className="text-primary font-medium">{searchRole}</span>
              {' '}in{' '}
              <span className="text-on-surface-variant">{location}</span>
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {jobs.map((job, i) => (
              <div
                key={i}
                className="group bg-surface-container-low rounded-xl overflow-hidden hover:bg-surface-container transition-all duration-300 flex flex-col"
              >
                {/* Card Header */}
                <div className="h-16 bg-gradient-to-r from-surface-container-high to-surface-container flex items-center px-5 gap-3">
                  {job.thumbnail ? (
                    <img
                      src={job.thumbnail}
                      alt={job.company}
                      className="w-10 h-10 rounded-xl object-contain bg-surface-container-highest p-1 shrink-0"
                      onError={e => {
                        e.target.style.display = 'none'
                        e.target.nextSibling.style.display = 'flex'
                      }}
                    />
                  ) : null}
                  <div
                    className="w-10 h-10 rounded-xl bg-surface-container-highest items-center justify-center shrink-0"
                    style={{ display: job.thumbnail ? 'none' : 'flex' }}
                  >
                    <span className="material-symbols-outlined text-on-surface-variant text-lg">business</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-on-surface text-sm font-bold truncate">{job.title}</p>
                    <p className="text-on-surface-variant text-xs truncate">{job.company}</p>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-5 flex flex-col flex-1 gap-3">
                  <div className="flex items-center gap-1 text-outline text-xs">
                    <span className="material-symbols-outlined text-sm">location_on</span>
                    <span className="truncate">{job.location}</span>
                  </div>
                  {job.description && (
                    <p className="text-on-surface-variant text-xs leading-relaxed line-clamp-3 flex-1">
                      {job.description}
                    </p>
                  )}
                  {job.link && job.link !== '#' ? (
                    <a
                      href={job.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-auto flex items-center justify-center gap-2 py-2.5 rounded-lg bg-gradient-primary text-on-primary text-xs font-bold hover:shadow-lg hover:shadow-primary/20 transition-all"
                    >
                      <span className="material-symbols-outlined text-sm">open_in_new</span>
                      Apply Now
                    </a>
                  ) : (
                    <div className="mt-auto flex items-center justify-center gap-2 py-2.5 rounded-lg bg-surface-container text-on-surface-variant text-xs font-bold cursor-default">
                      No Link Available
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Results */}
      {!loading && searched && jobs.length === 0 && (
        <div className="text-center py-20">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant opacity-30 mb-4">
            search_off
          </span>
          <p className="text-on-surface-variant mb-1">
            No jobs found for "{searchRole}" in {location}.
          </p>
          <p className="text-outline text-sm">Try a broader role name or different location.</p>
        </div>
      )}

      {/* Demo State — shown before first search */}
      {showDemo && (
        <div>
          <p className="text-on-surface-variant text-sm mb-5 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm text-outline">info</span>
            Sample listings — search above for live results
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {DEMO_JOBS.map((job, i) => (
              <div
                key={i}
                className="bg-surface-container-low rounded-xl overflow-hidden opacity-60"
              >
                <div className="h-16 bg-surface-container-high flex items-center px-5 gap-3">
                  <div className="w-10 h-10 rounded-xl bg-surface-container-highest flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-on-surface-variant text-lg">business</span>
                  </div>
                  <div>
                    <p className="text-on-surface text-sm font-bold">{job.title}</p>
                    <p className={`text-xs font-bold ${job.companyColor}`}>{job.company}</p>
                  </div>
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex items-center gap-1 text-outline text-xs">
                    <span className="material-symbols-outlined text-sm">location_on</span>
                    {job.location}
                  </div>
                  <p className="text-on-surface-variant text-xs line-clamp-2">{job.desc}</p>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${job.tagColor}`}>
                      {job.tag}
                    </span>
                    <span className="text-on-surface text-xs font-bold">{job.salary}</span>
                  </div>
                </div>
              </div>
            ))}

            {/* CTA Card */}
            <div className="bg-surface-container rounded-xl p-8 flex flex-col justify-center items-center text-center border border-dashed border-outline/20 hover:border-primary/30 transition-all duration-300">
              <span className="material-symbols-outlined text-primary text-4xl mb-4">travel_explore</span>
              <h4 className="font-headline font-bold text-on-surface mb-2">
                Can't find the perfect role?
              </h4>
              <p className="text-on-surface-variant text-sm mb-6">
                Let our AI optimize your resume and surface hidden opportunities.
              </p>
              <a
                href="/resume-coach"
                className="bg-gradient-primary text-on-primary px-6 py-2.5 rounded-lg text-sm font-bold hover:shadow-lg hover:shadow-primary/20 transition-all"
              >
                Try Resume Coach
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
