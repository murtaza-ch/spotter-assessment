import { HStack, Box, Text } from '@chakra-ui/react'

import { riskStyle } from '../presentation'
import type { RiskLevel } from '../types'

export function RiskBadge({ level }: { level: RiskLevel }) {
  const style = riskStyle[level]
  return (
    <HStack
      gap="1.5"
      px="2"
      py="1"
      rounded="full"
      bg={style.background}
      color={style.color}
      whiteSpace="nowrap"
    >
      <Box boxSize="1.5" rounded="full" bg="currentColor" />
      <Text fontSize="xs" fontWeight="600">
        {style.label}
      </Text>
    </HStack>
  )
}
