import { completeHitterScene, createCareer, expect, ids, test } from '../support/fixtures'

test('creates a new hitter career and opens the career hub', async ({ guardedPage: page }) => {
  await createCareer(page, '김다이아')

  await expect(page.getByTestId(ids.playerNameDisplay)).toHaveText('김다이아')
})

test('finishes one game and shows its result', async ({ guardedPage: page }) => {
  test.setTimeout(60_000)
  await createCareer(page)
  await page.getByTestId(ids.startGame).click()
  await expect(page.getByTestId(ids.game)).toBeVisible()
  await completeHitterScene(page)
  await page.getByTestId(ids.finishGame).dispatchEvent('click')

  await expect(page.getByTestId(ids.result)).toBeVisible()
})
