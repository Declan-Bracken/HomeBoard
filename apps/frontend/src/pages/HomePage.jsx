import { useState, useEffect, useRef } from 'react'
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
  .nav-logo { font-family: 'Bebas Neue', sans-serif; font-size: 22px; letter-spacing: 0.08em; color: #f5f0eb; }
  .nav-logo span { color: #ff6428; }
  .nav-right { display: flex; align-items: center; gap: 10px; }
  .profile-btn, .logout-btn {
    background: none; border: 1px solid rgba(255,255,255,0.1); border-radius: 2px;
    padding: 6px 12px; font-family: 'DM Sans', sans-serif; font-size: 12px; font-weight: 500;
    letter-spacing: 0.06em; text-transform: uppercase; color: rgba(245,240,235,0.5);
    cursor: pointer; transition: all 0.2s; min-height: 36px; white-space: nowrap;
  }
  .profile-btn:hover, .logout-btn:hover { border-color: rgba(255,100,40,0.4); color: #ff6428; }

  /* MAIN */
  .dash-main { position: relative; z-index: 1; max-width: 900px; margin: 0 auto; padding: 32px 20px 80px; }

  .dash-header {
    display: flex; align-items: flex-end; justify-content: space-between;
    gap: 16px; margin-bottom: 24px; flex-wrap: wrap;
  }
  .dash-title { font-family: 'Bebas Neue', sans-serif; font-size: 44px; line-height: 0.9; letter-spacing: 0.03em; }
  .dash-title span { color: #ff6428; }
  .dash-subtitle { font-size: 12px; font-weight: 300; color: rgba(245,240,235,0.35); margin-top: 8px; }
  .new-wall-btn {
    display: flex; align-items: center; gap: 8px;
    background: #ff6428; border: none; border-radius: 2px; padding: 11px 20px;
    font-family: 'Bebas Neue', sans-serif; font-size: 16px; letter-spacing: 0.08em;
    color: #0f0e0d; cursor: pointer; transition: background 0.2s;
    white-space: nowrap; min-height: 44px; flex-shrink: 0;
  }
  .new-wall-btn:hover { background: #ff7a40; }
  .new-wall-btn:active { opacity: 0.85; }

  /* SEARCH BAR */
  .search-bar-wrap { position: relative; margin-bottom: 20px; }
  .search-icon {
    position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
    font-size: 14px; color: rgba(245,240,235,0.25); pointer-events: none;
    line-height: 1;
  }
  .search-input {
    width: 100%; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 2px; padding: 11px 40px 11px 38px; font-size: 14px;
    font-family: 'DM Sans', sans-serif; font-weight: 300; color: #f5f0eb;
    outline: none; transition: border-color 0.2s; min-height: 44px;
  }
  .search-input:focus { border-color: rgba(255,100,40,0.4); }
  .search-input::placeholder { color: rgba(245,240,235,0.2); }
  .search-clear {
    position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
    background: none; border: none; color: rgba(245,240,235,0.3); cursor: pointer;
    font-size: 16px; line-height: 1; padding: 4px; transition: color 0.15s;
  }
  .search-clear:hover { color: rgba(245,240,235,0.7); }

  .dash-divider { height: 1px; background: rgba(255,255,255,0.06); margin-bottom: 28px; }

  .section-label {
    font-family: 'Bebas Neue', sans-serif; font-size: 13px; letter-spacing: 0.14em;
    color: rgba(245,240,235,0.28); text-transform: uppercase; margin-bottom: 12px;
  }

  /* STATES */
  .dash-state {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; padding: 80px 0; gap: 12px; color: rgba(245,240,235,0.25);
  }
  .dash-state-icon { font-size: 40px; opacity: 0.3; }
  .dash-state p { font-size: 14px; font-weight: 300; text-align: center; }

  /* WALL GRID */
  .wall-grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 14px; margin-bottom: 32px;
  }
  .wall-card {
    background: #161412; border: 1px solid rgba(255,255,255,0.06); border-radius: 2px; padding: 22px;
    cursor: pointer; transition: border-color 0.2s, background 0.2s;
    animation: cardIn 0.4s ease both; position: relative; overflow: hidden;
  }
  .wall-card::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
    background: #ff6428; transform: scaleX(0); transform-origin: left; transition: transform 0.3s ease;
  }
  .wall-card:hover { border-color: rgba(255,100,40,0.2); background: #1a1714; }
  .wall-card:hover::before { transform: scaleX(1); }
  .wall-card:active { background: #1e1b17; }
  @keyframes cardIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  .wall-card:nth-child(1) { animation-delay: 0.05s; }
  .wall-card:nth-child(2) { animation-delay: 0.10s; }
  .wall-card:nth-child(3) { animation-delay: 0.15s; }
  .wall-card:nth-child(4) { animation-delay: 0.20s; }
  .wall-card:nth-child(5) { animation-delay: 0.25s; }
  .wall-card:nth-child(6) { animation-delay: 0.30s; }

  .wall-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
  .wall-card-id { font-size: 10px; font-weight: 500; letter-spacing: 0.15em; text-transform: uppercase; color: #ff6428; opacity: 0.7; }
  .wall-card-badges { display: flex; gap: 5px; }
  .badge { font-size: 9px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; padding: 2px 6px; border-radius: 2px; }
  .badge-owner { background: rgba(255,100,40,0.1); color: rgba(255,100,40,0.7); border: 1px solid rgba(255,100,40,0.2); }
  .badge-member { background: rgba(255,255,255,0.04); color: rgba(245,240,235,0.35); border: 1px solid rgba(255,255,255,0.08); }
  .badge-public { background: rgba(107,203,119,0.1); color: rgba(107,203,119,0.7); border: 1px solid rgba(107,203,119,0.2); }
  .badge-private { background: rgba(255,255,255,0.03); color: rgba(245,240,235,0.22); border: 1px solid rgba(255,255,255,0.06); }

  .wall-card-name { font-family: 'Bebas Neue', sans-serif; font-size: 24px; letter-spacing: 0.04em; color: #f5f0eb; margin-bottom: 14px; line-height: 1; }
  .wall-card-meta { display: flex; flex-direction: column; gap: 4px; }
  .wall-meta-row { display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 300; color: rgba(245,240,235,0.35); }
  .wall-meta-dot { width: 3px; height: 3px; border-radius: 50%; background: rgba(255,100,40,0.4); flex-shrink: 0; }
  .wall-card-arrow { position: absolute; bottom: 18px; right: 18px; font-size: 15px; color: rgba(255,100,40,0.3); transition: color 0.2s; }
  .wall-card:hover .wall-card-arrow { color: #ff6428; }

  /* SKELETON */
  .skeleton-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; }
  .skeleton-card { background: #161412; border: 1px solid rgba(255,255,255,0.04); border-radius: 2px; padding: 22px; display: flex; flex-direction: column; gap: 12px; }
  .skeleton-line { height: 10px; border-radius: 2px; background: linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 100%); background-size: 200% 100%; animation: shimmer 1.4s infinite; }
  .skeleton-line.title { height: 26px; width: 70%; }
  .skeleton-line.short { width: 45%; }
  .skeleton-line.medium { width: 60%; }
  @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

  /* SEARCH RESULTS */
  .search-results { animation: fadeIn 0.2s ease; }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

  .search-section { margin-bottom: 32px; }

  /* Search wall card — slimmer than the main wall card */
  .search-wall-card {
    background: #161412; border: 1px solid rgba(255,255,255,0.06); border-radius: 2px;
    padding: 14px 18px; display: flex; align-items: center; gap: 16px;
    cursor: pointer; transition: border-color 0.2s, background 0.2s;
    position: relative; overflow: hidden; min-height: 56px;
  }
  .search-wall-card::before {
    content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
    background: #ff6428; opacity: 0; transition: opacity 0.2s;
  }
  .search-wall-card:hover { border-color: rgba(255,100,40,0.2); background: #1a1714; }
  .search-wall-card:hover::before { opacity: 1; }
  .search-wall-body { flex: 1; min-width: 0; }
  .search-wall-name { font-family: 'Bebas Neue', sans-serif; font-size: 20px; letter-spacing: 0.04em; color: #f5f0eb; line-height: 1; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .search-wall-meta { font-size: 11px; font-weight: 300; color: rgba(245,240,235,0.35); }
  .search-wall-routes { font-family: 'Bebas Neue', sans-serif; font-size: 16px; color: rgba(245,240,235,0.25); text-align: right; flex-shrink: 0; }
  .search-wall-routes span { font-family: 'DM Sans', sans-serif; font-size: 9px; font-weight: 300; display: block; letter-spacing: 0.08em; text-transform: uppercase; }
  .search-wall-arrow { color: rgba(255,100,40,0.25); font-size: 13px; flex-shrink: 0; transition: color 0.2s; }
  .search-wall-card:hover .search-wall-arrow { color: #ff6428; }

  /* User result card */
  .user-card {
    background: #161412; border: 1px solid rgba(255,255,255,0.06); border-radius: 2px;
    padding: 16px 18px; margin-bottom: 10px;
  }
  .user-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
  .user-card-name { font-family: 'Bebas Neue', sans-serif; font-size: 20px; letter-spacing: 0.05em; color: #f5f0eb; }
  .user-card-meta { font-size: 11px; font-weight: 300; color: rgba(245,240,235,0.35); }
  .user-card-stats { display: flex; gap: 16px; }
  .user-stat { font-size: 11px; font-weight: 300; color: rgba(245,240,235,0.35); }
  .user-stat strong { font-family: 'Bebas Neue', sans-serif; font-size: 16px; letter-spacing: 0.04em; color: rgba(245,240,235,0.6); margin-right: 3px; }
  .user-walls { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
  .user-wall-chip {
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 2px; padding: 4px 10px; font-size: 11px; font-weight: 400;
    color: rgba(245,240,235,0.5); cursor: pointer; transition: all 0.15s;
  }
  .user-wall-chip:hover { border-color: rgba(255,100,40,0.3); color: #ff6428; background: rgba(255,100,40,0.05); }
  .user-no-walls { font-size: 11px; font-weight: 300; color: rgba(245,240,235,0.2); margin-top: 8px; }

  .search-loading { display: flex; align-items: center; gap: 12px; padding: 40px 0; color: rgba(245,240,235,0.3); font-size: 13px; font-weight: 300; }
  .search-spinner { width: 20px; height: 20px; border: 2px solid rgba(255,255,255,0.06); border-top-color: #ff6428; border-radius: 50%; animation: spin 0.8s linear infinite; flex-shrink: 0; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .search-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 0; gap: 10px; color: rgba(245,240,235,0.2); }
  .search-empty-icon { font-size: 32px; opacity: 0.3; }
  .search-empty p { font-size: 13px; font-weight: 300; }

  /* MODAL */
  .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); z-index: 100; display: flex; align-items: center; justify-content: center; animation: fadeIn 0.15s ease; padding: 16px; }
  .modal { background: #161412; border: 1px solid rgba(255,255,255,0.08); border-radius: 2px; padding: 32px; width: min(420px, 100%); animation: slideUp 0.2s ease; }
  @keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
  .modal-title { font-family: 'Bebas Neue', sans-serif; font-size: 28px; letter-spacing: 0.05em; color: #f5f0eb; margin-bottom: 6px; }
  .modal-sub { font-size: 12px; font-weight: 300; color: rgba(245,240,235,0.35); margin-bottom: 24px; }
  .modal-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 20px; }
  .modal-field label { font-size: 11px; font-weight: 500; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(245,240,235,0.4); }
  .modal-field input { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 2px; padding: 11px 14px; font-size: 14px; font-family: 'DM Sans', sans-serif; font-weight: 300; color: #f5f0eb; outline: none; transition: border-color 0.2s; min-height: 44px; }
  .modal-field input:focus { border-color: rgba(255,100,40,0.5); }
  .modal-field input::placeholder { color: rgba(245,240,235,0.15); }

  .privacy-toggle { display: flex; gap: 8px; }
  .privacy-opt { flex: 1; padding: 10px 12px; border-radius: 2px; cursor: pointer; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.02); transition: all 0.15s; }
  .privacy-opt-label { font-size: 13px; font-weight: 500; color: rgba(245,240,235,0.5); display: block; margin-bottom: 2px; }
  .privacy-opt-desc { font-size: 10px; font-weight: 300; color: rgba(245,240,235,0.25); display: block; }
  .privacy-opt.selected { border-color: rgba(255,100,40,0.4); background: rgba(255,100,40,0.06); }
  .privacy-opt.selected .privacy-opt-label { color: #ff6428; }
  .privacy-opt.selected .privacy-opt-desc { color: rgba(255,100,40,0.45); }

  .modal-error { font-size: 12px; color: #ff6060; background: rgba(255,60,60,0.08); border: 1px solid rgba(255,60,60,0.15); border-radius: 2px; padding: 8px 12px; margin-bottom: 16px; }
  .modal-actions { display: flex; gap: 8px; justify-content: flex-end; }
  .modal-cancel { background: none; border: 1px solid rgba(255,255,255,0.08); border-radius: 2px; padding: 10px 20px; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 300; color: rgba(245,240,235,0.4); cursor: pointer; transition: all 0.2s; min-height: 44px; }
  .modal-cancel:hover { border-color: rgba(255,255,255,0.2); color: rgba(245,240,235,0.7); }
  .modal-submit { background: #ff6428; border: none; border-radius: 2px; padding: 10px 24px; font-family: 'Bebas Neue', sans-serif; font-size: 16px; letter-spacing: 0.08em; color: #0f0e0d; cursor: pointer; transition: background 0.2s; min-height: 44px; }
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
  return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getUsername() {
  try {
    const token = localStorage.getItem('token')
    return JSON.parse(atob(token.split('.')[1])).sub
  } catch { return null }
}

// ─── New Wall Modal ───────────────────────────────────────────────────────────
function NewWallModal({ onClose, onCreated }) {
  const [name, setName] = useState('')
  const [privacy, setPrivacy] = useState('Private')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Wall name is required'); return }
    setLoading(true); setError(null)
    try {
      const res = await api.post('/walls/', { name: name.trim(), privacy })
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
        <div className="modal-field">
          <label>Privacy</label>
          <div className="privacy-toggle">
            <div className={`privacy-opt ${privacy === 'Private' ? 'selected' : ''}`} onClick={() => setPrivacy('Private')}>
              <span className="privacy-opt-label">🔒 Private</span>
              <span className="privacy-opt-desc">Invite only</span>
            </div>
            <div className={`privacy-opt ${privacy === 'Public' ? 'selected' : ''}`} onClick={() => setPrivacy('Public')}>
              <span className="privacy-opt-label">🌐 Public</span>
              <span className="privacy-opt-desc">Anyone can view & add routes</span>
            </div>
          </div>
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

// ─── Wall card (my walls) ─────────────────────────────────────────────────────
function WallCard({ wall }) {
  const navigate = useNavigate()
  return (
    <div
      className="wall-card"
      onClick={() => navigate(wall.image_path ? `/walls/${wall.id}/detail` : `/walls/${wall.id}`)}
    >
      <div className="wall-card-top">
        <div className="wall-card-id">Wall #{wall.id}</div>
        <div className="wall-card-badges">
          <span className={`badge ${wall.privacy === 'Public' ? 'badge-public' : 'badge-private'}`}>
            {wall.privacy === 'Public' ? 'Public' : 'Private'}
          </span>
          <span className={`badge ${wall.role === 'owner' ? 'badge-owner' : 'badge-member'}`}>
            {wall.role === 'owner' ? 'Owner' : 'Member'}
          </span>
        </div>
      </div>
      <div className="wall-card-name">{wall.name}</div>
      <div className="wall-card-meta">
        <div className="wall-meta-row"><div className="wall-meta-dot" />Created by {wall.created_by}</div>
        <div className="wall-meta-row"><div className="wall-meta-dot" />{formatDate(wall.created_at)}</div>
      </div>
      <div className="wall-card-arrow">↗</div>
    </div>
  )
}

// ─── Search results ───────────────────────────────────────────────────────────
function SearchResults({ query }) {
  const navigate = useNavigate()
  const [wallResults, setWallResults] = useState(null)
  const [userResults, setUserResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    if (query.length < 2) { setWallResults(null); setUserResults(null); return }

    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true); setError(null)
      try {
        const [wallsRes, usersRes] = await Promise.all([
          api.get(`/search/walls?q=${encodeURIComponent(query)}`),
          api.get(`/search/users?q=${encodeURIComponent(query)}`),
        ])
        setWallResults(wallsRes.data)
        setUserResults(usersRes.data)
      } catch {
        setError('Search failed')
      } finally {
        setLoading(false)
      }
    }, 400)

    return () => clearTimeout(debounceRef.current)
  }, [query])

  if (query.length < 2) return null

  if (loading) {
    return (
      <div className="search-results">
        <div className="search-loading">
          <div className="search-spinner" />
          Searching...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="search-results">
        <div className="search-empty">
          <div className="search-empty-icon">⚠</div>
          <p>Search failed — is the backend running?</p>
        </div>
      </div>
    )
  }

  const noResults = wallResults?.length === 0 && userResults?.length === 0

  if (noResults) {
    return (
      <div className="search-results">
        <div className="search-empty">
          <div className="search-empty-icon">◻</div>
          <p>No walls or users found for "{query}"</p>
        </div>
      </div>
    )
  }

  return (
    <div className="search-results">
      {wallResults?.length > 0 && (
        <div className="search-section">
          <div className="section-label">Walls</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {wallResults.map(wall => (
              <div
                key={wall.id}
                className="search-wall-card"
                onClick={() => navigate(`/walls/${wall.id}/detail`)}
              >
                <div className="search-wall-body">
                  <div className="search-wall-name">{wall.name}</div>
                  <div className="search-wall-meta">by {wall.created_by} · {formatDate(wall.created_at)}</div>
                </div>
                <div className="search-wall-routes">
                  {wall.route_count}
                  <span>routes</span>
                </div>
                <div className="search-wall-arrow">→</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {userResults?.length > 0 && (
        <div className="search-section">
          <div className="section-label">People</div>
          {userResults.map(user => (
            <div key={user.username} className="user-card">
              <div className="user-card-header">
                <div className="user-card-name">{user.username}</div>
                <div className="user-card-meta">joined {formatDate(user.created_at)}</div>
              </div>
              <div className="user-card-stats">
                <div className="user-stat"><strong>{user.total_sends}</strong>sends</div>
                <div className="user-stat"><strong>{user.public_walls?.length ?? 0}</strong>public walls</div>
              </div>
              {user.public_walls?.length > 0 ? (
                <div className="user-walls">
                  {user.public_walls.map(w => (
                    <div
                      key={w.id}
                      className="user-wall-chip"
                      onClick={() => navigate(`/walls/${w.id}/detail`)}
                    >
                      {w.name}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="user-no-walls">No public walls</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Home page ────────────────────────────────────────────────────────────────
function HomePage() {
  const username = getUsername()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

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

  const ownedWalls = walls?.filter(w => w.role === 'owner') ?? []
  const joinedWalls = walls?.filter(w => w.role === 'member') ?? []
  const showSectionLabels = ownedWalls.length > 0 && joinedWalls.length > 0
  const isSearching = searchQuery.length >= 2

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

          {/* Search bar */}
          <div className="search-bar-wrap">
            <span className="search-icon">⌕</span>
            <input
              className="search-input"
              placeholder="Search public walls and users..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="search-clear" onClick={() => setSearchQuery('')}>×</button>
            )}
          </div>

          <div className="dash-divider" />

          {/* Search results — replaces wall grid when active */}
          {isSearching ? (
            <SearchResults query={searchQuery} />
          ) : (
            <>
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
                <>
                  {ownedWalls.length > 0 && (
                    <>
                      {showSectionLabels && <div className="section-label">My Walls</div>}
                      <div className="wall-grid">
                        {ownedWalls.map(wall => <WallCard key={wall.id} wall={wall} />)}
                      </div>
                    </>
                  )}
                  {joinedWalls.length > 0 && (
                    <>
                      <div className="section-label">Member Of</div>
                      <div className="wall-grid">
                        {joinedWalls.map(wall => <WallCard key={wall.id} wall={wall} />)}
                      </div>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </main>
      </div>
    </>
  )
}

export default HomePage
