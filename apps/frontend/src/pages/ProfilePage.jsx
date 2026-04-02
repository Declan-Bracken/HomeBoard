import { useState, useMemo, useQueryClient } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient as useQC } from '@tanstack/react-query'
import api from '../api/axios'
import Navbar from '../components/Navbar'

// ─── Grade helpers ────────────────────────────────────────────────────────────
const GRADE_ORDER = ['Unknown','V0','V1','V2','V3','V4','V5','V6','V7','V8','V9','V10','V11','V12','V15','V16','V17']

function gradeColor(grade) {
  const map = {
    Unknown: '#666', V0: '#6bcb77', V1: '#6bcb77', V2: '#80d8a0',
    V3: '#ffe066', V4: '#ffe066', V5: '#ffb347', V6: '#ffb347',
    V7: '#ff6428', V8: '#ff6428', V9: '#ff4040', V10: '#ff4040',
    V11: '#d040ff', V12: '#d040ff', V15: '#a040ff', V16: '#a040ff', V17: '#a040ff',
  }
  return map[grade] ?? '#666'
}

function gradeIndex(grade) {
  const idx = GRADE_ORDER.indexOf(grade)
  return idx === -1 ? 0 : idx
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

function ActivityCalendar({ ascents, memberSince }) {
  const today = new Date(); today.setHours(0,0,0,0)
  const joinDate = new Date(memberSince); joinDate.setHours(0,0,0,0)
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [hoveredDay, setHoveredDay] = useState(null)

  const dateMap = useMemo(() => {
    const map = {}
    for (const a of ascents) {
      if (!map[a.date]) map[a.date] = []
      map[a.date].push(a)
    }
    return map
  }, [ascents])

  const atCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth()
  const atJoinMonth = viewYear === joinDate.getFullYear() && viewMonth === joinDate.getMonth()

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const calDays = useMemo(() => {
    const firstDow = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7 // Mon=0
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const cells = []
    for (let i = 0; i < firstDow; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewYear, viewMonth, d))
    return cells
  }, [viewYear, viewMonth])

  const fmtDate = (d) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const getCellColor = (dateStr) => {
    const entries = dateMap[dateStr]
    if (!entries || entries.length === 0) return 'rgba(255,255,255,0.04)'
    const best = entries.reduce((a, b) => gradeIndex(a.grade) > gradeIndex(b.grade) ? a : b)
    return gradeColor(best.grade) + 'cc'
  }

  const todayStr = fmtDate(today)

  return (
    <div className="cal-wrap">
      <div className="cal-nav">
        <button className="cal-nav-btn" onClick={prevMonth} disabled={atJoinMonth}>←</button>
        <span className="cal-month-label">{MONTHS[viewMonth]} {viewYear}</span>
        <button className="cal-nav-btn" onClick={nextMonth} disabled={atCurrentMonth}>→</button>
      </div>
      <div className="cal-dow-row">
        {DAYS.map(d => <span key={d} className="cal-dow-label">{d}</span>)}
      </div>
      <div className="cal-grid">
        {calDays.map((day, i) => {
          if (!day) return <div key={`e-${i}`} className="cal-cell cal-cell--empty" />
          const col = i % 7
          const tooltipStyle = col <= 1
            ? { left: 0 }
            : col >= 5
              ? { right: 0 }
              : { left: '50%', transform: 'translateX(-50%)' }
          const dateStr = fmtDate(day)
          const entries = dateMap[dateStr] ?? []
          const isFuture = day > today
          const isToday = dateStr === todayStr
          const isHovered = hoveredDay === dateStr
          return (
            <div key={dateStr}
              className={`cal-cell${isFuture ? ' cal-cell--future' : ''}${isToday ? ' cal-cell--today' : ''}`}
              style={{ background: isFuture ? 'rgba(255,255,255,0.02)' : getCellColor(dateStr) }}
              onMouseEnter={() => !isFuture && setHoveredDay(dateStr)}
              onMouseLeave={() => setHoveredDay(null)}
            >
              <span className="cal-day-num" style={{
                color: isFuture ? 'rgba(245,240,235,0.1)' : entries.length > 0 ? 'rgba(15,14,13,0.85)' : 'rgba(245,240,235,0.25)'
              }}>{day.getDate()}</span>
              {isHovered && !isFuture && (
                <div className="cell-tooltip" style={tooltipStyle}>
                  <div className="tooltip-date">{dateStr}</div>
                  {entries.length === 0
                    ? <div style={{ color: 'rgba(245,240,235,0.3)', fontSize: 11 }}>No sends</div>
                    : entries.map((e, idx) => (
                      <div key={idx} className="tooltip-entry">
                        <span style={{ color: gradeColor(e.grade) }}>{e.grade}</span>
                        {' '}{e.route_name}
                        <span className="tooltip-wall"> · {e.wall_name}</span>
                      </div>
                    ))
                  }
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="calendar-legend">
        <span className="legend-label">Less</span>
        {['V0','V3','V6','V9','V12'].map(g => (
          <div key={g} className="legend-cell" style={{ background: gradeColor(g) + 'cc' }} title={g} />
        ))}
        <span className="legend-label">More</span>
      </div>
    </div>
  )
}

// ─── Edit Profile Modal ───────────────────────────────────────────────────────
function EditProfileModal({ profile, onClose, onUsernameChanged }) {
  const [username, setUsername] = useState(profile.username)
  const [email, setEmail] = useState(profile.email ?? '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQC()

  const handleSave = async () => {
    setError(null)
    if (newPassword && newPassword !== confirmPassword) {
      setError('New passwords do not match')
      return
    }
    if (newPassword && newPassword.length < 8) {
      setError('New password must be at least 8 characters')
      return
    }
    setLoading(true)
    try {
      const body = {}
      if (username !== profile.username) body.username = username
      if (email !== (profile.email ?? '')) body.email = email
      if (newPassword) { body.current_password = currentPassword; body.new_password = newPassword }
      if (Object.keys(body).length === 0) { onClose(); return }
      await api.patch('/users/me', body)
      if (body.username) {
        // Username changed — token is stale, force re-login
        localStorage.removeItem('token')
        onUsernameChanged()
      } else {
        queryClient.invalidateQueries({ queryKey: ['profile'] })
        onClose()
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save changes')
    } finally {
      setLoading(false) }
  }

  const handleDeleteAccount = async () => {
    setDeleteLoading(true)
    try {
      await api.delete('/users/me')
      localStorage.removeItem('token')
      navigate('/auth')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete account')
      setDeleteLoading(false)
      setShowDeleteConfirm(false)
    }
  }

  if (showDeleteConfirm) {
    return (
      <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setShowDeleteConfirm(false) }}>
        <div className="modal">
          <div className="modal-title">Delete Account</div>
          <div className="modal-sub">This cannot be undone.</div>
          <div className="modal-warning-box">
            <p className="modal-warning-text">
              Your account will be permanently deleted. Your walls, routes, and ascents will remain visible to others but will no longer be associated with your account.
            </p>
          </div>
          {error && <div className="modal-error">{error}</div>}
          <div className="modal-actions">
            <button className="modal-cancel" onClick={() => setShowDeleteConfirm(false)} disabled={deleteLoading}>Cancel</button>
            <button className="modal-delete" onClick={handleDeleteAccount} disabled={deleteLoading}>
              {deleteLoading ? 'Deleting...' : 'Delete My Account'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-title">Edit Profile</div>
        <div className="modal-sub">Changes to username require you to log in again.</div>

        <div className="modal-section-label">Account Info</div>
        <div className="modal-field">
          <label>Username</label>
          <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" />
        </div>
        <div className="modal-field">
          <label>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" />
        </div>

        <div className="modal-section-label" style={{ marginTop: 8 }}>Change Password</div>
        <div className="modal-field">
          <label>Current Password</label>
          <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Required to change password" />
        </div>
        <div className="modal-field">
          <label>New Password</label>
          <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Leave blank to keep current" />
        </div>
        <div className="modal-field">
          <label>Confirm New Password</label>
          <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm new password" />
        </div>

        {error && <div className="modal-error">{error}</div>}

        <div className="modal-actions">
          <button className="modal-cancel" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="modal-submit" onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        <div className="modal-danger-zone">
          <button className="modal-danger-btn" onClick={() => setShowDeleteConfirm(true)}>
            Delete Account
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }

  .profile-root { min-height: 100vh; background: #0f0e0d; font-family: 'DM Sans', sans-serif; color: #f5f0eb; }
  .profile-root::before {
    content: ''; position: fixed; inset: 0; pointer-events: none; z-index: 0;
    background-image:
      radial-gradient(ellipse 50% 60% at 10% 20%, rgba(255,100,40,0.07) 0%, transparent 55%),
      radial-gradient(ellipse 40% 40% at 90% 80%, rgba(255,100,40,0.04) 0%, transparent 50%),
      url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");
  }

  .edit-profile-btn { background: none; border: 1px solid rgba(255,255,255,0.08); border-radius: 2px; padding: 7px 14px; font-family: 'DM Sans', sans-serif; font-size: 12px; font-weight: 400; color: rgba(245,240,235,0.4); cursor: pointer; transition: all 0.2s; white-space: nowrap; }
  .edit-profile-btn:hover { border-color: rgba(255,100,40,0.4); color: #ff6428; }

  .profile-main { position: relative; z-index: 1; max-width: 1100px; margin: 0 auto; padding: 28px 20px 80px; display: flex; flex-direction: column; gap: 36px; }

  .profile-hero { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
  .profile-identity { display: flex; flex-direction: column; gap: 6px; }
  .profile-avatar { width: 56px; height: 56px; border-radius: 2px; background: linear-gradient(135deg, rgba(255,100,40,0.2), rgba(255,100,40,0.05)); border: 1px solid rgba(255,100,40,0.2); display: flex; align-items: center; justify-content: center; font-family: 'Bebas Neue', sans-serif; font-size: 24px; letter-spacing: 0.05em; color: #ff6428; margin-bottom: 12px; }
  .profile-username { font-family: 'Bebas Neue', sans-serif; font-size: 44px; letter-spacing: 0.03em; line-height: 0.9; }
  .profile-since { font-size: 12px; font-weight: 300; color: rgba(245,240,235,0.3); letter-spacing: 0.06em; }

  .profile-stats { display: flex; gap: 10px; flex-wrap: wrap; }
  .stat-pill { background: #161412; border: 1px solid rgba(255,255,255,0.06); border-radius: 2px; padding: 12px 16px; display: flex; flex-direction: column; gap: 4px; min-width: 90px; }
  .stat-pill-value { font-family: 'Bebas Neue', sans-serif; font-size: 28px; letter-spacing: 0.03em; line-height: 1; }
  .stat-pill-label { font-size: 9px; font-weight: 500; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(245,240,235,0.35); }

  .profile-section { display: flex; flex-direction: column; gap: 14px; }
  .section-title { font-family: 'Bebas Neue', sans-serif; font-size: 16px; letter-spacing: 0.1em; color: rgba(245,240,235,0.4); }
  .section-divider { height: 1px; background: rgba(255,255,255,0.05); }

  .cal-wrap { display: flex; flex-direction: column; gap: 8px; max-width: 420px; }
  .cal-nav { display: flex; align-items: center; gap: 12px; margin-bottom: 2px; }
  .cal-nav-btn { background: none; border: 1px solid rgba(255,255,255,0.08); border-radius: 2px; width: 30px; height: 30px; color: rgba(245,240,235,0.5); cursor: pointer; transition: all 0.2s; font-size: 13px; display: flex; align-items: center; justify-content: center; }
  .cal-nav-btn:hover:not(:disabled) { border-color: rgba(255,100,40,0.4); color: #ff6428; }
  .cal-nav-btn:disabled { opacity: 0.25; cursor: not-allowed; }
  .cal-month-label { font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 0.08em; min-width: 130px; text-align: center; }
  .cal-dow-row { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; }
  .cal-dow-label { font-size: 9px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(245,240,235,0.25); text-align: center; padding: 2px 0; }
  .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; }
  .cal-cell { aspect-ratio: 1; border-radius: 3px; cursor: pointer; position: relative; display: flex; align-items: center; justify-content: center; min-height: 40px; transition: transform 0.1s; }
  .cal-cell--empty { background: transparent !important; cursor: default; pointer-events: none; }
  .cal-cell--future { cursor: default; }
  .cal-cell--today { box-shadow: 0 0 0 1px rgba(255,100,40,0.6); }
  .cal-cell:not(.cal-cell--empty):not(.cal-cell--future):hover { transform: scale(1.08); z-index: 5; }
  .cal-day-num { font-size: 11px; font-weight: 400; pointer-events: none; line-height: 1; user-select: none; }
  .cell-tooltip { position: absolute; bottom: 16px; background: #1e1b18; border: 1px solid rgba(255,255,255,0.1); border-radius: 2px; padding: 8px 12px; width: max-content; max-width: 220px; z-index: 20; pointer-events: none; box-shadow: 0 8px 24px rgba(0,0,0,0.5); }
  .tooltip-date { font-size: 10px; font-weight: 500; letter-spacing: 0.08em; color: rgba(245,240,235,0.4); margin-bottom: 4px; text-transform: uppercase; }
  .tooltip-entry { font-size: 12px; font-weight: 300; color: #f5f0eb; line-height: 1.6; }
  .tooltip-wall { color: rgba(245,240,235,0.35); }
  .calendar-legend { display: flex; align-items: center; gap: 4px; margin-top: 4px; padding-left: 32px; }
  .legend-label { font-size: 10px; font-weight: 300; color: rgba(245,240,235,0.25); margin: 0 4px; }
  .legend-cell { width: 11px; height: 11px; border-radius: 2px; }

  .ascents-table { display: flex; flex-direction: column; gap: 2px; }
  .ascent-row { display: grid; grid-template-columns: 88px 1fr 1fr 56px 72px; gap: 12px; align-items: flex-start; padding: 11px 14px; border-radius: 2px; background: #161412; border: 1px solid rgba(255,255,255,0.04); font-size: 13px; font-weight: 300; transition: border-color 0.2s, background 0.15s; }
  .ascent-notes { font-size: 11px; font-weight: 300; color: rgba(245,240,235,0.4); margin-top: 4px; font-style: italic; }
  .ascent-row:hover { background: #1a1714; border-color: rgba(255,255,255,0.08); }
  .ascent-row-header { display: grid; grid-template-columns: 88px 1fr 1fr 56px 72px; gap: 12px; padding: 0 14px 8px; font-size: 10px; font-weight: 500; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(245,240,235,0.25); }
  .grade-chip { font-family: 'Bebas Neue', sans-serif; font-size: 14px; letter-spacing: 0.04em; padding: 2px 7px; border-radius: 2px; display: inline-block; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); }
  .quality-stars { color: #ffb347; font-size: 11px; letter-spacing: 1px; }

  .empty-state { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 48px 24px; border: 1px dashed rgba(255,255,255,0.06); border-radius: 2px; color: rgba(245,240,235,0.2); }
  .empty-icon { font-size: 28px; opacity: 0.3; }
  .empty-label { font-size: 13px; font-weight: 300; text-align: center; }
  .loading-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; padding: 80px; }
  .loading-spinner { width: 32px; height: 32px; border: 2px solid rgba(255,255,255,0.08); border-top-color: #ff6428; border-radius: 50%; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .loading-label { font-size: 13px; font-weight: 300; color: rgba(245,240,235,0.4); }

  /* Modal */
  .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); z-index: 50; display: flex; align-items: flex-end; justify-content: center; animation: fadeIn 0.15s ease; padding: 0; }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes sheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
  .modal { background: #161412; border: 1px solid rgba(255,255,255,0.08); border-radius: 4px 4px 0 0; padding: 28px 24px 32px; width: 100%; max-width: 520px; animation: sheetUp 0.22s ease; max-height: 92dvh; overflow-y: auto; }
  .modal-title { font-family: 'Bebas Neue', sans-serif; font-size: 26px; letter-spacing: 0.05em; margin-bottom: 4px; }
  .modal-sub { font-size: 12px; font-weight: 300; color: rgba(245,240,235,0.35); margin-bottom: 20px; }
  .modal-section-label { font-size: 10px; font-weight: 500; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(245,240,235,0.3); margin-bottom: 10px; }
  .modal-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
  .modal-field label { font-size: 11px; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(245,240,235,0.4); }
  .modal-field input { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 2px; padding: 10px 14px; font-size: 16px; font-family: 'DM Sans', sans-serif; font-weight: 300; color: #f5f0eb; outline: none; transition: border-color 0.2s; width: 100%; -webkit-appearance: none; }
  .modal-field input:focus { border-color: rgba(255,100,40,0.5); }
  .modal-field input::placeholder { color: rgba(245,240,235,0.15); }
  .modal-error { font-size: 12px; color: #ff6060; background: rgba(255,60,60,0.08); border: 1px solid rgba(255,60,60,0.15); border-radius: 2px; padding: 8px 12px; margin-bottom: 14px; }
  .modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px; }
  .modal-cancel { background: none; border: 1px solid rgba(255,255,255,0.08); border-radius: 2px; padding: 10px 20px; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 300; color: rgba(245,240,235,0.4); cursor: pointer; transition: all 0.2s; }
  .modal-cancel:hover { border-color: rgba(255,255,255,0.2); color: rgba(245,240,235,0.7); }
  .modal-cancel:disabled { opacity: 0.5; cursor: not-allowed; }
  .modal-submit { background: #ff6428; border: none; border-radius: 2px; padding: 10px 24px; font-family: 'Bebas Neue', sans-serif; font-size: 16px; letter-spacing: 0.08em; color: #0f0e0d; cursor: pointer; transition: background 0.2s; }
  .modal-submit:hover { background: #ff7a40; }
  .modal-submit:disabled { opacity: 0.5; cursor: not-allowed; }
  .modal-danger-zone { margin-top: 24px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.05); }
  .modal-danger-btn { background: none; border: 1px solid rgba(255,60,60,0.2); border-radius: 2px; padding: 10px 14px; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 400; color: rgba(255,80,80,0.6); cursor: pointer; transition: all 0.2s; width: 100%; text-align: left; }
  .modal-danger-btn:hover { background: rgba(255,60,60,0.08); border-color: rgba(255,60,60,0.4); color: #ff5050; }
  .modal-warning-box { background: rgba(255,60,60,0.06); border: 1px solid rgba(255,60,60,0.12); border-radius: 2px; padding: 14px 16px; margin-bottom: 22px; }
  .modal-warning-text { font-size: 13px; font-weight: 300; color: rgba(245,240,235,0.6); line-height: 1.6; }
  .modal-delete { background: rgba(255,60,60,0.12); border: 1px solid rgba(255,60,60,0.3); border-radius: 2px; padding: 10px 24px; font-family: 'Bebas Neue', sans-serif; font-size: 16px; letter-spacing: 0.08em; color: #ff5050; cursor: pointer; transition: all 0.2s; }
  .modal-delete:hover { background: rgba(255,60,60,0.2); border-color: rgba(255,60,60,0.5); }
  .modal-delete:disabled { opacity: 0.5; cursor: not-allowed; }

  @media (max-width: 600px) {
    .profile-hero { flex-direction: column; }
    .profile-username { font-size: 36px; }
    .profile-stats { gap: 8px; }
    .stat-pill { min-width: calc(50% - 4px); flex: 1; }
    .ascent-row, .ascent-row-header { grid-template-columns: 76px 1fr 44px; }
    .ascent-row > *:nth-child(3), .ascent-row-header > *:nth-child(3),
    .ascent-row > *:nth-child(5), .ascent-row-header > *:nth-child(5) { display: none; }
  }
  @media (min-width: 600px) {
    .modal-backdrop { align-items: center; padding: 16px; }
    .modal { border-radius: 2px; max-height: 85vh; }
    @keyframes sheetUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  }
  @media (min-width: 701px) {
    .profile-main { padding: 40px 40px 80px; gap: 44px; }
    .profile-username { font-size: 52px; }
    .stat-pill { padding: 14px 20px; min-width: 110px; }
    .stat-pill-value { font-size: 32px; }
  }
`

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ProfilePage() {
  const navigate = useNavigate()
  const [showEditModal, setShowEditModal] = useState(false)

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => (await api.get('/users/me/profile')).data,
  })

  const handleUsernameChanged = () => {
    navigate('/auth')
  }

  return (
    <>
      <style>{styles}</style>
      <div className="profile-root">
        <Navbar backTo="/home">
          <button className="edit-profile-btn" onClick={() => setShowEditModal(true)}>Edit Profile</button>
        </Navbar>

        {showEditModal && profile && (
          <EditProfileModal
            profile={profile}
            onClose={() => setShowEditModal(false)}
            onUsernameChanged={handleUsernameChanged}
          />
        )}

        <main className="profile-main">
          {isLoading ? (
            <div className="loading-state">
              <div className="loading-spinner" />
              <div className="loading-label">Loading profile...</div>
            </div>
          ) : profile ? (
            <>
              <div className="profile-hero">
                <div className="profile-identity">
                  <div className="profile-avatar">{profile.username[0].toUpperCase()}</div>
                  <div className="profile-username">{profile.username}</div>
                  <div className="profile-since">Member since {formatDate(profile.member_since)}</div>
                </div>
                <div className="profile-stats">
                  <div className="stat-pill">
                    <span className="stat-pill-value" style={{ color: '#ff6428' }}>{profile.total_sends}</span>
                    <span className="stat-pill-label">Total Sends</span>
                  </div>
                  <div className="stat-pill">
                    <span className="stat-pill-value" style={{ color: profile.highest_flash_grade ? gradeColor(profile.highest_flash_grade) : 'rgba(245,240,235,0.2)' }}>
                      {profile.highest_flash_grade ?? '—'}
                    </span>
                    <span className="stat-pill-label">Highest Flash</span>
                  </div>
                  <div className="stat-pill">
                    <span className="stat-pill-value" style={{ color: profile.highest_redpoint_grade ? gradeColor(profile.highest_redpoint_grade) : 'rgba(245,240,235,0.2)' }}>
                      {profile.highest_redpoint_grade ?? '—'}
                    </span>
                    <span className="stat-pill-label">Highest Send</span>
                  </div>
                  <div className="stat-pill">
                    <span className="stat-pill-value" style={{ color: 'rgba(245,240,235,0.5)' }}>
                      {new Set(profile.ascents.map(a => a.wall_name)).size}
                    </span>
                    <span className="stat-pill-label">Walls Climbed</span>
                  </div>
                </div>
              </div>

              <div className="profile-section">
                <span className="section-title">Activity</span>
                <div className="section-divider" />
                {profile.ascents.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">◻</div>
                    <div className="empty-label">No activity yet — log your first send</div>
                  </div>
                ) : (
                  <ActivityCalendar ascents={profile.ascents} memberSince={profile.member_since} />
                )}
              </div>

              <div className="profile-section">
                <span className="section-title">Send Log</span>
                <div className="section-divider" />
                {profile.ascents.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">◻</div>
                    <div className="empty-label">No sends logged yet</div>
                  </div>
                ) : (
                  <div className="ascents-table">
                    <div className="ascent-row-header">
                      <span>Date</span><span>Route</span><span>Wall</span><span>Grade</span><span>Quality</span>
                    </div>
                    {profile.ascents.map((a, i) => (
                      <div key={i} className="ascent-row">
                        <span style={{ color: 'rgba(245,240,235,0.4)', fontSize: 12, paddingTop: 1 }}>{a.date}</span>
                        <div>
                          <span style={{ fontWeight: 400 }}>{a.route_name}</span>
                          {a.notes && <div className="ascent-notes">{a.notes}</div>}
                        </div>
                        <span style={{ color: 'rgba(245,240,235,0.4)' }}>{a.wall_name}</span>
                        <span><span className="grade-chip" style={{ color: gradeColor(a.grade) }}>{a.grade}</span></span>
                        <span>
                          {a.quality
                            ? <span className="quality-stars">{'★'.repeat(a.quality)}{'☆'.repeat(5 - a.quality)}</span>
                            : <span style={{ color: 'rgba(245,240,235,0.2)', fontSize: 11 }}>—</span>
                          }
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">◻</div>
              <div className="empty-label">Could not load profile</div>
            </div>
          )}
        </main>
      </div>
    </>
  )
}
