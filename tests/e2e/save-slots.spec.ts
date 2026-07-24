import { expect, ids, openTitle, test } from '../support/fixtures'

async function createCareerInNextEmptySlot(page: Parameters<typeof openTitle>[0], playerName: string): Promise<void> {
  await page.getByTestId(ids.newGame).click()
  await page.getByTestId(ids.playerName).fill(playerName)
  await page.getByTestId(ids.hitterRole).click()
  await page.getByTestId(ids.shortstopPosition).click()
  await page.getByTestId(ids.schoolOption).first().click()
  await page.getByTestId(ids.createCareer).click()
  await expect(page.getByTestId(ids.playerNameDisplay)).toHaveText(playerName)
  await page.getByTestId(ids.returnToTitle).click()
}

test('creates careers in each of the three independent save slots', async ({ guardedPage: page }) => {
  await openTitle(page)
  for (const playerName of ['1번 선수', '2번 선수', '3번 선수']) {
    await createCareerInNextEmptySlot(page, playerName)
  }

  await page.getByRole('button', { name: '저장 슬롯 관리' }).click()
  for (const playerName of ['1번 선수', '2번 선수', '3번 선수']) {
    await expect(page.getByRole('heading', { name: playerName, exact: true })).toBeVisible()
  }
  await expect(page.locator('.save-slot')).toHaveCount(3)
})

test('deletes only the confirmed save slot', async ({ guardedPage: page }) => {
  await openTitle(page)
  for (const playerName of ['보존 선수 1', '삭제 선수', '보존 선수 3']) {
    await createCareerInNextEmptySlot(page, playerName)
  }
  await page.getByRole('button', { name: '저장 슬롯 관리' }).click()

  await page.getByTestId('delete-save-slot-2').click()
  await expect(page.getByTestId('save-confirm-dialog')).toBeVisible()
  await page.getByTestId('confirm-delete-save-slot').click()

  await expect(page.getByTestId('save-slot-2')).toContainText('비어 있는 슬롯')
  await expect(page.getByTestId('save-slot-1')).toContainText('보존 선수 1')
  await expect(page.getByTestId('save-slot-3')).toContainText('보존 선수 3')
  expect(await page.evaluate(() => [1, 2, 3].map((slot) => localStorage.getItem(`diamond-road:save:${slot}`) !== null))).toEqual([true, false, true])
})

test('cancels overwrite without changing the selected save slot', async ({ guardedPage: page }) => {
  await openTitle(page)
  await createCareerInNextEmptySlot(page, '덮어쓰기 보존 선수')
  await page.getByTestId('manage-saves-button').click()
  const originalSlot = await page.evaluate(() => localStorage.getItem('diamond-road:save:1'))

  await page.getByTestId('overwrite-save-slot-1').click()
  await expect(page.getByTestId('save-confirm-dialog')).toBeVisible()
  await page.getByTestId('cancel-save-action').click()

  await expect(page.getByTestId('save-confirm-dialog')).toBeHidden()
  await expect(page.getByTestId('save-slot-1')).toContainText('덮어쓰기 보존 선수')
  await expect(page.getByTestId(ids.create)).toBeHidden()
  await expect.poll(() => page.evaluate(() => localStorage.getItem('diamond-road:save:1'))).toBe(originalSlot)
})
