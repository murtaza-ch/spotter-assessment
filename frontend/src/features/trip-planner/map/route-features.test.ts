import { describe, expect, it } from 'vitest'

import { planFixture } from '../../../../../e2e/fixtures/planning'
import { routeFeatures } from './route-features'

describe('planning map data', () => {
  it('keeps every route checkpoint visible and identifies the route on click', () => {
    const plan = planFixture()
    const { checkpoints, routes } = routeFeatures(plan, 'route-2')
    expect(checkpoints.features).toHaveLength(9)
    expect(new Set(checkpoints.features.map((point) => point.properties?.routeId))).toEqual(
      new Set(['route-1', 'route-2', 'route-3']),
    )
    expect(checkpoints.features.filter((point) => point.properties?.selected === 1)).toHaveLength(3)
    expect(routes.features.some((line) => line.properties?.routeId === 'route-1')).toBe(true)
  })

  it('clears all map data when starting a new trip', () => {
    const data = routeFeatures(undefined, undefined)
    expect(Object.values(data).every((collection) => collection.features.length === 0)).toBe(true)
  })
})
