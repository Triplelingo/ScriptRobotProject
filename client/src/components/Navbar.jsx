import { Link, useLocation, useNavigate } from 'react-router-dom'

function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const loggedInUser = localStorage.getItem('loginUser')
  const user = loggedInUser ? JSON.parse(loggedInUser) : null

  const hidePaths = ['/', '/register']
  // 검은 배경 탭 숨기기 - 연습 관련 페이지에서는 Navbar 숨김
  const hiddenNavPaths = ['/preview', '/character', '/practice', '/result', '/settings']

  if (!loggedInUser || hidePaths.includes(location.pathname)) {
    return null
  }

  if (hiddenNavPaths.includes(location.pathname)) {
    return null
  }

  const menus = [
    { name: '대본 업로드', path: '/upload' },
    { name: '연습 기록', path: '/history' },
  ]

  const handleLogout = () => {
    localStorage.removeItem('loginUser')
    alert("로그아웃 되었습니다.")
    navigate('/')
  }

  return (
    <nav style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '14px 40px',
      background: '#FFFFFF',
      borderBottom: '1px solid #E2E8F0',
      fontFamily: 'sans-serif'
    }}>
      <div style={{ fontSize: '18px', fontWeight: '800', color: '#1E293B', cursor: 'pointer' }} onClick={() => navigate('/upload')}>
        ScriptBot
      </div>

      <div style={{ display: 'flex', gap: '32px' }}>
        {menus.map((menu) => {
          const isActive = location.pathname === menu.path
          return (
            <Link
              key={menu.path}
              to={menu.path}
              style={{
                textDecoration: 'none',
                fontSize: '15px',
                fontWeight: '600',
                color: isActive ? '#2563EB' : '#64748B',
                borderBottom: isActive ? '2px solid #2563EB' : 'none',
                paddingBottom: '4px'
              }}
            >
              {menu.name}
            </Link>
          )
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: '50%',
          background: '#2563EB', color: '#FFFFFF',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '14px', fontWeight: 'bold'
        }}>
          {user?.nickname?.[0]?.toUpperCase() || 'U'}
        </div>
        <button
          onClick={handleLogout}
          style={{
            background: 'transparent',
            border: '1px solid #E2E8F0',
            color: '#64748B',
            padding: '6px 14px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          로그아웃
        </button>
      </div>
    </nav>
  )
}

export default Navbar