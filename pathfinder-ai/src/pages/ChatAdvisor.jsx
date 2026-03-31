import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import api from '../api/client.js'

const INITIAL_MESSAGE = {
  role: 'ai',
  content:
    "Hello! I'm your **Pathfinder AI** career advisor. I can help you with career guidance, market trends, skill roadmaps, college advice, and more — specifically tailored for the Indian job market. What would you like to know?",
}

const sessions = [
  { id: 1, title: 'UX Career Trajectory', time: '2h ago', active: true },
  { id: 2, title: 'Salary Negotiation Tips', time: 'Yesterday' },
  { id: 3, title: 'Portfolio Review', time: '3 days ago' },
  { id: 4, title: 'MBA vs. Bootcamp', time: '1 week ago' },
]

const suggestions = [
  'How do I become a Data Scientist in India?',
  'Top skills for a Cloud Architect?',
  'How to prepare for FAANG interviews?',
  'Best certifications for Cybersecurity in 2025?',
]

export default function ChatAdvisor() {
  const [messages, setMessages] = useState([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = async (text) => {
    const msg = (text || input).trim()
    if (!msg || loading) return

    const userMsg = { role: 'user', content: msg }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    const history = messages.slice(1).map(m => ({
      role: m.role === 'user' ? 'human' : 'assistant',
      content: m.content,
    }))

    try {
      const { data } = await api.post('/chat', { message: msg, history })
      setMessages(prev => [
        ...prev,
        { role: 'ai', content: data.answer || "I couldn't process that. Please try again." },
      ])
    } catch (err) {
      console.error('/chat failed', err)
      setMessages(prev => [
        ...prev,
        { role: 'ai', content: '⚠️ Sorry, I encountered an error. Please try again.' },
      ])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const clearChat = () => {
    setMessages([{
      role: 'ai',
      content: "Chat cleared! I'm ready to help with your career questions.",
    }])
  }

  return (
    <div className="max-w-7xl mx-auto flex gap-6 h-[calc(100vh-7rem)]">
      {/* Session Sidebar */}
      <aside className="hidden xl:flex flex-col w-72 shrink-0 bg-surface-container-low rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/20">
          <h3 className="font-headline font-bold text-xs uppercase tracking-widest text-on-surface-variant">
            Recent Sessions
          </h3>
          <button
            onClick={clearChat}
            title="New session"
            className="p-1.5 text-primary hover:bg-surface-container rounded-lg transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">add</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar py-2">
          {sessions.map(s => (
            <div
              key={s.id}
              className={`px-4 py-3 cursor-pointer transition-all duration-200 ${
                s.active
                  ? 'border-l-2 border-primary bg-primary/5'
                  : 'border-l-2 border-transparent hover:bg-surface-container'
              }`}
            >
              <p className={`text-sm font-semibold truncate ${s.active ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                {s.title}
              </p>
              <p className="text-[11px] text-outline mt-0.5">{s.time}</p>
            </div>
          ))}
        </div>
      </aside>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-surface-container-low rounded-xl overflow-hidden">
        {/* Chat Header */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-outline-variant/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary-container flex items-center justify-center shrink-0">
              <span
                className="material-symbols-outlined text-on-primary text-sm"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                psychology
              </span>
            </div>
            <div>
              <h2 className="font-headline font-bold text-on-surface text-sm">Pathfinder AI</h2>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-tertiary shadow-[0_0_6px_#26fedc]"></span>
                <span className="text-[10px] text-tertiary font-bold tracking-wider">ONLINE</span>
              </div>
            </div>
          </div>
          <button
            onClick={clearChat}
            className="flex items-center gap-1.5 text-on-surface-variant hover:text-on-surface text-xs transition-colors px-3 py-1.5 rounded-lg hover:bg-surface-container cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">delete_sweep</span>
            Clear
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-6 space-y-6">
          {/* Welcome prompt (shown only initially) */}
          {messages.length === 1 && (
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 bg-tertiary/10 text-tertiary px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase mb-4">
                <span className="w-2 h-2 rounded-full bg-tertiary shadow-[0_0_8px_#26fedc]"></span>
                AI Intelligence Active
              </div>
              <h1 className="font-headline text-xl md:text-2xl font-extrabold text-on-surface tracking-tight mb-2">
                How can I accelerate your career path today?
              </h1>
            </div>
          )}

          {/* Message List */}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 items-start ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {/* Avatar */}
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-1 ${
                msg.role === 'user'
                  ? 'bg-secondary'
                  : 'bg-gradient-to-br from-primary to-primary-container'
              }`}>
                <span
                  className={`material-symbols-outlined text-sm ${msg.role === 'user' ? 'text-on-secondary' : 'text-on-primary'}`}
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  {msg.role === 'user' ? 'person' : 'psychology'}
                </span>
              </div>

              {/* Bubble */}
              <div className={`max-w-xl ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                <div className={`rounded-2xl px-5 py-4 ${
                  msg.role === 'user'
                    ? 'bg-surface-container-high rounded-tr-none'
                    : 'bg-surface-container rounded-tl-none'
                }`}>
                  {msg.role === 'user' ? (
                    <p className="text-on-surface text-sm leading-relaxed">{msg.content}</p>
                  ) : (
                    <div className="prose-pathfinder text-sm">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* AI Thinking */}
          {loading && (
            <div className="flex gap-3 items-start">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary-container flex items-center justify-center shrink-0 mt-1 ai-pulse">
                <span
                  className="material-symbols-outlined text-on-primary text-sm"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  psychology
                </span>
              </div>
              <div className="bg-surface-container rounded-2xl rounded-tl-none px-5 py-4 flex items-center gap-2">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-primary animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  ></div>
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input Area */}
        <div className="glass-panel border-t border-outline-variant/20 px-4 py-4 space-y-3 shrink-0">
          {/* Suggestion Chips — only show before first user message */}
          {messages.length === 1 && (
            <div className="flex flex-wrap gap-2">
              {suggestions.map(s => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  disabled={loading}
                  className="text-xs text-on-surface-variant bg-surface-container-high hover:bg-surface-container-highest hover:text-on-surface px-3 py-1.5 rounded-full transition-all cursor-pointer disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input Row */}
          <div className="relative flex items-center bg-surface-container-highest rounded-xl px-4 py-3 gap-3 focus-within:ring-2 focus-within:ring-primary/40 transition-all">
            <input
              ref={inputRef}
              className="flex-1 bg-transparent border-none text-on-surface placeholder:text-outline focus:ring-0 outline-none text-sm"
              placeholder="Message Pathfinder AI…"
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              disabled={loading}
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              className="bg-gradient-primary text-on-primary w-9 h-9 rounded-lg flex items-center justify-center hover:shadow-lg hover:shadow-primary/25 transition-all cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-sm">send</span>
            </button>
          </div>
          <p className="text-[10px] text-outline text-center">
            Pathfinder AI can make mistakes. Verify important information independently.
          </p>
        </div>
      </div>
    </div>
  )
}
