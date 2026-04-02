import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../api/axios'
import { useRouteRelations } from '../hooks/useRouteRelations'
import SaveButtons from '../components/SaveButtons'
import Navbar from '../components/Navbar'
import { useGradeSystem } from '../hooks/useGradeSystem'
import { convertGrade } from '../utils/gradeUtils'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getUsername() {
  try {
    const token = localStorage.getItem('token')
    return JSON.parse(atob(token.split('.')[1])).sub
  } catch { return null }
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function gradeColor(grade) {
  const map = {
    Unknown: '#888', V0: '#6bcb77', V1: '#6bcb77', V2: '#80d8a0',
    V3: '#ffe066', V4: '#ffe066', V5: '#ffb347', V6: '#ffb347',
    V7: '#ff6428', V8: '#ff6428', V9: '#ff4040', V10: '#ff4040',
    V11: '#d040ff', V12: '#d040ff', V15: '#a040ff', V16: '#a040ff', V17: '#a040ff',
  }
  return map[grade] ?? '#888'
}

function downsampleImage(src, maxSize) {
  return new Promise((resolve) => {
    const img = new window.Image()
    img.onload = () => {
      const s = Math.min(1, maxSize / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      const out = new window.Image()
      out.onload = () => resolve(out)
      out.src = c.toDataURL('image/jpeg', 0.85)
    }
    img.src = src
  })
}

const GRADES = ['Unknown','V0','V1','V2','V3','V4','V5','V6','V7','V8','V9','V10','V11','V12','V15','V16','V17']

// ─── Canvas ───────────────────────────────────────────────────────────────────
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

function WallCanvas({ imageUrl, holds, imageWidth, imageHeight, maxHeight = 500, interactive = true }) {
  const containerRef = useRef(null)
  const imageCanvasRef = useRef(null)
  const overlayCanvasRef = useRef(null)
  const rafRef = useRef(null)
  const S = useRef({ tx: { x: 0, y: 0, z: 1 }, imgScale: 1, origWidth: 1, origHeight: 1, img: null, dragOrigin: null, lastTouchDist: null })
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 200 })

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
    const s = Math.min(w / imageWidth, maxHeight / imageHeight)
    const displayW = imageWidth * s, displayH = imageHeight * s
    S.current.imgScale = s; S.current.origWidth = imageWidth; S.current.origHeight = imageHeight
    S.current.tx = { x: (w - displayW) / 2, y: 0, z: 1 }
    setCanvasSize({ width: w, height: displayH })
    scheduleRender()
  }, [imageWidth, imageHeight, maxHeight, scheduleRender])

  useEffect(() => { scheduleRender() }, [canvasSize, scheduleRender])

  useEffect(() => {
    if (!interactive) return
    const overlay = overlayCanvasRef.current
    if (!overlay) return
    const getPos = e => { const r = overlay.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top } }
    const onDown = e => { const p = getPos(e); S.current.dragOrigin = { mx: p.x, my: p.y, tx: S.current.tx.x, ty: S.current.tx.y } }
    const onMove = e => {
      if (!S.current.dragOrigin) return
      const p = getPos(e), d = S.current.dragOrigin
      S.current.tx = { ...S.current.tx, x: d.tx + (p.x - d.mx), y: d.ty + (p.y - d.my) }
      scheduleRender()
    }
    const onUp = () => { S.current.dragOrigin = null }
    const onWheel = e => {
      e.preventDefault()
      const p = getPos(e), { tx } = S.current, factor = e.deltaY < 0 ? 1.08 : 1 / 1.08
      const newZ = Math.min(Math.max(tx.z * factor, 0.3), 8)
      S.current.tx = { z: newZ, x: p.x - (p.x - tx.x) * (newZ / tx.z), y: p.y - (p.y - tx.y) * (newZ / tx.z) }
      scheduleRender()
    }
    overlay.addEventListener('mousedown', onDown)
    overlay.addEventListener('mousemove', onMove)
    overlay.addEventListener('mouseup', onUp)
    overlay.addEventListener('mouseleave', onUp)
    overlay.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      overlay.removeEventListener('mousedown', onDown)
      overlay.removeEventListener('mousemove', onMove)
      overlay.removeEventListener('mouseup', onUp)
      overlay.removeEventListener('mouseleave', onUp)
      overlay.removeEventListener('wheel', onWheel)
    }
  }, [interactive, scheduleRender])

  useEffect(() => {
    if (!interactive) return
    const overlay = overlayCanvasRef.current
    if (!overlay) return
    const getDist = (t1, t2) => Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY)
    const getMid = (t1, t2) => ({ x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 })
    const getPos = t => { const r = overlay.getBoundingClientRect(); return { x: t.clientX - r.left, y: t.clientY - r.top } }
    const onStart = e => {
      e.preventDefault()
      if (e.touches.length === 1) {
        const p = getPos(e.touches[0])
        S.current.dragOrigin = { mx: p.x, my: p.y, tx: S.current.tx.x, ty: S.current.tx.y }
        S.current.lastTouchDist = null
      } else if (e.touches.length === 2) {
        S.current.dragOrigin = null
        S.current.lastTouchDist = getDist(e.touches[0], e.touches[1])
      }
    }
    const onMove = e => {
      e.preventDefault()
      if (e.touches.length === 1 && S.current.dragOrigin) {
        const p = getPos(e.touches[0]), d = S.current.dragOrigin
        S.current.tx = { ...S.current.tx, x: d.tx + (p.x - d.mx), y: d.ty + (p.y - d.my) }
        scheduleRender()
      } else if (e.touches.length === 2 && S.current.lastTouchDist) {
        const newDist = getDist(e.touches[0], e.touches[1])
        const mid = getMid(e.touches[0], e.touches[1])
        const r = overlay.getBoundingClientRect()
        const m = { x: mid.x - r.left, y: mid.y - r.top }
        const { tx } = S.current
        const newZ = Math.min(Math.max(tx.z * (newDist / S.current.lastTouchDist), 0.3), 8)
        S.current.tx = { z: newZ, x: m.x - (m.x - tx.x) * (newZ / tx.z), y: m.y - (m.y - tx.y) * (newZ / tx.z) }
        S.current.lastTouchDist = newDist
        scheduleRender()
      }
    }
    const onEnd = e => { e.preventDefault(); S.current.dragOrigin = null; if (e.touches.length < 2) S.current.lastTouchDist = null }
    overlay.addEventListener('touchstart', onStart, { passive: false })
    overlay.addEventListener('touchmove', onMove, { passive: false })
    overlay.addEventListener('touchend', onEnd, { passive: false })
    return () => {
      overlay.removeEventListener('touchstart', onStart)
      overlay.removeEventListener('touchmove', onMove)
      overlay.removeEventListener('touchend', onEnd)
    }
  }, [interactive, scheduleRender])

  return (
    <div ref={containerRef} style={{
      position: 'relative', width: '100%', height: canvasSize.height,
      background: '#0a0908', overflow: 'hidden',
      cursor: interactive ? 'grab' : 'default', touchAction: 'none',
    }}>
      <canvas ref={imageCanvasRef} width={canvasSize.width} height={canvasSize.height} style={{ position: 'absolute', top: 0, left: 0 }} />
      <canvas ref={overlayCanvasRef} width={canvasSize.width} height={canvasSize.height} style={{ position: 'absolute', top: 0, left: 0 }} />
    </div>
  )
}

// ─── Fullscreen canvas modal ──────────────────────────────────────────────────
function FullscreenCanvasModal({ imageUrl, holds, imageWidth, imageHeight, onClose }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fs-backdrop" onClick={onClose}>
      <div className="fs-modal" onClick={e => e.stopPropagation()}>
        <button className="fs-close" onClick={onClose}>✕</button>
        <div className="fs-hint">Pinch to zoom · Drag to pan</div>
        <WallCanvas imageUrl={imageUrl} holds={holds} imageWidth={imageWidth} imageHeight={imageHeight} maxHeight={window.innerHeight - 80} interactive={true} />
      </div>
    </div>
  )
}

// ─── Settings modal ───────────────────────────────────────────────────────────
function SettingsModal({ wallId, wallName, currentPrivacy, queryClient, onClose, onDeleteClick }) {
  const [privacy, setPrivacy] = useState(currentPrivacy)
  const [inviteUsername, setInviteUsername] = useState('')
  const [inviteError, setInviteError] = useState(null)
  const [inviteSuccess, setInviteSuccess] = useState(null)
  const [privacySaving, setPrivacySaving] = useState(false)
  const [inviteLoading, setInviteLoading] = useState(false)
  const navigate = useNavigate()

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ['members', wallId],
    queryFn: async () => (await api.get(`/walls/${wallId}/members`)).data,
  })

  const handlePrivacyChange = async (newPrivacy) => {
    if (newPrivacy === privacy) return
    setPrivacy(newPrivacy); setPrivacySaving(true)
    try {
      await api.patch(`/walls/${wallId}`, { privacy: newPrivacy })
      queryClient.invalidateQueries({ queryKey: ['wall', wallId] })
      queryClient.invalidateQueries({ queryKey: ['walls'] })
      queryClient.invalidateQueries({ queryKey: ['publicWalls'] })
    } catch { setPrivacy(currentPrivacy) }
    finally { setPrivacySaving(false) }
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
    } finally { setInviteLoading(false) }
  }

  const handleRemove = async (userId, username) => {
    if (!window.confirm(`Remove ${username} from this wall?`)) return
    try {
      await api.delete(`/walls/${wallId}/members/${userId}`)
      queryClient.invalidateQueries({ queryKey: ['members', wallId] })
    } catch (err) { alert(err.response?.data?.detail || 'Failed to remove member') }
  }

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="settings-modal">
        <div className="settings-modal-header">
          <div className="settings-modal-title">Wall Settings</div>
          <button className="settings-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="settings-modal-body">
          <div className="sm-section">
            <div className="sm-section-title">Image</div>
            <button className="sm-action-btn" onClick={() => { onClose(); navigate(`/walls/${wallId}`) }}>↑ Re-upload Wall Image</button>
          </div>
          <div className="sm-section">
            <div className="sm-section-title">Privacy</div>
            <div className="privacy-toggle">
              <div className={`privacy-opt ${privacy === 'Private' ? 'selected' : ''}`} onClick={() => handlePrivacyChange('Private')}>
                <span className="privacy-opt-label">🔒 Private</span>
                <span className="privacy-opt-desc">Invite only</span>
              </div>
              <div className={`privacy-opt ${privacy === 'Public' ? 'selected' : ''}`} onClick={() => handlePrivacyChange('Public')}>
                <span className="privacy-opt-label">🌐 Public</span>
                <span className="privacy-opt-desc">Anyone can view & add routes</span>
              </div>
            </div>
            {privacySaving && <div className="sm-saving">Saving...</div>}
          </div>
          <div className="sm-section">
            <div className="sm-section-title">Members</div>
            <div className="invite-row">
              <input className="invite-input" placeholder="Username to invite..." value={inviteUsername}
                onChange={e => setInviteUsername(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleInvite()} />
              <button className="invite-btn" onClick={handleInvite} disabled={inviteLoading}>{inviteLoading ? '...' : '+ Add'}</button>
            </div>
            {inviteError && <div className="invite-error">{inviteError}</div>}
            {inviteSuccess && <div className="invite-success">{inviteSuccess}</div>}
            <div className="members-list">
              {membersLoading ? <div className="members-loading">Loading...</div> : members?.map(m => (
                <div key={m.user_id} className="member-row">
                  <div className="member-info">
                    <span className="member-name">{m.username}</span>
                    <span className={`member-role ${m.role === 'owner' ? 'role-owner' : 'role-member'}`}>{m.role}</span>
                  </div>
                  {m.role !== 'owner' && <button className="remove-btn" onClick={() => handleRemove(m.user_id, m.username)}>✕</button>}
                </div>
              ))}
            </div>
          </div>
          <div className="sm-section sm-danger-section">
            <div className="sm-section-title" style={{ color: 'rgba(255,80,80,0.5)' }}>Danger Zone</div>
            <button className="delete-wall-btn" onClick={() => { onClose(); onDeleteClick() }}>Delete Wall</button>
            <div className="danger-hint">Permanently removes this wall, all routes, and the uploaded image.</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Delete confirmation modal ────────────────────────────────────────────────
function DeleteWallModal({ wallName, onClose, onConfirm, loading }) {
  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-title">Delete Wall</div>
        <div className="modal-sub">This action is permanent and cannot be undone.</div>
        <div className="modal-warning-box">
          <p className="modal-warning-text">Deleting <strong style={{ color: '#f5f0eb' }}>{wallName}</strong> will permanently remove the wall, all its routes, ascent logs, and the uploaded image.</p>
        </div>
        <div className="modal-actions">
          <button className="modal-cancel" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="modal-delete" onClick={onConfirm} disabled={loading}>{loading ? 'Deleting...' : 'Delete Wall'}</button>
        </div>
      </div>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }

  .detail-root { min-height: 100vh; min-height: 100dvh; background: #0f0e0d; font-family: 'DM Sans', sans-serif; color: #f5f0eb; }
  .detail-root::before {
    content: ''; position: fixed; inset: 0; pointer-events: none; z-index: 0;
    background-image: radial-gradient(ellipse 60% 40% at 80% 10%, rgba(255,100,40,0.06) 0%, transparent 60%),
      url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");
  }

  .gear-btn { background: none; border: 1px solid rgba(255,255,255,0.08); border-radius: 2px; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; color: rgba(245,240,235,0.4); cursor: pointer; transition: all 0.2s; font-size: 16px; }
  .gear-btn:hover { border-color: rgba(255,100,40,0.4); color: #ff6428; }

  .detail-main { position: relative; z-index: 1; max-width: 760px; margin: 0 auto; padding: 20px 16px 80px; }

  .detail-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
  .detail-title { font-family: 'Bebas Neue', sans-serif; font-size: 36px; line-height: 0.9; letter-spacing: 0.03em; }
  .detail-title-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 6px; }
  .detail-subtitle { font-size: 11px; font-weight: 300; color: rgba(245,240,235,0.35); }
  .new-route-btn { background: #ff6428; border: none; border-radius: 2px; padding: 10px 16px; font-family: 'Bebas Neue', sans-serif; font-size: 15px; letter-spacing: 0.08em; color: #0f0e0d; cursor: pointer; transition: background 0.2s; white-space: nowrap; min-height: 44px; flex-shrink: 0; }
  .new-route-btn:hover { background: #ff7a40; }

  .privacy-badge { font-size: 9px; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; padding: 3px 7px; border-radius: 2px; }
  .privacy-badge-public { background: rgba(107,203,119,0.1); color: rgba(107,203,119,0.7); border: 1px solid rgba(107,203,119,0.2); }
  .privacy-badge-private { background: rgba(255,255,255,0.04); color: rgba(245,240,235,0.3); border: 1px solid rgba(255,255,255,0.08); }

  .wall-thumbnail-wrap { border-radius: 2px; border: 1px solid rgba(255,255,255,0.07); overflow: hidden; margin-bottom: 20px; cursor: pointer; position: relative; transition: border-color 0.2s; }
  .wall-thumbnail-wrap:hover { border-color: rgba(255,100,40,0.3); }
  .wall-thumbnail-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0); transition: background 0.2s; pointer-events: none; }
  .wall-thumbnail-wrap:hover .wall-thumbnail-overlay { background: rgba(0,0,0,0.25); }
  .wall-thumbnail-icon { background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.15); border-radius: 2px; padding: 6px 10px; font-size: 11px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(255,255,255,0.7); opacity: 0; transition: opacity 0.2s; }
  .wall-thumbnail-wrap:hover .wall-thumbnail-icon { opacity: 1; }
  .wall-thumbnail-loading { height: 100px; display: flex; align-items: center; justify-content: center; background: #161412; gap: 10px; color: rgba(245,240,235,0.25); font-size: 12px; font-weight: 300; }
  .thumbnail-spinner { width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.06); border-top-color: #ff6428; border-radius: 50%; animation: spin 0.8s linear infinite; }

  .detail-divider { height: 1px; background: rgba(255,255,255,0.06); margin-bottom: 20px; }

  .view-tabs { display: flex; gap: 4px; margin-bottom: 12px; overflow-x: auto; padding-bottom: 2px; }
  .view-tab { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 2px; padding: 7px 14px; font-family: 'DM Sans', sans-serif; font-size: 12px; font-weight: 400; color: rgba(245,240,235,0.35); cursor: pointer; transition: all 0.15s; white-space: nowrap; min-height: 36px; flex-shrink: 0; }
  .view-tab:hover { color: rgba(245,240,235,0.6); border-color: rgba(255,255,255,0.14); }
  .view-tab.active { background: rgba(255,100,40,0.1); border-color: rgba(255,100,40,0.35); color: #ff6428; }

  .filter-bar { display: flex; gap: 8px; margin-bottom: 14px; width: 100%; box-sizing: border-box; }
  .filter-input { flex: 1; min-width: 0; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 2px; padding: 10px 12px; font-size: 14px; font-family: 'DM Sans', sans-serif; font-weight: 300; color: #f5f0eb; outline: none; transition: border-color 0.2s; min-height: 44px; box-sizing: border-box; }
  .filter-input:focus { border-color: rgba(255,100,40,0.4); }
  .filter-input::placeholder { color: rgba(245,240,235,0.2); }
  .filter-select { flex-shrink: 0; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 2px; padding: 10px 8px; font-size: 13px; font-family: 'DM Sans', sans-serif; font-weight: 300; color: #f5f0eb; outline: none; transition: border-color 0.2s; cursor: pointer; min-height: 44px; box-sizing: border-box; appearance: none; -webkit-appearance: none; }
  .filter-select:focus { border-color: rgba(255,100,40,0.4); }
  .filter-select option { background: #161412; }

  .routes-list { display: flex; flex-direction: column; gap: 8px; }

  .route-card { border-radius: 2px; padding: 14px 16px; display: flex; align-items: center; gap: 12px; cursor: pointer; transition: border-color 0.2s, background 0.2s; position: relative; overflow: hidden; min-height: 64px; background: #161412; border: 1px solid rgba(255,255,255,0.06); }
  .route-card.sent { background: rgba(107,203,119,0.05); border-color: rgba(107,203,119,0.15); }
  .route-card::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--grade-color, #ff6428); opacity: 0; transition: opacity 0.2s; }
  .route-card:hover { border-color: rgba(255,255,255,0.12); background: #1a1714; }
  .route-card.sent:hover { background: rgba(107,203,119,0.08); border-color: rgba(107,203,119,0.25); }
  .route-card:hover::before { opacity: 1; }

  .sent-check { font-size: 13px; color: #6bcb77; flex-shrink: 0; }
  .grade-badge { font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 0.04em; min-width: 44px; text-align: center; padding: 6px 8px; border-radius: 2px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); flex-shrink: 0; }
  .route-card-body { flex: 1; min-width: 0; }
  .route-card-name { font-size: 14px; font-weight: 500; color: #f5f0eb; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .route-card-meta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .route-meta-item { font-size: 11px; font-weight: 300; color: rgba(245,240,235,0.35); display: flex; align-items: center; gap: 4px; }
  .route-meta-dot { width: 3px; height: 3px; border-radius: 50%; background: rgba(255,100,40,0.4); }
  .ascent-count { font-family: 'Bebas Neue', sans-serif; font-size: 16px; color: rgba(245,240,235,0.25); flex-shrink: 0; text-align: center; }
  .ascent-count span { font-family: 'DM Sans', sans-serif; font-size: 9px; font-weight: 300; display: block; letter-spacing: 0.08em; text-transform: uppercase; margin-top: 1px; }
  .route-arrow { color: rgba(255,100,40,0.2); font-size: 14px; transition: color 0.2s; flex-shrink: 0; }
  .route-card:hover .route-arrow { color: #ff6428; }

  .skeleton-route { background: #161412; border: 1px solid rgba(255,255,255,0.04); border-radius: 2px; padding: 14px 16px; display: flex; gap: 14px; align-items: center; }
  .skeleton-box { border-radius: 2px; background: linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 100%); background-size: 200% 100%; animation: shimmer 1.4s infinite; }
  @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

  .routes-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 48px 24px; border: 1px dashed rgba(255,255,255,0.07); border-radius: 2px; color: rgba(245,240,235,0.2); }
  .routes-empty-icon { font-size: 28px; opacity: 0.3; }
  .routes-empty p { font-size: 13px; font-weight: 300; text-align: center; }

  .fs-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.92); z-index: 50; display: flex; align-items: center; justify-content: center; animation: fadeIn 0.15s ease; }
  .fs-modal { position: relative; width: 100%; max-width: 900px; padding: 0 16px; }
  .fs-close { position: absolute; top: -44px; right: 16px; background: none; border: 1px solid rgba(255,255,255,0.12); border-radius: 2px; width: 36px; height: 36px; color: rgba(245,240,235,0.5); cursor: pointer; font-size: 14px; transition: all 0.2s; z-index: 1; }
  .fs-close:hover { border-color: rgba(255,100,40,0.4); color: #ff6428; }
  .fs-hint { position: absolute; top: -44px; left: 16px; font-size: 11px; font-weight: 300; color: rgba(245,240,235,0.2); line-height: 36px; }

  .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); z-index: 30; display: flex; align-items: flex-end; justify-content: center; animation: fadeIn 0.15s ease; padding: 0; }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes spin { to { transform: rotate(360deg); } }

  .settings-modal { background: #161412; border: 1px solid rgba(255,255,255,0.08); border-radius: 2px 2px 0 0; width: 100%; max-width: 560px; max-height: 85dvh; display: flex; flex-direction: column; animation: sheetUp 0.25s ease; }
  @keyframes sheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
  .settings-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 20px 20px 0; flex-shrink: 0; }
  .settings-modal-title { font-family: 'Bebas Neue', sans-serif; font-size: 22px; letter-spacing: 0.06em; color: #f5f0eb; }
  .settings-modal-close { background: none; border: none; color: rgba(245,240,235,0.3); cursor: pointer; font-size: 16px; padding: 4px; min-height: 36px; min-width: 36px; transition: color 0.15s; }
  .settings-modal-close:hover { color: #ff6428; }
  .settings-modal-body { overflow-y: auto; padding: 16px 20px 32px; display: flex; flex-direction: column; }
  .sm-section { padding: 16px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
  .sm-section:last-child { border-bottom: none; }
  .sm-section-title { font-family: 'Bebas Neue', sans-serif; font-size: 13px; letter-spacing: 0.12em; color: rgba(245,240,235,0.3); margin-bottom: 12px; }
  .sm-saving { font-size: 11px; font-weight: 300; color: rgba(245,240,235,0.3); margin-top: 8px; }
  .sm-action-btn { background: none; border: 1px solid rgba(255,255,255,0.1); border-radius: 2px; padding: 10px 14px; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 400; color: rgba(245,240,235,0.5); cursor: pointer; transition: all 0.2s; min-height: 40px; width: 100%; text-align: left; }
  .sm-action-btn:hover { border-color: rgba(255,100,40,0.4); color: #ff6428; }
  .privacy-toggle { display: flex; gap: 8px; }
  .privacy-opt { flex: 1; padding: 10px 12px; border-radius: 2px; cursor: pointer; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.02); transition: all 0.15s; }
  .privacy-opt-label { font-size: 13px; font-weight: 500; color: rgba(245,240,235,0.5); display: block; margin-bottom: 2px; }
  .privacy-opt-desc { font-size: 10px; font-weight: 300; color: rgba(245,240,235,0.25); display: block; }
  .privacy-opt.selected { border-color: rgba(255,100,40,0.4); background: rgba(255,100,40,0.06); }
  .privacy-opt.selected .privacy-opt-label { color: #ff6428; }
  .privacy-opt.selected .privacy-opt-desc { color: rgba(255,100,40,0.45); }
  .invite-row { display: flex; gap: 8px; margin-bottom: 8px; }
  .invite-input { flex: 1; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 2px; padding: 10px 12px; font-size: 14px; font-family: 'DM Sans', sans-serif; font-weight: 300; color: #f5f0eb; outline: none; transition: border-color 0.2s; min-height: 44px; }
  .invite-input:focus { border-color: rgba(255,100,40,0.4); }
  .invite-input::placeholder { color: rgba(245,240,235,0.2); }
  .invite-btn { background: rgba(255,100,40,0.1); border: 1px solid rgba(255,100,40,0.25); border-radius: 2px; padding: 10px 14px; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500; color: #ff6428; cursor: pointer; transition: all 0.2s; white-space: nowrap; min-height: 44px; }
  .invite-btn:hover { background: rgba(255,100,40,0.18); }
  .invite-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .invite-error { font-size: 11px; color: #ff6060; margin-bottom: 8px; }
  .invite-success { font-size: 11px; color: #6bcb77; margin-bottom: 8px; }
  .members-list { display: flex; flex-direction: column; gap: 4px; margin-top: 4px; }
  .member-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; border-radius: 2px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); }
  .member-info { display: flex; align-items: center; gap: 8px; }
  .member-name { font-size: 13px; font-weight: 400; color: #f5f0eb; }
  .member-role { font-size: 9px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; padding: 2px 6px; border-radius: 2px; }
  .role-owner { background: rgba(255,100,40,0.1); color: rgba(255,100,40,0.6); border: 1px solid rgba(255,100,40,0.2); }
  .role-member { background: rgba(255,255,255,0.04); color: rgba(245,240,235,0.3); border: 1px solid rgba(255,255,255,0.06); }
  .remove-btn { background: none; border: none; color: rgba(245,240,235,0.2); cursor: pointer; font-size: 13px; padding: 6px; border-radius: 2px; transition: color 0.15s, background 0.15s; min-height: 32px; min-width: 32px; }
  .remove-btn:hover { color: #ff6060; background: rgba(255,60,60,0.08); }
  .members-loading { font-size: 12px; font-weight: 300; color: rgba(245,240,235,0.3); padding: 8px 0; }
  .sm-danger-section { background: rgba(255,60,60,0.02); }
  .delete-wall-btn { width: 100%; background: none; border: 1px solid rgba(255,60,60,0.2); border-radius: 2px; padding: 10px 14px; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500; color: rgba(255,80,80,0.6); cursor: pointer; transition: all 0.2s; text-align: left; min-height: 44px; }
  .delete-wall-btn:hover { background: rgba(255,60,60,0.08); border-color: rgba(255,60,60,0.4); color: #ff5050; }
  .danger-hint { font-size: 10px; font-weight: 300; color: rgba(245,240,235,0.2); margin-top: 8px; line-height: 1.5; }

  .modal { background: #161412; border: 1px solid rgba(255,255,255,0.08); border-radius: 2px; padding: 28px; width: min(400px, calc(100vw - 32px)); animation: scaleIn 0.2s ease; align-self: center; }
  @keyframes scaleIn { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
  .modal-title { font-family: 'Bebas Neue', sans-serif; font-size: 26px; letter-spacing: 0.05em; color: #f5f0eb; margin-bottom: 6px; }
  .modal-sub { font-size: 12px; font-weight: 300; color: rgba(245,240,235,0.35); margin-bottom: 18px; }
  .modal-warning-box { background: rgba(255,60,60,0.06); border: 1px solid rgba(255,60,60,0.12); border-radius: 2px; padding: 14px 16px; margin-bottom: 22px; }
  .modal-warning-text { font-size: 13px; font-weight: 300; color: rgba(245,240,235,0.6); line-height: 1.6; }
  .modal-actions { display: flex; gap: 8px; justify-content: flex-end; }
  .modal-cancel { background: none; border: 1px solid rgba(255,255,255,0.08); border-radius: 2px; padding: 10px 20px; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 300; color: rgba(245,240,235,0.4); cursor: pointer; transition: all 0.2s; min-height: 44px; }
  .modal-cancel:hover { border-color: rgba(255,255,255,0.2); color: rgba(245,240,235,0.7); }
  .modal-cancel:disabled { opacity: 0.5; cursor: not-allowed; }
  .modal-delete { background: rgba(255,60,60,0.12); border: 1px solid rgba(255,60,60,0.3); border-radius: 2px; padding: 10px 24px; font-family: 'Bebas Neue', sans-serif; font-size: 16px; letter-spacing: 0.08em; color: #ff5050; cursor: pointer; transition: all 0.2s; min-height: 44px; }
  .modal-delete:hover { background: rgba(255,60,60,0.2); border-color: rgba(255,60,60,0.5); }
  .modal-delete:disabled { opacity: 0.5; cursor: not-allowed; }

  .page-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 100px 40px; color: rgba(245,240,235,0.3); }
  .loading-spinner { width: 28px; height: 28px; border: 2px solid rgba(255,255,255,0.08); border-top-color: #ff6428; border-radius: 50%; animation: spin 0.8s linear infinite; }

  @media (min-width: 600px) {
    .detail-main { padding: 28px 32px 80px; }
    .detail-title { font-size: 44px; }
    .modal-backdrop { align-items: center; padding: 16px; }
    .settings-modal { border-radius: 2px; max-height: 80vh; }
    @keyframes sheetUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  }
`

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function WallDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const currentUsername = getUsername()
  const [system] = useGradeSystem()

  const [search, setSearch] = useState('')
  const [gradeFilter, setGradeFilter] = useState('All')
  const [sortBy, setSortBy] = useState('default')
  const [viewTab, setViewTab] = useState('all')
  const [showSettings, setShowSettings] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showFullscreen, setShowFullscreen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // DB-backed relations
  const { isLiked, isTodo } = useRouteRelations(id)

  const { data: wall, isLoading: wallLoading } = useQuery({
    queryKey: ['wall', id],
    queryFn: async () => (await api.get(`/walls/${id}`)).data,
  })
  const { data: holds } = useQuery({
    queryKey: ['holds', id],
    queryFn: async () => (await api.get(`/walls/${id}/holds`)).data,
  })
  const { data: routes, isLoading: routesLoading } = useQuery({
    queryKey: ['routes', id],
    queryFn: async () => (await api.get(`/walls/${id}/routes`)).data,
  })
  const { data: mySentIds } = useQuery({
    queryKey: ['myAscents', id],
    queryFn: async () => (await api.get(`/walls/${id}/routes/my_ascents`)).data,
    select: data => new Set(data),
  })
  const { data: imageUrl } = useQuery({
    queryKey: ['image', id],
    queryFn: async () => {
      const res = await api.get(`/walls/${id}/image`, { responseType: 'blob' })
      return URL.createObjectURL(res.data)
    },
    enabled: !!wall?.image_path,
    staleTime: Infinity,
  })
  const { data: imageDimensions } = useQuery({
    queryKey: ['imageDimensions', id],
    queryFn: () => new Promise(resolve => {
      const img = new window.Image()
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
      img.src = imageUrl
    }),
    enabled: !!imageUrl,
    staleTime: Infinity,
  })

  const handleDeleteWall = async () => {
    setDeleteLoading(true)
    try {
      await api.delete(`/walls/${id}`)
      queryClient.invalidateQueries({ queryKey: ['walls'] })
      queryClient.invalidateQueries({ queryKey: ['publicWalls'] })
      navigate('/home')
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete wall')
      setDeleteLoading(false)
    }
  }

  const filteredRoutes = useMemo(() => {
    let list = routes ?? []
    if (viewTab === 'sent')  list = list.filter(r => mySentIds?.has(r.id))
    else if (viewTab === 'liked') list = list.filter(r => isLiked(r.id))
    else if (viewTab === 'todo')  list = list.filter(r => isTodo(r.id))
    list = list.filter(r =>
      r.name.toLowerCase().includes(search.toLowerCase()) &&
      (gradeFilter === 'All' || r.grade === gradeFilter)
    )
    if (sortBy === 'sends')   list = [...list].sort((a, b) => (b.n_repeats ?? 0) - (a.n_repeats ?? 0))
    if (sortBy === 'quality') list = [...list].sort((a, b) => (b.avg_quality ?? 0) - (a.avg_quality ?? 0))
    return list
  }, [routes, viewTab, search, gradeFilter, sortBy, mySentIds, isLiked, isTodo])

  const isOwner = wall?.created_by === currentUsername
  const sentCount  = mySentIds ? (routes ?? []).filter(r => mySentIds.has(r.id)).length : 0
  const likedCount = (routes ?? []).filter(r => isLiked(r.id)).length
  const todoCount  = (routes ?? []).filter(r => isTodo(r.id)).length

  return (
    <>
      <style>{styles}</style>
      <div className="detail-root">

        {showSettings && isOwner && wall && (
          <SettingsModal wallId={id} wallName={wall.name} currentPrivacy={wall.privacy}
            queryClient={queryClient} onClose={() => setShowSettings(false)} onDeleteClick={() => setShowDeleteModal(true)} />
        )}
        {showDeleteModal && (
          <DeleteWallModal wallName={wall?.name ?? `Wall #${id}`}
            onClose={() => setShowDeleteModal(false)} onConfirm={handleDeleteWall} loading={deleteLoading} />
        )}
        {showFullscreen && imageUrl && imageDimensions && holds && (
          <FullscreenCanvasModal imageUrl={imageUrl} holds={holds}
            imageWidth={imageDimensions.width} imageHeight={imageDimensions.height}
            onClose={() => setShowFullscreen(false)} />
        )}

        <Navbar backTo="/home">
          {isOwner && (
            <button className="gear-btn" onClick={() => setShowSettings(true)} title="Wall settings">⚙</button>
          )}
        </Navbar>

        <main className="detail-main">
          {wallLoading ? (
            <div className="page-loading"><div className="loading-spinner" /></div>
          ) : (
            <>
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
                    {routes != null ? `${routes.length} route${routes.length !== 1 ? 's' : ''} · ${holds?.length ?? 0} holds mapped` : 'Loading...'}
                  </p>
                </div>
                <button className="new-route-btn" onClick={() => navigate(`/walls/${id}/route/new`)}>+ New Route</button>
              </div>

              {wall?.image_path && (
                <div className="wall-thumbnail-wrap" onClick={() => imageUrl && imageDimensions && holds && setShowFullscreen(true)}>
                  {imageUrl && imageDimensions && holds ? (
                    <>
                      <WallCanvas imageUrl={imageUrl} holds={holds} imageWidth={imageDimensions.width} imageHeight={imageDimensions.height} maxHeight={160} interactive={false} />
                      <div className="wall-thumbnail-overlay"><div className="wall-thumbnail-icon">View Wall</div></div>
                    </>
                  ) : (
                    <div className="wall-thumbnail-loading"><div className="thumbnail-spinner" />Loading image...</div>
                  )}
                </div>
              )}

              <div className="detail-divider" />

              {/* View tabs */}
              <div className="view-tabs">
                <button className={`view-tab ${viewTab === 'all' ? 'active' : ''}`} onClick={() => setViewTab('all')}>
                  All {routes ? `(${routes.length})` : ''}
                </button>
                <button className={`view-tab ${viewTab === 'sent' ? 'active' : ''}`} onClick={() => setViewTab('sent')}>
                  ✓ Sent{sentCount > 0 ? ` (${sentCount})` : ''}
                </button>
                <button className={`view-tab ${viewTab === 'liked' ? 'active' : ''}`} onClick={() => setViewTab('liked')}>
                  ♥ Liked{likedCount > 0 ? ` (${likedCount})` : ''}
                </button>
                <button className={`view-tab ${viewTab === 'todo' ? 'active' : ''}`} onClick={() => setViewTab('todo')}>
                  ★ Todo{todoCount > 0 ? ` (${todoCount})` : ''}
                </button>
              </div>

              {/* Filter + sort bar */}
              <div className="filter-bar">
                <input className="filter-input" placeholder="Search routes..." value={search} onChange={e => setSearch(e.target.value)} />
                <select className="filter-select" value={gradeFilter} onChange={e => setGradeFilter(e.target.value)}>
                  <option value="All">All Grades</option>
                  {GRADES.map(g => <option key={g} value={g}>{convertGrade(g, system)}</option>)}
                </select>
                <select className="filter-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                  <option value="default">Default</option>
                  <option value="sends">Most Sends</option>
                  <option value="quality">Top Rated</option>
                </select>
              </div>

              {/* Route list */}
              <div className="routes-list">
                {routesLoading ? (
                  [1,2,3].map(i => (
                    <div key={i} className="skeleton-route">
                      <div className="skeleton-box" style={{ width: 44, height: 44, flexShrink: 0 }} />
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div className="skeleton-box" style={{ height: 14, width: '55%' }} />
                        <div className="skeleton-box" style={{ height: 10, width: '35%' }} />
                      </div>
                    </div>
                  ))
                ) : filteredRoutes.length === 0 ? (
                  <div className="routes-empty">
                    <div className="routes-empty-icon">◻</div>
                    <p>
                      {viewTab === 'sent'  ? 'No sends yet — get on the wall' :
                       viewTab === 'liked' ? 'No liked routes yet' :
                       viewTab === 'todo'  ? 'No routes on your todo list' :
                       routes?.length === 0 ? 'No routes yet — create the first one' :
                       'No routes match your filters'}
                    </p>
                  </div>
                ) : (
                  filteredRoutes.map(route => {
                    const color = gradeColor(route.grade)
                    const isSent = mySentIds?.has(route.id) ?? false
                    return (
                      <div
                        key={route.id}
                        className={`route-card ${isSent ? 'sent' : ''}`}
                        style={{ '--grade-color': color }}
                        onClick={() => navigate(`/walls/${id}/routes/${route.id}`)}
                      >
                        {isSent && <div className="sent-check">✓</div>}
                        <div className="grade-badge" style={{ color }}>{convertGrade(route.grade, system)}</div>
                        <div className="route-card-body">
                          <div className="route-card-name">{route.name}</div>
                          <div className="route-card-meta">
                            <div className="route-meta-item"><div className="route-meta-dot" />{route.created_by}</div>
                            <div className="route-meta-item"><div className="route-meta-dot" />{formatDate(route.created_at)}</div>
                            {route.avg_quality != null && (
                              <div className="route-meta-item">
                                <div className="route-meta-dot" />
                                {'★'.repeat(Math.round(route.avg_quality))}{'☆'.repeat(5 - Math.round(route.avg_quality))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="ascent-count">{route.n_repeats ?? route.ascent_count ?? 0}<span>sends</span></div>
                        <SaveButtons
                          routeId={route.id}
                          wallId={id}
                          onClick={e => e.stopPropagation()}
                        />
                        <div className="route-arrow">→</div>
                      </div>
                    )
                  })
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </>
  )
}
