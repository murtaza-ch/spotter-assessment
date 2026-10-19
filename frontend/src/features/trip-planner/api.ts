import { apiClient } from '@/lib/api/client'

import type { TripRequest } from './types'

export class PlanningError extends Error {
  readonly fields: Record<string, unknown>

  constructor(message: string, fields: Record<string, unknown> = {}) {
    super(message)
    this.fields = fields
    this.name = 'PlanningError'
  }
}

function requestError(error: unknown): PlanningError {
  if (error && typeof error === 'object' && 'detail' in error && typeof error.detail === 'string') {
    const fields =
      'fields' in error && error.fields && typeof error.fields === 'object' ? error.fields : {}
    return new PlanningError(error.detail, Object.fromEntries(Object.entries(fields)))
  }
  return new PlanningError('The planning service is unavailable. Please try again.')
}

export async function createPlan(body: TripRequest) {
  const { data, error } = await apiClient.POST('/plans/', {
    body,
    signal: AbortSignal.timeout(120_000),
  })
  if (!data) throw requestError(error)
  return data
}

export async function getForecast(planId: string, signal: AbortSignal) {
  const { data, error } = await apiClient.GET('/plans/{plan_id}/forecast/', {
    params: { path: { plan_id: planId } },
    signal: AbortSignal.any([signal, AbortSignal.timeout(90_000)]),
  })
  if (!data) throw requestError(error)
  return data
}
