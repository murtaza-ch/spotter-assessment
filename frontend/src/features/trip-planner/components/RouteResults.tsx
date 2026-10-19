import { Box, Button, Flex, HStack, Stack, Text } from '@chakra-ui/react'
import { Check, Clock3 } from 'lucide-react'

import { durationLabel, riskLevels, riskStyle, timeLabel } from '../presentation'
import type { Plan } from '../types'
import { RiskBadge } from './RiskBadge'

interface RouteResultsProps {
  plan: Plan
  selectedRouteId: string | null
  onSelect: (id: string) => void
}

export function RouteResults({ plan, selectedRouteId, onSelect }: RouteResultsProps) {
  return (
    <Stack gap="3" aria-label="Route options">
      <HStack justify="space-between">
        <Text fontWeight="600" fontSize="sm">
          Your route options
        </Text>
        <Text color="ink.muted" fontSize="xs">
          {plan.routes.length} routes
        </Text>
      </HStack>
      {plan.routes.map((route) => {
        const selected = selectedRouteId === route.id
        const recommended = route.id === plan.recommended_route_id
        return (
          <Button
            key={route.id}
            aria-pressed={selected}
            aria-label={`Select ${route.name}${recommended ? ', recommended' : ''}`}
            onClick={() => onSelect(route.id)}
            variant="plain"
            display="block"
            h="auto"
            p="4"
            textAlign="left"
            whiteSpace="normal"
            rounded="lg"
            borderWidth={selected ? '2px' : '1px'}
            borderColor={selected ? 'brand.solid' : 'line.default'}
            bg={selected ? '#f0f5e9' : 'white'}
            color="ink.primary"
          >
            <Stack gap="3">
              <HStack justify="space-between" gap="2">
                <HStack gap="2">
                  <Text fontSize="xs" fontWeight="600">
                    {route.name}
                  </Text>
                  {recommended && (
                    <HStack gap="1" color="brand.solid" fontSize="10px">
                      <Check size={12} />
                      Recommended
                    </HStack>
                  )}
                </HStack>
                <RiskBadge level={route.summary.maximum_risk} />
              </HStack>
              <HStack gap="2" align="baseline">
                <Text fontSize="2xl" fontWeight="600" letterSpacing="-0.04em">
                  {durationLabel(route.duration_seconds)}
                </Text>
                <Text fontSize="sm" fontWeight="400" color="ink.muted">
                  · {Math.round(route.distance_miles).toLocaleString()} mi
                </Text>
              </HStack>
              <Flex
                h="1.5"
                rounded="full"
                overflow="hidden"
                bg="surface.subtle"
                aria-label="Distance by weather risk"
              >
                {riskLevels.map((level) => (
                  <Box
                    key={level}
                    w={`${((route.summary.miles_by_risk[String(level)] ?? 0) / route.distance_miles) * 100}%`}
                    bg={riskStyle[level].color}
                  />
                ))}
              </Flex>
              <HStack gap="3" fontSize="11px" fontWeight="400" color="ink.muted" flexWrap="wrap">
                <Text>{(route.summary.miles_by_risk['3'] ?? 0).toFixed(1)} mi severe</Text>
                <Text>{(route.summary.miles_by_risk['2'] ?? 0).toFixed(1)} mi high</Text>
                <HStack gap="1">
                  <Clock3 size={11} />
                  ETA {timeLabel(route.arrival_at, true)}
                </HStack>
                <Text>
                  Average risk {route.summary.average_risk?.toFixed(2) ?? 'Unknown'}
                  {route.summary.average_risk !== null ? ' / 4' : ''}
                </Text>
              </HStack>
              {!route.summary.eligible && (
                <Text fontSize="xs" color="status.error" fontWeight="400">
                  {route.summary.maximum_risk === 4
                    ? 'No Travel conditions. Not eligible for recommendation.'
                    : 'Weather coverage incomplete. Not eligible for recommendation.'}
                </Text>
              )}
            </Stack>
          </Button>
        )
      })}
    </Stack>
  )
}
