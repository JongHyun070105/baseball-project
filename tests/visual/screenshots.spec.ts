import { createCareer, createPitcherCareer, finishOneGame, ids, installCompletedDraftCareer, openTitle, test } from '../support/fixtures'

test.use({
  colorScheme: 'dark',
})

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  test.expect(page.viewportSize()).toEqual({ width: 1440, height: 900 })
})

test('title screen matches the approved desktop baseline', async ({ guardedPage: page }) => {
  await openTitle(page)
  await test.expect(page.getByTestId(ids.title)).toHaveScreenshot('title.png', { animations: 'disabled' })
})

test('career creation matches the approved desktop baseline', async ({ guardedPage: page }) => {
  await openTitle(page)
  await page.getByTestId(ids.newGame).click()

  await test.expect(page.getByTestId(ids.create)).toHaveScreenshot('create.png', { animations: 'disabled' })
})

test('career hub matches the approved desktop baseline', async ({ guardedPage: page }) => {
  await createCareer(page)

  await test.expect(page.getByTestId(ids.hub)).toHaveScreenshot('hub.png', { animations: 'disabled' })
})

test('game screen matches the approved desktop baseline', async ({ guardedPage: page }) => {
  await createCareer(page)
  await page.getByTestId(ids.startGame).click()
  await test.expect(page.getByTestId(ids.game)).toBeVisible()
  await page.keyboard.press('Escape')
  await test.expect(page.locator('.pause-overlay')).toBeVisible()
  await page.locator('.pause-overlay').evaluate((overlay) => {
    const pauseOverlay = overlay as HTMLElement
    pauseOverlay.style.display = 'none'
  })

  await test.expect(page.getByTestId(ids.game)).toHaveScreenshot('game.png', { animations: 'disabled', maxDiffPixels: 1_000, timeout: 15_000 })
})

test('pitching game screen matches the approved desktop baseline', async ({ guardedPage: page }) => {
  await createPitcherCareer(page)
  await page.getByTestId(ids.startGame).click()
  await test.expect(page.getByTestId(ids.game)).toBeVisible()
  await page.keyboard.press('Escape')
  await test.expect(page.locator('.pause-overlay')).toBeVisible()
  await page.locator('.pause-overlay').evaluate((overlay) => {
    const pauseOverlay = overlay as HTMLElement
    pauseOverlay.style.display = 'none'
  })

  await test.expect(page.getByTestId(ids.game)).toHaveScreenshot('pitching.png', { animations: 'disabled', maxDiffPixels: 1_000, timeout: 15_000 })
})

test('result screen matches the approved desktop baseline', async ({ guardedPage: page }) => {
  await createCareer(page)
  await finishOneGame(page)

  await test.expect(page.getByTestId(ids.result)).toHaveScreenshot('result.png', { animations: 'disabled' })
})

test('draft screen matches the approved desktop baseline', async ({ guardedPage: page }) => {
  await installCompletedDraftCareer(page)
  await openTitle(page)
  await page.getByTestId(ids.resumeGame).click()

  await test.expect(page.getByTestId(ids.draft)).toHaveScreenshot('draft.png', { animations: 'disabled' })
})
