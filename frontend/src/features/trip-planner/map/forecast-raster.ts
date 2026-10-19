/** Interpolate forecast values, not point density. Uniform low risk stays low everywhere. */
import type { LngLat, RiskLevel } from '../types'

type XY = [number, number]
interface WeightedSample {
  index: number
  weight: number
}
export interface ForecastGrid {
  width: number
  height: number
  corners: [LngLat, LngLat, LngLat, LngLat]
  pixels: (WeightedSample[] | null)[]
}

const earthRadius = 6_378_137
const colors: [number, number, number][] = [
  [61, 137, 84],
  [207, 178, 75],
  [223, 126, 66],
  [195, 62, 67],
  [105, 44, 71],
]

function project(coordinates: number[]): XY {
  const [longitude, latitude] = coordinates
  if (longitude === undefined || latitude === undefined)
    throw new Error('Invalid forecast coordinate.')
  return [
    (earthRadius * longitude * Math.PI) / 180,
    earthRadius * Math.log(Math.tan(Math.PI / 4 + (latitude * Math.PI) / 360)),
  ]
}

function unproject([x, y]: XY): LngLat {
  return [
    ((x / earthRadius) * 180) / Math.PI,
    ((2 * Math.atan(Math.exp(y / earthRadius)) - Math.PI / 2) * 180) / Math.PI,
  ]
}

function segmentDistanceSquared([x, y]: XY, start: XY, end: XY): number {
  const dx = end[0] - start[0],
    dy = end[1] - start[1]
  const length = dx * dx + dy * dy
  const ratio = length
    ? Math.max(0, Math.min(1, ((x - start[0]) * dx + (y - start[1]) * dy) / length))
    : 0
  return (x - start[0] - ratio * dx) ** 2 + (y - start[1] - ratio * dy) ** 2
}

function nearestSamples(point: XY, samples: XY[]): WeightedSample[] {
  const nearest: { index: number; distance: number }[] = []
  for (const [index, sample] of samples.entries()) {
    const distance = (sample[0] - point[0]) ** 2 + (sample[1] - point[1]) ** 2
    const farthest = nearest[3]
    if (farthest && distance >= farthest.distance) continue
    const position = nearest.findIndex((candidate) => distance < candidate.distance)
    nearest.splice(position === -1 ? nearest.length : position, 0, { index, distance })
    if (nearest.length > 4) nearest.pop()
  }
  return nearest.map((sample) => ({
    index: sample.index,
    weight: 1 / Math.max(1, sample.distance),
  }))
}

export function buildForecastGrid(
  coordinates: number[][],
  routes: number[][][],
  width = 112,
): ForecastGrid {
  const samples = coordinates.map(project)
  const routeSegments: [XY, XY][] = []
  for (const route of routes) {
    const points = route.map(project)
    for (let index = 1; index < points.length; index++) {
      const start = points[index - 1],
        end = points[index]
      if (start && end) routeSegments.push([start, end])
    }
  }
  const minX = Math.min(...samples.map((point) => point[0]))
  const maxX = Math.max(...samples.map((point) => point[0]))
  const minY = Math.min(...samples.map((point) => point[1]))
  const maxY = Math.max(...samples.map((point) => point[1]))
  const height = Math.max(
    32,
    Math.min(112, Math.round((width * (maxY - minY)) / Math.max(1, maxX - minX))),
  )
  const centerLatitude = unproject([(minX + maxX) / 2, (minY + maxY) / 2])[1]
  const corridorRadius = (25 * 1609.344) / Math.cos((centerLatitude * Math.PI) / 180)
  const corridorSegments = routeSegments.map(([start, end]) => ({
    start,
    end,
    minX: Math.min(start[0], end[0]) - corridorRadius,
    maxX: Math.max(start[0], end[0]) + corridorRadius,
    minY: Math.min(start[1], end[1]) - corridorRadius,
    maxY: Math.max(start[1], end[1]) + corridorRadius,
  }))
  const pixels: ForecastGrid['pixels'] = []
  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      const point: XY = [
        minX + ((column + 0.5) / width) * (maxX - minX),
        maxY - ((row + 0.5) / height) * (maxY - minY),
      ]
      if (
        !corridorSegments.some(
          (segment) =>
            point[0] >= segment.minX &&
            point[0] <= segment.maxX &&
            point[1] >= segment.minY &&
            point[1] <= segment.maxY &&
            segmentDistanceSquared(point, segment.start, segment.end) <= corridorRadius ** 2,
        )
      ) {
        pixels.push(null)
        continue
      }
      pixels.push(nearestSamples(point, samples))
    }
  }
  return {
    width,
    height,
    corners: [
      unproject([minX, maxY]),
      unproject([maxX, maxY]),
      unproject([maxX, minY]),
      unproject([minX, minY]),
    ],
    pixels,
  }
}

export function interpolatedRisk(samples: WeightedSample[], frame: RiskLevel[]): number | null {
  let weightedRisk = 0,
    totalWeight = 0,
    unknownWeight = 0
  for (const sample of samples) {
    const risk = frame[sample.index] ?? -1
    totalWeight += sample.weight
    if (risk === -1) unknownWeight += sample.weight
    else weightedRisk += risk * sample.weight
  }
  if (!totalWeight || unknownWeight / totalWeight > 0.1) return null
  return weightedRisk / (totalWeight - unknownWeight)
}

export function paintForecast(grid: ForecastGrid, frame: RiskLevel[]): string {
  const canvas = document.createElement('canvas')
  canvas.width = grid.width
  canvas.height = grid.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Forecast rendering is unavailable.')
  const image = context.createImageData(grid.width, grid.height)
  grid.pixels.forEach((samples, index) => {
    if (!samples) return
    const value = interpolatedRisk(samples, frame)
    const lower = Math.min(4, Math.max(0, Math.floor(value ?? 0)))
    const first = colors[lower] ?? colors[0]
    const second = colors[Math.min(4, lower + 1)] ?? first
    if (!first || !second) return
    const ratio = value === null ? 0 : value - lower
    const offset = index * 4
    for (const channel of [0, 1, 2] as const)
      image.data[offset + channel] =
        value === null
          ? 125
          : Math.round(first[channel] + (second[channel] - first[channel]) * ratio)
    image.data[offset + 3] = value === null ? 100 : 255
  })
  context.putImageData(image, 0, 0)
  return canvas.toDataURL('image/png')
}
