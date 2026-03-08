import { useRef, useState, useCallback, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../api/axios'

// ─── Constants ────────────────────────────────────────────────────────────────
const ROLE_COLORS = {
  any:   { fill: 'rgba(255,100,40,0.35)',  stroke: '#ff6428' },
  start: { fill: 'rgba(64,255,128,0.35)',  stroke: '#40ff80' },
  end:   { fill: 'rgba(255,64,64,0.35)',   stroke: '#ff4040' },
  foot:  { fill: 'rgba(100,200,255,0.35)', stroke: '#64c8ff' },
}
const ROLE_LABELS = { any: 'Any', start: 'Start', end: 'End', foot: 'Foot' }

function gradeColor(grade) {
  const map = {
    Unknown: '#888', V0: '#6bcb77', V1: '#6bcb77', V2: '#80d8a0',
    V3: '#ffe066', V4: '#ffe066', V5: '#ffb347', V6: '#ffb347',
    V7: '#ff6428', V8: '#ff6428', V9: '#ff4040', V10: '#ff4040',
    V11: '#d040ff', V12: '#d040ff', V15: '#a040ff', V16: '#a040ff', V17: '#a040ff',
  }
  return map[grade] ?? '#888'
}

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

// ─── Canvas renderer ──────────────────────────────────────────────────────────
function renderCanvas(imageCanvas, overlayCanvas, img, allHolds, routeHoldMap, state) {
  if (!imageCanvas || !overlayCanvas) return
  const { tx, imgScale, origWidth, origHeight } = state

  const ic = imageCanvas.getContext('2d')
  ic.clearRect(0, 0, imageCanvas.width, imageCanvas.height)
  if (img) {
    ic.drawImage(img, tx.x, tx.y, origWidth * imgScale * tx.z, origHeight * imgScale * tx.z)
    ic.fillStyle = 'rgba(0,0,0,0.5)'
    ic.fillRect(0, 0, imageCanvas.width, imageCanvas.height)
  }

  const oc = overlayCanvas.getContext('2d')
  oc.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height)

  for (const hold of allHolds) {
    const pts = hold.polygon
    if (!pts || pts.length < 2) continue
    const role = routeHoldMap[hold.id] ?? null

    const buildPath = (ctx) => {
      ctx.beginPath()
      ctx.moveTo(pts[0].x * imgScale * tx.z + tx.x, pts[0].y * imgScale * tx.z + tx.y)
      for (let i = 1; i < pts.length; i++)
        ctx.lineTo(pts[i].x * imgScale * tx.z + tx.x, pts[i].y * imgScale * tx.z + tx.y)
      ctx.closePath()
    }

    if (role) {
      ic.save()
      ic.globalCompositeOperation = 'destination-out'
      buildPath(ic)
      ic.fill()
      ic.restore()

      ic.save()
      buildPath(ic)
      ic.clip()
      if (img) ic.drawImage(img, tx.x, tx.y, origWidth * imgScale * tx.z, origHeight * imgScale * tx.z)
      ic.restore()

      const colors = ROLE_COLORS[role]
      buildPath(oc)
      oc.fillStyle = colors.fill
      oc.fill()
      oc.strokeStyle = colors.stroke
      oc.lineWidth = 2
      oc.shadowColor = colors.stroke
      oc.shadowBlur = 8
      oc.stroke()
      oc.shadowBlur = 0
    } else {
      buildPath(oc)
      oc.strokeStyle = 'rgba(255,255,255,0.12)'
      oc.lineWidth = 1
      oc.stroke()
    }
  }
}

// ─── Route Canvas ─────────────────────────────────────────────────────────────
function RouteCanvas({ imageUrl, allHolds, routeHoldMap, imageWidth, imageHeight, fullscreen }) {
  const containerRef = useRef(null)
  const imageCanvasRef = useRef(null)
  const overlayCanvasRef = useRef(null)
  const rafRef = useRef(null)
  const S = useRef({
    tx: { x: 0, y: 0, z: 1 }, imgScale: 1, origWidth: 1, origHeight: 1,
    img: null, isDragging: false, dragOrigin: null,
    lastTouchDist: null, touchMoved: false,
  })
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 500 })

  const scheduleRender = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() =>
      renderCanvas(imageCanvasRef.current, overlayCanvasRef.current, S.current.img, allHolds, routeHoldMap, S.current))
  }, [allHolds, routeHoldMap])

  useEffect(() => {
    downsampleImage(imageUrl, 1200).then(img => { S.current.img = img; scheduleRender() })
  }, [imageUrl, scheduleRender])

  useEffect(() => {
    if (!containerRef.current) return
    const w = containerRef.current.offsetWidth
    const maxH = fullscreen
      ? window.innerHeight - 60
      : Math.min(window.innerHeight * 0.55, 520)
    const s = Math.min(w / imageWidth, maxH / imageHeight)
    const displayW = imageWidth * s, displayH = imageHeight * s
    S.current.imgScale = s
    S.current.origWidth = imageWidth
    S.current.origHeight = imageHeight
    S.current.tx = { x: (w - displayW) / 2, y: 0, z: 1 }
    setCanvasSize({ width: w, height: fullscreen ? maxH : displayH })
    scheduleRender()
  }, [imageWidth, imageHeight, scheduleRender, fullscreen])

  useEffect(() => { scheduleRender() }, [canvasSize, scheduleRender])

  useEffect(() => {
    const overlay = overlayCanvasRef.current
    if (!overlay) return
    const getPos = e => { const r = overlay.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top } }
    const onMouseDown = e => {
      S.current.isDragging = false
      S.current.dragOrigin = { mx: getPos(e).x, my: getPos(e).y, tx: S.current.tx.x, ty: S.current.tx.y }
    }
    const onMouseMove = e => {
      if (!S.current.dragOrigin) return
      const pos = getPos(e), d = S.current.dragOrigin
      const dx = pos.x - d.mx, dy = pos.y - d.my
      if (Math.hypot(dx, dy) > 3) S.current.isDragging = true
      S.current.tx = { ...S.current.tx, x: d.tx + dx, y: d.ty + dy }
      scheduleRender()
    }
    const onMouseUp = () => { S.current.dragOrigin = null }
    const onWheel = e => {
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
    overlay.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      overlay.removeEventListener('mousedown', onMouseDown)
      overlay.removeEventListener('mousemove', onMouseMove)
      overlay.removeEventListener('mouseup', onMouseUp)
      overlay.removeEventListener('mouseleave', onMouseUp)
      overlay.removeEventListener('wheel', onWheel)
    }
  }, [scheduleRender])

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
      borderRadius: fullscreen ? 0 : 2,
      border: fullscreen ? 'none' : '1px solid rgba(255,255,255,0.08)',
      background: '#0a0908', overflow: 'hidden', cursor: 'grab', touchAction: 'none',
    }}>
      <canvas ref={imageCanvasRef} width={canvasSize.width} height={canvasSize.height} style={{ position: 'absolute', top: 0, left: 0 }} />
      <canvas ref={overlayCanvasRef} width={canvasSize.width} height={canvasSize.height} style={{ position: 'absolute', top: 0, left: 0 }} />
    </div>
  )
}

// ─── Fullscreen Canvas Modal ──────────────────────────────────────────────────
function FullscreenCanvas({ imageUrl, allHolds, routeHoldMap, imageDimensions, onClose }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: '#0a0908', display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        height: 52, display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
        padding: '0 16px', flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <button onClick={onClose} style={{
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 2, padding: '6px 14px', color: '#f5f0eb',
          fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 300, cursor: 'pointer',
        }}>✕ Close</button>
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <RouteCanvas
          imageUrl={imageUrl}
          allHolds={allHolds}
          routeHoldMap={routeHoldMap}
          imageWidth={imageDimensions.width}
          imageHeight={imageDimensions.height}
          fullscreen
        />
      </div>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }

  html, body { background: #0f0e0d; overscroll-behavior: none; }

  .rd-root {
    min-height: 100vh;
    min-height: 100dvh;
    background-color: #0f0e0d;
    font-family: 'DM Sans', sans-serif;
    color: #f5f0eb;
  }

  .rd-root::before {
    content: ''; position: fixed; inset: 0;
    background-image: radial-gradient(ellipse 60% 40% at 80% 10%, rgba(255,100,40,0.06) 0%, transparent 60%),
      url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");
    pointer-events: none; z-index: 0;
  }

  .rd-nav {
    position: sticky; top: 0; z-index: 10;
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 16px; height: 52px;
    background: rgba(15,14,13,0.92); backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }
  .rd-nav-left { display: flex; align-items: center; gap: 12px; }
  .nav-back { background: none; border: none; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 300; color: rgba(245,240,235,0.4); cursor: pointer; transition: color 0.2s; padding: 0; }
  .nav-back:hover { color: #ff6428; }
  .nav-divider { width: 1px; height: 16px; background: rgba(255,255,255,0.1); }
  .nav-logo { font-family: 'Bebas Neue', sans-serif; font-size: 22px; letter-spacing: 0.08em; color: #f5f0eb; }
  .nav-logo span { color: #ff6428; }

  .log-send-btn {
    background: #ff6428; border: none; border-radius: 2px;
    padding: 7px 14px; font-family: 'Bebas Neue', sans-serif;
    font-size: 15px; letter-spacing: 0.08em; color: #0f0e0d;
    cursor: pointer; transition: background 0.2s; white-space: nowrap;
  }
  .log-send-btn:hover { background: #ff7a40; }

  .rd-main {
    position: relative; z-index: 1;
    max-width: 1200px; margin: 0 auto;
    padding: 20px 16px 60px;
  }

  .rd-layout { display: grid; grid-template-columns: 1fr; gap: 0; align-items: start; }

  .rd-canvas-col { display: flex; flex-direction: column; gap: 10px; }

  .rd-route-header {
    display: flex; align-items: baseline; gap: 0; flex-wrap: nowrap; overflow: hidden;
  }
  .rd-title {
    font-family: 'Bebas Neue', sans-serif; font-size: 32px;
    letter-spacing: 0.03em; line-height: 1; white-space: nowrap;
    overflow: hidden; text-overflow: ellipsis; min-width: 0;
  }
  .rd-grade {
    font-family: 'Bebas Neue', sans-serif; font-size: 32px;
    letter-spacing: 0.03em; margin-left: 10px; flex-shrink: 0;
  }

  .rd-legend { display: flex; gap: 12px; flex-wrap: wrap; }
  .legend-item { display: flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; }
  .legend-dot { width: 8px; height: 8px; border-radius: 50%; border: 2px solid; flex-shrink: 0; }

  .canvas-tap-hint {
    font-size: 11px; font-weight: 300; color: rgba(245,240,235,0.2);
    text-align: center; padding: 4px 0 0;
  }

  /* Mobile stat strip */
  .rd-stat-strip {
    display: flex; gap: 0;
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 2px; overflow: hidden;
    background: #161412;
  }
  .rd-stat-strip-item {
    flex: 1; display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    padding: 10px 6px; gap: 3px;
    border-right: 1px solid rgba(255,255,255,0.06);
  }
  .rd-stat-strip-item:last-child { border-right: none; }
  .strip-label { font-size: 10px; font-weight: 300; color: rgba(245,240,235,0.3); letter-spacing: 0.06em; text-transform: uppercase; }
  .strip-value { font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 0.04em; line-height: 1.1; }

  .rd-sidebar { display: flex; flex-direction: column; gap: 12px; margin-top: 16px; }

  .stat-card {
    background: #161412; border: 1px solid rgba(255,255,255,0.06);
    border-radius: 2px; padding: 16px;
    display: flex; flex-direction: column; gap: 10px;
  }
  .stat-card-title { font-family: 'Bebas Neue', sans-serif; font-size: 13px; letter-spacing: 0.1em; color: rgba(245,240,235,0.4); text-transform: uppercase; }
  .stat-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .stat-label { font-size: 11px; font-weight: 300; color: rgba(245,240,235,0.35); letter-spacing: 0.06em; text-transform: uppercase; flex-shrink: 0; }
  .stat-value { font-size: 13px; font-weight: 400; color: #f5f0eb; text-align: right; }
  .stat-value.grade { font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 0.04em; }
  .stat-divider { height: 1px; background: rgba(255,255,255,0.05); }
  .description-text { font-size: 13px; font-weight: 300; color: rgba(245,240,235,0.5); line-height: 1.6; }

  .hold-breakdown { display: flex; flex-direction: column; gap: 6px; }
  .hold-breakdown-row { display: flex; align-items: center; justify-content: space-between; }
  .hold-role-label { display: flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 300; }
  .hold-role-dot { width: 8px; height: 8px; border-radius: 50%; border: 1.5px solid; flex-shrink: 0; }
  .hold-role-count { font-family: 'Bebas Neue', sans-serif; font-size: 16px; letter-spacing: 0.04em; }

  .ascent-log { display: flex; flex-direction: column; gap: 8px; }
  .ascent-entry {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 12px; border-radius: 2px;
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.04);
  }
  .ascent-avatar {
    width: 28px; height: 28px; border-radius: 50%;
    background: rgba(255,100,40,0.15); border: 1px solid rgba(255,100,40,0.2);
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 500; color: #ff6428; flex-shrink: 0;
    font-family: 'Bebas Neue', sans-serif; letter-spacing: 0.05em;
  }
  .ascent-info { flex: 1; min-width: 0; }
  .ascent-user { font-size: 12px; font-weight: 500; color: #f5f0eb; }
  .ascent-meta { font-size: 11px; font-weight: 300; color: rgba(245,240,235,0.3); margin-top: 1px; }
  .ascent-grade-pill {
    font-family: 'Bebas Neue', sans-serif; font-size: 13px; letter-spacing: 0.04em;
    padding: 2px 7px; border-radius: 2px; flex-shrink: 0;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06);
  }
  .ascent-empty { font-size: 12px; font-weight: 300; color: rgba(245,240,235,0.2); text-align: center; padding: 16px 0; }

  .loading-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; padding: 80px; grid-column: 1/-1; }
  .loading-spinner { width: 32px; height: 32px; border: 2px solid rgba(255,255,255,0.08); border-top-color: #ff6428; border-radius: 50%; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .loading-label { font-size: 13px; font-weight: 300; color: rgba(245,240,235,0.4); }

  /* Modal — slides from bottom on all screen sizes */
  .modal-backdrop {
    position: fixed; inset: 0; background: rgba(0,0,0,0.75);
    backdrop-filter: blur(4px); z-index: 100;
    display: flex; align-items: flex-end; justify-content: center;
    animation: fadeIn 0.15s ease;
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .modal {
    background: #161412; border: 1px solid rgba(255,255,255,0.08);
    border-radius: 4px 4px 0 0; padding: 28px 24px 40px;
    width: 100%; max-width: 520px;
    animation: slideUp 0.22s ease;
    max-height: 92dvh; overflow-y: auto;
  }
  @keyframes slideUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
  .modal-title { font-family: 'Bebas Neue', sans-serif; font-size: 26px; letter-spacing: 0.05em; margin-bottom: 4px; }
  .modal-sub { font-size: 12px; font-weight: 300; color: rgba(245,240,235,0.35); margin-bottom: 20px; }
  .modal-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
  .modal-field label { font-size: 11px; font-weight: 500; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(245,240,235,0.4); }
  .modal-field input, .modal-field select, .modal-field textarea {
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 2px; padding: 10px 14px; font-size: 16px;
    font-family: 'DM Sans', sans-serif; font-weight: 300; color: #f5f0eb;
    outline: none; transition: border-color 0.2s; width: 100%;
    -webkit-appearance: none;
  }
  .modal-field input:focus, .modal-field select:focus, .modal-field textarea:focus { border-color: rgba(255,100,40,0.5); }
  .modal-field textarea { resize: vertical; min-height: 72px; }
  .modal-field select option { background: #161412; }
  .modal-field input::placeholder, .modal-field textarea::placeholder { color: rgba(245,240,235,0.15); }
  .star-row { display: flex; align-items: center; gap: 4px; }
  .star-btn { background: none; border: none; font-size: 24px; cursor: pointer; color: rgba(255,255,255,0.2); transition: color 0.15s; padding: 4px; line-height: 1; }
  .star-btn.active { color: #ffb347; }
  .star-label { font-size: 12px; font-weight: 300; color: rgba(245,240,235,0.35); margin-left: 6px; }
  .modal-error { font-size: 12px; color: #ff6060; background: rgba(255,60,60,0.08); border: 1px solid rgba(255,60,60,0.15); border-radius: 2px; padding: 8px 12px; margin-bottom: 14px; }
  .modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 4px; }
  .modal-cancel { background: none; border: 1px solid rgba(255,255,255,0.08); border-radius: 2px; padding: 10px 20px; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 300; color: rgba(245,240,235,0.4); cursor: pointer; }
  .modal-cancel:hover { border-color: rgba(255,255,255,0.2); color: rgba(245,240,235,0.7); }
  .modal-submit { background: #ff6428; border: none; border-radius: 2px; padding: 10px 24px; font-family: 'Bebas Neue', sans-serif; font-size: 16px; letter-spacing: 0.08em; color: #0f0e0d; cursor: pointer; }
  .modal-submit:hover { background: #ff7a40; }
  .modal-submit:disabled { opacity: 0.5; cursor: not-allowed; }

  /* ── Desktop overrides ── */
  @media (min-width: 701px) {
    .rd-main { padding: 32px 32px 80px; }
    .rd-layout { grid-template-columns: 1fr 300px; gap: 28px; }
    .rd-title { font-size: 40px; }
    .rd-grade { font-size: 40px; }
    .rd-nav { padding: 0 28px; }
    .rd-hide-desktop { display: none; }
  }

  @media (max-width: 700px) {
    .rd-hide-mobile { display: none; }
  }
`

const GRADES = ['Unknown','V0','V1','V2','V3','V4','V5','V6','V7','V8','V9','V10','V11','V12','V15','V16','V17']

// ─── Log Ascent Modal ─────────────────────────────────────────────────────────
function LogAscentModal({ wallId, routeId, routeGrade, onClose, onLogged }) {
  const [suggestedGrade, setSuggestedGrade] = useState(routeGrade ?? 'Unknown')
  const [quality, setQuality] = useState(0)
  const [nAttempts, setNAttempts] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setError(null)
    setLoading(true)
    try {
      await api.post(`/walls/${wallId}/routes/${routeId}/ascents`, {
        suggested_grade: suggestedGrade,
        quality: quality > 0 ? quality : null,
        n_attempts: nAttempts ? parseInt(nAttempts) : null,
        notes: notes.trim() || null,
      })
      onLogged()
    } catch (err) {
      console.log('Ascent error:', err.response?.status, err.response?.data)
      const detail = err.response?.data?.detail
      setError(Array.isArray(detail) ? detail.map(d => d.msg).join(', ') : detail || 'Failed to log ascent')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-title">Log Send</div>
        <div className="modal-sub">Record your ascent of this route</div>
        <div className="modal-field">
          <label>Suggested Grade</label>
          <select value={suggestedGrade} onChange={e => setSuggestedGrade(e.target.value)}>
            {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div className="modal-field">
          <label>Quality</label>
          <div className="star-row">
            {[1,2,3,4,5].map(n => (
              <button key={n} className={`star-btn ${n <= quality ? 'active' : ''}`}
                onClick={() => setQuality(prev => prev === n ? 0 : n)}>
                {n <= quality ? '★' : '☆'}
              </button>
            ))}
            {quality > 0 && <span className="star-label">{['','Poor','Fair','Good','Great','Classic'][quality]}</span>}
          </div>
        </div>
        <div className="modal-field">
          <label>Attempts</label>
          <input type="number" min="1" placeholder="How many attempts?" value={nAttempts} onChange={e => setNAttempts(e.target.value)} />
        </div>
        <div className="modal-field">
          <label>Notes</label>
          <textarea placeholder="Beta, conditions, thoughts..." value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
        </div>
        {error && <div className="modal-error">{error}</div>}
        <div className="modal-actions">
          <button className="modal-cancel" onClick={onClose}>Cancel</button>
          <button className="modal-submit" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Logging...' : 'Log Send'}
          </button>
        </div>
      </div>
    </div>
  )
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function formatRelative(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return formatDate(iso)
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function RouteDetailPage() {
  const { id: wallId, routeId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showLogModal, setShowLogModal] = useState(false)
  const [showFullscreen, setShowFullscreen] = useState(false)

  const { data: wall } = useQuery({
    queryKey: ['wall', wallId],
    queryFn: async () => (await api.get(`/walls/${wallId}`)).data,
  })
  const { data: route, isLoading: routeLoading } = useQuery({
    queryKey: ['route', wallId, routeId],
    queryFn: async () => (await api.get(`/walls/${wallId}/routes/${routeId}`)).data,
  })
  const { data: allHolds, isLoading: holdsLoading } = useQuery({
    queryKey: ['holds', wallId],
    queryFn: async () => (await api.get(`/walls/${wallId}/holds`)).data,
  })
  const { data: routeHolds, isLoading: routeHoldsLoading } = useQuery({
    queryKey: ['routeholds', routeId],
    queryFn: async () => (await api.get(`/routes/${routeId}/routeholds`)).data,
  })
  const { data: ascents } = useQuery({
    queryKey: ['ascents', routeId],
    queryFn: async () => (await api.get(`/walls/${wallId}/routes/${routeId}/ascents`)).data,
  })
  const { data: imageUrl } = useQuery({
    queryKey: ['image', wallId],
    queryFn: async () => {
      const res = await api.get(`/walls/${wallId}/image`, { responseType: 'blob' })
      return URL.createObjectURL(res.data)
    },
    enabled: !!wall?.image_path,
    staleTime: Infinity,
  })
  const { data: imageDimensions } = useQuery({
    queryKey: ['imageDimensions', wallId],
    queryFn: () => new Promise((resolve) => {
      const img = new window.Image()
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
      img.src = imageUrl
    }),
    enabled: !!imageUrl,
    staleTime: Infinity,
  })

  const routeHoldMap = {}
  if (routeHolds) for (const rh of routeHolds) routeHoldMap[rh.hold_id] = rh.role

  const roleCounts = {}
  if (routeHolds) for (const rh of routeHolds) roleCounts[rh.role] = (roleCounts[rh.role] ?? 0) + 1

  const isLoading = routeLoading || holdsLoading || routeHoldsLoading
  const gradeCol = gradeColor(route?.grade)
  const canvasReady = imageUrl && imageDimensions && allHolds

  const handleLogged = () => {
    setShowLogModal(false)
    queryClient.invalidateQueries({ queryKey: ['ascents', routeId] })
    queryClient.invalidateQueries({ queryKey: ['route', wallId, routeId] })
  }

  return (
    <>
      <style>{styles}</style>
      <div className="rd-root">

        {showLogModal && (
          <LogAscentModal
            wallId={wallId} routeId={routeId} routeGrade={route?.grade}
            onClose={() => setShowLogModal(false)} onLogged={handleLogged}
          />
        )}

        {showFullscreen && canvasReady && (
          <FullscreenCanvas
            imageUrl={imageUrl} allHolds={allHolds} routeHoldMap={routeHoldMap}
            imageDimensions={imageDimensions} onClose={() => setShowFullscreen(false)}
          />
        )}

        <nav className="rd-nav">
          <div className="rd-nav-left">
            <button className="nav-back" onClick={() => navigate(`/walls/${wallId}/detail`)}>← Back</button>
            <div className="nav-divider" />
            <div className="nav-logo">Home<span>Board</span></div>
          </div>
          <button className="log-send-btn" onClick={() => setShowLogModal(true)}>+ Log Send</button>
        </nav>

        <main className="rd-main">
          {isLoading ? (
            <div className="loading-state">
              <div className="loading-spinner" />
              <div className="loading-label">Loading route...</div>
            </div>
          ) : (
            <div className="rd-layout">

              <div className="rd-canvas-col">
                {/* Title + grade */}
                <div className="rd-route-header">
                  <h1 className="rd-title">{route?.name}</h1>
                  <span className="rd-grade" style={{ color: gradeCol }}> · {route?.grade}</span>
                </div>

                {/* Legend — counts inline */}
                <div className="rd-legend">
                  {Object.entries(ROLE_COLORS).map(([role, colors]) =>
                    roleCounts[role] ? (
                      <div key={role} className="legend-item" style={{ color: colors.stroke }}>
                        <div className="legend-dot" style={{ borderColor: colors.stroke, background: colors.fill }} />
                        {ROLE_LABELS[role]} {roleCounts[role]}
                      </div>
                    ) : null
                  )}
                </div>

                {/* Canvas */}
                {canvasReady ? (
                  <div style={{ position: 'relative', cursor: 'pointer' }}>
                    <RouteCanvas
                      imageUrl={imageUrl} allHolds={allHolds} routeHoldMap={routeHoldMap}
                      imageWidth={imageDimensions.width} imageHeight={imageDimensions.height}
                    />
                    <div
                      onClick={() => setShowFullscreen(true)}
                      style={{
                        position: 'absolute', inset: 0, zIndex: 10,
                        background: 'transparent',
                      }}
                    />
                  </div>
                ) : (
                  <div style={{ padding: 60, textAlign: 'center', color: 'rgba(245,240,235,0.2)', fontSize: 13 }}>
                    No image available
                  </div>
                )}

                {canvasReady && (
                  <div className="canvas-tap-hint">Tap to expand · Pinch to zoom · Drag to pan</div>
                )}

                {/* Stat strip — always visible, compact */}
                <div className="rd-stat-strip">
                  <div className="rd-stat-strip-item">
                    <span className="strip-label">Grade</span>
                    <span className="strip-value" style={{ color: gradeCol }}>{route?.grade}</span>
                  </div>
                  <div className="rd-stat-strip-item">
                    <span className="strip-label">Sends</span>
                    <span className="strip-value" style={{ color: '#ff6428' }}>{route?.ascent_count ?? 0}</span>
                  </div>
                  {route?.mode_suggested_grade && route.mode_suggested_grade !== route.grade && (
                    <div className="rd-stat-strip-item">
                      <span className="strip-label">Consensus</span>
                      <span className="strip-value" style={{ color: gradeColor(route.mode_suggested_grade) }}>
                        {route.mode_suggested_grade}
                      </span>
                    </div>
                  )}
                  <div className="rd-stat-strip-item">
                    <span className="strip-label">Set by</span>
                    <span className="strip-value" style={{ fontSize: 12, fontFamily: "'DM Sans',sans-serif", fontWeight: 400, textAlign: 'center' }}>
                      {route?.created_by}
                    </span>
                  </div>
                </div>
              </div>

              {/* Sidebar */}
              <div className="rd-sidebar">

                {/* Full route info card — hidden on mobile (stat strip covers it) */}
                <div className="stat-card rd-hide-mobile">
                  <div className="stat-card-title">Route Info</div>
                  <div className="stat-row">
                    <span className="stat-label">Set by</span>
                    <span className="stat-value">{route?.created_by}</span>
                  </div>
                  <div className="stat-divider" />
                  <div className="stat-row">
                    <span className="stat-label">Date set</span>
                    <span className="stat-value">{route?.created_at ? formatDate(route.created_at) : '—'}</span>
                  </div>
                  <div className="stat-divider" />
                  <div className="stat-row">
                    <span className="stat-label">Grade</span>
                    <span className="stat-value grade" style={{ color: gradeCol }}>{route?.grade}</span>
                  </div>
                  {route?.mode_suggested_grade && route.mode_suggested_grade !== route.grade && (
                    <>
                      <div className="stat-divider" />
                      <div className="stat-row">
                        <span className="stat-label">Consensus</span>
                        <span className="stat-value grade" style={{ color: gradeColor(route.mode_suggested_grade) }}>
                          {route.mode_suggested_grade}
                        </span>
                      </div>
                    </>
                  )}
                  <div className="stat-divider" />
                  <div className="stat-row">
                    <span className="stat-label">Sends</span>
                    <span className="stat-value grade" style={{ color: '#ff6428' }}>{route?.ascent_count ?? 0}</span>
                  </div>
                  {route?.description && (
                    <>
                      <div className="stat-divider" />
                      <p className="description-text">{route.description}</p>
                    </>
                  )}
                </div>

                {/* Description on mobile — only if present */}
                {route?.description && (
                  <div className="stat-card rd-hide-desktop">
                    <p className="description-text">{route.description}</p>
                  </div>
                )}

                {/* Hold breakdown — desktop only */}
                {Object.keys(roleCounts).length > 0 && (
                  <div className="stat-card rd-hide-mobile">
                    <div className="stat-card-title">Holds ({routeHolds?.length ?? 0})</div>
                    <div className="hold-breakdown">
                      {Object.entries(ROLE_COLORS).map(([role, colors]) =>
                        roleCounts[role] ? (
                          <div key={role} className="hold-breakdown-row">
                            <div className="hold-role-label">
                              <div className="hold-role-dot" style={{ borderColor: colors.stroke, background: colors.fill }} />
                              <span style={{ color: colors.stroke }}>{ROLE_LABELS[role]}</span>
                            </div>
                            <span className="hold-role-count" style={{ color: colors.stroke }}>{roleCounts[role]}</span>
                          </div>
                        ) : null
                      )}
                    </div>
                  </div>
                )}

                {/* Ascent log */}
                <div className="stat-card">
                  <div className="stat-card-title">Recent Sends</div>
                  <div className="ascent-log">
                    {!ascents || ascents.length === 0 ? (
                      <div className="ascent-empty">No sends logged yet</div>
                    ) : (
                      ascents.slice(0, 10).map(a => (
                        <div key={a.id} className="ascent-entry">
                          <div className="ascent-avatar">{(a.username ?? '?')[0].toUpperCase()}</div>
                          <div className="ascent-info">
                            <div className="ascent-user">{a.username ?? `User ${a.user_id}`}</div>
                            <div className="ascent-meta">
                              {formatRelative(a.created_at)}
                              {a.n_attempts && ` · ${a.n_attempts} attempt${a.n_attempts !== 1 ? 's' : ''}`}
                              {a.quality && ` · ${'★'.repeat(a.quality)}${'☆'.repeat(5 - a.quality)}`}
                            </div>
                          </div>
                          {a.suggested_grade && (
                            <div className="ascent-grade-pill" style={{ color: gradeColor(a.suggested_grade) }}>
                              {a.suggested_grade}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}
        </main>
      </div>
    </>
  )
}
