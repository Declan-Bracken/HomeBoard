import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '../api/axios'

// ─── Constants ────────────────────────────────────────────────────────────────
const ROLES = [null, 'any', 'foot', 'start', 'end']
const ROLE_COLORS = {
  any:   { fill: 'rgba(255,100,40,0.35)',  stroke: '#ff6428' },
  start: { fill: 'rgba(64,255,128,0.35)',  stroke: '#40ff80' },
  end:   { fill: 'rgba(255,64,64,0.35)',   stroke: '#ff4040' },
  foot:  { fill: 'rgba(100,200,255,0.35)', stroke: '#64c8ff' },
}
const ROLE_LABELS = { any: 'Any', start: 'Start', end: 'End', foot: 'Foot' }
const GRADES = ['Unknown','V0','V1','V2','V3','V4','V5','V6','V7','V8','V9','V10','V11','V12','V15','V16','V17']

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

// ─── Hit test ─────────────────────────────────────────────────────────────────
function hitTest(screenX, screenY, polygon, imgScale, tx) {
  if (!polygon || polygon.length < 3) return false
  const pts = polygon.map(p => ({
    x: p.x * imgScale * tx.z + tx.x,
    y: p.y * imgScale * tx.z + tx.y,
  }))
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y
    if ((yi > screenY) !== (yj > screenY) &&
        screenX < ((xj - xi) * (screenY - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

// ─── Canvas renderer ──────────────────────────────────────────────────────────
function renderCanvas(imageCanvas, overlayCanvas, img, holds, holdRolesRef, state) {
  if (!imageCanvas || !overlayCanvas) return
  const { tx, imgScale, origWidth, origHeight } = state
  const holdRoles = holdRolesRef.current

  const ic = imageCanvas.getContext('2d')
  ic.clearRect(0, 0, imageCanvas.width, imageCanvas.height)
  if (img) {
    ic.drawImage(img, tx.x, tx.y, origWidth * imgScale * tx.z, origHeight * imgScale * tx.z)
    ic.fillStyle = 'rgba(0,0,0,0.45)'
    ic.fillRect(0, 0, imageCanvas.width, imageCanvas.height)
  }

  const oc = overlayCanvas.getContext('2d')
  oc.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height)

  for (const hold of holds) {
    const pts = hold.polygon
    if (!pts || pts.length < 2) continue
    const role = holdRoles[hold.id] ?? null

    oc.beginPath()
    oc.moveTo(pts[0].x * imgScale * tx.z + tx.x, pts[0].y * imgScale * tx.z + tx.y)
    for (let i = 1; i < pts.length; i++) {
      oc.lineTo(pts[i].x * imgScale * tx.z + tx.x, pts[i].y * imgScale * tx.z + tx.y)
    }
    oc.closePath()

    if (role) {
      const colors = ROLE_COLORS[role]
      ic.save()
      ic.globalCompositeOperation = 'destination-out'
      ic.beginPath()
      ic.moveTo(pts[0].x * imgScale * tx.z + tx.x, pts[0].y * imgScale * tx.z + tx.y)
      for (let i = 1; i < pts.length; i++) {
        ic.lineTo(pts[i].x * imgScale * tx.z + tx.x, pts[i].y * imgScale * tx.z + tx.y)
      }
      ic.closePath()
      ic.fill()
      ic.restore()

      ic.save()
      ic.beginPath()
      ic.moveTo(pts[0].x * imgScale * tx.z + tx.x, pts[0].y * imgScale * tx.z + tx.y)
      for (let i = 1; i < pts.length; i++) {
        ic.lineTo(pts[i].x * imgScale * tx.z + tx.x, pts[i].y * imgScale * tx.z + tx.y)
      }
      ic.closePath()
      ic.clip()
      if (img) ic.drawImage(img, tx.x, tx.y, origWidth * imgScale * tx.z, origHeight * imgScale * tx.z)
      ic.restore()

      oc.fillStyle = colors.fill
      oc.fill()
      oc.strokeStyle = colors.stroke
      oc.lineWidth = 2
      oc.shadowColor = colors.stroke
      oc.shadowBlur = 8
      oc.stroke()
      oc.shadowBlur = 0
    } else {
      oc.strokeStyle = 'rgba(255,255,255,0.3)'
      oc.lineWidth = 1
      oc.stroke()
    }
  }
}

// ─── Route Canvas ─────────────────────────────────────────────────────────────
function RouteCanvas({ imageUrl, holds, holdRolesRef, onHoldClick, imageWidth, imageHeight, scheduleRenderRef }) {
  const containerRef = useRef(null)
  const imageCanvasRef = useRef(null)
  const overlayCanvasRef = useRef(null)
  const rafRef = useRef(null)

  const S = useRef({
    tx: { x: 0, y: 0, z: 1 },
    imgScale: 1, origWidth: 1, origHeight: 1,
    img: null, isDragging: false, dragOrigin: null,
    lastTouchDist: null, touchMoved: false,
  })

  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 500 })

  const scheduleRender = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      renderCanvas(imageCanvasRef.current, overlayCanvasRef.current, S.current.img, holds, holdRolesRef, S.current)
    })
  }, [holds, holdRolesRef])

  useEffect(() => {
    if (scheduleRenderRef) scheduleRenderRef.current = scheduleRender
  }, [scheduleRender, scheduleRenderRef])

  useEffect(() => {
    downsampleImage(imageUrl, 1200).then(img => { S.current.img = img; scheduleRender() })
  }, [imageUrl, scheduleRender])

  useEffect(() => {
    if (!containerRef.current) return
    const w = containerRef.current.offsetWidth
    const maxH = Math.min(window.innerHeight * 0.75, 700)
    const s = Math.min(w / imageWidth, maxH / imageHeight)
    const displayW = imageWidth * s, displayH = imageHeight * s
    S.current.imgScale = s
    S.current.origWidth = imageWidth
    S.current.origHeight = imageHeight
    S.current.tx = { x: (w - displayW) / 2, y: 0, z: 1 }
    setCanvasSize({ width: w, height: displayH })
    scheduleRender()
  }, [imageWidth, imageHeight, scheduleRender])

  useEffect(() => { scheduleRender() }, [canvasSize, scheduleRender])

  // ── Shared tap handler ──
  const handleTap = useCallback((pos) => {
    const { imgScale, tx } = S.current
    for (let i = holds.length - 1; i >= 0; i--) {
      if (hitTest(pos.x, pos.y, holds[i].polygon, imgScale, tx)) {
        onHoldClick(holds[i].id)
        return
      }
    }
  }, [holds, onHoldClick])

  // ── Mouse events ──
  useEffect(() => {
    const overlay = overlayCanvasRef.current
    if (!overlay) return

    const getPos = (e) => { const r = overlay.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top } }

    const onMouseDown = (e) => {
      const pos = getPos(e)
      S.current.isDragging = false
      S.current.dragOrigin = { mx: pos.x, my: pos.y, tx: S.current.tx.x, ty: S.current.tx.y }
    }
    const onMouseMove = (e) => {
      if (!S.current.dragOrigin) return
      const pos = getPos(e), d = S.current.dragOrigin
      const dx = pos.x - d.mx, dy = pos.y - d.my
      if (Math.hypot(dx, dy) > 3) S.current.isDragging = true
      S.current.tx = { ...S.current.tx, x: d.tx + dx, y: d.ty + dy }
      scheduleRender()
    }
    const onMouseUp = () => { S.current.dragOrigin = null }
    const onClick = (e) => {
      if (S.current.isDragging) { S.current.isDragging = false; return }
      handleTap(getPos(e))
    }
    const onWheel = (e) => {
      e.preventDefault()
      const pos = getPos(e), { tx } = S.current
      const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08
      const newZ = Math.min(Math.max(tx.z * factor, 0.3), 8)
      S.current.tx = { z: newZ, x: pos.x - (pos.x - tx.x) * (newZ / tx.z), y: pos.y - (pos.y - tx.y) * (newZ / tx.z) }
      scheduleRender()
    }

    overlay.addEventListener('mousedown', onMouseDown)
    overlay.addEventListener('mousemove', onMouseMove)
    overlay.addEventListener('mouseup', onMouseUp)
    overlay.addEventListener('mouseleave', onMouseUp)
    overlay.addEventListener('click', onClick)
    overlay.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      overlay.removeEventListener('mousedown', onMouseDown)
      overlay.removeEventListener('mousemove', onMouseMove)
      overlay.removeEventListener('mouseup', onMouseUp)
      overlay.removeEventListener('mouseleave', onMouseUp)
      overlay.removeEventListener('click', onClick)
      overlay.removeEventListener('wheel', onWheel)
    }
  }, [holds, handleTap, scheduleRender])

  // ── Touch events ──
  useEffect(() => {
    const overlay = overlayCanvasRef.current
    if (!overlay) return

    const getPos = (t) => { const r = overlay.getBoundingClientRect(); return { x: t.clientX - r.left, y: t.clientY - r.top } }
    const getDist = (t1, t2) => Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY)
    const getMid = (t1, t2) => ({ x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 })

    const onTouchStart = (e) => {
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

    const onTouchMove = (e) => {
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

    const onTouchEnd = (e) => {
      e.preventDefault()
      if (e.changedTouches.length === 1 && e.touches.length === 0) {
        const wasTap = !S.current.touchMoved
        S.current.dragOrigin = null
        S.current.lastTouchDist = null
        if (wasTap) handleTap(getPos(e.changedTouches[0]))
      }
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
  }, [handleTap, scheduleRender])

  return (
    <div ref={containerRef} style={{
      position: 'relative', width: '100%', height: canvasSize.height,
      borderRadius: 2, border: '1px solid rgba(255,255,255,0.08)',
      background: '#0a0908', overflow: 'hidden', cursor: 'grab', touchAction: 'none',
    }}>
      <canvas ref={imageCanvasRef} width={canvasSize.width} height={canvasSize.height}
        style={{ position: 'absolute', top: 0, left: 0 }} />
      <canvas ref={overlayCanvasRef} width={canvasSize.width} height={canvasSize.height}
        style={{ position: 'absolute', top: 0, left: 0 }} />
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  .rc-root {
    min-height: 100vh;
    background-color: #0f0e0d;
    font-family: 'DM Sans', sans-serif;
    color: #f5f0eb;
  }

  .rc-root::before {
    content: '';
    position: fixed; inset: 0;
    background-image:
      radial-gradient(ellipse 60% 40% at 80% 10%, rgba(255,100,40,0.06) 0%, transparent 60%),
      url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");
    pointer-events: none; z-index: 0;
  }

  .rc-nav {
    position: sticky; top: 0; z-index: 10;
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 40px; height: 60px;
    background: rgba(15,14,13,0.85); backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }

  .rc-nav-left { display: flex; align-items: center; gap: 16px; }

  .nav-back {
    background: none; border: none;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 300;
    color: rgba(245,240,235,0.4); cursor: pointer; transition: color 0.2s; padding: 0;
    min-height: 44px;
  }
  .nav-back:hover { color: #ff6428; }
  .nav-divider { width: 1px; height: 16px; background: rgba(255,255,255,0.1); }
  .nav-logo { font-family: 'Bebas Neue', sans-serif; font-size: 24px; letter-spacing: 0.08em; color: #f5f0eb; }
  .nav-logo span { color: #ff6428; }

  .rc-layout {
    position: relative; z-index: 1;
    display: grid; grid-template-columns: 1fr 300px; gap: 24px;
    max-width: 1300px; margin: 0 auto; padding: 40px 40px 60px;
  }

  .rc-canvas-col { display: flex; flex-direction: column; gap: 12px; }
  .rc-canvas-header { display: flex; align-items: flex-end; justify-content: space-between; }
  .rc-title { font-family: 'Bebas Neue', sans-serif; font-size: 36px; letter-spacing: 0.03em; line-height: 1; }
  .rc-title span { color: #ff6428; }
  .rc-hint { font-size: 12px; font-weight: 300; color: rgba(245,240,235,0.25); }
  .rc-legend { display: flex; gap: 16px; flex-wrap: wrap; padding: 4px 0; }
  .legend-item { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; }
  .legend-dot { width: 10px; height: 10px; border-radius: 50%; border: 2px solid; }

  .rc-sidebar { display: flex; flex-direction: column; gap: 16px; padding-top: 52px; }

  .sidebar-section {
    background: #161412; border: 1px solid rgba(255,255,255,0.06);
    border-radius: 2px; padding: 20px; display: flex; flex-direction: column; gap: 14px;
  }

  .sidebar-section-title { font-family: 'Bebas Neue', sans-serif; font-size: 16px; letter-spacing: 0.08em; color: rgba(245,240,235,0.5); }
  .sidebar-field { display: flex; flex-direction: column; gap: 6px; }
  .sidebar-field label { font-size: 11px; font-weight: 500; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(245,240,235,0.35); }

  .sidebar-field input, .sidebar-field select {
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 2px; padding: 10px 12px; font-size: 13px;
    font-family: 'DM Sans', sans-serif; font-weight: 300; color: #f5f0eb;
    outline: none; transition: border-color 0.2s; width: 100%;
    min-height: 44px;
  }

  .sidebar-field input:focus, .sidebar-field select:focus { border-color: rgba(255,100,40,0.5); }
  .sidebar-field select option { background: #161412; }

  .hold-summary { display: flex; flex-direction: column; gap: 6px; }
  .hold-summary-row { display: flex; align-items: center; justify-content: space-between; font-size: 12px; font-weight: 300; }
  .hold-summary-label { display: flex; align-items: center; gap: 6px; }
  .hold-role-dot { width: 8px; height: 8px; border-radius: 50%; border: 1.5px solid; }
  .hold-count { font-family: 'Bebas Neue', sans-serif; font-size: 16px; letter-spacing: 0.06em; }
  .hold-summary-empty { font-size: 12px; font-weight: 300; color: rgba(245,240,235,0.2); text-align: center; padding: 8px 0; }

  .sidebar-error { font-size: 12px; color: #ff6060; background: rgba(255,60,60,0.08); border: 1px solid rgba(255,60,60,0.15); border-radius: 2px; padding: 8px 12px; }

  .submit-btn {
    width: 100%; padding: 13px; background: #ff6428; border: none; border-radius: 2px;
    font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 0.1em;
    color: #0f0e0d; cursor: pointer; transition: background 0.2s, transform 0.1s;
    min-height: 44px;
  }
  .submit-btn:hover { background: #ff7a40; }
  .submit-btn:active { transform: scale(0.99); }
  .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .loading-state {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 16px; padding: 80px 40px; border: 1px solid rgba(255,255,255,0.06);
    border-radius: 2px; background: #161412; grid-column: 1 / -1;
  }
  .loading-spinner { width: 32px; height: 32px; border: 2px solid rgba(255,255,255,0.08); border-top-color: #ff6428; border-radius: 50%; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .loading-label { font-size: 13px; font-weight: 300; color: rgba(245,240,235,0.4); }

  @media (max-width: 860px) {
    .rc-layout { grid-template-columns: 1fr; }
    .rc-sidebar { padding-top: 0; }
  }
`

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function RouteCreatePage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [grade, setGrade] = useState('Unknown')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [imageUrl, setImageUrl] = useState(null)
  const [imageDimensions, setImageDimensions] = useState(null)

  const holdRolesRef = useRef({})
  const [roleCounts, setRoleCounts] = useState({})
  const scheduleRenderRef = useRef(null)

  const { data: wall, isLoading: wallLoading } = useQuery({
    queryKey: ['wall', id],
    queryFn: async () => (await api.get(`/walls/${id}`)).data
  })

  const { data: holds, isLoading: holdsLoading } = useQuery({
    queryKey: ['holds', id],
    queryFn: async () => (await api.get(`/walls/${id}/holds`)).data
  })

  useEffect(() => {
    if (!wall?.image_path) return
    api.get(`/walls/${id}/image`, { responseType: 'blob' }).then(res => {
      const url = URL.createObjectURL(res.data)
      setImageUrl(url)
      const img = new window.Image()
      img.onload = () => setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight })
      img.src = url
    })
  }, [wall?.image_path, id])

  const handleHoldClick = useCallback((holdId) => {
    const current = holdRolesRef.current[holdId] ?? null
    const currentIdx = ROLES.indexOf(current)
    const nextRole = ROLES[(currentIdx + 1) % ROLES.length]

    if (nextRole === null) {
      delete holdRolesRef.current[holdId]
    } else {
      holdRolesRef.current[holdId] = nextRole
    }

    const counts = {}
    for (const role of Object.values(holdRolesRef.current)) {
      counts[role] = (counts[role] ?? 0) + 1
    }
    setRoleCounts(counts)

    if (scheduleRenderRef.current) scheduleRenderRef.current()
  }, [])

  const totalSelected = Object.keys(holdRolesRef.current).length

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Route name is required'); return }
    if (Object.keys(holdRolesRef.current).length === 0) { setError('Select at least one hold'); return }

    setError(null)
    setSubmitting(true)

    try {
      const holdsData = Object.entries(holdRolesRef.current).map(([holdId, role]) => ({
        hold_id: parseInt(holdId),
        role,
      }))

      await api.post(`/walls/${id}/routes/with-holds`, {
        route: { name: name.trim(), grade, created_by: '' },
        holds_data: holdsData,
      })

      navigate(`/walls/${id}/detail`)
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(Array.isArray(detail) ? detail.map(d => d.msg).join(', ') : detail || 'Failed to create route')
    } finally {
      setSubmitting(false)
    }
  }

  const isLoading = wallLoading || holdsLoading

  return (
    <>
      <style>{styles}</style>
      <div className="rc-root">
        <nav className="rc-nav">
          <div className="rc-nav-left">
            <button className="nav-back" onClick={() => navigate(`/walls/${id}/detail`)}>← Back</button>
            <div className="nav-divider" />
            <div className="nav-logo">Home<span>Board</span></div>
          </div>
        </nav>

        <div className="rc-layout">
          {isLoading && (
            <div className="loading-state">
              <div className="loading-spinner" />
              <div className="loading-label">Loading wall...</div>
            </div>
          )}

          {!isLoading && imageUrl && imageDimensions && holds && (
            <>
              <div className="rc-canvas-col">
                <div className="rc-canvas-header">
                  <h1 className="rc-title">New <span>Route</span></h1>
                  <span className="rc-hint">Tap holds to assign roles · Pinch to zoom · Drag to pan</span>
                </div>

                <div className="rc-legend">
                  {Object.entries(ROLE_COLORS).map(([role, colors]) => (
                    <div key={role} className="legend-item" style={{ color: colors.stroke }}>
                      <div className="legend-dot" style={{ borderColor: colors.stroke, background: colors.fill }} />
                      {ROLE_LABELS[role]}
                    </div>
                  ))}
                  <div className="legend-item" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    <div className="legend-dot" style={{ borderColor: 'rgba(255,255,255,0.2)', background: 'transparent' }} />
                    Unselected
                  </div>
                </div>

                <RouteCanvas
                  imageUrl={imageUrl}
                  holds={holds}
                  holdRolesRef={holdRolesRef}
                  onHoldClick={handleHoldClick}
                  imageWidth={imageDimensions.width}
                  imageHeight={imageDimensions.height}
                  scheduleRenderRef={scheduleRenderRef}
                />
              </div>

              <div className="rc-sidebar">
                <div className="sidebar-section">
                  <div className="sidebar-section-title">Route Details</div>
                  <div className="sidebar-field">
                    <label>Name</label>
                    <input
                      placeholder="e.g. Burden of Dreams"
                      value={name}
                      onChange={e => setName(e.target.value)}
                    />
                  </div>
                  <div className="sidebar-field">
                    <label>Grade</label>
                    <select value={grade} onChange={e => setGrade(e.target.value)}>
                      {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                </div>

                <div className="sidebar-section">
                  <div className="sidebar-section-title">Selected Holds</div>
                  {totalSelected === 0 ? (
                    <div className="hold-summary-empty">No holds selected yet</div>
                  ) : (
                    <div className="hold-summary">
                      {Object.entries(ROLE_COLORS).map(([role, colors]) => (
                        roleCounts[role] ? (
                          <div key={role} className="hold-summary-row">
                            <div className="hold-summary-label">
                              <div className="hold-role-dot" style={{ borderColor: colors.stroke, background: colors.fill }} />
                              <span style={{ color: colors.stroke, fontSize: 12 }}>{ROLE_LABELS[role]}</span>
                            </div>
                            <span className="hold-count" style={{ color: colors.stroke }}>{roleCounts[role]}</span>
                          </div>
                        ) : null
                      ))}
                      <div className="hold-summary-row" style={{ marginTop: 4, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <span style={{ fontSize: 12, color: 'rgba(245,240,235,0.4)' }}>Total</span>
                        <span className="hold-count" style={{ color: '#f5f0eb' }}>{totalSelected}</span>
                      </div>
                    </div>
                  )}
                </div>

                {error && <div className="sidebar-error">{error}</div>}

                <button className="submit-btn" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Route'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
} 
