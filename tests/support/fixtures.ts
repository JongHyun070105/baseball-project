import { expect, test as base, type Page } from '@playwright/test'
import { advanceCareerMonth, applyCareerEventChoice, chooseCareerAction, createCareer as createCareerSimulation, enterDraft, type CareerSimulation } from '../../src/domain/career'
import { getCareerEvent } from '../../src/content'
import { MemoryStorage, SaveRepository } from '../../src/persistence'

export const ids = {
  app: 'app-shell',
  title: 'title-screen',
  newGame: 'new-game-button',
  resumeGame: 'resume-game-button',
  create: 'create-screen',
  playerName: 'player-name-input',
  hitterRole: 'role-hitter',
  shortstopPosition: 'position-SS',
  schoolOption: 'school-option',
  createCareer: 'create-career-button',
  hub: 'career-hub',
  playerNameDisplay: 'player-name-display',
  returnToTitle: 'return-to-title-button',
  startGame: 'start-game-button',
  game: 'game-screen',
  finishGame: 'finish-game-button',
  result: 'result-screen',
  returnToHub: 'return-to-hub-button',
  advanceMonth: 'advance-month-button',
  careerYear: 'career-year',
  draft: 'draft-screen',
  exportSave: 'export-save-button',
  importSave: 'import-save-input',
  importSuccess: 'import-save-success',
} as const

export const test = base.extend<{ guardedPage: Page }>({
  guardedPage: async ({ page }, use) => {
    const errors: string[] = []

    await page.addInitScript(() => {
      Date.now = () => 1_767_225_600_000
    })

    page.on('console', (message) => {
      if (message.type() === 'error') {
        const source = message.location().url
        errors.push(`console: ${message.text()}${source ? ` (${source})` : ''}`)
      }
    })
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))

    await use(page)

    expect(errors, 'the browser must not emit console errors or uncaught exceptions').toEqual([])
  },
})

export { expect }

export async function openTitle(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByTestId(ids.title)).toBeVisible()
}

export async function createCareer(page: Page, playerName = '테스트 선수'): Promise<void> {
  await openTitle(page)
  await page.getByTestId(ids.newGame).click()
  await expect(page.getByTestId(ids.create)).toBeVisible()
  await page.getByTestId(ids.playerName).fill(playerName)
  await page.getByTestId(ids.hitterRole).click()
  await page.getByTestId(ids.shortstopPosition).click()
  await page.getByTestId(ids.schoolOption).first().click()
  await page.getByTestId(ids.createCareer).click()
  await expect(page.getByTestId(ids.hub)).toBeVisible()
}

export async function createPitcherCareer(page: Page, playerName = '테스트 투수'): Promise<void> {
  await openTitle(page)
  await page.getByTestId(ids.newGame).click()
  await expect(page.getByTestId(ids.create)).toBeVisible()
  await page.getByTestId(ids.playerName).fill(playerName)
  await page.getByRole('group', { name: '선수 역할' }).getByRole('button', { name: '투수', exact: true }).click()
  await page.getByRole('group', { name: '투수 보직' }).getByRole('button', { name: '선발', exact: true }).click()
  await page.getByTestId(ids.schoolOption).first().click()
  await page.getByTestId(ids.createCareer).click()
  await expect(page.getByTestId(ids.hub)).toBeVisible()
}

export async function finishOneGame(page: Page): Promise<void> {
  await page.getByTestId(ids.startGame).click()
  await expect(page.getByTestId(ids.game)).toBeVisible()
  await completeHitterScene(page)
  await page.getByTestId(ids.finishGame).dispatchEvent('click')
  await expect(page.getByTestId(ids.result)).toBeVisible()
}

export async function completeHitterScene(page: Page): Promise<void> {
  const game = page.getByTestId(ids.game)
  for (let appearance = 1; appearance <= 3; appearance += 1) {
    for (let pitch = 0; pitch < 12 && await game.getAttribute('data-scene') === 'batting'; pitch += 1) {
      await game.dispatchEvent('pointermove', { clientX: 720, clientY: 450, pointerType: 'mouse' })
      await game.dispatchEvent('pointerdown', { clientX: 720, clientY: 450, button: 0, pointerType: 'mouse' })
      await page.waitForTimeout(40)
    }
    await expect(game).toHaveAttribute('data-scene', /baserunning|infield/)
    if (await game.getAttribute('data-scene') === 'baserunning') {
      await page.keyboard.down('Shift')
      await page.keyboard.down('w')
      await page.keyboard.press('Space')
      await page.keyboard.up('w')
      await page.keyboard.up('Shift')
    }
    await expect(game).toHaveAttribute('data-scene', 'infield')
    await page.keyboard.press('Space')
    await page.keyboard.press('2')
    await expect(game).toHaveAttribute('data-player-plate-appearances', String(appearance))
  }
  await expect(page.getByTestId(ids.finishGame)).toBeEnabled()
}

function simulatedCareerAtMonth(targetMonth: number): CareerSimulation {
  let career = createCareerSimulation({
    seed: 20_260_724,
    name: '드래프트 선수',
    schoolId: 'seorin',
    role: 'hitter',
    position: 'SS',
    archetypeId: 'field-general',
  })
  for (let month = 0; month < targetMonth; month += 1) {
    career = chooseCareerAction(career, 'growth')
    career = chooseCareerAction(career, 'study')
    career = chooseCareerAction(career, 'relationship')
    career = advanceCareerMonth(career)
    if (career.progress.latestEventId) {
      const event = getCareerEvent(career.progress.latestEventId)
      career = applyCareerEventChoice(career, event.id, event.choices[0].id)
    }
  }
  return career
}

async function installCareer(page: Page, career: CareerSimulation): Promise<void> {
  const repository = new SaveRepository(new MemoryStorage())
  repository.autosave(1, career.save)
  const serialized = repository.export(1)
  await page.addInitScript((save) => localStorage.setItem('diamond-road:save:1', save), serialized)
}

export async function installCareerAtFinalMonth(page: Page): Promise<void> {
  await installCareer(page, simulatedCareerAtMonth(35))
}

export async function installCompletedDraftCareer(page: Page): Promise<void> {
  let career = simulatedCareerAtMonth(35)
  career = chooseCareerAction(career, 'growth')
  career = chooseCareerAction(career, 'study')
  career = chooseCareerAction(career, 'relationship')
  career = advanceCareerMonth(career)
  await installCareer(page, enterDraft(career).career)
}
