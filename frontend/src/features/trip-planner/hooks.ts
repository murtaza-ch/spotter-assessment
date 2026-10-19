import { useMutation, useQuery } from '@tanstack/react-query'

import { createPlan, getForecast } from './api'

export function useTripPlanning() {
  return useMutation({ mutationFn: createPlan })
}

export function usePlanForecast(planId: string | undefined) {
  return useQuery({
    queryKey: ['planning', 'forecast', planId],
    queryFn: ({ signal }) => {
      if (!planId) throw new Error('A trip is required to fetch forecasts.')
      return getForecast(planId, signal)
    },
    enabled: Boolean(planId),
    staleTime: 20 * 60_000,
  })
}
