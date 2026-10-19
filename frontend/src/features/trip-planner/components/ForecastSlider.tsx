import { Box, Button, HStack, Stack, Text } from '@chakra-ui/react'
import { CloudSun, Pause, Play, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'

import { timeLabel } from '../presentation'
import type { Forecast } from '../types'

interface ForecastSliderProps {
  forecast: Forecast | undefined
  hour: number
  onHourChange: (value: number) => void
  loading: boolean
  error: boolean
  onRetry: () => void
}

export function ForecastSlider({
  forecast,
  hour,
  onHourChange,
  loading,
  error,
  onRetry,
}: ForecastSliderProps) {
  const [playing, setPlaying] = useState(false)
  const unknownSamples = forecast?.risk_frames[hour]?.filter((risk) => risk === -1).length ?? 0
  useEffect(() => {
    if (!playing || !forecast) return
    const timer = window.setInterval(() => onHourChange((hour + 1) % forecast.hours.length), 700)
    return () => window.clearInterval(timer)
  }, [playing, forecast, hour, onHourChange])

  return (
    <Stack
      gap="3"
      bg="white"
      borderWidth="1px"
      rounded="xl"
      p={{ base: 4, md: 5 }}
      boxShadow="0 5px 30px #173c3512"
      aria-label="Weather forecast controls"
    >
      <HStack justify="space-between" gap="3">
        <HStack gap="2">
          <CloudSun size={18} />
          <Text fontSize="sm" fontWeight="600">
            Corridor weather
          </Text>
        </HStack>
        <Text fontSize="xs" color="ink.muted">
          {forecast?.hours[hour]
            ? timeLabel(forecast.hours[hour], true)
            : loading
              ? 'Loading forecast…'
              : '0–48 hour forecast'}
        </Text>
      </HStack>
      {error ? (
        <HStack justify="space-between">
          <Text fontSize="xs" color="status.error">
            Forecast could not be loaded.
          </Text>
          <Button size="xs" variant="outline" onClick={onRetry}>
            <RefreshCw size={12} />
            Retry forecast
          </Button>
        </HStack>
      ) : (
        <HStack gap="4">
          <Button
            size="sm"
            variant="outline"
            boxSize="9"
            p="0"
            aria-label={playing ? 'Pause forecast' : 'Play forecast'}
            disabled={!forecast}
            onClick={() => setPlaying(!playing)}
          >
            {playing ? <Pause size={14} /> : <Play size={14} />}
          </Button>
          <Stack flex="1" gap="1">
            <Box asChild w="full" accentColor="brand.solid">
              <input
                aria-label="Forecast hour"
                type="range"
                min="0"
                max="48"
                step="1"
                value={hour}
                disabled={!forecast}
                onChange={(event) => {
                  setPlaying(false)
                  onHourChange(Number(event.target.value))
                }}
              />
            </Box>
            <HStack justify="space-between" color="ink.muted" fontSize="10px">
              <Text>Departure</Text>
              <Text>+12h</Text>
              <Text>+24h</Text>
              <Text>+36h</Text>
              <Text>+48h</Text>
            </HStack>
          </Stack>
          <Text minW="8" fontSize="xs" fontWeight="600">
            +{hour}h
          </Text>
        </HStack>
      )}
      <Text fontSize="10px" color="ink.muted">
        Smoothed Open-Meteo samples · 25-mile corridor. Route colors use arrival times; the slider
        changes corridor weather.
      </Text>
      {unknownSamples > 0 && (
        <Text fontSize="xs" color="status.error">
          Forecast unavailable at {unknownSamples} of {forecast?.coordinates.length} sample
          locations.
        </Text>
      )}
    </Stack>
  )
}
