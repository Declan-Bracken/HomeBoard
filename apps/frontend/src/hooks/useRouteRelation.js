// src/hooks/useRouteRelation.js
// Single-route relation hook — used by RouteDetailPage.

import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../api/axios'

export function useRouteRelation(routeId) {
  const queryClient = useQueryClient()

  const { data: relation } = useQuery({
    queryKey: ['relation', routeId],
    queryFn: async () => {
      try {
        return (await api.get(`/routes/${routeId}/relations`)).data
      } catch {
        return { route_id: routeId, liked: false, todo: false }
      }
    },
  })

  const isLiked = relation?.liked ?? false
  const isTodo  = relation?.todo  ?? false

  const toggle = async (field) => {
    const updated = { liked: isLiked, todo: isTodo, [field]: !relation?.[field] }

    // Optimistic update
    queryClient.setQueryData(['relation', routeId], old => ({ ...old, [field]: updated[field] }))

    try {
      await api.post(`/routes/${routeId}/relations`, { [field]: updated[field] })
    } catch {
      queryClient.invalidateQueries({ queryKey: ['relation', routeId] })
    }
  }

  return { isLiked, isTodo, toggle }
}
