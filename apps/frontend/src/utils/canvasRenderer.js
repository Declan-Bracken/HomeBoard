// ─── canvasRenderer.js ───────────────────────────────────────────────────────
// Shared hold-rendering logic for RouteDetailPage and RouteCreatePage.

export const ROLE_COLORS = {
    start: { stroke: '#6bcb77', glow: '#6bcb77' },  // green
    end:   { stroke: '#ff4040', glow: '#ff4040' },  // red
    any:   { stroke: '#ff9030', glow: '#ff9030' },  // orange
    foot:  { stroke: '#60aaff', glow: '#60aaff' },  // blue
  }
  
  function buildPath(ctx, pts, imgScale, tx) {
    ctx.beginPath()
    ctx.moveTo(pts[0].x * imgScale * tx.z + tx.x, pts[0].y * imgScale * tx.z + tx.y)
    for (let i = 1; i < pts.length; i++)
      ctx.lineTo(pts[i].x * imgScale * tx.z + tx.x, pts[i].y * imgScale * tx.z + tx.y)
    ctx.closePath()
  }
  
  function polygonCentroid(pts, imgScale, tx) {
    let cx = 0, cy = 0
    for (const p of pts) {
      cx += p.x * imgScale * tx.z + tx.x
      cy += p.y * imgScale * tx.z + tx.y
    }
    return { cx: cx / pts.length, cy: cy / pts.length }
  }
  
  /**
   * renderCanvas(imageCanvas, overlayCanvas, img, allHolds, roleMap, state)
   *
   * roleMap — plain object { [holdId]: 'start' | 'end' | 'any' | 'foot' }
   *           Pass holdRolesRef.current from RouteCreatePage,
   *           or the routeHoldMap object from RouteDetailPage.
   */
  export function renderCanvas(imageCanvas, overlayCanvas, img, allHolds, roleMap, state) {
    if (!imageCanvas || !overlayCanvas) return
    const { tx, imgScale, origWidth, origHeight } = state
  
    // ── Image canvas — full brightness, never touched again ───────────────────
    const ic = imageCanvas.getContext('2d')
    ic.clearRect(0, 0, imageCanvas.width, imageCanvas.height)
    if (img) {
      ic.drawImage(img, tx.x, tx.y, origWidth * imgScale * tx.z, origHeight * imgScale * tx.z)
    }
  
    // ── Overlay canvas ────────────────────────────────────────────────────────
    const oc = overlayCanvas.getContext('2d')
    oc.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height)
  
    // 1. Dark overlay across full canvas
    oc.fillStyle = 'rgba(0,0,0,0.45)'
    oc.fillRect(0, 0, overlayCanvas.width, overlayCanvas.height)
  
    // 2. Punch holes ONLY for assigned holds
    oc.globalCompositeOperation = 'destination-out'
    for (const hold of allHolds) {
      const pts = hold.polygon
      if (!pts || pts.length < 2) continue
      const role = roleMap[hold.id] ?? null
      if (!role) continue  // skip unassigned — leave them darkened
      buildPath(oc, pts, imgScale, tx)
      oc.fill()
    }
    oc.globalCompositeOperation = 'source-over'

    // 3. Draw outlines ONLY for assigned holds — remove the unassigned outline block entirely
    for (const hold of allHolds) {
      const pts = hold.polygon
      if (!pts || pts.length < 2) continue
      const role = roleMap[hold.id] ?? null
      if (!role) continue  // no outline for unassigned holds
  
      const colors = ROLE_COLORS[role]
      oc.shadowColor = colors.glow
      oc.shadowBlur = 10
  
      if (role === 'start') {
        // Solid outline
        buildPath(oc, pts, imgScale, tx)
        oc.strokeStyle = colors.stroke
        oc.lineWidth = 2.5
        oc.stroke()
        oc.shadowBlur = 0
      
        // Two outward tick marks from top-left and top-right of bounding box
        const xs = pts.map(p => p.x * imgScale * tx.z + tx.x)
        const ys = pts.map(p => p.y * imgScale * tx.z + tx.y)
        const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys)
        const TICK = 8
        oc.strokeStyle = colors.stroke
        oc.lineWidth = 2
        // Left tick
        oc.beginPath()
        oc.moveTo(minX, minY)
        oc.lineTo(minX - TICK, minY - TICK)
        oc.stroke()
        // Right tick
        oc.beginPath()
        oc.moveTo(maxX, minY)
        oc.lineTo(maxX + TICK, minY - TICK)
        oc.stroke()
      
      } else if (role === 'end') {
        // Solid outline
        buildPath(oc, pts, imgScale, tx)
        oc.strokeStyle = colors.stroke
        oc.lineWidth = 2.5
        oc.stroke()
        oc.shadowBlur = 0
      
        // X mark above the hold centroid — exterior, not inside
        const { cx, cy } = polygonCentroid(pts, imgScale, tx)
        const ys = pts.map(p => p.y * imgScale * tx.z + tx.y)
        const minY = Math.min(...ys)
        const ARM = 6
        const ox = cx
        const oy = minY - 10  // above the hold
        oc.strokeStyle = colors.stroke
        oc.lineWidth = 2
        oc.beginPath()
        oc.moveTo(ox - ARM, oy - ARM); oc.lineTo(ox + ARM, oy + ARM)
        oc.stroke()
        oc.beginPath()
        oc.moveTo(ox + ARM, oy - ARM); oc.lineTo(ox - ARM, oy + ARM)
        oc.stroke()
      
      } else if (role === 'foot') {
        // Dashed outline
        buildPath(oc, pts, imgScale, tx)
        oc.setLineDash([5, 4])
        oc.strokeStyle = colors.stroke
        oc.lineWidth = 2
        oc.stroke()
        oc.setLineDash([])
      
      } else {
        // any — solid outline
        buildPath(oc, pts, imgScale, tx)
        oc.strokeStyle = colors.stroke
        oc.lineWidth = 2
        oc.stroke()
      }
      
      oc.shadowBlur = 0
    }
  }
