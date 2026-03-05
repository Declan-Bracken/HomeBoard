import { useState, useEffect, useRef, useCallback } from 'react'

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

// ─── Point-in-polygon hit test (screen space) ─────────────────────────────────
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

// ─── Main render function ─────────────────────────────────────────────────────
function render(imageCanvas, overlayCanvas, img, holds, state) {
  if (!imageCanvas || !overlayCanvas) return
  const { tx, imgScale, selectedIds, mode, drawPts, mousePos, origWidth, origHeight } = state

  // Image layer
  const ic = imageCanvas.getContext('2d')
  ic.clearRect(0, 0, imageCanvas.width, imageCanvas.height)
  if (img) {
    ic.drawImage(img, tx.x, tx.y, origWidth * imgScale * tx.z, origHeight * imgScale * tx.z)
  }

  // Overlay layer
  const oc = overlayCanvas.getContext('2d')
  oc.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height)

  for (const hold of holds) {
    const pts = hold.polygon
    if (!pts || pts.length < 2) continue
    oc.beginPath()
    oc.moveTo(pts[0].x * imgScale * tx.z + tx.x, pts[0].y * imgScale * tx.z + tx.y)
    for (let i = 1; i < pts.length; i++) {
      oc.lineTo(pts[i].x * imgScale * tx.z + tx.x, pts[i].y * imgScale * tx.z + tx.y)
    }
    oc.closePath()
    const sel = selectedIds.has(hold._id)
    const isNew = !!hold.isNew
    oc.fillStyle = isNew ? 'rgba(100,200,255,0.2)' : 'rgba(255,100,40,0.18)'
    oc.fill()
    oc.strokeStyle = sel ? '#fff' : isNew ? '#64c8ff' : '#ff6428'
    oc.lineWidth = sel ? 2.5 : 1.5
    if (sel) { oc.shadowColor = '#fff'; oc.shadowBlur = 8 }
    oc.stroke()
    oc.shadowBlur = 0
  }

  // In-progress polygon
  if (mode === 'draw' && drawPts.length > 0) {
    const all = mousePos ? [...drawPts, mousePos] : drawPts
    oc.beginPath()
    oc.moveTo(all[0].x * imgScale * tx.z + tx.x, all[0].y * imgScale * tx.z + tx.y)
    for (let i = 1; i < all.length; i++) {
      oc.lineTo(all[i].x * imgScale * tx.z + tx.x, all[i].y * imgScale * tx.z + tx.y)
    }
    oc.strokeStyle = 'rgba(100,200,255,0.85)'
    oc.lineWidth = 1.5
    oc.setLineDash([4, 4])
    oc.stroke()
    oc.setLineDash([])

    const fp = drawPts[0]
    oc.beginPath()
    oc.arc(fp.x * imgScale * tx.z + tx.x, fp.y * imgScale * tx.z + tx.y,
      drawPts.length >= 3 ? 7 : 4, 0, Math.PI * 2)
    oc.fillStyle = drawPts.length >= 3 ? '#64c8ff' : 'white'
    oc.fill()

    for (const p of drawPts) {
      oc.beginPath()
      oc.arc(p.x * imgScale * tx.z + tx.x, p.y * imgScale * tx.z + tx.y, 3, 0, Math.PI * 2)
      oc.fillStyle = 'white'
      oc.fill()
    }
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function HoldCanvas({ preview, onConfirm }) {
  const containerRef = useRef(null)
  const imageCanvasRef = useRef(null)
  const overlayCanvasRef = useRef(null)

  const S = useRef({
    tx: { x: 0, y: 0, z: 1 },
    imgScale: 1,
    origWidth: 1,
    origHeight: 1,
    holds: [],
    selectedIds: new Set(),
    mode: 'select',
    drawPts: [],
    mousePos: null,
    img: null,
    isDragging: false,
    dragOrigin: null,
  })

  const [uiHolds, setUiHolds] = useState([])
  const [uiSelectedCount, setUiSelectedCount] = useState(0)
  const [uiMode, setUiMode] = useState('select')
  const [uiDrawPts, setUiDrawPts] = useState([])
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 500 })

  const nextId = useRef(1000)
  const rafRef = useRef(null)

  const scheduleRender = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      render(imageCanvasRef.current, overlayCanvasRef.current, S.current.img, S.current.holds, S.current)
    })
  }, [])

  const setMode = useCallback((m) => {
    S.current.mode = m
    S.current.drawPts = []
    S.current.mousePos = null
    setUiMode(m)
    setUiDrawPts([])
    scheduleRender()
  }, [scheduleRender])

  const toggleSelected = useCallback((id) => {
    const next = new Set(S.current.selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    S.current.selectedIds = next
    setUiSelectedCount(next.size)
    scheduleRender()
  }, [scheduleRender])

  const clearSelected = useCallback(() => {
    S.current.selectedIds = new Set()
    setUiSelectedCount(0)
    scheduleRender()
  }, [scheduleRender])

  const setHolds = useCallback((updater) => {
    const next = typeof updater === 'function' ? updater(S.current.holds) : updater
    S.current.holds = next
    setUiHolds(next)
    scheduleRender()
  }, [scheduleRender])

  // ── Setup: image + scale ──
  useEffect(() => {
    const src = `data:image/jpeg;base64,${preview.image_b64}`
    downsampleImage(src, 1200).then(img => {
      S.current.img = img
      scheduleRender()
    })
  }, [preview.image_b64, scheduleRender])

  useEffect(() => {
    if (!containerRef.current) return
    const w = containerRef.current.offsetWidth
    const maxH = Math.min(window.innerHeight * 0.75, 700)
    const scaleByWidth = w / preview.image_width
    const scaleByHeight = maxH / preview.image_height
    const s = Math.min(scaleByWidth, scaleByHeight)
    const displayW = preview.image_width * s
    const displayH = preview.image_height * s

    S.current.imgScale = s
    S.current.origWidth = preview.image_width
    S.current.origHeight = preview.image_height
    S.current.tx = { x: (w - displayW) / 2, y: 0, z: 1 }

    setCanvasSize({ width: w, height: displayH })
    scheduleRender()
  }, [preview.image_width, preview.image_height, scheduleRender])

  useEffect(() => {
    scheduleRender()
  }, [canvasSize, scheduleRender])

  useEffect(() => {
    const initial = preview.holds.map((h, i) => ({ ...h, _id: i }))
    setHolds(initial)
  }, [preview.holds, setHolds])

  // ── Pointer events ──
  useEffect(() => {
    const overlay = overlayCanvasRef.current
    if (!overlay) return

    const getPos = (e) => {
      const r = overlay.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }

    const toImg = (sx, sy) => {
      const { tx, imgScale } = S.current
      return { x: (sx - tx.x) / (imgScale * tx.z), y: (sy - tx.y) / (imgScale * tx.z) }
    }

    const onMouseDown = (e) => {
      if (S.current.mode !== 'select') return
      const pos = getPos(e)
      S.current.isDragging = false
      S.current.dragOrigin = { mx: pos.x, my: pos.y, tx: S.current.tx.x, ty: S.current.tx.y }
    }

    const onMouseMove = (e) => {
      const pos = getPos(e)
      if (S.current.mode === 'select' && S.current.dragOrigin) {
        const d = S.current.dragOrigin
        const dx = pos.x - d.mx
        const dy = pos.y - d.my
        if (Math.hypot(dx, dy) > 3) S.current.isDragging = true
        S.current.tx = { ...S.current.tx, x: d.tx + dx, y: d.ty + dy }
        scheduleRender()
        return
      }
      if (S.current.mode === 'draw') {
        S.current.mousePos = toImg(pos.x, pos.y)
        scheduleRender()
      }
    }

    const onMouseUp = () => {
      S.current.dragOrigin = null
    }

    const onClick = (e) => {
      if (S.current.isDragging) {
        S.current.isDragging = false
        return
      }
      const pos = getPos(e)
      const { mode, holds, imgScale, tx, drawPts } = S.current

      if (mode === 'select') {
        let hit = null
        for (let i = holds.length - 1; i >= 0; i--) {
          if (hitTest(pos.x, pos.y, holds[i].polygon, imgScale, tx)) {
            hit = holds[i]._id; break
          }
        }
        if (hit !== null) toggleSelected(hit)
        else clearSelected()
        return
      }

      if (mode === 'draw') {
        const imgPos = toImg(pos.x, pos.y)
        if (drawPts.length >= 3) {
          const fp = drawPts[0]
          const fpScreen = {
            x: fp.x * imgScale * tx.z + tx.x,
            y: fp.y * imgScale * tx.z + tx.y,
          }
          if (Math.hypot(pos.x - fpScreen.x, pos.y - fpScreen.y) < 12) {
            const newHold = {
              _id: nextId.current++,
              isNew: true,
              polygon: drawPts,
              x_center: Math.round(drawPts.reduce((s, p) => s + p.x, 0) / drawPts.length),
              y_center: Math.round(drawPts.reduce((s, p) => s + p.y, 0) / drawPts.length),
              x_min: Math.round(Math.min(...drawPts.map(p => p.x))),
              x_max: Math.round(Math.max(...drawPts.map(p => p.x))),
              y_min: Math.round(Math.min(...drawPts.map(p => p.y))),
              y_max: Math.round(Math.max(...drawPts.map(p => p.y))),
              confidence: null,
            }
            S.current.drawPts = []
            S.current.mousePos = null
            setUiDrawPts([])
            setHolds(prev => [...prev, newHold])
            return
          }
        }
        S.current.drawPts = [...drawPts, imgPos]
        setUiDrawPts(S.current.drawPts)
        scheduleRender()
      }
    }

    const onWheel = (e) => {
      e.preventDefault()
      const pos = getPos(e)
      const { tx } = S.current
      const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08
      const newZ = Math.min(Math.max(tx.z * factor, 0.3), 8)
      S.current.tx = {
        z: newZ,
        x: pos.x - (pos.x - tx.x) * (newZ / tx.z),
        y: pos.y - (pos.y - tx.y) * (newZ / tx.z),
      }
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
  }, [scheduleRender, toggleSelected, clearSelected, setHolds])

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && S.current.selectedIds.size > 0) {
        setHolds(prev => prev.filter(h => !S.current.selectedIds.has(h._id)))
        clearSelected()
      }
      if (e.key === 'Escape') setMode('select')
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setHolds, clearSelected, setMode])

  const handleConfirm = () => {
    onConfirm(S.current.holds.map(h => ({
      x_min: h.x_min, x_max: h.x_max,
      y_min: h.y_min, y_max: h.y_max,
      x_center: h.x_center, y_center: h.y_center,
      confidence: h.confidence ?? null,
      polygon: h.polygon,
    })))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={toolbarStyle}>
        <div style={{ display: 'flex', gap: 8 }}>
          <ToolButton active={uiMode === 'select'} onClick={() => setMode('select')}>↖ Select</ToolButton>
          <ToolButton active={uiMode === 'draw'} onClick={() => setMode('draw')}>✏ Draw Hold</ToolButton>
          {uiMode === 'draw' && uiDrawPts.length > 0 && (
            <ToolButton onClick={() => { S.current.drawPts = []; setUiDrawPts([]); scheduleRender() }}>✕ Cancel</ToolButton>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={statStyle}>{uiHolds.length} holds</span>
          {uiSelectedCount > 0 && (
            <ToolButton danger onClick={() => {
              setHolds(prev => prev.filter(h => !S.current.selectedIds.has(h._id)))
              clearSelected()
            }}>
              🗑 Delete {uiSelectedCount > 1 ? `${uiSelectedCount} Holds` : 'Hold'}
            </ToolButton>
          )}
          <ToolButton confirm onClick={handleConfirm}>✓ Confirm Holds</ToolButton>
        </div>
      </div>

      <div style={hintStyle}>
        {uiMode === 'select'
          ? 'Click holds to select (multi-select supported). Delete key or button to remove. Scroll to zoom, drag to pan.'
          : uiDrawPts.length === 0 ? 'Click to place the first point.'
          : uiDrawPts.length < 3 ? `${uiDrawPts.length} point${uiDrawPts.length > 1 ? 's' : ''} — keep clicking.`
          : 'Click near the first point (blue dot) to close the polygon.'}
      </div>

      <div ref={containerRef} style={{
        position: 'relative', width: '100%', height: canvasSize.height,
        borderRadius: 2, border: '1px solid rgba(255,255,255,0.08)',
        background: '#0a0908', overflow: 'hidden',
      }}>
        <canvas ref={imageCanvasRef} width={canvasSize.width} height={canvasSize.height}
          style={{ position: 'absolute', top: 0, left: 0 }} />
        <canvas ref={overlayCanvasRef} width={canvasSize.width} height={canvasSize.height}
          style={{ position: 'absolute', top: 0, left: 0, cursor: uiMode === 'draw' ? 'crosshair' : 'grab' }} />
      </div>
    </div>
  )
}

const toolbarStyle = {
  display: 'flex', justifyContent: 'space-between',
  alignItems: 'center', padding: '10px 0', flexWrap: 'wrap', gap: 8,
}
const hintStyle = {
  fontSize: 12, fontWeight: 300,
  color: 'rgba(245, 240, 235, 0.35)', fontFamily: 'DM Sans, sans-serif',
}
const statStyle = {
  fontSize: 12, fontWeight: 500, letterSpacing: '0.1em',
  textTransform: 'uppercase', color: '#ff6428', fontFamily: 'DM Sans, sans-serif',
}

function ToolButton({ children, active, danger, confirm, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: confirm ? '#ff6428' : active ? 'rgba(255,100,40,0.15)' : 'rgba(255,255,255,0.04)',
      border: `1px solid ${confirm ? '#ff6428' : active ? 'rgba(255,100,40,0.4)' : danger ? 'rgba(255,80,80,0.3)' : 'rgba(255,255,255,0.08)'}`,
      borderRadius: 2, padding: '7px 14px', fontSize: 12,
      fontFamily: 'DM Sans, sans-serif', fontWeight: 500, letterSpacing: '0.05em',
      color: confirm ? '#0f0e0d' : danger ? '#ff6060' : active ? '#ff6428' : 'rgba(245,240,235,0.6)',
      cursor: 'pointer', transition: 'all 0.15s',
    }}>
      {children}
    </button>
  )
}
