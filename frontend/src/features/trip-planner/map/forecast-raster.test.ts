import { describe, expect, it } from 'vitest'

import { buildForecastGrid, interpolatedRisk } from './forecast-raster'

describe('forecast interpolation', () => {
  it('keeps uniform low risk low even when many samples overlap', () => {
    expect(
      interpolatedRisk(
        [
          { index: 0, weight: 20 },
          { index: 1, weight: 5 },
          { index: 2, weight: 100 },
        ],
        [0, 0, 0],
      ),
    ).toBe(0)
  })

  it('normalizes weights rather than treating sampling density as risk', () => {
    expect(
      interpolatedRisk(
        [
          { index: 0, weight: 1 },
          { index: 1, weight: 1 },
        ],
        [1, 3],
      ),
    ).toBe(2)
    expect(
      interpolatedRisk(
        [
          { index: 0, weight: 10 },
          { index: 1, weight: 10 },
        ],
        [1, 3],
      ),
    ).toBe(2)
  })

  it('preserves materially unknown coverage', () => {
    expect(
      interpolatedRisk(
        [
          { index: 0, weight: 1 },
          { index: 1, weight: 1 },
        ],
        [0, -1],
      ),
    ).toBeNull()
  })

  it('masks pixels beyond the 25-mile trip corridor', () => {
    const grid = buildForecastGrid(
      [
        [-90, 39],
        [-89, 40],
        [-88, 41],
      ],
      [
        [
          [-90, 40],
          [-88, 40],
        ],
      ],
      24,
    )
    expect(grid.pixels.some((pixel) => pixel === null)).toBe(true)
    expect(grid.pixels.some((pixel) => pixel !== null)).toBe(true)
    expect(grid.pixels).toHaveLength(grid.width * grid.height)
  })
})
