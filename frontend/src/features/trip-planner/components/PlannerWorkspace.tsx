import { Box, Button, Flex, Grid, Heading, HStack, Spinner, Stack, Text } from '@chakra-ui/react'
import {
  Circle,
  CloudSun,
  Info,
  Layers,
  MapPin,
  Maximize2,
  Pencil,
  Plus,
  Route,
} from 'lucide-react'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'

import { PlanningError } from '../api'
import { usePlanForecast, useTripPlanning } from '../hooks'
import { riskLevels, riskStyle } from '../presentation'
import type { TripRequest } from '../types'
import { CheckpointList } from './CheckpointList'
import { ForecastSlider } from './ForecastSlider'
import { MapBoundary } from './MapBoundary'
import { MapRouteSummary } from './MapRouteSummary'
import { RouteResults } from './RouteResults'
import { TripForm } from './TripForm'

const RouteMap = lazy(() => import('../map/RouteMap'))

export function PlannerWorkspace() {
  const planning = useTripPlanning()
  const plan = planning.data
  const forecast = usePlanForecast(plan?.id)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [checkpointIndex, setCheckpointIndex] = useState<number | null>(null)
  const [forecastHour, setForecastHour] = useState(0)
  const [weatherVisible, setWeatherVisible] = useState(true)
  const [showForm, setShowForm] = useState(true)
  const [formKey, setFormKey] = useState(0)
  const [fitRequest, setFitRequest] = useState(0)
  const resultsRef = useRef<HTMLDivElement>(null)
  const selectedRoute = plan?.routes.find((route) => route.id === selectedId)

  useEffect(() => {
    resultsRef.current?.scrollTo({ top: 0 })
  }, [plan?.id])

  function submit(trip: TripRequest) {
    planning.reset()
    setSelectedId(null)
    setCheckpointIndex(null)
    setForecastHour(0)
    planning.mutate(trip, {
      onSuccess(result) {
        setSelectedId(result.recommended_route_id ?? result.routes[0]?.id ?? null)
        setShowForm(false)
      },
    })
  }

  function selectRoute(id: string) {
    setSelectedId(id)
    setCheckpointIndex(null)
  }

  function selectCheckpoint(index: number | null, routeId?: string) {
    if (routeId) setSelectedId(routeId)
    setCheckpointIndex(index)
    if (index !== null) document.getElementById('route-map')?.scrollIntoView({ block: 'nearest' })
  }

  function newTrip() {
    planning.reset()
    setSelectedId(null)
    setCheckpointIndex(null)
    setShowForm(true)
    setFormKey((key) => key + 1)
  }

  return (
    <Flex
      direction="column"
      minH="100dvh"
      h={{ base: 'auto', lg: '100dvh' }}
      overflow={{ base: 'visible', lg: 'hidden' }}
    >
      <Box
        asChild
        position="absolute"
        top="-20"
        left="4"
        p="3"
        zIndex="20"
        bg="accent.solid"
        _focus={{ top: '4' }}
      >
        <a href="#trip-form">Skip to trip planner</a>
      </Box>
      <Grid
        as="main"
        flex="1"
        minH="0"
        templateColumns={{ base: '1fr', lg: '380px minmax(0, 1fr)' }}
        templateRows={{ base: 'auto 600px auto', lg: 'auto minmax(0, 1fr)' }}
        templateAreas={{ base: '"form" "map" "results"', lg: '"form map" "results map"' }}
      >
        <Box
          gridArea="form"
          id="trip-form"
          p={{ base: 5, md: 6 }}
          borderRightWidth={{ base: '0', lg: '1px' }}
          borderBottomWidth="1px"
          bg="surface.canvas"
          maxH={{ lg: 'calc(100dvh - 28px)' }}
          overflowY="auto"
        >
          <Heading
            as="h1"
            fontSize="xl"
            fontWeight="600"
            letterSpacing="-0.04em"
            mb={showForm ? '5' : '4'}
          >
            {showForm ? 'Plan your trip' : 'Your trip, analyzed.'}
          </Heading>
          {!showForm && plan && (
            <Stack gap="3" fontSize="sm">
              <Stack gap="3" position="relative">
                <Box position="absolute" left="7px" top="3" bottom="3" borderLeftWidth="1px" />
                <HStack gap="3" align="start">
                  <Box pt="0.5" flexShrink="0" bg="surface.canvas" zIndex="1">
                    <Circle size={15} />
                  </Box>
                  <Text minW="0" overflowWrap="anywhere">
                    {plan.origin.label}
                  </Text>
                </HStack>
                <HStack gap="3" align="start">
                  <Box pt="0.5" flexShrink="0" bg="surface.canvas" zIndex="1">
                    <MapPin size={15} />
                  </Box>
                  <Text minW="0" overflowWrap="anywhere">
                    {plan.destination.label}
                  </Text>
                </HStack>
              </Stack>
              <Text fontSize="xs" color="ink.muted" lineHeight="1.7">
                {plan.load_weight_lb.toLocaleString()} lb · {plan.sample_interval_miles}-mile
                checkpoints
              </Text>
            </Stack>
          )}
          <Box display={showForm ? 'block' : 'none'}>
            <TripForm key={formKey} pending={planning.isPending} onSubmit={submit} />
          </Box>
          {plan && (
            <HStack gap="2" mt="4" flexWrap="wrap">
              <Button
                flex="1 1 130px"
                size="sm"
                variant="outline"
                color="brand.solid"
                onClick={() => setShowForm(!showForm)}
              >
                <Pencil size={14} />
                {showForm ? 'Hide details' : 'Edit trip'}
              </Button>
              <Button
                flex="1 1 130px"
                variant="outline"
                size="sm"
                color="ink.primary"
                onClick={newTrip}
              >
                <Plus size={14} />
                New trip
              </Button>
            </HStack>
          )}
          {planning.isPending && (
            <Text mt="4" fontSize="xs" color="ink.muted" role="status">
              Finding truck routes and checking weather at each estimated arrival. This can take a
              moment.
            </Text>
          )}
          {planning.isError && (
            <Stack
              role="alert"
              mt="4"
              gap="2"
              p="3"
              borderWidth="1px"
              borderColor="#e8c4bf"
              rounded="md"
              bg="#fbefed"
              color="status.error"
              fontSize="sm"
            >
              <Text>
                {planning.error instanceof PlanningError
                  ? planning.error.message
                  : 'The trip could not be analyzed. Please try again.'}
              </Text>
              {planning.error instanceof PlanningError &&
                Object.entries(planning.error.fields).map(([field, errors]) => (
                  <Text key={field} fontSize="xs">
                    {field.replaceAll('_', ' ')}:{' '}
                    {Array.isArray(errors) ? errors.map(String).join(' ') : String(errors)}
                  </Text>
                ))}
            </Stack>
          )}
        </Box>
        <Box
          ref={resultsRef}
          gridArea="results"
          p={{ base: 5, md: 6 }}
          borderRightWidth={{ base: '0', lg: '1px' }}
          overflowY={{ lg: 'auto' }}
          bg="surface.canvas"
        >
          {plan ? (
            <Stack gap="5">
              {plan.warnings.map((warning) => (
                <HStack
                  key={warning}
                  align="start"
                  gap="2"
                  p="3"
                  bg="#faf2d9"
                  rounded="md"
                  fontSize="xs"
                >
                  <Box flexShrink="0" pt="0.5">
                    <Info size={14} />
                  </Box>
                  <Text>{warning}</Text>
                </HStack>
              ))}
              {!plan.recommended_route_id && (
                <Box
                  role="alert"
                  p="3"
                  rounded="md"
                  bg="#f9e8e7"
                  color="status.error"
                  fontSize="sm"
                >
                  No route is currently eligible for recommendation.
                </Box>
              )}
              <RouteResults plan={plan} selectedRouteId={selectedId} onSelect={selectRoute} />
              {selectedRoute && (
                <CheckpointList route={selectedRoute} onSelect={selectCheckpoint} />
              )}
            </Stack>
          ) : (
            <Stack gap="4" color="ink.muted" fontSize="xs">
              <HStack gap="2">
                <Route size={16} />
                <Text>Three route options, compared by weather exposure.</Text>
              </HStack>
              <HStack gap="2">
                <CloudSun size={16} />
                <Text>Forecasts matched to your checkpoint arrival times.</Text>
              </HStack>
              <Text lineHeight="1.8">
                Choose a departure within the next 7 days. Weather risk considers wind, rain, snow,
                and load weight.
              </Text>
            </Stack>
          )}
        </Box>
        <Box
          gridArea="map"
          id="route-map"
          position="relative"
          minH="0"
          bg="#e8ede7"
          overflow="hidden"
        >
          <MapBoundary>
            <Suspense
              fallback={
                <Flex h="full" align="center" justify="center">
                  <Spinner color="brand.solid" />
                </Flex>
              }
            >
              <RouteMap
                plan={plan}
                selectedRoute={selectedRoute}
                forecast={forecast.data}
                forecastHour={forecastHour}
                weatherVisible={weatherVisible}
                checkpointIndex={checkpointIndex}
                onSelectRoute={selectRoute}
                onSelectCheckpoint={selectCheckpoint}
                fitRequest={fitRequest}
              />
            </Suspense>
          </MapBoundary>
          {selectedRoute && <MapRouteSummary route={selectedRoute} />}
          <HStack
            position="absolute"
            top="4"
            left="4"
            right="4"
            justify="space-between"
            gap="2"
            pointerEvents="none"
          >
            <HStack
              gap="2"
              bg="white"
              borderWidth="1px"
              rounded="lg"
              px="3"
              py="2.5"
              fontSize="xs"
              pointerEvents="auto"
            >
              <Layers size={15} />
              <Text>
                {plan
                  ? `${plan.routes.length} routes · ${selectedRoute?.name ?? 'Select a route'}`
                  : 'Trip overview'}
              </Text>
            </HStack>
            <HStack gap="2" pointerEvents="auto">
              {plan && (
                <Button
                  size="sm"
                  bg="white"
                  borderWidth="1px"
                  color="ink.primary"
                  aria-pressed={weatherVisible}
                  aria-label="Toggle weather layer"
                  onClick={() => setWeatherVisible(!weatherVisible)}
                >
                  <CloudSun size={14} />
                  <Text display={{ base: 'none', sm: 'block' }}>Weather</Text>
                </Button>
              )}
              <Button
                size="sm"
                bg="white"
                borderWidth="1px"
                color="ink.primary"
                aria-label="Fit all routes"
                disabled={!plan}
                onClick={() => setFitRequest((value) => value + 1)}
              >
                <Maximize2 size={15} />
              </Button>
            </HStack>
          </HStack>
          {!plan && !planning.isPending && (
            <Box
              position="absolute"
              top="50%"
              left="50%"
              transform="translate(-50%, -50%)"
              w="min(340px, 85%)"
              p="6"
              bg="#fffffff2"
              rounded="xl"
              borderWidth="1px"
              textAlign="center"
              pointerEvents="none"
              boxShadow="0 8px 40px #173c3514"
            >
              <Route size={26} style={{ margin: '0 auto 12px' }} />
              <Heading as="h2" fontSize="xl" letterSpacing="-0.04em" mb="2">
                Your next route starts here.
              </Heading>
              <Text fontSize="sm" color="ink.muted" lineHeight="1.7">
                Enter your trip details to see route options, weather checkpoints, and a 48-hour
                corridor forecast.
              </Text>
            </Box>
          )}
          {planning.isPending && (
            <Flex
              position="absolute"
              inset="0"
              bg="#f5f5efb8"
              align="center"
              justify="center"
              direction="column"
              gap="4"
              backdropFilter="blur(2px)"
            >
              <Spinner size="lg" color="brand.solid" />
              <Text fontSize="sm">Looking at the road ahead…</Text>
            </Flex>
          )}
          {plan && (
            <Stack
              position="absolute"
              bottom="7"
              left={{ base: 3, md: 5 }}
              right={{ base: 3, md: 5 }}
              gap="3"
              maxW="660px"
              mx="auto"
            >
              <HStack
                gap={{ base: 2, sm: 3 }}
                flexWrap="wrap"
                bg="#fffffff0"
                rounded="lg"
                px="3"
                py="2"
                alignSelf="start"
                aria-label="Weather risk legend"
              >
                {riskLevels.map((level) => (
                  <HStack key={level} gap="1" fontSize="10px">
                    <Box boxSize="2" bg={riskStyle[level].color} rounded="full" />
                    <Text>{riskStyle[level].label}</Text>
                  </HStack>
                ))}
              </HStack>
              {weatherVisible && (
                <ForecastSlider
                  key={plan.id}
                  forecast={forecast.data}
                  hour={forecastHour}
                  onHourChange={setForecastHour}
                  loading={forecast.isFetching}
                  error={forecast.isError}
                  onRetry={() => void forecast.refetch()}
                />
              )}
            </Stack>
          )}
        </Box>
      </Grid>
    </Flex>
  )
}
