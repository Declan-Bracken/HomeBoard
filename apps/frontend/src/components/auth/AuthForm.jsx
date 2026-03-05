import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/axios'

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  .auth-root {
    min-height: 100vh;
    background-color: #0f0e0d;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'DM Sans', sans-serif;
    overflow: hidden;
    position: relative;
  }

  .auth-root::before {
    content: '';
    position: fixed;
    inset: 0;
    background-image: 
      radial-gradient(ellipse 80% 60% at 70% 20%, rgba(255, 100, 40, 0.08) 0%, transparent 60%),
      radial-gradient(ellipse 60% 80% at 20% 80%, rgba(255, 60, 20, 0.05) 0%, transparent 60%),
      url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
    pointer-events: none;
    z-index: 0;
  }

  .auth-layout {
    display: flex;
    width: min(960px, 95vw);
    min-height: 560px;
    position: relative;
    z-index: 1;
  }

  .auth-brand {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    padding: 48px;
    position: relative;
    overflow: hidden;
  }

  .auth-brand::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, #1a1714 0%, #0f0e0d 100%);
    border: 1px solid rgba(255,255,255,0.04);
    border-right: none;
    border-radius: 2px 0 0 2px;
  }

  .hold-grid {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    overflow: hidden;
  }

  .hold {
    position: absolute;
    border-radius: 50%;
    opacity: 0.15;
    animation: float 6s ease-in-out infinite;
  }

  .hold:nth-child(1)  { width: 18px; height: 18px; background: #ff6428; top: 15%; left: 20%; animation-delay: 0s; }
  .hold:nth-child(2)  { width: 12px; height: 12px; background: #ff9040; top: 35%; left: 60%; animation-delay: 1.2s; }
  .hold:nth-child(3)  { width: 22px; height: 22px; background: #ff6428; top: 55%; left: 30%; animation-delay: 2.4s; }
  .hold:nth-child(4)  { width: 10px; height: 10px; background: #ffb060; top: 25%; left: 75%; animation-delay: 0.8s; }
  .hold:nth-child(5)  { width: 16px; height: 16px; background: #ff6428; top: 70%; left: 55%; animation-delay: 3.1s; }
  .hold:nth-child(6)  { width: 8px;  height: 8px;  background: #ff9040; top: 80%; left: 15%; animation-delay: 1.7s; }
  .hold:nth-child(7)  { width: 14px; height: 14px; background: #ff6428; top: 45%; left: 85%; animation-delay: 2.9s; }
  .hold:nth-child(8)  { width: 20px; height: 20px; background: #ffb060; top: 10%; left: 45%; animation-delay: 0.4s; }

  @keyframes float {
    0%, 100% { transform: translateY(0px) scale(1); opacity: 0.15; }
    50% { transform: translateY(-8px) scale(1.05); opacity: 0.25; }
  }

  .brand-content {
    position: relative;
    z-index: 1;
  }

  .brand-eyebrow {
    font-family: 'DM Sans', sans-serif;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: #ff6428;
    margin-bottom: 12px;
  }

  .brand-title {
    font-family: 'Bebas Neue', sans-serif;
    font-size: clamp(56px, 7vw, 84px);
    line-height: 0.9;
    color: #f5f0eb;
    letter-spacing: 0.02em;
    margin-bottom: 20px;
  }

  .brand-title span {
    color: #ff6428;
  }

  .brand-desc {
    font-size: 13px;
    font-weight: 300;
    color: rgba(245, 240, 235, 0.4);
    line-height: 1.6;
    max-width: 260px;
  }

  .auth-form-panel {
    width: 380px;
    flex-shrink: 0;
    background: #161412;
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 0 2px 2px 0;
    padding: 48px 40px;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .form-header {
    margin-bottom: 36px;
  }

  .form-mode-label {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 32px;
    color: #f5f0eb;
    letter-spacing: 0.05em;
    line-height: 1;
    margin-bottom: 8px;
  }

  .form-sub {
    font-size: 13px;
    color: rgba(245, 240, 235, 0.35);
    font-weight: 300;
  }

  .form-fields {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-bottom: 24px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .field label {
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(245, 240, 235, 0.4);
  }

  .field input {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 2px;
    padding: 11px 14px;
    font-size: 14px;
    font-family: 'DM Sans', sans-serif;
    font-weight: 300;
    color: #f5f0eb;
    outline: none;
    transition: border-color 0.2s, background 0.2s;
  }

  .field input:focus {
    border-color: rgba(255, 100, 40, 0.5);
    background: rgba(255, 100, 40, 0.03);
  }

  .field input::placeholder {
    color: rgba(245, 240, 235, 0.15);
  }

  .error-msg {
    font-size: 12px;
    color: #ff6060;
    background: rgba(255, 60, 60, 0.08);
    border: 1px solid rgba(255, 60, 60, 0.15);
    border-radius: 2px;
    padding: 8px 12px;
    margin-bottom: 16px;
  }

  .submit-btn {
    width: 100%;
    padding: 13px;
    background: #ff6428;
    border: none;
    border-radius: 2px;
    font-family: 'Bebas Neue', sans-serif;
    font-size: 18px;
    letter-spacing: 0.1em;
    color: #0f0e0d;
    cursor: pointer;
    transition: background 0.2s, transform 0.1s;
    margin-bottom: 20px;
  }

  .submit-btn:hover { background: #ff7a40; }
  .submit-btn:active { transform: scale(0.99); }
  .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .toggle-btn {
    background: none;
    border: none;
    font-size: 12px;
    font-family: 'DM Sans', sans-serif;
    font-weight: 300;
    color: rgba(245, 240, 235, 0.35);
    cursor: pointer;
    text-align: center;
    width: 100%;
    transition: color 0.2s;
    padding: 0;
  }

  .toggle-btn span {
    color: #ff6428;
    font-weight: 500;
  }

  .toggle-btn:hover { color: rgba(245, 240, 235, 0.6); }

  .divider {
    height: 1px;
    background: rgba(255,255,255,0.05);
    margin: 20px 0;
  }

  @media (max-width: 640px) {
    .auth-brand { display: none; }
    .auth-form-panel { width: 100%; border-radius: 2px; }
  }
`

function AuthForm({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true)
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      let response
      if (isLogin) {
        const formData = new URLSearchParams()
        formData.append('username', username)
        formData.append('password', password)
        response = await api.post('/auth/login', formData)
      } else {
        response = await api.post('/auth/register', { username, email, password })
      }

      localStorage.setItem('token', response.data.access_token)
      onLogin()
      navigate('/home')
      
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const switchMode = () => {
    setIsLogin(!isLogin)
    setError(null)
    setUsername('')
    setEmail('')
    setPassword('')
  }

  return (
    <>
      <style>{styles}</style>
      <div className="auth-root">
        <div className="auth-layout">
          {/* Brand panel */}
          <div className="auth-brand">
            <div className="hold-grid">
              {[...Array(8)].map((_, i) => <div key={i} className="hold" />)}
            </div>
            <div className="brand-content">
              <p className="brand-eyebrow">Your wall. Your routes.</p>
              <h1 className="brand-title">Home<br /><span>Board</span></h1>
              <p className="brand-desc">Map your wall, set your routes, track every send.</p>
            </div>
          </div>

          {/* Form panel */}
          <div className="auth-form-panel">
            <div className="form-header">
              <p className="form-mode-label">{isLogin ? 'Welcome Back' : 'Create Account'}</p>
              <p className="form-sub">{isLogin ? 'Log in to your board' : 'Start mapping your wall'}</p>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-fields">
                <div className="field">
                  <label>Username</label>
                  <input
                    placeholder="your_username"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    required
                  />
                </div>
                {!isLogin && (
                  <div className="field">
                    <label>Email</label>
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                    />
                  </div>
                )}
                <div className="field">
                  <label>Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              {error && <div className="error-msg">{error}</div>}

              <button className="submit-btn" type="submit" disabled={loading}>
                {loading ? 'Loading...' : isLogin ? 'Log In' : 'Create Account'}
              </button>
            </form>

            <div className="divider" />

            <button className="toggle-btn" onClick={switchMode}>
              {isLogin
                ? <>No account? <span>Register here</span></>
                : <>Already have one? <span>Log in</span></>
              }
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export default AuthForm
