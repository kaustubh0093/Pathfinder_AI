import { Outlet, useLocation } from 'react-router-dom'
import Navbar from './Navbar'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'

export default function Layout() {
  const location = useLocation()
  const isChatPage = location.pathname === '/chat-advisor'

  return (
    <div className="min-h-screen bg-surface text-on-surface font-body">
      <Navbar />
      <Sidebar />

      <main
        className={`lg:ml-64 pt-20 bg-mesh min-h-screen ${
          isChatPage ? 'px-3 md:px-5 pb-0 overflow-hidden' : 'px-4 md:px-8 pb-16'
        }`}
      >
        <Outlet />
      </main>

      <BottomNav />
    </div>
  )
}
