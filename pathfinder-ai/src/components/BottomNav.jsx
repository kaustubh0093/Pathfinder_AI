import { NavLink } from 'react-router-dom'

const bottomNavItems = [
  { path: '/career-insights', label: 'Insights', icon: 'insights' },
  { path: '/market-analysis', label: 'Market', icon: 'analytics' },
  { path: '/resume-coach', label: 'Coach', icon: 'description' },
  { path: '/chat-advisor', label: 'Chat', icon: 'forum' },
  { path: '/jobs', label: 'Jobs', icon: 'work' },
]

export default function BottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#121416]/90 backdrop-blur-xl h-16 flex items-center justify-around z-50 border-t border-outline-variant/10">
      {bottomNavItems.map((item) => (
        <NavLink
          key={item.label}
          to={item.path}
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 ${isActive ? 'text-primary' : 'text-on-surface-variant'}`
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
              <span className="text-[10px]">{item.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
