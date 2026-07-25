import { createCareer, expect, ids, test } from '../support/fixtures'

async function createAuthoritativeContact(page: Parameters<typeof createCareer>[0]): Promise<void> {
  const game = page.getByTestId(ids.game)
  for (let attempt = 0; attempt < 8 && await game.getAttribute('data-authoritative-ball-count') !== '1'; attempt += 1) {
    expect(await game.getAttribute('data-scene'), 'the deterministic performance fixture must still accept direct batting input').toBe('batting')
    await page.getByRole('button', { name: /CONTACT/ }).click()
    await page.waitForTimeout(60)
  }
  await expect(game).toHaveAttribute('data-authoritative-ball-count', '1')
  await expect(page.getByTestId('authoritative-ball-state')).toBeVisible()
  await expect(page.locator('.game-canvas canvas')).toBeVisible()
}

test('renders the title screen within the local performance budget', async ({ guardedPage: page }) => {
  const startedAt = Date.now()
  await page.goto('/')
  await expect(page.getByTestId(ids.title)).toBeVisible()

  expect(Date.now() - startedAt).toBeLessThan(5_000)
})

test('loads without failed same-origin application requests', async ({ guardedPage: page }) => {
  const failures: string[] = []
  page.on('requestfailed', (request) => {
    if (request.url().startsWith('http://127.0.0.1:4173')) {
      failures.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText ?? 'unknown error'}`)
    }
  })

  await page.goto('/')
  await expect(page.getByTestId(ids.app)).toBeVisible()

  expect(failures, 'all same-origin application requests must succeed').toEqual([])
})

test('boots the production build while every external origin is blocked', async ({ guardedPage: page }) => {
  const externalRequests: string[] = []
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.origin !== 'http://127.0.0.1:4173') {
      externalRequests.push(url.href)
      await route.abort('blockedbyclient')
      return
    }
    await route.continue()
  })

  await page.goto('/')

  await expect(page.getByTestId(ids.title)).toBeVisible()
  expect(externalRequests, 'the production build must not depend on external origins').toEqual([])
})

test('holds the representative 3D game scene above the 50fps budget', async ({ guardedPage: page }) => {
  test.setTimeout(90_000)
  expect(page.viewportSize()).toEqual({ width: 1440, height: 900 })
  await createCareer(page)
  await page.getByTestId(ids.startGame).click()
  await expect(page.getByTestId(ids.game)).toBeVisible()
  await expect(page.getByTestId(ids.game)).toHaveAttribute('data-target-dpr', '1.5')
  await expect(page.getByTestId(ids.game)).toHaveAttribute('data-athlete-count', '18')
  await expect(page.getByTestId(ids.game)).toHaveAttribute('data-crowd-count', '800')
  await expect(page.getByTestId(ids.game)).toHaveAttribute('data-lighting', 'night')
  await expect(page.getByTestId(ids.game)).toHaveAttribute('data-quality-fallback', 'false')
  await expect(page.getByTestId(ids.game)).toHaveAttribute('data-scene-quality', 'high')
  await createAuthoritativeContact(page)
  await page.waitForTimeout(10_000)

  const measurement = await page.evaluate(() => new Promise<{ frameTimes: number[]; peakHeapMiB: number | null }>((resolve) => {
    const samples: number[] = []
    let peakHeapMiB: number | null = null
    let previous = performance.now()
    const started = previous
    const measure = (now: number) => {
      samples.push(now - previous)
      const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory
      if (memory) peakHeapMiB = Math.max(peakHeapMiB ?? 0, memory.usedJSHeapSize / 1024 / 1024)
      previous = now
      if (now - started >= 60_000) resolve({ frameTimes: samples.slice(10), peakHeapMiB })
      else requestAnimationFrame(measure)
    }
    requestAnimationFrame(measure)
  }))
  const { frameTimes, peakHeapMiB } = measurement
  const sorted = [...frameTimes].sort((left, right) => left - right)
  const median = sorted[Math.floor(sorted.length / 2)]
  const averageFrameTime = frameTimes.reduce((sum, value) => sum + value, 0) / frameTimes.length
  const averageFps = 1000 / averageFrameTime
  const p95 = sorted[Math.ceil(sorted.length * 0.95) - 1]
  console.log(`frame metrics (1440x900): median=${median.toFixed(2)}ms average=${averageFrameTime.toFixed(2)}ms (${averageFps.toFixed(1)}fps) p95=${p95.toFixed(2)}ms samples=${frameTimes.length} peakHeap=${peakHeapMiB?.toFixed(1) ?? 'n/a'}MiB`)

  expect(median).toBeLessThanOrEqual(20)
  expect(averageFps).toBeGreaterThanOrEqual(50)
  expect(p95).toBeLessThanOrEqual(33)
  if (peakHeapMiB !== null) expect(peakHeapMiB).toBeLessThanOrEqual(350)
})

test('reduces DPR and scene quality after sustained slow frames', async ({ guardedPage: page, context }) => {
  test.setTimeout(30_000)
  await createCareer(page)
  await page.getByTestId(ids.startGame).click()
  const game = page.getByTestId(ids.game)
  await expect(game).toHaveAttribute('data-quality-fallback', 'false')
  await expect(game).toHaveAttribute('data-target-dpr', '1.5')
  await expect(game).toHaveAttribute('data-scene-quality', 'high')

  const session = await context.newCDPSession(page)
  try {
    await session.send('Emulation.setCPUThrottlingRate', { rate: 8 })
    await page.evaluate(() => new Promise<void>((resolve) => {
      const started = performance.now()
      const renderSlowFrame = () => {
        const workStarted = performance.now()
        while (performance.now() - workStarted < 34) Math.sqrt(123_456.789)
        if (performance.now() - started >= 4_500) resolve()
        else requestAnimationFrame(renderSlowFrame)
      }
      requestAnimationFrame(renderSlowFrame)
    }))
    await expect(game).toHaveAttribute('data-quality-fallback', 'true', { timeout: 10_000 })
    await expect(game).toHaveAttribute('data-target-dpr', '1.13')
    await expect(game).toHaveAttribute('data-scene-quality', 'medium')
  } finally {
    await session.send('Emulation.setCPUThrottlingRate', { rate: 1 })
    await session.detach()
  }
})
