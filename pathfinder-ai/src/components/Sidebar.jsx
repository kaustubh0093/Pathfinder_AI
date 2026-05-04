import { NavLink } from 'react-router-dom'

const navItems = [
  { path: '/career-insights', label: 'Career Insights', icon: 'insights' },
  { path: '/market-analysis', label: 'Market Analysis', icon: 'analytics' },
  { path: '/college-advisor', label: 'College Advisor', icon: 'school' },
  { path: '/resume-coach', label: 'Resume Coach', icon: 'description' },
  { path: '/chat-advisor', label: 'Chat Advisor', icon: 'forum' },
  { path: '/jobs', label: 'Jobs & Internships', icon: 'work' },
]

export default function Sidebar() {
  return (
    <aside className="hidden lg:flex flex-col py-6 space-y-2 h-screen w-64 fixed left-0 top-0 bg-[#121416] z-40 font-[Inter] text-sm">
      <div className="px-6 mt-16 mb-8">
        <div className="text-lg font-black text-primary tracking-tighter">Pathfinder AI</div>
        <p className="text-[10px] text-on-surface-variant tracking-[0.2em] uppercase opacity-60">
          Digital Atelier
        </p>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.label}
            to={item.path}
            className={({ isActive }) =>
              isActive
                ? 'bg-gradient-to-r from-primary to-primary-container text-[#121416] font-bold rounded-lg mx-2 px-4 py-3 flex items-center gap-3 transition-all duration-300'
                : 'text-on-surface-variant flex items-center gap-3 px-6 py-3 hover:bg-surface-container-low hover:text-on-surface transition-all duration-300 ease-out'
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className="material-symbols-outlined"
                  style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
                >
                  {item.icon}
                </span>
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

    </aside>
  )
}
