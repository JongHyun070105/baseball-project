import { createCareer, expect, ids, test } from '../support/fixtures'

test('imports an exported career into empty local storage', async ({ guardedPage: page }) => {
  await createCareer(page, '이동 선수')
  const downloadPromise = page.waitForEvent('download')
  await page.getByTestId(ids.exportSave).click()
  const download = await downloadPromise
  const savePath = await download.path()
  expect(savePath).not.toBeNull()

  await page.evaluate(() => localStorage.clear())
  await page.getByTestId(ids.importSave).setInputFiles(savePath!)

  await expect(page.getByTestId(ids.importSuccess)).toBeVisible()
  await page.getByTestId(ids.returnToTitle).click()
  await page.reload()
  await page.getByTestId(ids.resumeGame).click()
  await expect(page.getByTestId(ids.playerNameDisplay)).toHaveText('이동 선수')
})
