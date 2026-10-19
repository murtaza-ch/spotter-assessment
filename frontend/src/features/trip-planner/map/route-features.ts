import type { FeatureCollection, LineString, Point } from 'geojson'

import type { Plan, RiskLevel } from '../types'

interface RouteProperties {
  routeId: string
  risk: RiskLevel
  selected: number
}

interface CheckpointProperties extends RouteProperties {
  index: number
}

export function routeFeatures(plan: Plan | undefined, selectedId: string | undefined) {
  const routes: FeatureCollection<LineString, RouteProperties> = {
    type: 'FeatureCollection',
    features: (plan?.routes ?? []).flatMap((route) =>
      route.segments.map((segment) => ({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: segment.coordinates },
        properties: {
          routeId: route.id,
          risk: segment.risk,
          selected: route.id === selectedId ? 1 : 0,
        },
      })),
    ),
  }
  const checkpoints: FeatureCollection<Point, CheckpointProperties> = {
    type: 'FeatureCollection',
    features: (plan?.routes ?? []).flatMap((route) =>
      route.checkpoints.map((point) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: point.coordinates },
        properties: {
          routeId: route.id,
          index: point.index,
          risk: point.risk,
          selected: route.id === selectedId ? 1 : 0,
        },
      })),
    ),
  }
  const endpoints: FeatureCollection<Point> = {
    type: 'FeatureCollection',
    features: plan
      ? [plan.origin, plan.destination].map((place) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: place.coordinates },
          properties: {},
        }))
      : [],
  }
  return { routes, checkpoints, endpoints }
}
