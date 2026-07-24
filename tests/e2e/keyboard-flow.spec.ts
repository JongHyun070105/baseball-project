import type { Locator, Page } from '@playwright/test'
import { expect, ids, openTitle, test } from '../support/fixtures'

async function tabTo(page: Page, target: Locator, maximumTabs = 24): Promise<void> {
  for (let index = 0; index < maximumTabs; index += 1) {
    await page.keyboard.press('Tab')
    if (await target.evaluate((element) => element === document.activeElement)) return
  }
  throw new Error(`Target did not receive keyboard focus after ${maximumTabs} tabs`)
}

test('creates a career using only the keyboard at 1280 by 720', async ({ guardedPage: page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await openTitle(page)
  expect(page.viewportSize()).toEqual({ width: 1280, height: 720 })

  await tabTo(page, page.getByTestId(ids.newGame))
  await page.keyboard.press('Enter')
  await expect(page.getByTestId(ids.create)).toBeVisible()

  await tabTo(page, page.getByTestId(ids.playerName))
  await page.keyboard.type('키보드 선수')
  await tabTo(page, page.getByTestId(ids.createCareer))
  await page.keyboard.press('Enter')

  await expect(page.getByTestId(ids.playerNameDisplay)).toHaveText('키보드 선수')
})
