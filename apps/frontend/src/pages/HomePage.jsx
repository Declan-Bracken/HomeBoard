import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../api/axios'
import { useNavigate } from 'react-router-dom'

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  .dash-root {
    min-height: 100vh;
    background-color: #0f0e0d;
    font-family: 'DM Sans', sans-serif;
    color: #f5f0eb;
  }

  .dash-root::before {
    content: '';
    position: fixed; inset: 0;
    background-image:
      radial-gradient(ellipse 60% 40% at 80% 10%, rgba(255, 100, 40, 0.06) 0%, transparent 60%),
      url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");
    pointer-events: none; z-index: 0;
  }

  /* NAV */
  .dash-nav {
    position: sticky; top: 0; z-index: 10;
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 20px; height: 56px;
    background: rgba(15, 14, 13, 0.85); backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }

  .nav-logo {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 22px; letter-spacing: 0.08em; color: #f5f0eb;
  }
  .nav-logo span { color: #ff6428; }

  .nav-right { display: flex; align-items: center; gap: 10px; }

  .profile-btn, .logout-btn {
    background: none;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 2px;
    padding: 6px 12px;
    font-family: 'DM Sans', sans-serif;
    font-size: 12px; font-weight: 500;
    letter-spacing: 0.06em; text-transform: uppercase;
    color: rgba(245, 240, 235, 0.5);
    cursor: pointer; transition: all 0.2s;
    min-height: 36px; white-space: nowrap;
  }
  .profile-btn:hover, .logout-btn:hover {
    border-color: rgba(255, 100, 40, 0.4); color: #ff6428;
  }

  /* MAIN */
  .dash-main {
    position: relative; z-index: 1;
    max-width: 900px; margin: 0 auto;
    padding: 32px 20px 80px;
  }

  .dash-header {
    display: flex; align-items: flex-end; justify-content: space-between;
    gap: 16px; margin-bottom: 32px; flex-wrap: wrap;
  }

  .dash-title {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 44px; line-height: 0.9; letter-spacing: 0.03em;
  }
  .dash-title span { color: #ff6428; }

  .dash-subtitle {
    font-size: 12px; font-weight: 300;
    color: rgba(245, 240, 235, 0.35); margin-top: 8px;
  }

  .new-wall-btn {
    display: flex; align-items: center; gap: 8px;
    background: #ff6428; border: none; border-radius: 2px;
    padding: 11px 20px;
    font-family: 'Bebas Neue', sans-serif; font-size: 16px;
    letter-spacing: 0.08em; color: #0f0e0d;
    cursor: pointer; transition: background 0.2s;
    white-space: nowrap; min-height: 44px; flex-shrink: 0;
  }
  .new-wall-btn:hover { background: #ff7a40; }
  .new-wall-btn:active { opacity: 0.85; }

  .dash-divider { height: 1px; background: rgba(255,255,255,0.06); margin-bottom: 28px; }

  /* STATES */
  .dash-state {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; padding: 80px 0; gap: 12px;
    color: rgba(245, 240, 235, 0.25);
  }
  .dash-state-icon { font-size: 40px; opacity: 0.3; }
  .dash-state p { font-size: 14px; font-weight: 300; text-align: center; }

  /* WALL GRID */
  .wall-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 14px;
  }

  .wall-card {
    background: #161412; border: 1px solid rgba(255,255,255,0.06);
    border-radius: 2px; padding: 22px;
    cursor: pointer; transition: border-color 0.2s, background 0.2s;
    animation: cardIn 0.4s ease both; position: relative; overflow: hidden;
    min-height: 44px;
  }

  .wall-card::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
    background: #ff6428; transform: scaleX(0); transform-origin: left;
    transition: transform 0.3s ease;
  }

  .wall-card:hover { border-color: rgba(255, 100, 40, 0.2); background: #1a1714; }
  .wall-card:hover::before { transform: scaleX(1); }
  .wall-card:active { background: #1e1b17; }

  @keyframes cardIn {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .wall-card:nth-child(1) { animation-delay: 0.05s; }
  .wall-card:nth-child(2) { animation-delay: 0.10s; }
  .wall-card:nth-child(3) { animation-delay: 0.15s; }
  .wall-card:nth-child(4) { animation-delay: 0.20s; }
  .wall-card:nth-child(5) { animation-delay: 0.25s; }
  .wall-card:nth-child(6) { animation-delay: 0.30s; }

  .wall-card-id {
    font-size: 10px; font-weight: 500; letter-spacing: 0.15em;
    text-transform: uppercase; color: #ff6428; margin-bottom: 8px; opacity: 0.7;
  }
  .wall-card-name {
    font-family: 'Bebas Neue', sans-serif; font-size: 24px;
    letter-spacing: 0.04em; color: #f5f0eb; margin-bottom: 14px; line-height: 1;
  }
  .wall-card-meta { display: flex; flex-direction: column; gap: 4px; }
  .wall-meta-row {
    display: flex; align-items: center; gap: 8px;
    font-size: 11px; font-weight: 300; color: rgba(245, 240, 235, 0.35);
  }
  .wall-meta-dot {
    width: 3px; height: 3px; border-radius: 50%;
    background: rgba(255, 100, 40, 0.4); flex-shrink: 0;
  }
  .wall-card-arrow {
    position: absolute; bottom: 18px; right: 18px;
    font-size: 15px; color: rgba(255, 100, 40, 0.3); transition: color 0.2s;
  }
  .wall-card:hover .wall-card-arrow { color: #ff6428; }

  /* SKELETON */
  .skeleton-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 14px;
  }
  .skeleton-card {
    background: #161412; border: 1px solid rgba(255,255,255,0.04);
    border-radius: 2px; padding: 22px;
    display: flex; flex-direction: column; gap: 12px;
  }
  .skeleton-line {
    height: 10px; border-radius: 2px;
    background: linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 100%);
    background-size: 200% 100%; animation: shimmer 1.4s infinite;
  }
  .skeleton-line.title { height: 26px; width: 70%; }
  .skeleton-line.short { width: 45%; }
  .skeleton-line.medium { width: 60%; }
  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  /* MODAL */
  .modal-backdrop {
    position: fixed; inset: 0; background: rgba(0,0,0,0.7);
    backdrop-filter: blur(4px); z-index: 100;
    display: flex; align-items: center; justify-content: center;
    animation: fadeIn 0.15s ease; padding: 16px;
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

  .modal {
    background: #161412; border: 1px solid rgba(255,255,255,0.08);
    border-radius: 2px; padding: 32px; width: min(420px, 100%);
    animation: slideUp 0.2s ease;
  }
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .modal-title {
    font-family: 'Bebas Neue', sans-serif; font-size: 28px;
    letter-spacing: 0.05em; color: #f5f0eb; margin-bottom: 6px;
  }
  .modal-sub {
    font-size: 12px; font-weight: 300;
    color: rgba(245, 240, 235, 0.35); margin-bottom: 24px;
  }
  .modal-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 20px; }
  .modal-field label {
    font-size: 11px; font-weight: 500; letter-spacing: 0.12em;
    text-transform: uppercase; color: rgba(245, 240, 235, 0.4);
  }
  .modal-field input {
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 2px; padding: 11px 14px; font-size: 14px;
    font-family: 'DM Sans', sans-serif; font-weight: 300; color: #f5f0eb;
    outline: none; transition: border-color 0.2s; min-height: 44px;
  }
  .modal-field input:focus { border-color: rgba(255, 100, 40, 0.5); }
  .modal-field input::placeholder { color: rgba(245, 240, 235, 0.15); }

  .modal-error {
    font-size: 12px; color: #ff6060;
    background: rgba(255, 60, 60, 0.08); border: 1px solid rgba(255, 60, 60, 0.15);
    border-radius: 2px; padding: 8px 12px; margin-bottom: 16px;
  }
  .modal-actions { display: flex; gap: 8px; justify-content: flex-end; }
  .modal-cancel {
    background: none; border: 1px solid rgba(255,255,255,0.08); border-radius: 2px;
    padding: 10px 20px; font-family: 'DM Sans', sans-serif; font-size: 13px;
    font-weight: 300; color: rgba(245, 240, 235, 0.4); cursor: pointer;
    transition: all 0.2s; min-height: 44px;
  }
  .modal-cancel:hover { border-color: rgba(255,255,255,0.2); color: rgba(245, 240, 235, 0.7); }
  .modal-submit {
    background: #ff6428; border: none; border-radius: 2px;
    padding: 10px 24px; font-family: 'Bebas Neue', sans-serif;
    font-size: 16px; letter-spacing: 0.08em; color: #0f0e0d;
    cursor: pointer; transition: background 0.2s; min-height: 44px;
  }
  .modal-submit:hover { background: #ff7a40; }
  .modal-submit:disabled { opacity: 0.5; cursor: not-allowed; }

  /* ── Responsive ── */
  @media (max-width: 480px) {
    .dash-header { flex-direction: column; align-items: flex-start; gap: 12px; }
    .new-wall-btn { width: 100%; justify-content: center; }
    .wall-grid, .skeleton-grid { grid-template-columns: 1fr; }
    .profile-btn { display: none; }
    .nav-right { gap: 8px; }
  }

  @media (min-width: 481px) and (max-width: 700px) {
    .wall-grid, .skeleton-grid { grid-template-columns: 1fr 1fr; }
  }

  @media (min-width: 701px) {
    .dash-main { padding: 48px 40px 80px; }
    .dash-nav { padding: 0 40px; height: 60px; }
    .nav-logo { font-size: 24px; }
    .nav-right { gap: 20px; }
  }
`

function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="skeleton-line short" />
      <div className="skeleton-line title" />
      <div className="skeleton-line medium" />
      <div className="skeleton-line short" />
    </div>
  )
}

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  })
}

function getUsername() {
  try {
    const token = localStorage.getItem('token')
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.sub
  } catch { return null }
}

function NewWallModal({ onClose, onCreated }) {
  const [name, setName] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Wall name is required'); return }
    setLoading(true); setError(null)
    try {
      const res = await api.post('/walls/', { name: name.trim() })
      onCreated(res.data)
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(Array.isArray(detail) ? detail.map(d => d.msg).join(', ') : detail || 'Failed to create wall')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-title">New Wall</div>
        <div className="modal-sub">Give your wall a name to get started</div>
        <div className="modal-field">
          <label>Wall Name</label>
          <input
            autoFocus
            placeholder="e.g. Garage Wall"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); if (e.key === 'Escape') onClose() }}
          />
        </div>
        {error && <div className="modal-error">{error}</div>}
        <div className="modal-actions">
          <button className="modal-cancel" onClick={onClose}>Cancel</button>
          <button className="modal-submit" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Creating...' : 'Create Wall'}
          </button>
        </div>
      </div>
    </div>
  )
}

function HomePage() {
  const username = getUsername()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)

  const { data: walls, isLoading, isError } = useQuery({
    queryKey: ['walls'],
    queryFn: async () => (await api.get('/walls/me/')).data
  })

  const handleLogout = () => {
    localStorage.removeItem('token')
    window.location.href = '/auth'
  }

  const handleWallCreated = (newWall) => {
    queryClient.invalidateQueries({ queryKey: ['walls'] })
    setShowModal(false)
    navigate(`/walls/${newWall.id}`)
  }

  return (
    <>
      <style>{styles}</style>
      <div className="dash-root">
        {showModal && (
          <NewWallModal onClose={() => setShowModal(false)} onCreated={handleWallCreated} />
        )}

        <nav className="dash-nav">
          <div className="nav-logo">Home<span>Board</span></div>
          <div className="nav-right">
            <button className="profile-btn" onClick={() => navigate('/profile')}>{username}</button>
            <button className="logout-btn" onClick={handleLogout}>Logout</button>
          </div>
        </nav>

        <main className="dash-main">
          <div className="dash-header">
            <div>
              <h1 className="dash-title">My <span>Walls</span></h1>
              <p className="dash-subtitle">
                {walls ? `${walls.length} wall${walls.length !== 1 ? 's' : ''} configured` : 'Loading your walls...'}
              </p>
            </div>
            <button className="new-wall-btn" onClick={() => setShowModal(true)}>+ New Wall</button>
          </div>

          <div className="dash-divider" />

          {isLoading && (
            <div className="skeleton-grid">{[1,2,3].map(i => <SkeletonCard key={i} />)}</div>
          )}
          {isError && (
            <div className="dash-state">
              <div className="dash-state-icon">⚠</div>
              <p>Failed to load walls. Is the backend running?</p>
            </div>
          )}
          {!isLoading && !isError && walls?.length === 0 && (
            <div className="dash-state">
              <div className="dash-state-icon">◻</div>
              <p>No walls yet — create your first one</p>
            </div>
          )}
          {!isLoading && !isError && walls?.length > 0 && (
            <div className="wall-grid">
              {walls.map(wall => (
                <div className="wall-card" key={wall.id} onClick={() =>
                  navigate(wall.image_path ? `/walls/${wall.id}/detail` : `/walls/${wall.id}`)
                }>
                  <div className="wall-card-id">Wall #{wall.id}</div>
                  <div className="wall-card-name">{wall.name}</div>
                  <div className="wall-card-meta">
                    <div className="wall-meta-row">
                      <div className="wall-meta-dot" />
                      Created by {wall.created_by}
                    </div>
                    <div className="wall-meta-row">
                      <div className="wall-meta-dot" />
                      {formatDate(wall.created_at)}
                    </div>
                  </div>
                  <div className="wall-card-arrow">↗</div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </>
  )
}

export default HomePage
