import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
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
  const S = useRef({ tx: { x: 0, y: 0, z: 1 }, imgScale: 1, origWidth: 1, origHeight: 1, img: null, dragOrigin: null, isDragging: false })
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
    const displayW = imageWidth * s
    const displayH = imageHeight * s
    S.current.imgScale = s
    S.current.origWidth = imageWidth
    S.current.origHeight = imageHeight
    S.current.tx = { x: (w - displayW) / 2, y: 0, z: 1 }
    setCanvasSize({ width: w, height: displayH })
    scheduleRender()
  }, [imageWidth, imageHeight, scheduleRender])

  useEffect(() => { scheduleRender() }, [canvasSize, scheduleRender])

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

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: canvasSize.height, borderRadius: 2, border: '1px solid rgba(255,255,255,0.06)', background: '#0a0908', overflow: 'hidden', cursor: 'grab' }}>
      <canvas ref={imageCanvasRef} width={canvasSize.width} height={canvasSize.height} style={{ position: 'absolute', top: 0, left: 0 }} />
      <canvas ref={overlayCanvasRef} width={canvasSize.width} height={canvasSize.height} style={{ position: 'absolute', top: 0, left: 0 }} />
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
    padding: 0 40px; height: 60px;
    background: rgba(15,14,13,0.85); backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }

  .nav-left { display: flex; align-items: center; gap: 16px; }
  .nav-back { background: none; border: none; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 300; color: rgba(245,240,235,0.4); cursor: pointer; transition: color 0.2s; padding: 0; }
  .nav-back:hover { color: #ff6428; }
  .nav-divider { width: 1px; height: 16px; background: rgba(255,255,255,0.1); }
  .nav-logo { font-family: 'Bebas Neue', sans-serif; font-size: 24px; letter-spacing: 0.08em; color: #f5f0eb; }
  .nav-logo span { color: #ff6428; }

  .detail-main { position: relative; z-index: 1; max-width: 1100px; margin: 0 auto; padding: 40px 40px 60px; }

  /* Header */
  .detail-header { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 32px; }
  .detail-title { font-family: 'Bebas Neue', sans-serif; font-size: 48px; line-height: 0.9; letter-spacing: 0.03em; }
  .detail-subtitle { font-size: 13px; font-weight: 300; color: rgba(245,240,235,0.35); margin-top: 10px; }
  .detail-actions { display: flex; gap: 8px; margin-bottom: 4px; }

  .action-btn { background: #ff6428; border: none; border-radius: 2px; padding: 11px 20px; font-family: 'Bebas Neue', sans-serif; font-size: 16px; letter-spacing: 0.08em; color: #0f0e0d; cursor: pointer; transition: background 0.2s, transform 0.1s; white-space: nowrap; }
  .action-btn:hover { background: #ff7a40; }
  .action-btn:active { transform: scale(0.98); }
  .action-btn.secondary { background: none; border: 1px solid rgba(255,255,255,0.1); color: rgba(245,240,235,0.5); }
  .action-btn.secondary:hover { border-color: rgba(255,100,40,0.4); color: #ff6428; background: none; }

  .detail-divider { height: 1px; background: rgba(255,255,255,0.06); margin-bottom: 32px; }

  /* Two-col layout */
  .detail-layout { display: grid; grid-template-columns: 1fr 380px; gap: 32px; align-items: start; }

  /* Routes panel */
  .routes-panel { display: flex; flex-direction: column; gap: 16px; }

  .routes-panel-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }

  .panel-title { font-family: 'Bebas Neue', sans-serif; font-size: 22px; letter-spacing: 0.06em; color: rgba(245,240,235,0.6); }

  /* Filter bar */
  .filter-bar { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 4px; }

  .filter-input {
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 2px; padding: 8px 12px; font-size: 12px;
    font-family: 'DM Sans', sans-serif; font-weight: 300; color: #f5f0eb;
    outline: none; transition: border-color 0.2s; flex: 1; min-width: 140px;
  }
  .filter-input:focus { border-color: rgba(255,100,40,0.4); }
  .filter-input::placeholder { color: rgba(245,240,235,0.2); }

  .filter-select {
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 2px; padding: 8px 12px; font-size: 12px;
    font-family: 'DM Sans', sans-serif; font-weight: 300; color: #f5f0eb;
    outline: none; transition: border-color 0.2s; cursor: pointer;
  }
  .filter-select:focus { border-color: rgba(255,100,40,0.4); }
  .filter-select option { background: #161412; }

  /* Route cards */
  .route-card {
    background: #161412; border: 1px solid rgba(255,255,255,0.06);
    border-radius: 2px; padding: 18px 20px;
    display: flex; align-items: center; gap: 16px;
    cursor: pointer; transition: border-color 0.2s, background 0.2s, transform 0.15s;
    position: relative; overflow: hidden;
  }

  .route-card::before {
    content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
    background: var(--grade-color, #ff6428); opacity: 0;
    transition: opacity 0.2s;
  }

  .route-card:hover { border-color: rgba(255,255,255,0.12); background: #1a1714; transform: translateX(2px); }
  .route-card:hover::before { opacity: 1; }

  .grade-badge {
    font-family: 'Bebas Neue', sans-serif; font-size: 20px; letter-spacing: 0.04em;
    min-width: 44px; text-align: center;
    padding: 6px 10px; border-radius: 2px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.06);
    flex-shrink: 0;
  }

  .route-card-body { flex: 1; min-width: 0; }
  .route-card-name { font-size: 15px; font-weight: 500; color: #f5f0eb; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .route-card-meta { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .route-meta-item { font-size: 11px; font-weight: 300; color: rgba(245,240,235,0.35); display: flex; align-items: center; gap: 4px; }
  .route-meta-dot { width: 3px; height: 3px; border-radius: 50%; background: rgba(255,100,40,0.4); }

  .ascent-count { font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 0.04em; color: rgba(245,240,235,0.25); flex-shrink: 0; }
  .ascent-count span { font-family: 'DM Sans', sans-serif; font-size: 10px; font-weight: 300; display: block; text-align: center; letter-spacing: 0.08em; text-transform: uppercase; margin-top: 1px; }

  .route-arrow { color: rgba(255,100,40,0.2); font-size: 14px; transition: color 0.2s, transform 0.2s; flex-shrink: 0; }
  .route-card:hover .route-arrow { color: #ff6428; transform: translateX(3px); }

  /* Empty/loading states */
  .routes-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 48px; border: 1px dashed rgba(255,255,255,0.07); border-radius: 2px; color: rgba(245,240,235,0.2); }
  .routes-empty-icon { font-size: 28px; opacity: 0.3; }
  .routes-empty p { font-size: 13px; font-weight: 300; }

  /* Wall preview panel */
  .wall-preview-panel { display: flex; flex-direction: column; gap: 12px; }
  .preview-header { display: flex; align-items: center; justify-content: space-between; }
  .canvas-hint { font-size: 11px; font-weight: 300; color: rgba(245,240,235,0.2); }

  /* Loading */
  .loading-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; padding: 80px 40px; border: 1px solid rgba(255,255,255,0.06); border-radius: 2px; background: #161412; }
  .loading-spinner { width: 32px; height: 32px; border: 2px solid rgba(255,255,255,0.08); border-top-color: #ff6428; border-radius: 50%; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .loading-label { font-size: 13px; font-weight: 300; color: rgba(245,240,235,0.4); }

  .no-image-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 48px; border: 1px dashed rgba(255,255,255,0.08); border-radius: 2px; background: #161412; color: rgba(245,240,235,0.2); }

  .skeleton-route { background: #161412; border: 1px solid rgba(255,255,255,0.04); border-radius: 2px; padding: 18px 20px; display: flex; gap: 16px; align-items: center; }
  .skeleton-box { border-radius: 2px; background: linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 100%); background-size: 200% 100%; animation: shimmer 1.4s infinite; }
  @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

  @media (max-width: 800px) {
    .detail-layout { grid-template-columns: 1fr; }
    .wall-preview-panel { order: -1; }
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
  const [imageUrl, setImageUrl] = useState(null)
  const [imageDimensions, setImageDimensions] = useState(null)
  const [search, setSearch] = useState('')
  const [gradeFilter, setGradeFilter] = useState('All')

  const { data: wall, isLoading: wallLoading } = useQuery({
    queryKey: ['wall', id],
    queryFn: async () => (await api.get(`/walls/${id}/`)).data
  })

  const { data: holds, isLoading: holdsLoading } = useQuery({
    queryKey: ['holds', id],
    queryFn: async () => (await api.get(`/walls/${id}/holds/`)).data
  })

  const { data: routes, isLoading: routesLoading } = useQuery({
    queryKey: ['routes', id],
    queryFn: async () => (await api.get(`/walls/${id}/routes/`)).data
  })

  useEffect(() => {
    if (!wall?.image_path) return
    api.get(`/walls/${id}/image/`, { responseType: 'blob' }).then(res => {
      const url = URL.createObjectURL(res.data)
      setImageUrl(url)
      const img = new window.Image()
      img.onload = () => setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight })
      img.src = url
    })
  }, [wall?.image_path, id])

  const filteredRoutes = (routes ?? []).filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(search.toLowerCase())
    const matchesGrade = gradeFilter === 'All' || r.grade === gradeFilter
    return matchesSearch && matchesGrade
  })

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
              <h1 className="detail-title">{wall?.name ?? `Wall #${id}`}</h1>
              <p className="detail-subtitle">
                {routes
                  ? `${routes.length} route${routes.length !== 1 ? 's' : ''} · ${holds?.length ?? 0} holds mapped`
                  : 'Loading...'}
              </p>
            </div>
            <div className="detail-actions">
              <button className="action-btn secondary" onClick={() => navigate(`/walls/${id}`)}>↑ Re-upload</button>
              <button className="action-btn" onClick={() => navigate(`/walls/${id}/route/new`)}>+ Create Route</button>
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

                {/* Filters */}
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

                {/* Route list */}
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

              {/* Wall preview */}
              <div className="wall-preview-panel">
                <div className="preview-header">
                  <span className="panel-title">Wall</span>
                  <span className="canvas-hint">Scroll to zoom · Drag to pan</span>
                </div>
                {imageUrl && imageDimensions && holds ? (
                  <WallCanvas
                    imageUrl={imageUrl}
                    holds={holds}
                    imageWidth={imageDimensions.width}
                    imageHeight={imageDimensions.height}
                  />
                ) : (
                  <div className="no-image-state">
                    <div style={{ fontSize: 28, opacity: 0.3 }}>◻</div>
                    <p style={{ fontSize: 13, fontWeight: 300 }}>No image uploaded</p>
                    <button className="action-btn" style={{ marginTop: 4 }} onClick={() => navigate(`/walls/${id}`)}>Upload Image</button>
                  </div>
                )}
              </div>

            </div>
          )}
        </main>
      </div>
    </>
  )
}
