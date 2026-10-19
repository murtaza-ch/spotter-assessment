import { Box, Button, HStack, Stack, Text } from '@chakra-ui/react'
import { CloudSun, Pause, Play, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { riskLevels, riskStyle, timeLabel } from '../presentation'
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
  const frame = forecast?.risk_frames[hour]
  const lastHour = Math.max(0, (forecast?.hours.length ?? 1) - 1)
  const hasForecast = Boolean(frame?.length)
  const unknownSamples = frame?.filter((risk) => risk === -1).length ?? 0
  const unchanged = useMemo(() => {
    const first = forecast?.risk_frames[0]
    if (!forecast || !first?.length) return false
    return forecast.risk_frames.every(
      (values) => values.length === first.length && values.every((risk, i) => risk === first[i]),
    )
  }, [forecast])
  useEffect(() => {
    if (!playing || !forecast || !hasForecast || error) return
    const timer = window.setInterval(() => onHourChange((hour + 1) % forecast.hours.length), 700)
    return () => window.clearInterval(timer)
  }, [playing, forecast, hour, onHourChange, hasForecast, error])

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
            Corridor weather risk
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
            disabled={!hasForecast}
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
                max={lastHour}
                step="1"
                value={hour}
                disabled={!hasForecast}
                aria-valuetext={
                  forecast?.hours[hour]
                    ? `${timeLabel(forecast.hours[hour], true)}, ${hour} hours after departure`
                    : undefined
                }
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
      {hasForecast && !error && (
        <Stack gap="1" aria-label="Forecast risk summary">
          <HStack gap="3" flexWrap="wrap" fontSize="xs">
            {riskLevels.map((risk) => {
              const count = frame?.filter((value) => value === risk).length ?? 0
              return count ? (
                <HStack key={risk} gap="1.5">
                  <Box boxSize="2" rounded="full" bg={riskStyle[risk].color} />
                  <Text>
                    {count} {riskStyle[risk].label}
                  </Text>
                </HStack>
              ) : null
            })}
            <Text color="ink.muted">forecast locations at +{hour}h</Text>
          </HStack>
          {unchanged && (
            <Text fontSize="xs" color="ink.muted">
              Risk levels stay the same for all {lastHour} hours, so the map colors will not change.
            </Text>
          )}
        </Stack>
      )}
      <Text fontSize="10px" color="ink.muted">
        Open-Meteo risk forecast · {forecast?.corridor_half_width_miles ?? 25}-mile corridor. The
        slider updates the shaded area; route colors use checkpoint arrival times.
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
