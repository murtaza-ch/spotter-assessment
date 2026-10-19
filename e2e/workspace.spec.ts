import { expect, test, type Page } from '@playwright/test'

import { forecastFixture, planFixture } from './fixtures/planning'

// Basemap responses are stubbed so CI needs no API keys or external network.
const blankTile = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAABFUlEQVR4nO3BMQEAAADCoPVP7WsIoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAeAMBPAABPO1TCQAAAABJRU5ErkJggg==',
  'base64',
)

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/map/tiles/**', (route) =>
    route.fulfill({ contentType: 'image/png', body: blankTile }),
  )
})

async function submitExample(page: Page) {
  await page.getByRole('button', { name: 'Chicago → Detroit', exact: true }).click()
  await page.getByRole('button', { name: 'Compare routes', exact: true }).click()
}

test('loads the planner and connects to the real Django health endpoint', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Plan your trip')
  const health = await page.request.get('/api/v1/health/')
  expect(health.ok()).toBe(true)
  expect(await health.json()).toEqual({ status: 'ok', service: 'spotter-api' })
  await expect(
    page.getByRole('region', { name: 'Trip routes and weather map', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Chicago → Detroit', exact: true }).click()
  await page.getByRole('button', { name: 'Swap origin and destination' }).click()
  await expect(page.getByRole('textbox', { name: 'Origin', exact: true })).toHaveValue(
    'Detroit, MI, USA',
  )
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(
    false,
  )
})

test('selects routes, opens checkpoints, and changes forecasts without another API call', async ({
  page,
}) => {
  let forecastRequests = 0
  const mapErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error' && /worker|webgl|source|image/i.test(message.text()))
      mapErrors.push(message.text())
  })
  await page.route('**/api/v1/plans/', (route) => route.fulfill({ json: planFixture() }))
  await page.route('**/api/v1/plans/*/forecast/', (route) => {
    forecastRequests++
    return route.fulfill({ json: forecastFixture() })
  })
  await page.goto('/')
  await submitExample(page)
  const mapRegion = page.getByRole('region', { name: 'Trip routes and weather map', exact: true })
  await expect(mapRegion.locator('canvas')).toBeVisible()
  const mapBounds = await mapRegion.boundingBox()
  const canvasBounds = await mapRegion.locator('canvas').boundingBox()
  expect(mapBounds).not.toBeNull()
  expect(canvasBounds?.height).toBeCloseTo(mapBounds?.height ?? 0, 0)
  expect(canvasBounds?.width).toBeCloseTo(mapBounds?.width ?? 0, 0)
  await expect(
    page.getByRole('button', { name: 'Select Route 1, recommended', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Select Route 2', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Select Route 2', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  const summary = page.getByRole('region', { name: 'Selected route summary' })
  await expect(summary).toContainText('Route 2')
  await expect(summary).toContainText('ETA')
  await expect(summary).toContainText('mi severe')
  await page.getByRole('button', { name: 'Weather checkpoints (3)', exact: true }).click()
  await page.getByRole('button', { name: /^Checkpoint 1,/ }).click()
  await expect(page.getByText('Wind: 28.0 mph', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Close popup', exact: true }).click()
  await page.getByRole('button', { name: /^Checkpoint 1,/ }).click()
  await expect(page.getByText('Wind: 28.0 mph', { exact: true })).toBeVisible()
  const slider = page.getByRole('slider', { name: 'Forecast hour' })
  await expect(slider).toBeEnabled()
  await slider.focus()
  await slider.press('End')
  await expect(slider).toHaveValue('48')
  await expect(page.getByText('+48h', { exact: true }).last()).toBeVisible()
  expect(forecastRequests).toBe(1)
  await page.getByRole('button', { name: 'Toggle weather layer' }).click()
  await expect(page.getByRole('button', { name: 'Toggle weather layer' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  expect(mapErrors).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(
    false,
  )
})

test('clearly handles a trip where every route has No Travel conditions', async ({ page }) => {
  await page.route('**/api/v1/plans/', (route) => route.fulfill({ json: planFixture(true) }))
  await page.route('**/api/v1/plans/*/forecast/', (route) =>
    route.fulfill({ json: forecastFixture() }),
  )
  await page.goto('/')
  await submitExample(page)
  await expect(page.getByRole('alert')).toContainText('No route is currently eligible')
  await expect(page.getByRole('button', { name: /recommended/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'New trip', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Origin', exact: true })).toHaveValue('')
})

test('retains form details after a provider error and allows a successful retry', async ({
  page,
}) => {
  let attempts = 0
  await page.route('**/api/v1/plans/', (route) => {
    attempts++
    return attempts === 1
      ? route.fulfill({
          status: 503,
          json: {
            detail: 'Weather request limit reached. Please try again later.',
            code: 'provider_rate_limit',
          },
        })
      : route.fulfill({ json: planFixture() })
  })
  await page.route('**/api/v1/plans/*/forecast/', (route) =>
    route.fulfill({ json: forecastFixture() }),
  )
  await page.goto('/')
  await submitExample(page)
  await expect(page.getByRole('alert')).toContainText('Weather request limit reached')
  await expect(page.getByRole('textbox', { name: 'Origin', exact: true })).toHaveValue(
    'Chicago, IL, USA',
  )
  await page.getByRole('button', { name: 'Compare routes', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Select Route 1, recommended', exact: true }),
  ).toBeVisible()
})

test('keeps planning usable when WebGL is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      value(this: HTMLCanvasElement, ...args: Parameters<typeof original>) {
        if (args[0] === 'webgl' || args[0] === 'webgl2') return null
        return original.apply(this, args)
      },
    })
  })
  await page.route('**/api/v1/plans/', (route) => route.fulfill({ json: planFixture() }))
  await page.route('**/api/v1/plans/*/forecast/', (route) =>
    route.fulfill({ json: forecastFixture() }),
  )
  await page.goto('/')
  await submitExample(page)
  await expect(page.getByRole('status').filter({ hasText: 'The map could not load' })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Select Route 1, recommended', exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Retry map', exact: true })).toBeVisible()
})

test('retries a failed corridor forecast without recreating the trip', async ({ page }) => {
  let plans = 0
  let forecasts = 0
  await page.route('**/api/v1/plans/', (route) => {
    plans++
    return route.fulfill({ json: planFixture() })
  })
  await page.route('**/api/v1/plans/*/forecast/', (route) => {
    forecasts++
    return forecasts === 1
      ? route.fulfill({ status: 503, json: { detail: 'Weather provider unavailable.' } })
      : route.fulfill({ json: forecastFixture() })
  })
  await page.goto('/')
  await submitExample(page)
  await page.getByRole('button', { name: 'Retry forecast', exact: true }).click()
  await expect(page.getByRole('slider', { name: 'Forecast hour' })).toBeEnabled()
  expect(plans).toBe(1)
  expect(forecasts).toBe(2)
})
