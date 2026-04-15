import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import api from '../api/client.js'

const SESSION_KEY = 'resumeCoach_cache'
function loadCache() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null') } catch { return null }
}

export default function ResumeCoach() {
  const cache = loadCache()
  const [file, setFile] = useState(null)
  const [resumeText, setResumeText] = useState('')
  const [targetRole, setTargetRole] = useState(cache?.targetRole ?? '')
  const [inputMode, setInputMode] = useState('upload')
  const [result, setResult] = useState(cache?.result ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (result) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ targetRole, result }))
    }
  }, [result, targetRole])

  const handleFile = (f) => {
    if (!f) return
    const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
    if (allowed.includes(f.type) || f.name.match(/\.(pdf|docx|txt)$/i)) {
      setFile(f)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  const handleAnalyze = async () => {
    const hasContent = inputMode === 'upload' ? !!file : resumeText.trim()
    if (!hasContent || !targetRole.trim() || loading) return

    sessionStorage.removeItem(SESSION_KEY)
    setLoading(true)
    setError('')
    setResult('')

    try {
      const formData = new FormData()
      formData.append('target_role', targetRole)
      if (inputMode === 'upload' && file) {
        formData.append('file', file)
      } else {
        formData.append('resume_text', resumeText)
      }
      const { data } = await api.post('/resume-analysis', formData)
      setResult(data.result || '')
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = targetRole.trim() && (inputMode === 'upload' ? !!file : !!resumeText.trim())

  return (
    <div className="max-w-5xl mx-auto space-y-10">
      {/* Hero Header */}
      <header>
        <h1 className="font-headline text-4xl md:text-5xl font-extrabold tracking-tight leading-tight mb-4">
          <span
            style={{
              background: 'linear-gradient(135deg, #5cd7e5 0%, #00dfc1 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Resume Coach
          </span>
        </h1>
        <p className="text-on-surface-variant text-lg max-w-2xl leading-relaxed">
          Upload your resume for comprehensive AI analysis, ATS optimization scoring, and
          industry-specific actionable insights.
        </p>
      </header>

      {/* Input Panel */}
      <div className="space-y-8">
        {/* Input */}
        <div className="space-y-5">
          {/* Mode Toggle */}
          <div className="bg-surface-container-low rounded-xl p-1 flex gap-1">
            {['upload', 'paste'].map(mode => (
              <button
                key={mode}
                onClick={() => setInputMode(mode)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
                  inputMode === mode
                    ? 'bg-gradient-primary text-on-primary shadow-lg'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {mode === 'upload' ? '📎 Upload File' : '📋 Paste Text'}
              </button>
            ))}
          </div>

          {/* Target Role */}
          <div className="bg-surface-container-low rounded-xl p-5">
            <label className="block text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-3">
              Target Job Role *
            </label>
            <input
              type="text"
              value={targetRole}
              onChange={e => setTargetRole(e.target.value)}
              placeholder="e.g. Software Engineer, Data Analyst, UX Designer…"
              className="w-full bg-surface-container-highest border-none text-on-surface placeholder:text-outline rounded-lg py-3 px-4 focus:ring-2 focus:ring-primary focus:outline-none transition-all text-sm"
            />
          </div>

          {/* Upload or Paste */}
          {inputMode === 'upload' ? (
            <div className="bg-surface-container-low rounded-xl p-5">
              <label className="block text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-3">
                Resume File (PDF, DOCX, TXT)
              </label>
              {file ? (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
                  <span className="material-symbols-outlined text-primary">check_circle</span>
                  <span className="text-on-surface text-sm truncate flex-1">{file.name}</span>
                  <button
                    onClick={() => setFile(null)}
                    className="text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center text-center cursor-pointer transition-all duration-200 ${
                    isDragOver
                      ? 'border-primary/60 bg-primary/5'
                      : 'border-outline/30 hover:border-primary/40 hover:bg-primary/5'
                  }`}
                >
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 ${isDragOver ? 'bg-primary/20' : 'bg-surface-container'}`}>
                    <span className={`material-symbols-outlined text-3xl ${isDragOver ? 'text-primary' : 'text-on-surface-variant'}`}>
                      cloud_upload
                    </span>
                  </div>
                  <p className="font-headline font-bold text-on-surface mb-1">
                    {isDragOver ? 'Drop your resume here' : 'Drag & drop or click to upload'}
                  </p>
                  <p className="text-on-surface-variant text-xs mt-1">PDF · DOCX · TXT</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt"
                className="hidden"
                onChange={e => handleFile(e.target.files[0])}
              />
            </div>
          ) : (
            <div className="bg-surface-container-low rounded-xl p-5">
              <label className="block text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-3">
                Paste Resume Text
              </label>
              <textarea
                value={resumeText}
                onChange={e => setResumeText(e.target.value)}
                rows={10}
                placeholder="Paste your resume content here…"
                className="w-full bg-surface-container-highest border-none text-on-surface placeholder:text-outline rounded-lg py-3 px-4 focus:ring-2 focus:ring-primary focus:outline-none transition-all text-sm resize-none custom-scrollbar"
              />
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleAnalyze}
            disabled={loading || !canSubmit}
            className="w-full bg-gradient-primary text-on-primary py-4 rounded-xl font-bold shadow-lg hover:shadow-primary/25 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin"></span>
                Analyzing resume…
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-sm">auto_awesome</span>
                Analyze Resume
              </>
            )}
          </button>

          {error && (
            <div className="px-4 py-3 rounded-xl bg-error/10 border border-error/20 text-error text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Results — always mounted to prevent layout flicker */}
        <div className="bg-surface-container-low rounded-xl">
          {/* Loading */}
          {loading && (
            <div className="p-8 space-y-8">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-tertiary/20 flex items-center justify-center ai-pulse">
                  <span
                    className="material-symbols-outlined text-tertiary"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    psychology
                  </span>
                </div>
                <div>
                  <p className="font-headline font-bold text-on-surface">AI is analyzing your resume…</p>
                  <p className="text-on-surface-variant text-xs">Cross-referencing with 4.2M job descriptions</p>
                </div>
                <div className="flex gap-1.5 ml-auto">
                  {[0, 1, 2].map(i => (
                    <div
                      key={i}
                      className="w-2 h-2 rounded-full bg-tertiary animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-3 animate-pulse">
                {[90, 70, 85, 60, 78, 88, 65, 75].map((w, i) => (
                  <div key={i} className="h-3 bg-surface-container-highest rounded" style={{ width: `${w}%` }} />
                ))}
              </div>
              <p className="text-center text-on-surface-variant text-xs">This may take 20–40 seconds…</p>
            </div>
          )}

          {/* Result */}
          {!loading && result && (
            <div className="p-8">
              <div className="flex items-center gap-2 mb-6 pb-4 border-b border-outline/10">
                <span className="material-symbols-outlined text-primary">check_circle</span>
                <span className="font-headline font-bold text-on-surface">Analysis Complete</span>
                <span className="ml-auto text-[10px] text-on-surface-variant uppercase tracking-wider">
                  Target: {targetRole}
                </span>
              </div>
              <div className="overflow-x-auto">
                <div className="prose-pathfinder min-w-0">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
                </div>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!loading && !result && (
            <div className="p-8 min-h-64 flex flex-col items-center justify-center text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-3xl opacity-60">description</span>
              </div>
              <div>
                <p className="font-headline font-bold text-on-surface mb-1">Ready to analyze</p>
                <p className="text-on-surface-variant text-sm">
                  Upload your resume and specify your target role,
                  <br />then click Analyze Resume.
                </p>
              </div>
              <div className="w-full space-y-3 mt-4 opacity-30">
                {['Quantify Achievements', 'Missing Keywords', 'Visual Hierarchy'].map(t => (
                  <div key={t} className="flex items-center gap-3 p-3 bg-surface-container rounded-lg text-left">
                    <span className="material-symbols-outlined text-primary text-sm">
                      {t === 'Quantify Achievements' ? 'bolt' : t === 'Missing Keywords' ? 'manage_search' : 'auto_awesome'}
                    </span>
                    <span className="text-on-surface text-sm">{t}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
