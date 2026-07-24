import { createPitcherCareer, expect, ids, test } from '../support/fixtures'

test('creates a pitcher, throws the selected pitch, and records the pitching result', async ({ guardedPage: page }) => {
  test.setTimeout(60_000)
  await createPitcherCareer(page, '윤에이스')
  await page.getByTestId(ids.startGame).click()
  await expect(page.getByTestId(ids.game)).toBeVisible()

  const pitchSelector = page.getByRole('group', { name: '구종 선택' })
  await page.keyboard.press('4')
  await expect(pitchSelector.getByRole('button', { name: /슬라이더/ })).toHaveClass(/is-active/)
  const game = page.getByTestId(ids.game)
  await expect(page.getByTestId(ids.finishGame)).toBeDisabled()
  const terminalIds = new Set<string>()
  for (let pitch = 0; pitch < 40 && await game.getAttribute('data-match-half') === 'top'; pitch += 1) {
    await game.dispatchEvent('pointerdown', { clientX: 720, clientY: 450, button: 0, pointerType: 'mouse' })
    await page.waitForTimeout(325)
    await game.dispatchEvent('pointermove', { clientX: 900, clientY: 450, buttons: 1, pointerType: 'mouse' })
    await page.waitForTimeout(325)
    await game.dispatchEvent('pointerup', { clientX: 1044, clientY: 450, button: 0, pointerType: 'mouse' })
    const terminal = page.getByTestId('gameplay-terminal')
    if (await terminal.count()) terminalIds.add((await terminal.getAttribute('data-terminal-id'))!)
  }
  await expect(game).toHaveAttribute('data-match-half', 'bottom')
  expect(terminalIds.size).toBeGreaterThanOrEqual(3)
  const strikeouts = Number(await game.getAttribute('data-player-strikeouts'))
  await expect(page.getByTestId(ids.finishGame)).toBeEnabled()

  await page.getByTestId(ids.finishGame).dispatchEvent('click')
  await expect(page.getByTestId(ids.result)).toBeVisible()
  await expect(page.getByTestId('game-stat-line')).toHaveText(`1이닝 ${strikeouts}탈삼진`)
})
