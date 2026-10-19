import type { ExpressionSpecification, Map as MapLibreMap, StyleSpecification } from 'maplibre-gl'

import { riskStyle } from '../presentation'

const riskColor: ExpressionSpecification = [
  'match',
  ['get', 'risk'],
  0,
  riskStyle[0].color,
  1,
  riskStyle[1].color,
  2,
  riskStyle[2].color,
  3,
  riskStyle[3].color,
  4,
  riskStyle[4].color,
  riskStyle[-1].color,
]
const selected: ExpressionSpecification = ['==', ['get', 'selected'], 1]
const emptyCollection = { type: 'FeatureCollection' as const, features: [] }

export function basemapStyle(tileUrl: string): StyleSpecification {
  return {
    version: 8,
    sources: {
      basemap: {
        type: 'raster',
        tiles: [tileUrl],
        tileSize: 256,
        attribution:
          '© <a href="https://www.tomtom.com/" target="_blank" rel="noreferrer">TomTom</a>',
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#e8ede7' } },
      {
        id: 'basemap',
        type: 'raster',
        source: 'basemap',
        paint: { 'raster-saturation': -0.45, 'raster-opacity': 0.88 },
      },
    ],
  }
}

export function addPlanningLayers(map: MapLibreMap) {
  map.addSource('weather', {
    type: 'image',
    url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=',
    coordinates: [
      [-100, 45],
      [-90, 45],
      [-90, 35],
      [-100, 35],
    ],
  })
  map.addLayer({
    id: 'weather-heat',
    type: 'raster',
    source: 'weather',
    layout: { visibility: 'none' },
    paint: { 'raster-opacity': 0.42, 'raster-fade-duration': 0 },
  })
  map.addSource('routes', { type: 'geojson', data: emptyCollection })
  map.addLayer({
    id: 'route-halo',
    type: 'line',
    source: 'routes',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#ffffff', 'line-width': 8, 'line-opacity': 0.85 },
  })
  map.addLayer({
    id: 'route-lines',
    type: 'line',
    source: 'routes',
    layout: { 'line-cap': 'round', 'line-join': 'round', 'line-sort-key': ['get', 'selected'] },
    paint: {
      'line-color': riskColor,
      'line-width': ['case', selected, 5, 3],
      'line-opacity': ['case', selected, 1, 0.6],
    },
  })
  map.addLayer({
    id: 'route-hit',
    type: 'line',
    source: 'routes',
    paint: { 'line-color': '#000000', 'line-width': 18, 'line-opacity': 0 },
  })
  map.addSource('checkpoints', { type: 'geojson', data: emptyCollection })
  map.addLayer({
    id: 'checkpoints',
    type: 'circle',
    source: 'checkpoints',
    layout: { 'circle-sort-key': ['get', 'selected'] },
    paint: {
      'circle-color': riskColor,
      'circle-radius': ['case', selected, 5, 3.5],
      'circle-opacity': ['case', selected, 1, 0.65],
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': ['case', selected, 2, 1],
    },
  })
  map.addSource('endpoints', { type: 'geojson', data: emptyCollection })
  map.addLayer({
    id: 'endpoints',
    type: 'circle',
    source: 'endpoints',
    paint: {
      'circle-radius': 8,
      'circle-color': '#173c35',
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 3,
    },
  })
}
