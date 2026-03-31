import { NavLink } from 'react-router-dom'

const topNavLinks = [
  { path: '/career-insights', label: 'Career Insights' },
  { path: '/market-analysis', label: 'Market Analysis' },
  { path: '/college-advisor', label: 'College Advisor' },
  { path: '/resume-coach', label: 'Resume Coach' },
  { path: '/chat-advisor', label: 'Chat Advisor' },
  { path: '/jobs', label: 'Jobs & Internships' },
]

export default function Navbar() {
  return (
    <nav className="fixed top-0 w-full z-50 bg-[#121416]/60 backdrop-blur-xl shadow-[0_20px_40px_rgba(0,0,0,0.4)] flex justify-between items-center px-8 h-16 font-[Manrope] tracking-tight">
      <div className="text-xl font-bold text-on-surface tracking-tighter">Pathfinder AI</div>

      <div className="hidden md:flex items-center gap-8">
        {topNavLinks.map((link) => (
          <NavLink
            key={link.label}
            to={link.path}
            className={({ isActive }) =>
              isActive
                ? 'text-primary border-b-2 border-primary pb-1 text-sm'
                : 'text-on-surface-variant hover:text-on-surface transition-colors duration-300 text-sm'
            }
          >
            {link.label}
          </NavLink>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <button className="p-2 text-on-surface-variant hover:bg-surface-container rounded-lg transition-all duration-300">
          <span className="material-symbols-outlined">notifications</span>
        </button>
        <button className="p-2 text-on-surface-variant hover:bg-surface-container rounded-lg transition-all duration-300">
          <span className="material-symbols-outlined">account_circle</span>
        </button>
      </div>
    </nav>
  )
}
