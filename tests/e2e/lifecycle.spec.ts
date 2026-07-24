import { completeHitterScene, createCareer, expect, ids, test } from '../support/fixtures'

test('reloads an autosaved action without applying it a second time', async ({ guardedPage: page }) => {
  await createCareer(page, '재로드 선수')
  await page.getByRole('button', { name: /학업 관리/ }).click()
  const savedAfterAction = await page.evaluate(() => localStorage.getItem('diamond-road:save:1'))
  const beforeReload = JSON.parse(savedAfterAction!) as { current: { eventHistory: string[]; month: { actionsRemaining: number } } }
  expect(beforeReload.current.eventHistory.filter((entry) => entry.startsWith('action:0:study:'))).toHaveLength(1)
  expect(beforeReload.current.month.actionsRemaining).toBe(2)

  await page.reload()
  await page.getByTestId(ids.resumeGame).click()

  await expect(page.getByTestId(ids.hub)).toBeVisible()
  await expect.poll(() => page.evaluate(() => localStorage.getItem('diamond-road:save:1'))).toBe(savedAfterAction)
})

test('resumes an in-game checkpoint unchanged after reload', async ({ guardedPage: page }) => {
  await createCareer(page, '체크포인트 선수')
  await page.getByTestId(ids.startGame).click()
  await expect(page.getByTestId(ids.game)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.pause-overlay')).toBeVisible()

  const beforeReload = await page.evaluate(() => {
    const envelope = JSON.parse(localStorage.getItem('diamond-road:save:1')!)
    return {
      phase: envelope.current.phase as string,
      checkpointHash: envelope.current.replayCheckpoint.finalHash as string,
      lastAppliedCommandId: envelope.current.lastAppliedCommandId as number,
      score: {
        away: Number(document.querySelector('[data-testid="away-score"]')?.textContent),
        home: Number(document.querySelector('[data-testid="home-score"]')?.textContent),
      },
    }
  })
  expect(beforeReload.phase).toBe('in-game')

  await page.reload()
  await page.getByTestId(ids.resumeGame).click()

  await expect(page.getByTestId(ids.game)).toBeVisible()
  await expect(page.locator('.pause-overlay')).toBeVisible()
  await expect(page.getByTestId('away-score')).toHaveText(String(beforeReload.score.away))
  await expect(page.getByTestId('home-score')).toHaveText(String(beforeReload.score.home))
  const afterReload = await page.evaluate(() => {
    const current = JSON.parse(localStorage.getItem('diamond-road:save:1')!).current
    return { phase: current.phase, checkpointHash: current.replayCheckpoint.finalHash, lastAppliedCommandId: current.lastAppliedCommandId }
  })
  expect(afterReload).toEqual({
    phase: 'in-game',
    checkpointHash: beforeReload.checkpointHash,
    lastAppliedCommandId: beforeReload.lastAppliedCommandId,
  })
  await page.keyboard.press('Escape')
  await expect(page.locator('.pause-overlay')).toBeHidden()
})

test('reloads an authoritative result and returns to the hub without duplicating its record', async ({ guardedPage: page }) => {
  test.setTimeout(60_000)
  await createCareer(page, '결과 선수')
  await page.getByTestId(ids.startGame).click()
  await expect(page.getByTestId(ids.game)).toBeVisible()
  await completeHitterScene(page)
  await page.getByTestId(ids.finishGame).click()
  await expect(page.getByTestId(ids.result)).toBeVisible()

  const authoritativeResult = {
    away: await page.getByTestId('result-away-score').textContent(),
    home: await page.getByTestId('result-home-score').textContent(),
    hash: await page.getByTestId('result-replay-hash').textContent(),
    statLine: await page.getByTestId('game-stat-line').textContent(),
    performance: await page.getByTestId('game-performance').textContent(),
  }
  expect(authoritativeResult.hash).toMatch(/^[0-9a-f]{8}$/)
  const savedTerminalId = await page.evaluate(() => JSON.parse(localStorage.getItem('diamond-road:save:1')!).current.lastTerminalEventId as string)
  expect(savedTerminalId).not.toBe('')

  await page.reload()
  await page.getByTestId(ids.resumeGame).click()

  await expect(page.getByTestId(ids.result)).toBeVisible()
  await expect(page.getByTestId('result-away-score')).toHaveText(authoritativeResult.away!)
  await expect(page.getByTestId('result-home-score')).toHaveText(authoritativeResult.home!)
  await expect(page.getByTestId('result-replay-hash')).toHaveText(authoritativeResult.hash!)
  await expect(page.getByTestId('game-stat-line')).toHaveText(authoritativeResult.statLine!)
  await expect(page.getByTestId('game-performance')).toHaveText(authoritativeResult.performance!)
  await expect(page.getByTestId('result-terminal-id')).toHaveText(savedTerminalId)
  const beforeReturn = await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('diamond-road:save:1')!).current
    return { games: save.record.games, resolvedGameIds: save.resolvedGames.map((game: { id: string }) => game.id), terminalIds: save.appliedTerminalEventIds }
  })

  await page.getByTestId(ids.returnToHub).click()
  await expect(page.getByTestId(ids.hub)).toBeVisible()

  const afterReturn = await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('diamond-road:save:1')!).current
    return { games: save.record.games, resolvedGameIds: save.resolvedGames.map((game: { id: string }) => game.id), terminalIds: save.appliedTerminalEventIds }
  })
  expect(afterReturn).toEqual(beforeReturn)
  expect(new Set(afterReturn.resolvedGameIds).size).toBe(afterReturn.resolvedGameIds.length)
  expect(new Set(afterReturn.terminalIds).size).toBe(afterReturn.terminalIds.length)
})
