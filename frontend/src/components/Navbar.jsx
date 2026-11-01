import { Link, useLocation, useNavigate } from 'react-router-dom'

function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()

  // 1. Check if the user is authenticated by looking at localStorage tokens
  const loggedInUser = localStorage.getItem('loginUser')

  // 2. Hide the entire Navbar globally if the user is not logged in,
  // OR if they are currently on the Login ('/') or Register ('/register') page views.
  const hidePaths = ['/', '/register']
  if (!loggedInUser || hidePaths.includes(location.pathname)) {
    return null // Renders absolutely nothing to the DOM view screen
  }
// In Navbar.jsx (or Header component):
const menus = [
  { name: '대본 목록', path: '/upload' },
  { name: '연습 기록', path: '/history' },
  { name: '설정', path: '/settings' }
]

  // 4. Logout handler function to wipe user state clean
  const handleLogout = () => {
    localStorage.removeItem('loginUser') // Wipe token out of browser cache memories
    alert("로그아웃 되었습니다.")
    navigate('/') // Kick user back out to the clean login page view
  }

  return (
    <nav className="navbar" style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '12px 40px',
      background: '#0F172A', // Clean professional deep slate tone
      borderBottom: '1px solid #1E293B',
      fontFamily: 'sans-serif'
    }}>
      {/* Left side: Navigation Items */}
      <div style={{ display: 'flex', gap: '24px' }}>
        {menus.map((menu) => {
          const isActive = location.pathname === menu.path
          return (
            <Link
              key={menu.path}
              to={menu.path}
              style={{
                textDecoration: 'none',
                fontSize: '15px',
                fontWeight: '700',
                color: isActive ? '#3B82F6' : '#94A3B8', // Highlighting active route layout link
                transition: 'color 0.15s ease'
              }}
            >
              {menu.name}
            </Link>
          )
        })}
      </div>

      {/* Right side: Logout Control utility */}
      <button
        onClick={handleLogout}
        style={{
          background: 'transparent',
          border: '1px solid #EF4444',
          color: '#EF4444',
          padding: '6px 14px',
          borderRadius: '#FFFFFF',
          borderRadius: '6px',
          fontSize: '13px',
          fontWeight: '700',
          cursor: 'pointer',
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => { e.target.style.backgroundColor = '#EF4444'; e.target.style.color = '#FFFFFF' }}
        onMouseLeave={(e) => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = '#EF4444' }}
      >
        로그아웃
      </button>
    </nav>
  )
}

export default Navbar