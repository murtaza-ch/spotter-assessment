import 'maplibre-gl/dist/maplibre-gl.css'
import './map.css'

import { Box, Text } from '@chakra-ui/react'
import * as maplibregl from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import type { GeoJSONSource, ImageSource } from 'maplibre-gl'
import { useEffect, useRef, useState } from 'react'

import { riskStyle, timeLabel } from '../presentation'
import { addPlanningLayers, basemapStyle } from './layers'
import { routeFeatures } from './route-features'
import { buildForecastGrid, paintForecast, type ForecastGrid } from './forecast-raster'
import type { Checkpoint, Forecast, LngLat, Plan, RouteOption } from '../types'

interface RouteMapProps {
  plan: Plan | undefined
  selectedRoute: RouteOption | undefined
  forecast: Forecast | undefined
  forecastHour: number
  weatherVisible: boolean
  checkpointIndex: number | null
  onSelectRoute: (id: string) => void
  onSelectCheckpoint: (index: number | null, routeId?: string) => void
  fitRequest: number
}

maplibregl.setWorkerUrl(workerUrl)

function toLngLat(coordinates: number[]): LngLat {
  const [longitude, latitude] = coordinates
  if (longitude === undefined || latitude === undefined) throw new Error('Invalid map coordinate.')
  return [longitude, latitude]
}

function popupContent(point: Checkpoint, routeName: string): HTMLElement {
  const element = document.createElement('div')
  element.className = 'checkpoint-popup'
  const heading = document.createElement('strong')
  heading.textContent = `${routeName} · ${Math.round(point.distance_miles)} mi · ${riskStyle[point.risk].label}`
  heading.style.color = riskStyle[point.risk].color
  element.append(heading)
  const lines = [
    `ETA ${timeLabel(point.arrival_at, true)}`,
    `Wind: ${point.wind_mph === null ? 'Unknown' : `${point.wind_mph.toFixed(1)} mph`}`,
    `Rain: ${point.rain_in === null ? 'Unknown' : `${point.rain_in.toFixed(3)} in/hr`}`,
    `Snow: ${point.snow_in === null ? 'Unknown' : `${point.snow_in.toFixed(3)} in/hr`}`,
  ]
  for (const text of lines) {
    const row = document.createElement('p')
    row.textContent = text
    element.append(row)
  }
  return element
}

export default function RouteMap({
  plan,
  selectedRoute,
  forecast,
  forecastHour,
  weatherVisible,
  checkpointIndex,
  onSelectRoute,
  onSelectCheckpoint,
  fitRequest,
}: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const handlersRef = useRef({ onSelectRoute, onSelectCheckpoint })
  const [readyMap, setReadyMap] = useState<maplibregl.Map | null>(null)
  const forecastGridRef = useRef<ForecastGrid | null>(null)
  const [mapError, setMapError] = useState(false)
  const [fatalError, setFatalError] = useState(false)

  useEffect(() => {
    handlersRef.current = { onSelectRoute, onSelectCheckpoint }
  }, [onSelectRoute, onSelectCheckpoint])

  useEffect(() => {
    if (!containerRef.current) return
    const base = new URL(
      `${import.meta.env.VITE_API_BASE_URL || '/api/v1'}/map/tiles/`,
      window.location.origin,
    ).href
    const map = new maplibregl.Map({
      container: containerRef.current,
      center: [-91, 39],
      zoom: 3.7,
      maxZoom: 18,
      style: basemapStyle(`${base}{z}/{x}/{y}/`),
      attributionControl: false,
    })
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
    map.on('error', (event) => {
      if ('sourceId' in event && event.sourceId === 'basemap') setMapError(true)
      else if (!('sourceId' in event)) setFatalError(true)
    })
    map.on('load', () => {
      addPlanningLayers(map)
      map.on('click', 'route-hit', (event) => {
        if (map.queryRenderedFeatures(event.point, { layers: ['checkpoints'] }).length) return
        const routeId: unknown = event.features?.[0]?.properties.routeId
        if (typeof routeId === 'string') handlersRef.current.onSelectRoute(routeId)
      })
      map.on('click', 'checkpoints', (event) => {
        const properties = event.features?.[0]?.properties
        const index: unknown = properties?.index
        const routeId: unknown = properties?.routeId
        if (typeof index === 'number' && typeof routeId === 'string')
          handlersRef.current.onSelectCheckpoint(index, routeId)
      })
      for (const layer of ['route-hit', 'checkpoints']) {
        map.on('mouseenter', layer, () => {
          map.getCanvas().style.cursor = 'pointer'
        })
        map.on('mouseleave', layer, () => {
          map.getCanvas().style.cursor = ''
        })
      }
      setReadyMap(map)
    })
    const observer = new ResizeObserver(() => map.resize())
    observer.observe(containerRef.current)
    return () => {
      observer.disconnect()
      popupRef.current?.remove()
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = readyMap
    if (!map || map !== mapRef.current) return
    const { routes, checkpoints, endpoints } = routeFeatures(plan, selectedRoute?.id)
    void map.getSource<GeoJSONSource>('routes')?.setData(routes)
    void map.getSource<GeoJSONSource>('checkpoints')?.setData(checkpoints)
    void map.getSource<GeoJSONSource>('endpoints')?.setData(endpoints)
  }, [plan, selectedRoute, readyMap])

  useEffect(() => {
    const map = readyMap
    if (!map || map !== mapRef.current || !plan) return
    const bounds = new maplibregl.LngLatBounds()
    for (const route of plan.routes)
      for (const point of route.geometry) bounds.extend(toLngLat(point))
    if (!bounds.isEmpty())
      map.fitBounds(bounds, {
        padding: { top: 200, bottom: 250, left: 45, right: 45 },
        maxZoom: 11,
        duration: 800,
      })
  }, [plan, fitRequest, readyMap])

  useEffect(() => {
    forecastGridRef.current =
      forecast && plan
        ? buildForecastGrid(
            forecast.coordinates,
            plan.routes.map((route) => route.geometry),
          )
        : null
  }, [forecast, plan])

  useEffect(() => {
    const map = readyMap
    if (!map || map !== mapRef.current) return
    const frame = forecast?.risk_frames[forecastHour]
    const grid = forecastGridRef.current
    map.setLayoutProperty(
      'weather-heat',
      'visibility',
      weatherVisible && frame && grid ? 'visible' : 'none',
    )
    if (!weatherVisible || !frame || !grid) return
    void map
      .getSource<ImageSource>('weather')
      ?.updateImage({ url: paintForecast(grid, frame), coordinates: grid.corners })
  }, [forecast, forecastHour, plan, readyMap, weatherVisible])

  useEffect(() => {
    const map = readyMap
    popupRef.current?.remove()
    if (!map || map !== mapRef.current || checkpointIndex === null) return
    const point = selectedRoute?.checkpoints.find(
      (checkpoint) => checkpoint.index === checkpointIndex,
    )
    if (!point) return
    const popup = new maplibregl.Popup({ offset: 12, maxWidth: '240px' })
      .setLngLat(toLngLat(point.coordinates))
      .setDOMContent(popupContent(point, selectedRoute?.name ?? 'Route'))
      .addTo(map)
    popupRef.current = popup
    const clearSelection = () => handlersRef.current.onSelectCheckpoint(null)
    popup.on('close', clearSelection)
    map.easeTo({ center: toLngLat(point.coordinates), duration: 450 })
    return () => {
      popup.off('close', clearSelection)
      popup.remove()
    }
  }, [checkpointIndex, selectedRoute, readyMap])

  if (fatalError) throw new Error('The map renderer could not load.')

  return (
    <Box position="absolute" inset="0" role="region" aria-label="Trip routes and weather map">
      <Box ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      {mapError && (
        <Text
          position="absolute"
          top="20"
          left="4"
          right="14"
          bg="white"
          rounded="md"
          px="3"
          py="2"
          fontSize="xs"
          color="status.error"
          role="status"
        >
          Some map tiles could not load. Route analysis remains available.
        </Text>
      )}
    </Box>
  )
}
