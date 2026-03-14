// src/components/SaveButtons.jsx
// Liked + Todo toggle buttons.
//
// For WallDetailPage — pass wallId, uses wall-level relations cache:
//   <SaveButtons routeId={route.id} wallId={wallId} onClickCapture={e => e.stopPropagation()} />
//
// For RouteDetailPage — omit wallId, fetches single relation:
//   <SaveButtons routeId={routeId} />

import { useRouteRelations } from '../hooks/useRouteRelations'
import { useRouteRelation }  from '../hooks/useRouteRelation'

const btnStyle = (active, activeColor) => ({
  background: 'none',
  border: 'none',
  padding: '6px',
  cursor: 'pointer',
  fontSize: 16,
  flexShrink: 0,
  color: active ? activeColor : 'rgba(245,240,235,0.2)',
  transition: 'color 0.15s, transform 0.15s',
  lineHeight: 1,
})

// ─── Wall-level variant ───────────────────────────────────────────────────────
function WallSaveButtons({ routeId, wallId, onClick }) {
  const { isLiked, isTodo, toggle } = useRouteRelations(wallId)

  const handleLike = (e) => { onClick?.(e); toggle(routeId, 'liked') }
  const handleTodo = (e) => { onClick?.(e); toggle(routeId, 'todo') }

  return (
    <>
      <button
        style={btnStyle(isLiked(routeId), '#ff6060')}
        onClick={handleLike}
        title={isLiked(routeId) ? 'Unlike' : 'Like'}
      >
        {isLiked(routeId) ? '♥' : '♡'}
      </button>
      <button
        style={btnStyle(isTodo(routeId), '#ffb347')}
        onClick={handleTodo}
        title={isTodo(routeId) ? 'Remove from todo' : 'Add to todo'}
      >
        {isTodo(routeId) ? '★' : '☆'}
      </button>
    </>
  )
}

// ─── Single-route variant ─────────────────────────────────────────────────────
function RouteSaveButtons({ routeId }) {
  const { isLiked, isTodo, toggle } = useRouteRelation(routeId)

  return (
    <>
      <button
        style={btnStyle(isLiked, '#ff6060')}
        onClick={() => toggle('liked')}
        title={isLiked ? 'Unlike' : 'Like'}
      >
        {isLiked ? '♥' : '♡'}
      </button>
      <button
        style={btnStyle(isTodo, '#ffb347')}
        onClick={() => toggle('todo')}
        title={isTodo ? 'Remove from todo' : 'Add to todo'}
      >
        {isTodo ? '★' : '☆'}
      </button>
    </>
  )
}

// ─── Exported component ───────────────────────────────────────────────────────
export default function SaveButtons({ routeId, wallId, onClick }) {
  if (wallId) return <WallSaveButtons routeId={routeId} wallId={wallId} onClick={onClick} />
  return <RouteSaveButtons routeId={routeId} />
}
