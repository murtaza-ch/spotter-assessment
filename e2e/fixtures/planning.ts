import type { components } from '../../frontend/src/lib/api/schema'

type Plan = components['schemas']['PlanResponse']
type Forecast = components['schemas']['ForecastResponse']

/** Synthetic transport fixtures are test-only; the application always uses real providers. */
export function planFixture(blocked = false): Plan {
  const departure = new Date('2026-10-20T12:00:00Z')
  const routes: Plan['routes'] = [0, 1, 2].map((index) => {
    const risk = blocked ? 4 : index === 0 ? 0 : index === 1 ? 1 : 2
    const coordinates: [number, number][] = [
      [-87.6298, 41.8781],
      [-85.6, 41.7 + index * 0.6],
      [-83.0458, 42.3314],
    ]
    const miles = 283 + index * 25
    const duration = 15300 + index * 1200
    return {
      id: `route-${index + 1}`,
      name: `Route ${index + 1}`,
      distance_miles: miles,
      duration_seconds: duration,
      arrival_at: new Date(departure.getTime() + duration * 1000).toISOString(),
      geometry: coordinates,
      segments: [{ coordinates, risk, distance_miles: miles }],
      checkpoints: coordinates.map((point, pointIndex) => ({
        index: pointIndex,
        coordinates: point,
        distance_miles: (miles * pointIndex) / 2,
        arrival_at: new Date(
          departure.getTime() + ((duration * pointIndex) / 2) * 1000,
        ).toISOString(),
        risk,
        wind_mph: blocked ? 60 : index === 0 ? 12 : index === 1 ? 28 : 40,
        rain_in: 0,
        snow_in: 0,
        temperature_f: 60,
      })),
      summary: {
        miles_by_risk: {
          '-1': 0,
          '0': risk === 0 ? miles : 0,
          '1': risk === 1 ? miles : 0,
          '2': risk === 2 ? miles : 0,
          '3': 0,
          '4': risk === 4 ? miles : 0,
        },
        average_risk: risk,
        maximum_risk: risk,
        eligible: !blocked,
      },
    }
  })
  return {
    id: '11111111-1111-4111-8111-111111111111',
    origin: { label: 'Chicago, IL', coordinates: [-87.6298, 41.8781] },
    destination: { label: 'Detroit, MI', coordinates: [-83.0458, 42.3314] },
    departure_at: departure.toISOString(),
    load_weight_lb: 35000,
    sample_interval_miles: 25,
    routes,
    recommended_route_id: blocked ? null : 'route-1',
    recommendation_reason: blocked
      ? 'No route can be recommended: every route has a No Travel segment.'
      : 'Best eligible route by Severe miles, High miles, distance-weighted risk, then travel time.',
    warnings: [],
  }
}

export function forecastFixture(): Forecast {
  return {
    coordinates: [
      [-87.6, 41.5],
      [-87.6, 42.2],
      [-85.5, 41.3],
      [-85.5, 42.3],
      [-83, 42],
      [-83, 42.7],
    ],
    hours: Array.from({ length: 49 }, (_, index) =>
      new Date(Date.UTC(2026, 9, 20, 12 + index)).toISOString(),
    ),
    risk_frames: Array.from({ length: 49 }, (_, hour) => [0, 0, hour >= 24 ? 2 : 0, 1, 0, 1]),
    corridor_half_width_miles: 25,
    warnings: [],
  }
}
