import { createCareer, expect, ids, openTitle, test } from '../support/fixtures'

test('resumes the saved career after returning to the title screen', async ({ guardedPage: page }) => {
  await createCareer(page, '저장 선수')
  await page.getByTestId(ids.returnToTitle).click()
  await expect(page.getByTestId(ids.title)).toBeVisible()

  await page.reload()
  await page.getByTestId(ids.resumeGame).click()

  await expect(page.getByTestId(ids.hub)).toBeVisible()
  await expect(page.getByTestId(ids.playerNameDisplay)).toHaveText('저장 선수')
})

test('does not offer resume when no save exists', async ({ guardedPage: page }) => {
  await page.context().clearCookies()
  await page.addInitScript(() => localStorage.clear())
  await openTitle(page)

  await expect(page.getByTestId(ids.resumeGame)).toBeDisabled()
})
