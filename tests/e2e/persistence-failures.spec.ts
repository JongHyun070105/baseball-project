import { expect, ids, openTitle, test } from '../support/fixtures'

async function openConfiguredCreation(page: Parameters<typeof openTitle>[0], playerName: string): Promise<void> {
  await openTitle(page)
  await page.getByTestId(ids.newGame).click()
  await page.getByTestId(ids.playerName).fill(playerName)
  await page.getByTestId(ids.hitterRole).click()
  await page.getByTestId(ids.shortstopPosition).click()
  await page.getByTestId(ids.schoolOption).first().click()
}

test('keeps career creation visible when the primary save write exceeds quota', async ({ guardedPage: page }) => {
  await openConfiguredCreation(page, '저장 실패 선수')
  await page.evaluate(() => {
    const nativeSetItem = Storage.prototype.setItem
    Storage.prototype.setItem = function setItem(key: string, value: string): void {
      if (key === 'diamond-road:save:1') throw new DOMException('full', 'QuotaExceededError')
      nativeSetItem.call(this, key, value)
    }
  })

  await page.getByTestId(ids.createCareer).click()

  await expect(page.getByTestId(ids.create)).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('Storage quota was exceeded')
  expect(await page.evaluate(() => ({
    primary: localStorage.getItem('diamond-road:save:1'),
    pending: localStorage.getItem('diamond-road:save:1:pending'),
  }))).toEqual({ primary: null, pending: null })
})

test('restores an independently authenticated backup when the current save is corrupt', async ({ guardedPage: page }) => {
  await openConfiguredCreation(page, '백업 선수')
  await page.getByTestId(ids.createCareer).click()
  await expect(page.getByTestId(ids.hub)).toBeVisible()
  await page.getByTestId('career-action-study').click()
  await page.getByTestId(ids.returnToTitle).click()
  await page.evaluate(() => {
    const key = 'diamond-road:save:1'
    const envelope = JSON.parse(localStorage.getItem(key)!)
    envelope.current.player.name = '손상된 현재 선수'
    localStorage.setItem(key, JSON.stringify(envelope))
  })

  await page.reload()
  await page.getByTestId('manage-saves-button').click()

  await expect(page.getByTestId('save-slot-1')).toContainText('손상된 세이브')
  await expect(page.getByTestId('restore-save-slot-1')).toBeVisible()
  await page.getByTestId('restore-save-slot-1').click()
  await expect(page.getByTestId('save-confirm-dialog')).toBeVisible()
  await page.getByTestId('confirm-save-action').click()

  await expect(page.getByTestId(ids.hub)).toBeVisible()
  await expect(page.getByTestId(ids.playerNameDisplay)).toHaveText('백업 선수')
  const restored = await page.evaluate(() => JSON.parse(localStorage.getItem('diamond-road:save:1')!))
  expect(restored.current.player.name).toBe('백업 선수')
  expect(restored.backup).toBeNull()
  expect(restored.backupChecksum).toBeNull()
})
