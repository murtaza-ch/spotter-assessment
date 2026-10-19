import { HStack, Stack, Text } from '@chakra-ui/react'

import { durationLabel, timeLabel } from '../presentation'
import type { RouteOption } from '../types'
import { RiskBadge } from './RiskBadge'

export function MapRouteSummary({ route }: { route: RouteOption }) {
  return (
    <Stack
      position="absolute"
      top="16"
      left="4"
      maxW="360px"
      w="calc(100% - 100px)"
      bg="#fffffff2"
      borderWidth="1px"
      rounded="lg"
      p={{ base: '2.5', md: '3' }}
      gap={{ base: '1', md: '1.5' }}
      role="region"
      aria-label="Selected route summary"
    >
      <HStack justify="space-between" gap="2">
        <Text fontSize="xs" fontWeight="600">
          {route.name}
        </Text>
        <RiskBadge level={route.summary.maximum_risk} />
      </HStack>
      <Text fontSize="sm" fontWeight="600">
        {durationLabel(route.duration_seconds)} ·{' '}
        {Math.round(route.distance_miles).toLocaleString()} mi
      </Text>
      <Text fontSize="xs" color="ink.muted">
        ETA {timeLabel(route.arrival_at, true)}
      </Text>
      <Text fontSize="10px" color="ink.muted" display={{ base: 'none', md: 'block' }}>
        {(route.summary.miles_by_risk['3'] ?? 0).toFixed(1)} mi severe ·{' '}
        {(route.summary.miles_by_risk['2'] ?? 0).toFixed(1)} mi high
      </Text>
    </Stack>
  )
}
