import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../api/axios'

// ─── Image downsampler ────────────────────────────────────────────────────────
function downsampleImage(src, maxSize) {
  return new Promise((resolve) => {
    const img = new window.Image()
    img.onload = () => {
      const s = Math.min(1, maxSize / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * s)
      c.height = Math.round(img.height * s)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      const out = new window.Image()
      out.onload = () => resolve(out)
      out.src = c.toDataURL('image/jpeg', 0.85)
    }
    img.src = src
  })
}

function renderCanvas(imageCanvas, overlayCanvas, img, holds, state) {
  if (!imageCanvas || !overlayCanvas) return
  const { tx, imgScale, origWidth, origHeight } = state
  const ic = imageCanvas.getContext('2d')
  ic.clearRect(0, 0, imageCanvas.width, imageCanvas.height)
  if (img) ic.drawImage(img, tx.x, tx.y, origWidth * imgScale * tx.z, origHeight * imgScale * tx.z)
  const oc = overlayCanvas.getContext('2d')
  oc.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height)
  for (const hold of holds) {
    const pts = hold.polygon
    if (!pts || pts.length < 2) continue
    oc.beginPath()
    oc.moveTo(pts[0].x * imgScale * tx.z + tx.x, pts[0].y * imgScale * tx.z + tx.y)
    for (let i = 1; i < pts.length; i++)
      oc.lineTo(pts[i].x * imgScale * tx.z + tx.x, pts[i].y * imgScale * tx.z + tx.y)
    oc.closePath()
    oc.fillStyle = 'rgba(255,100,40,0.15)'
    oc.fill()
    oc.strokeStyle = '#ff6428'
    oc.lineWidth = 1.5
    oc.stroke()
  }
}

function WallCanvas({ imageUrl, holds, imageWidth, imageHeight }) {
  const containerRef = useRef(null)
  const imageCanvasRef = useRef(null)
  const overlayCanvasRef = useRef(null)
  const rafRef = useRef(null)
  const S = useRef({
    tx: { x: 0, y: 0, z: 1 }, imgScale: 1, origWidth: 1, origHeight: 1,
    img: null, dragOrigin: null, isDragging: false,
    lastTouchDist: null, touchMoved: false,
  })
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 400 })

  const scheduleRender = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() =>
      renderCanvas(imageCanvasRef.current, overlayCanvasRef.current, S.current.img, holds, S.current))
  }, [holds])

  useEffect(() => {
    downsampleImage(imageUrl, 1200).then(img => { S.current.img = img; scheduleRender() })
  }, [imageUrl, scheduleRender])

  useEffect(() => {
    if (!containerRef.current) return
    const w = containerRef.current.offsetWidth
    const maxH = Math.min(window.innerHeight * 0.5, 500)
    const s = Math.min(w / imageWidth, maxH / imageHeight)
    const displayW = imageWidth * s, displayH = imageHeight * s
    S.current.imgScale = s; S.current.origWidth = imageWidth; S.current.origHeight = imageHeight
    S.current.tx = { x: (w - displayW) / 2, y: 0, z: 1 }
    setCanvasSize({ width: w, height: displayH })
    scheduleRender()
  }, [imageWidth, imageHeight, scheduleRender])

  useEffect(() => { scheduleRender() }, [canvasSize, scheduleRender])

  // ── Mouse events ──
  useEffect(() => {
    const overlay = overlayCanvasRef.current
    if (!overlay) return
    const getPos = e => { const r = overlay.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top } }
    const onMouseDown = e => { const pos = getPos(e); S.current.isDragging = false; S.current.dragOrigin = { mx: pos.x, my: pos.y, tx: S.current.tx.x, ty: S.current.tx.y } }
    const onMouseMove = e => {
      if (!S.current.dragOrigin) return
      const pos = getPos(e), d = S.current.dragOrigin, dx = pos.x - d.mx, dy = pos.y - d.my
      if (Math.hypot(dx, dy) > 3) S.current.isDragging = true
      S.current.tx = { ...S.current.tx, x: d.tx + dx, y: d.ty + dy }
      scheduleRender()
    }
    const onMouseUp = () => { S.current.dragOrigin = null }
    const onWheel = e => {
      e.preventDefault()
      const pos = getPos(e), { tx } = S.current, factor = e.deltaY < 0 ? 1.08 : 1 / 1.08
      const newZ = Math.min(Math.max(tx.z * factor, 0.3), 8)
      S.current.tx = { z: newZ, x: pos.x - (pos.x - tx.x) * (newZ / tx.z), y: pos.y - (pos.y - tx.y) * (newZ / tx.z) }
      scheduleRender()
    }
    overlay.addEventListener('mousedown', onMouseDown)
    overlay.addEventListener('mousemove', onMouseMove)
    overlay.addEventListener('mouseup', onMouseUp)
    overlay.addEventListener('mouseleave', onMouseUp)
    overlay.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      overlay.removeEventListener('mousedown', onMouseDown)
      overlay.removeEventListener('mousemove', onMouseMove)
      overlay.removeEventListener('mouseup', onMouseUp)
      overlay.removeEventListener('mouseleave', onMouseUp)
      overlay.removeEventListener('wheel', onWheel)
    }
  }, [scheduleRender])

  // ── Touch events ──
  useEffect(() => {
    const overlay = overlayCanvasRef.current
    if (!overlay) return
    const getPos = t => { const r = overlay.getBoundingClientRect(); return { x: t.clientX - r.left, y: t.clientY - r.top } }
    const getDist = (t1, t2) => Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY)
    const getMid = (t1, t2) => ({ x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 })

    const onTouchStart = e => {
      e.preventDefault()
      if (e.touches.length === 1) {
        const pos = getPos(e.touches[0])
        S.current.touchMoved = false
        S.current.dragOrigin = { mx: pos.x, my: pos.y, tx: S.current.tx.x, ty: S.current.tx.y }
        S.current.lastTouchDist = null
      } else if (e.touches.length === 2) {
        S.current.dragOrigin = null
        S.current.lastTouchDist = getDist(e.touches[0], e.touches[1])
        S.current.lastTouchMid = getMid(e.touches[0], e.touches[1])
      }
    }
    const onTouchMove = e => {
      e.preventDefault()
      if (e.touches.length === 1 && S.current.dragOrigin) {
        const pos = getPos(e.touches[0]), d = S.current.dragOrigin
        const dx = pos.x - d.mx, dy = pos.y - d.my
        if (Math.hypot(dx, dy) > 4) S.current.touchMoved = true
        S.current.tx = { ...S.current.tx, x: d.tx + dx, y: d.ty + dy }
        scheduleRender()
      } else if (e.touches.length === 2 && S.current.lastTouchDist) {
        const newDist = getDist(e.touches[0], e.touches[1])
        const newMid = getMid(e.touches[0], e.touches[1])
        const r = overlay.getBoundingClientRect()
        const mid = { x: newMid.x - r.left, y: newMid.y - r.top }
        const { tx } = S.current
        const newZ = Math.min(Math.max(tx.z * (newDist / S.current.lastTouchDist), 0.3), 8)
        S.current.tx = { z: newZ, x: mid.x - (mid.x - tx.x) * (newZ / tx.z), y: mid.y - (mid.y - tx.y) * (newZ / tx.z) }
        S.current.lastTouchDist = newDist
        scheduleRender()
      }
    }
    const onTouchEnd = e => {
      e.preventDefault()
      S.current.dragOrigin = null
      if (e.touches.length < 2) S.current.lastTouchDist = null
    }
    overlay.addEventListener('touchstart', onTouchStart, { passive: false })
    overlay.addEventListener('touchmove', onTouchMove, { passive: false })
    overlay.addEventListener('touchend', onTouchEnd, { passive: false })
    return () => {
      overlay.removeEventListener('touchstart', onTouchStart)
      overlay.removeEventListener('touchmove', onTouchMove)
      overlay.removeEventListener('touchend', onTouchEnd)
    }
  }, [scheduleRender])

  return (
    <div ref={containerRef} style={{
      position: 'relative', width: '100%', height: canvasSize.height,
      borderRadius: 2, border: '1px solid rgba(255,255,255,0.06)',
      background: '#0a0908', overflow: 'hidden', cursor: 'grab', touchAction: 'none',
    }}>
      <canvas ref={imageCanvasRef} width={canvasSize.width} height={canvasSize.height} style={{ position: 'absolute', top: 0, left: 0 }} />
      <canvas ref={overlayCanvasRef} width={canvasSize.width} height={canvasSize.height} style={{ position: 'absolute', top: 0, left: 0 }} />
    </div>
  )
}

// ─── Settings panel (owner only) ─────────────────────────────────────────────
function SettingsPanel({ wallId, currentPrivacy, queryClient }) {
  const [privacy, setPrivacy] = useState(currentPrivacy)
  const [inviteUsername, setInviteUsername] = useState('')
  const [inviteError, setInviteError] = useState(null)
  const [inviteSuccess, setInviteSuccess] = useState(null)
  const [privacySaving, setPrivacySaving] = useState(false)
  const [inviteLoading, setInviteLoading] = useState(false)

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ['members', wallId],
    queryFn: async () => (await api.get(`/walls/${wallId}/members`)).data,
  })

  const handlePrivacyChange = async (newPrivacy) => {
    if (newPrivacy === privacy) return
    setPrivacy(newPrivacy)
    setPrivacySaving(true)
    try {
      await api.patch(`/walls/${wallId}`, { privacy: newPrivacy })
      queryClient.invalidateQueries({ queryKey: ['wall', wallId] })
      queryClient.invalidateQueries({ queryKey: ['walls'] })
    } catch {
      setPrivacy(currentPrivacy)
    } finally {
      setPrivacySaving(false)
    }
  }

  const handleInvite = async () => {
    if (!inviteUsername.trim()) return
    setInviteLoading(true); setInviteError(null); setInviteSuccess(null)
    try {
      await api.post(`/walls/${wallId}/members`, { username: inviteUsername.trim() })
      setInviteSuccess(`${inviteUsername.trim()} added`)
      setInviteUsername('')
      queryClient.invalidateQueries({ queryKey: ['members', wallId] })
    } catch (err) {
      setInviteError(err.response?.data?.detail || 'Failed to invite user')
    } finally {
      setInviteLoading(false)
    }
  }

  const handleRemove = async (userId, username) => {
    if (!window.confirm(`Remove ${username} from this wall?`)) return
    try {
      await api.delete(`/walls/${wallId}/members/${userId}`)
      queryClient.invalidateQueries({ queryKey: ['members', wallId] })
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to remove member')
    }
  }

  return (
    <div className="settings-panel">
      <div className="settings-section">
        <div className="settings-section-title">Privacy</div>
        <div className="privacy-toggle">
          <div
            className={`privacy-opt ${privacy === 'Private' ? 'selected' : ''}`}
            onClick={() => handlePrivacyChange('Private')}
          >
            <span className="privacy-opt-label">🔒 Private</span>
            <span className="privacy-opt-desc">Invite only</span>
          </div>
          <div
            className={`privacy-opt ${privacy === 'Public' ? 'selected' : ''}`}
            onClick={() => handlePrivacyChange('Public')}
          >
            <span className="privacy-opt-label">🌐 Public</span>
            <span className="privacy-opt-desc">Anyone can view & add routes</span>
          </div>
        </div>
        {privacySaving && <div className="settings-saving">Saving...</div>}
      </div>

      <div className="settings-section">
        <div className="settings-section-title">Members</div>
        <div className="invite-row">
          <input
            className="invite-input"
            placeholder="Username to invite..."
            value={inviteUsername}
            onChange={e => setInviteUsername(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleInvite()}
          />
          <button className="invite-btn" onClick={handleInvite} disabled={inviteLoading}>
            {inviteLoading ? '...' : '+ Add'}
          </button>
        </div>
        {inviteError && <div className="invite-error">{inviteError}</div>}
        {inviteSuccess && <div className="invite-success">{inviteSuccess}</div>}
        <div className="members-list">
          {membersLoading ? (
            <div className="members-loading">Loading...</div>
          ) : members?.map(m => (
            <div key={m.user_id} className="member-row">
              <div className="member-info">
                <span className="member-name">{m.username}</span>
                <span className={`member-role ${m.role === 'owner' ? 'role-owner' : 'role-member'}`}>
                  {m.role}
                </span>
              </div>
              {m.role !== 'owner' && (
                <button className="remove-btn" onClick={() => handleRemove(m.user_id, m.username)}>✕</button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Grade badge color ────────────────────────────────────────────────────────
function gradeColor(grade) {
  const map = {
    Unknown: '#888', V0: '#6bcb77', V1: '#6bcb77', V2: '#80d8a0',
    V3: '#ffe066', V4: '#ffe066', V5: '#ffb347', V6: '#ffb347',
    V7: '#ff6428', V8: '#ff6428', V9: '#ff4040', V10: '#ff4040',
    V11: '#d040ff', V12: '#d040ff', V15: '#a040ff', V16: '#a040ff', V17: '#a040ff',
  }
  return map[grade] ?? '#888'
}

const GRADES = ['Unknown','V0','V1','V2','V3','V4','V5','V6','V7','V8','V9','V10','V11','V12','V15','V16','V17']

function getUsername() {
  try {
    const token = localStorage.getItem('token')
    return JSON.parse(atob(token.split('.')[1])).sub
  } catch { return null }
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }

  .detail-root { min-height: 100vh; background-color: #0f0e0d; font-family: 'DM Sans', sans-serif; color: #f5f0eb; }

  .detail-root::before {
    content: ''; position: fixed; inset: 0;
    background-image: radial-gradient(ellipse 60% 40% at 80% 10%, rgba(255,100,40,0.06) 0%, transparent 60%),
      url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");
    pointer-events: none; z-index: 0;
  }

  .detail-nav {
    position: sticky; top: 0; z-index: 10;
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 20px; height: 56px;
    background: rgba(15,14,13,0.85); backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }

  .nav-left { display: flex; align-items: center; gap: 12px; }
  .nav-back { background: none; border: none; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 300; color: rgba(245,240,235,0.4); cursor: pointer; transition: color 0.2s; padding: 0; min-height: 44px; }
  .nav-back:hover { color: #ff6428; }
  .nav-divider { width: 1px; height: 16px; background: rgba(255,255,255,0.1); }
  .nav-logo { font-family: 'Bebas Neue', sans-serif; font-size: 22px; letter-spacing: 0.08em; color: #f5f0eb; }
  .nav-logo span { color: #ff6428; }

  .detail-main { position: relative; z-index: 1; max-width: 1100px; margin: 0 auto; padding: 24px 20px 80px; }

  /* Header */
  .detail-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
  .detail-title { font-family: 'Bebas Neue', sans-serif; font-size: 40px; line-height: 0.9; letter-spacing: 0.03em; }
  .detail-title-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .detail-subtitle { font-size: 12px; font-weight: 300; color: rgba(245,240,235,0.35); margin-top: 8px; }
  .detail-actions { display: flex; gap: 8px; align-items: flex-start; flex-wrap: wrap; }

  .privacy-badge { font-size: 10px; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; padding: 3px 8px; border-radius: 2px; }
  .privacy-badge-public { background: rgba(107,203,119,0.1); color: rgba(107,203,119,0.7); border: 1px solid rgba(107,203,119,0.2); }
  .privacy-badge-private { background: rgba(255,255,255,0.04); color: rgba(245,240,235,0.3); border: 1px solid rgba(255,255,255,0.08); }

  .action-btn {
    background: #ff6428; border: none; border-radius: 2px;
    padding: 10px 16px; font-family: 'Bebas Neue', sans-serif;
    font-size: 15px; letter-spacing: 0.08em; color: #0f0e0d;
    cursor: pointer; transition: background 0.2s; white-space: nowrap; min-height: 44px;
  }
  .action-btn:hover { background: #ff7a40; }
  .action-btn:active { opacity: 0.85; }
  .action-btn.secondary { background: none; border: 1px solid rgba(255,255,255,0.1); color: rgba(245,240,235,0.5); }
  .action-btn.secondary:hover { border-color: rgba(255,100,40,0.4); color: #ff6428; background: none; }

  .detail-divider { height: 1px; background: rgba(255,255,255,0.06); margin-bottom: 24px; }

  /* Two-col layout */
  .detail-layout { display: grid; grid-template-columns: 1fr 340px; gap: 28px; align-items: start; }

  /* Routes panel */
  .routes-panel { display: flex; flex-direction: column; gap: 12px; }
  .routes-panel-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px; }
  .panel-title { font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 0.06em; color: rgba(245,240,235,0.5); }

  /* Filter bar */
  .filter-bar { display: flex; gap: 8px; flex-wrap: wrap; }
  .filter-input {
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 2px; padding: 10px 12px; font-size: 13px;
    font-family: 'DM Sans', sans-serif; font-weight: 300; color: #f5f0eb;
    outline: none; transition: border-color 0.2s; flex: 1; min-width: 120px; min-height: 44px;
  }
  .filter-input:focus { border-color: rgba(255,100,40,0.4); }
  .filter-input::placeholder { color: rgba(245,240,235,0.2); }
  .filter-select {
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 2px; padding: 10px 12px; font-size: 13px;
    font-family: 'DM Sans', sans-serif; font-weight: 300; color: #f5f0eb;
    outline: none; transition: border-color 0.2s; cursor: pointer; min-height: 44px;
  }
  .filter-select:focus { border-color: rgba(255,100,40,0.4); }
  .filter-select option { background: #161412; }

  /* Route cards */
  .route-card {
    background: #161412; border: 1px solid rgba(255,255,255,0.06);
    border-radius: 2px; padding: 14px 16px;
    display: flex; align-items: center; gap: 14px;
    cursor: pointer; transition: border-color 0.2s, background 0.2s;
    position: relative; overflow: hidden; min-height: 64px;
  }
  .route-card::before {
    content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
    background: var(--grade-color, #ff6428); opacity: 0; transition: opacity 0.2s;
  }
  .route-card:hover { border-color: rgba(255,255,255,0.12); background: #1a1714; }
  .route-card:hover::before { opacity: 1; }
  .route-card:active { background: #1e1b17; }

  .grade-badge {
    font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 0.04em;
    min-width: 44px; text-align: center; padding: 6px 8px; border-radius: 2px;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); flex-shrink: 0;
  }
  .route-card-body { flex: 1; min-width: 0; }
  .route-card-name { font-size: 14px; font-weight: 500; color: #f5f0eb; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .route-card-meta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .route-meta-item { font-size: 11px; font-weight: 300; color: rgba(245,240,235,0.35); display: flex; align-items: center; gap: 4px; }
  .route-meta-dot { width: 3px; height: 3px; border-radius: 50%; background: rgba(255,100,40,0.4); }
  .ascent-count { font-family: 'Bebas Neue', sans-serif; font-size: 16px; letter-spacing: 0.04em; color: rgba(245,240,235,0.25); flex-shrink: 0; text-align: center; }
  .ascent-count span { font-family: 'DM Sans', sans-serif; font-size: 9px; font-weight: 300; display: block; letter-spacing: 0.08em; text-transform: uppercase; margin-top: 1px; }
  .route-arrow { color: rgba(255,100,40,0.2); font-size: 14px; transition: color 0.2s; flex-shrink: 0; }
  .route-card:hover .route-arrow { color: #ff6428; }

  /* Empty/loading */
  .routes-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 48px 24px; border: 1px dashed rgba(255,255,255,0.07); border-radius: 2px; color: rgba(245,240,235,0.2); }
  .routes-empty-icon { font-size: 28px; opacity: 0.3; }
  .routes-empty p { font-size: 13px; font-weight: 300; text-align: center; }

  /* Wall preview panel */
  .wall-preview-panel { display: flex; flex-direction: column; gap: 10px; }
  .preview-header { display: flex; align-items: center; justify-content: space-between; }
  .canvas-hint { font-size: 11px; font-weight: 300; color: rgba(245,240,235,0.2); }

  /* Settings panel */
  .settings-panel {
    border: 1px solid rgba(255,255,255,0.06); border-radius: 2px;
    background: #161412; overflow: hidden;
  }
  .settings-section { padding: 16px; border-bottom: 1px solid rgba(255,255,255,0.05); }
  .settings-section:last-child { border-bottom: none; }
  .settings-section-title { font-family: 'Bebas Neue', sans-serif; font-size: 14px; letter-spacing: 0.1em; color: rgba(245,240,235,0.4); margin-bottom: 12px; }
  .settings-saving { font-size: 11px; font-weight: 300; color: rgba(245,240,235,0.3); margin-top: 8px; }

  .privacy-toggle { display: flex; gap: 6px; }
  .privacy-opt { flex: 1; padding: 8px 10px; border-radius: 2px; cursor: pointer; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.02); transition: all 0.15s; }
  .privacy-opt-label { font-size: 12px; font-weight: 500; color: rgba(245,240,235,0.45); display: block; margin-bottom: 1px; }
  .privacy-opt-desc { font-size: 9px; font-weight: 300; color: rgba(245,240,235,0.22); display: block; }
  .privacy-opt.selected { border-color: rgba(255,100,40,0.4); background: rgba(255,100,40,0.06); }
  .privacy-opt.selected .privacy-opt-label { color: #ff6428; }
  .privacy-opt.selected .privacy-opt-desc { color: rgba(255,100,40,0.45); }

  .invite-row { display: flex; gap: 8px; margin-bottom: 8px; }
  .invite-input { flex: 1; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 2px; padding: 8px 10px; font-size: 12px; font-family: 'DM Sans', sans-serif; font-weight: 300; color: #f5f0eb; outline: none; transition: border-color 0.2s; min-height: 36px; }
  .invite-input:focus { border-color: rgba(255,100,40,0.4); }
  .invite-input::placeholder { color: rgba(245,240,235,0.2); }
  .invite-btn { background: rgba(255,100,40,0.1); border: 1px solid rgba(255,100,40,0.25); border-radius: 2px; padding: 8px 12px; font-family: 'DM Sans', sans-serif; font-size: 12px; font-weight: 500; color: #ff6428; cursor: pointer; transition: all 0.2s; white-space: nowrap; min-height: 36px; }
  .invite-btn:hover { background: rgba(255,100,40,0.18); }
  .invite-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .invite-error { font-size: 11px; color: #ff6060; margin-bottom: 8px; }
  .invite-success { font-size: 11px; color: #6bcb77; margin-bottom: 8px; }

  .members-list { display: flex; flex-direction: column; gap: 4px; margin-top: 4px; }
  .member-row { display: flex; align-items: center; justify-content: space-between; padding: 7px 10px; border-radius: 2px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); }
  .member-info { display: flex; align-items: center; gap: 8px; }
  .member-name { font-size: 12px; font-weight: 400; color: #f5f0eb; }
  .member-role { font-size: 9px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; padding: 1px 5px; border-radius: 2px; }
  .role-owner { background: rgba(255,100,40,0.1); color: rgba(255,100,40,0.6); border: 1px solid rgba(255,100,40,0.2); }
  .role-member { background: rgba(255,255,255,0.04); color: rgba(245,240,235,0.3); border: 1px solid rgba(255,255,255,0.06); }
  .remove-btn { background: none; border: none; color: rgba(245,240,235,0.2); cursor: pointer; font-size: 12px; padding: 4px 6px; border-radius: 2px; transition: color 0.15s, background 0.15s; min-height: 28px; min-width: 28px; }
  .remove-btn:hover { color: #ff6060; background: rgba(255,60,60,0.08); }
  .members-loading { font-size: 12px; font-weight: 300; color: rgba(245,240,235,0.3); padding: 8px 0; }

  /* Loading */
  .loading-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; padding: 80px 40px; border: 1px solid rgba(255,255,255,0.06); border-radius: 2px; background: #161412; }
  .loading-spinner { width: 32px; height: 32px; border: 2px solid rgba(255,255,255,0.08); border-top-color: #ff6428; border-radius: 50%; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .loading-label { font-size: 13px; font-weight: 300; color: rgba(245,240,235,0.4); }

  .no-image-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 48px; border: 1px dashed rgba(255,255,255,0.08); border-radius: 2px; background: #161412; color: rgba(245,240,235,0.2); }

  .skeleton-route { background: #161412; border: 1px solid rgba(255,255,255,0.04); border-radius: 2px; padding: 14px 16px; display: flex; gap: 14px; align-items: center; }
  .skeleton-box { border-radius: 2px; background: linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 100%); background-size: 200% 100%; animation: shimmer 1.4s infinite; }
  @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

  /* ── Responsive ── */
  @media (max-width: 680px) {
    .detail-main { padding: 16px 16px 80px; }
    .detail-title { font-size: 32px; }
    .detail-header { flex-direction: column; align-items: flex-start; gap: 12px; }
    .detail-actions { width: 100%; }
    .action-btn { flex: 1; text-align: center; justify-content: center; }
    .detail-layout { grid-template-columns: 1fr; gap: 20px; }
    .wall-preview-panel { order: -1; }
    .filter-bar { flex-direction: column; }
    .filter-input, .filter-select { width: 100%; }
  }

  @media (min-width: 681px) and (max-width: 960px) {
    .detail-layout { grid-template-columns: 1fr 260px; gap: 20px; }
    .detail-main { padding: 24px 24px 60px; }
  }

  @media (min-width: 961px) {
    .detail-main { padding: 32px 40px 60px; }
    .detail-layout { grid-template-columns: 1fr 360px; }
  }
`

function SkeletonRoute() {
  return (
    <div className="skeleton-route">
      <div className="skeleton-box" style={{ width: 44, height: 44, flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="skeleton-box" style={{ height: 14, width: '55%' }} />
        <div className="skeleton-box" style={{ height: 10, width: '35%' }} />
      </div>
    </div>
  )
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function WallDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const currentUsername = getUsername()
  // const [imageUrl, setImageUrl] = useState(null)
  // const [imageDimensions, setImageDimensions] = useState(null)
  const [search, setSearch] = useState('')
  const [gradeFilter, setGradeFilter] = useState('All')

  const { data: wall, isLoading: wallLoading } = useQuery({
    queryKey: ['wall', id],
    queryFn: async () => (await api.get(`/walls/${id}`)).data
  })

  const { data: holds, isLoading: holdsLoading } = useQuery({
    queryKey: ['holds', id],
    queryFn: async () => (await api.get(`/walls/${id}/holds`)).data
  })

  const { data: routes, isLoading: routesLoading } = useQuery({
    queryKey: ['routes', id],
    queryFn: async () => (await api.get(`/walls/${id}/routes`)).data
  })

  // useEffect(() => {
  //   if (!wall?.image_path) return
  //   api.get(`/walls/${id}/image`, { responseType: 'blob' }).then(res => {
  //     const url = URL.createObjectURL(res.data)
  //     setImageUrl(url)
  //     const img = new window.Image()
  //     img.onload = () => setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight })
  //     img.src = url
  //   })
  // }, [wall?.image_path, id])
  const { data: imageUrl } = useQuery({
    queryKey: ['image', id],
    queryFn: async () => {
      const res = await api.get(`/walls/${id}/image`, { responseType: 'blob' })
      return URL.createObjectURL(res.data)
    },
    enabled: !!wall?.image_path,
    staleTime: Infinity,  // never refetch, image won't change
  })
  
  const { data: imageDimensions } = useQuery({
    queryKey: ['imageDimensions', id],
    queryFn: () => new Promise((resolve) => {
      const img = new window.Image()
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
      img.src = imageUrl
    }),
    enabled: !!imageUrl,
    staleTime: Infinity,
  })

  const filteredRoutes = (routes ?? []).filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(search.toLowerCase())
    const matchesGrade = gradeFilter === 'All' || r.grade === gradeFilter
    return matchesSearch && matchesGrade
  })

  const isOwner = wall?.created_by === currentUsername
  const isLoading = wallLoading || holdsLoading

  return (
    <>
      <style>{styles}</style>
      <div className="detail-root">
        <nav className="detail-nav">
          <div className="nav-left">
            <button className="nav-back" onClick={() => navigate('/home')}>← Back</button>
            <div className="nav-divider" />
            <div className="nav-logo">Home<span>Board</span></div>
          </div>
        </nav>

        <main className="detail-main">
          <div className="detail-header">
            <div>
              <div className="detail-title-row">
                <h1 className="detail-title">{wall?.name ?? `Wall #${id}`}</h1>
                {wall && (
                  <span className={`privacy-badge ${wall.privacy === 'Public' ? 'privacy-badge-public' : 'privacy-badge-private'}`}>
                    {wall.privacy === 'Public' ? '🌐 Public' : '🔒 Private'}
                  </span>
                )}
              </div>
              <p className="detail-subtitle">
                {routes
                  ? `${routes.length} route${routes.length !== 1 ? 's' : ''} · ${holds?.length ?? 0} holds mapped`
                  : 'Loading...'}
              </p>
            </div>
            <div className="detail-actions">
              {isOwner && (
                <button className="action-btn secondary" onClick={() => navigate(`/walls/${id}`)}>↑ Re-upload</button>
              )}
              <button className="action-btn" onClick={() => navigate(`/walls/${id}/route/new`)}>+ New Route</button>
            </div>
          </div>

          <div className="detail-divider" />

          {isLoading ? (
            <div className="loading-state">
              <div className="loading-spinner" />
              <div className="loading-label">Loading wall...</div>
            </div>
          ) : (
            <div className="detail-layout">

              {/* Routes panel */}
              <div className="routes-panel">
                <div className="routes-panel-header">
                  <span className="panel-title">Routes</span>
                </div>

                <div className="filter-bar">
                  <input
                    className="filter-input"
                    placeholder="Search routes..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                  <select
                    className="filter-select"
                    value={gradeFilter}
                    onChange={e => setGradeFilter(e.target.value)}
                  >
                    <option value="All">All Grades</option>
                    {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>

                {routesLoading ? (
                  [1,2,3].map(i => <SkeletonRoute key={i} />)
                ) : filteredRoutes.length === 0 ? (
                  <div className="routes-empty">
                    <div className="routes-empty-icon">◻</div>
                    <p>{routes?.length === 0 ? 'No routes yet — create the first one' : 'No routes match your filters'}</p>
                  </div>
                ) : (
                  filteredRoutes.map(route => {
                    const color = gradeColor(route.grade)
                    return (
                      <div
                        key={route.id}
                        className="route-card"
                        style={{ '--grade-color': color }}
                        onClick={() => navigate(`/walls/${id}/routes/${route.id}`)}
                      >
                        <div className="grade-badge" style={{ color }}>
                          {route.grade}
                        </div>
                        <div className="route-card-body">
                          <div className="route-card-name">{route.name}</div>
                          <div className="route-card-meta">
                            <div className="route-meta-item">
                              <div className="route-meta-dot" />
                              {route.created_by}
                            </div>
                            <div className="route-meta-item">
                              <div className="route-meta-dot" />
                              {formatDate(route.created_at)}
                            </div>
                          </div>
                        </div>
                        <div className="ascent-count" style={{ color: 'rgba(245,240,235,0.3)' }}>
                          {route.ascent_count ?? 0}
                          <span>sends</span>
                        </div>
                        <div className="route-arrow">→</div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Wall preview + settings */}
              <div className="wall-preview-panel">
                <div className="preview-header">
                  <span className="panel-title">Wall</span>
                  <span className="canvas-hint">Pinch to zoom · Drag to pan</span>
                </div>
                {imageUrl && imageDimensions && holds ? (
                  <WallCanvas
                    imageUrl={imageUrl}
                    holds={holds}
                    imageWidth={imageDimensions.width}
                    imageHeight={imageDimensions.height}
                  />
                ) : wall?.image_path ? (
                  <div className="loading-state">
                    <div className="loading-spinner" />
                    <div className="loading-label">Loading image...</div>
                  </div>
                ) : (
                  <div className="no-image-state">
                    <div style={{ fontSize: 28, opacity: 0.3 }}>◻</div>
                    <p style={{ fontSize: 13, fontWeight: 300 }}>No image uploaded</p>
                    {isOwner && (
                      <button className="action-btn" style={{ marginTop: 4 }} onClick={() => navigate(`/walls/${id}`)}>Upload Image</button>
                    )}
                  </div>
                )}

                {isOwner && wall && (
                  <SettingsPanel
                    wallId={id}
                    currentPrivacy={wall.privacy}
                    queryClient={queryClient}
                  />
                )}
              </div>

            </div>
          )}
        </main>
      </div>
    </>
  )
}
