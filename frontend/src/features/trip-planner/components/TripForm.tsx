import { Box, Button, Field, HStack, Input, Stack, Text } from '@chakra-ui/react'
import { ArrowDownUp, ArrowRight, Circle, MapPin, Truck } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { localInputDate } from '../presentation'
import type { TripRequest } from '../types'

interface TripFormProps {
  pending: boolean
  onSubmit: (trip: TripRequest) => void
}

export function TripForm({ pending, onSubmit }: TripFormProps) {
  const [dateBounds] = useState(() => ({
    min: localInputDate(new Date()),
    max: localInputDate(new Date(Date.now() + 7 * 86_400_000)),
  }))
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [departure, setDeparture] = useState(() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(8, 0, 0, 0)
    return localInputDate(tomorrow)
  })
  const [weight, setWeight] = useState('35000')
  const [interval, setInterval] = useState<10 | 25 | 50>(25)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit({
      origin: origin.trim(),
      destination: destination.trim(),
      departure_at: new Date(departure).toISOString(),
      load_weight_lb: Number(weight),
      sample_interval_miles: interval,
    })
  }

  return (
    <form onSubmit={submit} aria-label="Trip details">
      <Stack gap="5">
        <Stack gap="3" position="relative">
          <Field.Root>
            <Field.Label fontSize="xs" color="ink.muted">
              Origin
            </Field.Label>
            <Box position="relative" w="full">
              <Box
                position="absolute"
                top="3.5"
                left="3.5"
                zIndex="1"
                pointerEvents="none"
                color="brand.solid"
              >
                <Circle size={15} />
              </Box>
              <Input
                aria-label="Origin"
                placeholder="City or street address"
                value={origin}
                onChange={(event) => setOrigin(event.target.value)}
                required
                maxLength={200}
                pl="10"
                h="11"
                bg="white"
                disabled={pending}
                autoComplete="off"
              />
            </Box>
          </Field.Root>
          <Field.Root>
            <Field.Label fontSize="xs" color="ink.muted">
              Destination
            </Field.Label>
            <Box position="relative" w="full">
              <Box
                position="absolute"
                top="3.5"
                left="3.5"
                zIndex="1"
                pointerEvents="none"
                color="brand.solid"
              >
                <MapPin size={16} />
              </Box>
              <Input
                aria-label="Destination"
                placeholder="Where are you headed?"
                value={destination}
                onChange={(event) => setDestination(event.target.value)}
                required
                maxLength={200}
                pl="10"
                h="11"
                bg="white"
                disabled={pending}
                autoComplete="off"
              />
            </Box>
          </Field.Root>
          <Button
            type="button"
            position="absolute"
            right="3"
            top="14"
            rounded="full"
            size="xs"
            boxSize="7"
            p="0"
            bg="surface.subtle"
            color="brand.solid"
            aria-label="Swap origin and destination"
            disabled={pending}
            onClick={() => {
              setOrigin(destination)
              setDestination(origin)
            }}
          >
            <ArrowDownUp size={13} />
          </Button>
        </Stack>
        <HStack gap="1" fontSize="xs" color="ink.muted" mt="-2">
          <Text>Try a trip:</Text>
          <Button
            type="button"
            variant="plain"
            size="xs"
            h="auto"
            px="1"
            color="brand.solid"
            textDecoration="underline"
            disabled={pending}
            onClick={() => {
              setOrigin('Chicago, IL, USA')
              setDestination('Detroit, MI, USA')
            }}
          >
            Chicago → Detroit
          </Button>
        </HStack>
        <Field.Root>
          <Field.Label fontSize="xs" color="ink.muted">
            Departure date & time
          </Field.Label>
          <Input
            aria-label="Departure date and time"
            type="datetime-local"
            value={departure}
            min={dateBounds.min}
            max={dateBounds.max}
            onChange={(event) => setDeparture(event.target.value)}
            required
            h="11"
            bg="white"
            disabled={pending}
          />
          <Field.HelperText fontSize="xs">
            Local time · {Intl.DateTimeFormat().resolvedOptions().timeZone}
          </Field.HelperText>
        </Field.Root>
        <Field.Root>
          <Field.Label fontSize="xs" color="ink.muted">
            <Truck size={14} /> Load weight
          </Field.Label>
          <Box position="relative" w="full">
            <Input
              aria-label="Load weight in pounds"
              type="number"
              value={weight}
              onChange={(event) => setWeight(event.target.value)}
              min="0"
              max="200000"
              step="1"
              required
              h="11"
              pr="12"
              bg="white"
              disabled={pending}
            />
            <Text
              position="absolute"
              right="4"
              top="3"
              fontSize="sm"
              color="ink.muted"
              pointerEvents="none"
            >
              lb
            </Text>
          </Box>
        </Field.Root>
        <fieldset disabled={pending}>
          <Text as="legend" fontSize="xs" color="ink.muted" mb="2">
            Weather checkpoint spacing
          </Text>
          <HStack gap="2">
            {([10, 25, 50] as const).map((value) => (
              <Button
                key={value}
                type="button"
                flex="1"
                size="sm"
                aria-pressed={interval === value}
                borderWidth="1px"
                borderColor={interval === value ? 'brand.solid' : 'line.default'}
                bg={interval === value ? 'surface.subtle' : 'white'}
                color="ink.primary"
                onClick={() => setInterval(value)}
              >
                {value} mi
              </Button>
            ))}
          </HStack>
        </fieldset>
        <Button
          type="submit"
          h="12"
          bg="brand.solid"
          color="white"
          _hover={{ bg: 'brand.hover' }}
          loading={pending}
          loadingText="Analyzing your trip"
        >
          Compare routes <ArrowRight size={16} />
        </Button>
      </Stack>
    </form>
  )
}
