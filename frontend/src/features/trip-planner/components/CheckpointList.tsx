import { Button, HStack, Stack, Text } from '@chakra-ui/react'
import { ChevronDown, ChevronUp, MapPin } from 'lucide-react'
import { useState } from 'react'

import { timeLabel } from '../presentation'
import type { RouteOption } from '../types'
import { RiskBadge } from './RiskBadge'

export function CheckpointList({
  route,
  onSelect,
}: {
  route: RouteOption
  onSelect: (index: number) => void
}) {
  const [expanded, setExpanded] = useState(false)
  return (
    <Stack gap="2">
      <Button
        variant="plain"
        px="0"
        justifyContent="space-between"
        color="ink.primary"
        fontSize="sm"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
      >
        Weather checkpoints ({route.checkpoints.length}){' '}
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </Button>
      {expanded && (
        <Stack maxH="300px" overflowY="auto" gap="1" aria-label="Weather checkpoints">
          {route.checkpoints.map((point) => (
            <Button
              key={point.index}
              variant="plain"
              h="auto"
              py="3"
              px="2"
              justifyContent="space-between"
              color="ink.primary"
              borderBottomWidth="1px"
              onClick={() => onSelect(point.index)}
              aria-label={`Checkpoint ${point.index + 1}, ${Math.round(point.distance_miles)} miles, ${timeLabel(point.arrival_at, true)}`}
            >
              <HStack gap="2">
                <MapPin size={13} />
                <Stack gap="0" textAlign="left">
                  <Text fontSize="xs">
                    {Math.round(point.distance_miles)} mi · {timeLabel(point.arrival_at, true)}
                  </Text>
                  <Text fontWeight="400" fontSize="11px" color="ink.muted">
                    Wind {point.wind_mph === null ? '—' : `${point.wind_mph.toFixed(1)} mph`}
                  </Text>
                </Stack>
              </HStack>
              <RiskBadge level={point.risk} />
            </Button>
          ))}
        </Stack>
      )}
    </Stack>
  )
}
