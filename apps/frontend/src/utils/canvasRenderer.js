// ─── canvasRenderer.js ───────────────────────────────────────────────────────
// Shared hold-rendering logic for RouteDetailPage and RouteCreatePage.
//
// Role colour palette — outlines only, no fill.
export const ROLE_COLORS = {
    start: { stroke: '#6bcb77', glow: '#6bcb77' },  // green ✓
    end:   { stroke: '#ff4040', glow: '#ff4040' },  // red
    any:   { stroke: '#ff9030', glow: '#ff9030' },  // orange
    foot:  { stroke: '#60aaff', glow: '#60aaff' },  // blue
  }
  
  // Build a polygon path on any canvas context.
  function buildPath(ctx, pts, imgScale, tx) {
    ctx.beginPath()
    ctx.moveTo(pts[0].x * imgScale * tx.z + tx.x, pts[0].y * imgScale * tx.z + tx.y)
    for (let i = 1; i < pts.length; i++)
      ctx.lineTo(pts[i].x * imgScale * tx.z + tx.x, pts[i].y * imgScale * tx.z + tx.y)
    ctx.closePath()
  }
  
  // Compute a rough centroid + bounding-box scale factor for a polygon,
  // used to inset the double-outline ring for START holds.
  function polygonCentroidAndScale(pts, imgScale, tx) {
    let cx = 0, cy = 0
    for (const p of pts) {
      cx += p.x * imgScale * tx.z + tx.x
      cy += p.y * imgScale * tx.z + tx.y
    }
    cx /= pts.length; cy /= pts.length
    return { cx, cy }
  }
  
  /**
   * renderCanvas(imageCanvas, overlayCanvas, img, allHolds, roleMap, state)
   *
   * roleMap — plain object  { [holdId]: 'START' | 'END' | 'ANY' | 'FOOT' }
   *           Pass holdRolesRef.current from RouteCreatePage,
   *           or the routeHoldMap object from RouteDetailPage.
   */
  export function renderCanvas(imageCanvas, overlayCanvas, img, allHolds, roleMap, state) {
    if (!imageCanvas || !overlayCanvas) return
    const { tx, imgScale, origWidth, origHeight } = state
  
    // ── Image layer ────────────────────────────────────────────────────────────
    const ic = imageCanvas.getContext('2d')
    ic.clearRect(0, 0, imageCanvas.width, imageCanvas.height)
    if (img) {
      ic.drawImage(img, tx.x, tx.y, origWidth * imgScale * tx.z, origHeight * imgScale * tx.z)
    }
  
    // ── Overlay layer ──────────────────────────────────────────────────────────
    const oc = overlayCanvas.getContext('2d')
    oc.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height)
  
    for (const hold of allHolds) {
      const pts = hold.polygon
      if (!pts || pts.length < 2) continue
      const role = roleMap[hold.id] ?? null
  
      if (!role) {
        // Inactive hold — faint white outline only
        buildPath(oc, pts, imgScale, tx)
        oc.strokeStyle = 'rgba(255,255,255,0.18)'
        oc.lineWidth = 1
        oc.stroke()
        continue
      }
  
      const colors = ROLE_COLORS[role]
  
      // ── Glow pass ────────────────────────────────────────────────────────────
      buildPath(oc, pts, imgScale, tx)
      oc.shadowColor = colors.glow
      oc.shadowBlur = 10
  
      if (role === 'end') {
        // Dashed outline
        oc.setLineDash([4, 3])
        oc.strokeStyle = colors.stroke
        oc.lineWidth = 2
        oc.stroke()
        oc.setLineDash([])
  
      } else if (role === 'start') {
        // Solid outline
        oc.strokeStyle = colors.stroke
        oc.lineWidth = 3
        oc.stroke()
        oc.shadowBlur = 0
  
        // Inner inset ring — shrink each point toward centroid by ~6px
        const { cx, cy } = polygonCentroidAndScale(pts, imgScale, tx)
        const INSET = 10
        oc.beginPath()
        for (let i = 0; i < pts.length; i++) {
          const sx = pts[i].x * imgScale * tx.z + tx.x
          const sy = pts[i].y * imgScale * tx.z + tx.y
          const dx = sx - cx, dy = sy - cy
          const dist = Math.hypot(dx, dy) || 1
          const nx = sx - (dx / dist) * INSET
          const ny = sy - (dy / dist) * INSET
          i === 0 ? oc.moveTo(nx, ny) : oc.lineTo(nx, ny)
        }
        oc.closePath()
        oc.strokeStyle = colors.stroke
        oc.lineWidth = 2
        oc.globalAlpha = 0.9
        oc.stroke()
        oc.globalAlpha = 1
  
      } else if (role === 'foot') {
        // Thin, lower-opacity solid outline
        oc.strokeStyle = colors.stroke
        oc.lineWidth = 1.5
        oc.globalAlpha = 0.55
        oc.stroke()
        oc.globalAlpha = 1

        const { cx, cy } = polygonCentroidAndScale(pts, imgScale, tx)
        const ARM = 4  // half-length of cross arms in px
        oc.beginPath()
        oc.moveTo(cx - ARM, cy); oc.lineTo(cx + ARM, cy)
        oc.moveTo(cx, cy - ARM); oc.lineTo(cx, cy + ARM)
        oc.strokeStyle = colors.stroke
        oc.lineWidth = 2
        oc.globalAlpha = 0.8
        oc.stroke()
        oc.globalAlpha = 1
  
      } else {
        // ANY — clean solid outline
        oc.strokeStyle = colors.stroke
        oc.lineWidth = 2
        oc.stroke()
      }
  
      oc.shadowBlur = 0
    }
  }
