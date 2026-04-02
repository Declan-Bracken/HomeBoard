import { useNavigate, useLocation } from 'react-router-dom'

const navbarStyles = `
  .hb-navbar {
    position: sticky; top: 0; z-index: 10;
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 20px; height: 56px; width: 100%; box-sizing: border-box; overflow: hidden;
    background: rgba(15, 14, 13, 0.85); backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }
  .hb-nav-left { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
  .hb-nav-right { display: flex; align-items: center; gap: 8px; flex-shrink: 1; min-width: 0; overflow: hidden; }
  .hb-nav-back {
    background: none; border: none;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 300;
    color: rgba(245, 240, 235, 0.4); cursor: pointer; transition: color 0.2s;
    padding: 0; display: flex; align-items: center; gap: 6px; min-height: 44px;
  }
  .hb-nav-back:hover { color: #ff6428; }
  .hb-nav-divider { width: 1px; height: 16px; background: rgba(255,255,255,0.1); flex-shrink: 0; }
  .hb-nav-logo {
    font-family: 'Bebas Neue', sans-serif; font-size: 22px;
    letter-spacing: 0.08em; color: #f5f0eb;
  }
  .hb-nav-logo span { color: #ff6428; }
  .hb-profile-btn, .hb-logout-btn {
    background: none; border: 1px solid rgba(255,255,255,0.1); border-radius: 2px;
    padding: 6px 12px; font-family: 'DM Sans', sans-serif; font-size: 12px; font-weight: 500;
    letter-spacing: 0.06em; text-transform: uppercase; color: rgba(245,240,235,0.5);
    cursor: pointer; transition: all 0.2s; min-height: 36px; white-space: nowrap;
    flex-shrink: 0;
  }
  .hb-profile-btn {
    max-width: 120px; overflow: hidden; text-overflow: ellipsis;
  }
  .hb-profile-btn:hover, .hb-logout-btn:hover { border-color: rgba(255,100,40,0.4); color: #ff6428; }
  @media (max-width: 600px) {
    .hb-nav-logo { display: none; }
    .hb-nav-divider { display: none; }
  }
  @media (min-width: 701px) {
    .hb-navbar { padding: 0 40px; height: 60px; }
    .hb-nav-logo { font-size: 24px; }
  }
`

function getUsername() {
  try {
    const token = localStorage.getItem('token')
    return JSON.parse(atob(token.split('.')[1])).sub
  } catch { return null }
}

// children: optional extra buttons rendered before profile/logout on the right side
export default function Navbar({ backTo, children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const username = getUsername()
  const isProfilePage = location.pathname === '/profile'

  const handleLogout = () => {
    localStorage.removeItem('token')
    window.location.href = '/auth'
  }

  return (
    <>
      <style>{navbarStyles}</style>
      <nav className="hb-navbar">
        <div className="hb-nav-left">
          {backTo && (
            <>
              <button className="hb-nav-back" onClick={() => navigate(backTo)}>← Back</button>
              <div className="hb-nav-divider" />
            </>
          )}
          <div className="hb-nav-logo">Home<span>Board</span></div>
        </div>
        <div className="hb-nav-right">
          {children}
          {!isProfilePage && (
            <button className="hb-profile-btn" onClick={() => navigate('/profile')}>{username}</button>
          )}
          <button className="hb-logout-btn" onClick={handleLogout}>Logout</button>
        </div>
      </nav>
    </>
  )
}
