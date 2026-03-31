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
        className={`lg:ml-64 pt-24 bg-mesh min-h-screen ${
          isChatPage ? 'px-4 md:px-6 pb-0 overflow-hidden' : 'px-6 md:px-12 pb-24'
        }`}
      >
        <Outlet />
      </main>

      <BottomNav />
    </div>
  )
}
