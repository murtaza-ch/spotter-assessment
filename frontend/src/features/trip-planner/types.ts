import type { components } from '@/lib/api/schema'
import type { MethodResponse } from 'openapi-fetch'
import type { apiClient } from '@/lib/api/client'

export type TripRequest = components['schemas']['TripRequestRequest']
export type Plan = MethodResponse<typeof apiClient, 'post', '/plans/'>
export type RouteOption = Plan['routes'][number]
export type Checkpoint = RouteOption['checkpoints'][number]
export type Forecast = MethodResponse<typeof apiClient, 'get', '/plans/{plan_id}/forecast/'>
export type RiskLevel = components['schemas']['RiskLevelEnum']
export type LngLat = [number, number]
