// src/hooks/useRouteRelations.js
// Wall-level relations hook — used by WallDetailPage.
// Fetches all liked/todo relations for the current user on a given wall.

import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../api/axios'

export function useRouteRelations(wallId) {
  const queryClient = useQueryClient()

  const { data: relations } = useQuery({
    queryKey: ['relations', wallId],
    queryFn: async () => (await api.get(`/walls/${wallId}/routes/my_relations`)).data,
    select: data => {
      // Build a map: { [routeId]: { liked, todo } }
      const map = {}
      for (const r of data) map[r.route_id] = { liked: r.liked, todo: r.todo }
      return map
    },
  })

  const isLiked = (routeId) => relations?.[routeId]?.liked ?? false
  const isTodo  = (routeId) => relations?.[routeId]?.todo  ?? false

  const toggle = async (routeId, field) => {
    const current = relations?.[routeId] ?? { liked: false, todo: false }
    const updated = { ...current, [field]: !current[field] }

    // Optimistic update
    queryClient.setQueryData(['relations', wallId], old => {
      if (!old) return old
      return old.map(r => r.route_id === routeId ? { ...r, [field]: updated[field] } : r)
    })

    try {
      await api.post(`/routes/${routeId}/relations`, { [field]: updated[field] })
    } catch {
      // Rollback on failure
      queryClient.invalidateQueries({ queryKey: ['relations', wallId] })
    }
  }

  return { isLiked, isTodo, toggle }
}
