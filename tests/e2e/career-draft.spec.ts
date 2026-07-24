import { completeHitterScene, expect, ids, installCareerAtFinalMonth, openTitle, test } from '../support/fixtures'

test('reaches the draft after completing the final career month', async ({ guardedPage: page }) => {
  await installCareerAtFinalMonth(page)
  await openTitle(page)
  await page.getByTestId(ids.resumeGame).click()
  await expect(page.getByTestId(ids.hub)).toBeVisible()

  await page.getByRole('button', { name: /타격·수비 훈련/ }).click()
  await page.getByRole('button', { name: /학업 관리/ }).click()
  await page.getByRole('button', { name: /팀 미팅/ }).click()

  while (!await page.getByTestId(ids.startGame).isDisabled()) {
    await page.getByTestId(ids.startGame).click()
    await expect(page.getByTestId(ids.game)).toBeVisible()
    await completeHitterScene(page)
    await page.getByTestId(ids.finishGame).dispatchEvent('click')
    await expect(page.getByTestId(ids.result)).toBeVisible()
    await page.getByTestId(ids.returnToHub).click()
  }

  await expect(page.getByTestId(ids.advanceMonth)).toBeEnabled()
  await page.getByTestId(ids.advanceMonth).click()

  await expect(page.getByTestId(ids.draft)).toBeVisible()
})
