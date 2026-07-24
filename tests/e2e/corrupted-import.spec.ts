import { createCareer, expect, ids, test } from '../support/fixtures'

async function importJson(page: Parameters<typeof createCareer>[0], contents: string): Promise<void> {
  await page.getByTestId(ids.importSave).evaluate((input, serialized) => {
    const transfer = new DataTransfer()
    transfer.items.add(new File([serialized], 'import.json', { type: 'application/json' }))
    const fileInput = input as HTMLInputElement
    fileInput.files = transfer.files
    fileInput.dispatchEvent(new Event('change', { bubbles: true }))
  }, contents)
}

test('rejects a malformed imported save without showing success', async ({ guardedPage: page }) => {
  await createCareer(page)

  await importJson(page, '{"schemaVersion":1,"current":')

  await expect(page.getByRole('alert')).toContainText('valid JSON')
  await expect(page.getByTestId(ids.importSuccess)).toBeHidden()
})

test('preserves the current slot when an imported save fails checksum validation', async ({ guardedPage: page }) => {
  await createCareer(page, '안전 선수')
  const originalSlot = await page.evaluate(() => localStorage.getItem('diamond-road:save:1'))
  const corrupted = JSON.parse(originalSlot!) as { current: { player: { name: string } } }
  corrupted.current.player.name = '조작 선수'

  await importJson(page, JSON.stringify(corrupted))

  await expect(page.getByRole('alert')).toContainText('checksum')
  await expect.poll(() => page.evaluate(() => localStorage.getItem('diamond-road:save:1'))).toBe(originalSlot)
})
