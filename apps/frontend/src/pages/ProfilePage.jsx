import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '../api/axios'

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

// ─── Calendar ─────────────────────────────────────────────────────────────────
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

function ActivityCalendar({ ascents }) {
  const today = new Date()
  const [hoveredDay, setHoveredDay] = useState(null)

  const dateMap = useMemo(() => {
    const map = {}
    for (const a of ascents) {
      if (!map[a.date]) map[a.date] = []
      map[a.date].push(a)
    }
    return map
  }, [ascents])

  const weeks = useMemo(() => {
    const days = []
    const end = new Date(today)
    end.setHours(0,0,0,0)
    const startOffset = (end.getDay() + 6) % 7
    const start = new Date(end)
    start.setDate(start.getDate() - 364 - startOffset)
    const cur = new Date(start)
    while (cur <= end) { days.push(new Date(cur)); cur.setDate(cur.getDate() + 1) }
    const result = []
    for (let i = 0; i < days.length; i += 7) result.push(days.slice(i, i + 7))
    return result
  }, [])

  const monthLabels = useMemo(() => {
    const labels = []; let lastMonth = -1
    weeks.forEach((week, wi) => {
      const month = week[0].getMonth()
      if (month !== lastMonth) { labels.push({ wi, label: MONTHS[month] }); lastMonth = month }
    })
    return labels
  }, [weeks])

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

  return (
    <div className="calendar-wrap">
      <div className="calendar-months">
        <div style={{ width: 28 }} />
        <div style={{ position: 'relative', flex: 1, height: 16 }}>
          {monthLabels.map(({ wi, label }) => (
            <span key={wi} className="month-label" style={{ left: wi * 13 }}>{label}</span>
          ))}
        </div>
      </div>

      <div className="calendar-body">
        <div className="calendar-days">
          {DAYS.map((d, i) => (
            <span key={d} className="day-label" style={{ opacity: i % 2 === 0 ? 0.4 : 0 }}>{d}</span>
          ))}
        </div>
        <div className="calendar-grid">
          {weeks.map((week, wi) => (
            <div key={wi} className="calendar-week">
              {week.map((day, di) => {
                const dateStr = fmtDate(day)
                const entries = dateMap[dateStr] ?? []
                const isHovered = hoveredDay === dateStr
                const isFuture = day > today
                return (
                  <div
                    key={di}
                    className="calendar-cell"
                    style={{
                      background: isFuture ? 'transparent' : getCellColor(dateStr),
                      border: isHovered ? '1px solid rgba(255,255,255,0.5)' : '1px solid transparent',
                      opacity: isFuture ? 0 : 1,
                    }}
                    onMouseEnter={() => setHoveredDay(dateStr)}
                    onMouseLeave={() => setHoveredDay(null)}
                  >
                    {isHovered && (
                      <div className="cell-tooltip">
                        <div className="tooltip-date">{dateStr}</div>
                        {entries.length === 0
                          ? <div style={{ color: 'rgba(245,240,235,0.3)', fontSize: 11 }}>No sends</div>
                          : entries.map((e, i) => (
                            <div key={i} className="tooltip-entry">
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
          ))}
        </div>
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

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }

  .profile-root {
    min-height: 100vh; background: #0f0e0d;
    font-family: 'DM Sans', sans-serif; color: #f5f0eb;
  }

  .profile-root::before {
    content: ''; position: fixed; inset: 0; pointer-events: none; z-index: 0;
    background-image:
      radial-gradient(ellipse 50% 60% at 10% 20%, rgba(255,100,40,0.07) 0%, transparent 55%),
      radial-gradient(ellipse 40% 40% at 90% 80%, rgba(255,100,40,0.04) 0%, transparent 50%),
      url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");
  }

  /* Nav */
  .profile-nav {
    position: sticky; top: 0; z-index: 10;
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 20px; height: 56px;
    background: rgba(15,14,13,0.85); backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }
  .nav-left { display: flex; align-items: center; gap: 12px; }
  .nav-back {
    background: none; border: none; font-family: 'DM Sans', sans-serif;
    font-size: 13px; font-weight: 300; color: rgba(245,240,235,0.4);
    cursor: pointer; transition: color 0.2s; padding: 0; min-height: 44px;
  }
  .nav-back:hover { color: #ff6428; }
  .nav-divider { width: 1px; height: 16px; background: rgba(255,255,255,0.1); }
  .nav-logo { font-family: 'Bebas Neue', sans-serif; font-size: 22px; letter-spacing: 0.08em; }
  .nav-logo span { color: #ff6428; }

  /* Main */
  .profile-main {
    position: relative; z-index: 1; max-width: 1100px; margin: 0 auto;
    padding: 28px 20px 80px; display: flex; flex-direction: column; gap: 36px;
  }

  /* Hero */
  .profile-hero { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
  .profile-identity { display: flex; flex-direction: column; gap: 6px; }

  .profile-avatar {
    width: 56px; height: 56px; border-radius: 2px;
    background: linear-gradient(135deg, rgba(255,100,40,0.2), rgba(255,100,40,0.05));
    border: 1px solid rgba(255,100,40,0.2);
    display: flex; align-items: center; justify-content: center;
    font-family: 'Bebas Neue', sans-serif; font-size: 24px; letter-spacing: 0.05em;
    color: #ff6428; margin-bottom: 12px;
  }

  .profile-username { font-family: 'Bebas Neue', sans-serif; font-size: 44px; letter-spacing: 0.03em; line-height: 0.9; }
  .profile-since { font-size: 12px; font-weight: 300; color: rgba(245,240,235,0.3); letter-spacing: 0.06em; }

  /* Stat pills */
  .profile-stats { display: flex; gap: 10px; flex-wrap: wrap; }

  .stat-pill {
    background: #161412; border: 1px solid rgba(255,255,255,0.06);
    border-radius: 2px; padding: 12px 16px;
    display: flex; flex-direction: column; gap: 4px; min-width: 90px;
  }
  .stat-pill-value { font-family: 'Bebas Neue', sans-serif; font-size: 28px; letter-spacing: 0.03em; line-height: 1; }
  .stat-pill-label { font-size: 9px; font-weight: 500; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(245,240,235,0.35); }

  /* Section */
  .profile-section { display: flex; flex-direction: column; gap: 14px; }
  .section-title { font-family: 'Bebas Neue', sans-serif; font-size: 16px; letter-spacing: 0.1em; color: rgba(245,240,235,0.4); }
  .section-divider { height: 1px; background: rgba(255,255,255,0.05); }

  /* Calendar */
  .calendar-wrap { display: flex; flex-direction: column; gap: 6px; overflow-x: auto; padding-bottom: 4px; }
  .calendar-months { display: flex; gap: 4px; }
  .month-label { position: absolute; font-size: 10px; font-weight: 300; color: rgba(245,240,235,0.3); letter-spacing: 0.06em; white-space: nowrap; }
  .calendar-body { display: flex; gap: 4px; }
  .calendar-days { display: flex; flex-direction: column; gap: 2px; padding-top: 18px; width: 28px; flex-shrink: 0; }
  .day-label { font-size: 9px; font-weight: 300; color: rgba(245,240,235,0.4); height: 11px; line-height: 11px; }
  .calendar-grid { display: flex; gap: 2px; padding-top: 18px; }
  .calendar-week { display: flex; flex-direction: column; gap: 2px; }

  .calendar-cell {
    width: 11px; height: 11px; border-radius: 2px;
    cursor: pointer; transition: transform 0.1s; position: relative; flex-shrink: 0;
  }
  .calendar-cell:hover { transform: scale(1.3); z-index: 5; }

  .cell-tooltip {
    position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%);
    background: #1e1b18; border: 1px solid rgba(255,255,255,0.1);
    border-radius: 2px; padding: 8px 12px; width: max-content; max-width: 220px;
    z-index: 20; pointer-events: none; box-shadow: 0 8px 24px rgba(0,0,0,0.5);
  }
  .tooltip-date { font-size: 10px; font-weight: 500; letter-spacing: 0.08em; color: rgba(245,240,235,0.4); margin-bottom: 4px; text-transform: uppercase; }
  .tooltip-entry { font-size: 12px; font-weight: 300; color: #f5f0eb; line-height: 1.6; }
  .tooltip-wall { color: rgba(245,240,235,0.35); }

  .calendar-legend { display: flex; align-items: center; gap: 4px; margin-top: 4px; padding-left: 32px; }
  .legend-label { font-size: 10px; font-weight: 300; color: rgba(245,240,235,0.25); margin: 0 4px; }
  .legend-cell { width: 11px; height: 11px; border-radius: 2px; }

  /* Ascents table */
  .ascents-table { display: flex; flex-direction: column; gap: 2px; }

  .ascent-row {
    display: grid; grid-template-columns: 88px 1fr 1fr 56px 72px;
    gap: 12px; align-items: center;
    padding: 11px 14px; border-radius: 2px;
    background: #161412; border: 1px solid rgba(255,255,255,0.04);
    font-size: 13px; font-weight: 300;
    transition: border-color 0.2s, background 0.15s;
  }
  .ascent-row:hover { background: #1a1714; border-color: rgba(255,255,255,0.08); }

  .ascent-row-header {
    display: grid; grid-template-columns: 88px 1fr 1fr 56px 72px;
    gap: 12px; padding: 0 14px 8px;
    font-size: 10px; font-weight: 500; letter-spacing: 0.12em;
    text-transform: uppercase; color: rgba(245,240,235,0.25);
  }

  .grade-chip {
    font-family: 'Bebas Neue', sans-serif; font-size: 14px; letter-spacing: 0.04em;
    padding: 2px 7px; border-radius: 2px; display: inline-block;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06);
  }
  .quality-stars { color: #ffb347; font-size: 11px; letter-spacing: 1px; }

  /* Empty / loading */
  .empty-state { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 48px 24px; border: 1px dashed rgba(255,255,255,0.06); border-radius: 2px; color: rgba(245,240,235,0.2); }
  .empty-icon { font-size: 28px; opacity: 0.3; }
  .empty-label { font-size: 13px; font-weight: 300; text-align: center; }

  .loading-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; padding: 80px; }
  .loading-spinner { width: 32px; height: 32px; border: 2px solid rgba(255,255,255,0.08); border-top-color: #ff6428; border-radius: 50%; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .loading-label { font-size: 13px; font-weight: 300; color: rgba(245,240,235,0.4); }

  /* ── Responsive ── */
  @media (max-width: 600px) {
    .profile-hero { flex-direction: column; }
    .profile-username { font-size: 36px; }
    .profile-stats { gap: 8px; }
    .stat-pill { min-width: calc(50% - 4px); flex: 1; }

    /* Hide wall + quality columns on narrow screens */
    .ascent-row, .ascent-row-header {
      grid-template-columns: 76px 1fr 44px;
    }
    .ascent-row > *:nth-child(3),
    .ascent-row-header > *:nth-child(3),
    .ascent-row > *:nth-child(5),
    .ascent-row-header > *:nth-child(5) { display: none; }
  }

  @media (min-width: 701px) {
    .profile-nav { padding: 0 40px; height: 60px; }
    .nav-logo { font-size: 24px; }
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

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => (await api.get('/users/me/profile')).data,
  })

  return (
    <>
      <style>{styles}</style>
      <div className="profile-root">
        <nav className="profile-nav">
          <div className="nav-left">
            <button className="nav-back" onClick={() => navigate('/home')}>← Back</button>
            <div className="nav-divider" />
            <div className="nav-logo">Home<span>Board</span></div>
          </div>
        </nav>

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
                <span className="section-title">Activity — Last 52 Weeks</span>
                <div className="section-divider" />
                {profile.ascents.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">◻</div>
                    <div className="empty-label">No activity yet — log your first send</div>
                  </div>
                ) : (
                  <ActivityCalendar ascents={profile.ascents} />
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
                      <span>Date</span>
                      <span>Route</span>
                      <span>Wall</span>
                      <span>Grade</span>
                      <span>Quality</span>
                    </div>
                    {profile.ascents.map((a, i) => (
                      <div key={i} className="ascent-row">
                        <span style={{ color: 'rgba(245,240,235,0.4)', fontSize: 12 }}>{a.date}</span>
                        <span style={{ fontWeight: 400 }}>{a.route_name}</span>
                        <span style={{ color: 'rgba(245,240,235,0.4)' }}>{a.wall_name}</span>
                        <span>
                          <span className="grade-chip" style={{ color: gradeColor(a.grade) }}>{a.grade}</span>
                        </span>
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
