import type { CareerSave } from '../contracts'
import {
  createCareerSchedule,
  type CareerSimulation,
  type LineupStatus,
} from '../domain/career'
import { CAREER_EVENTS } from '../content/events'

function lineupStatus(save: CareerSave, academics: number): LineupStatus {
  if (academics < 45) return 'ineligible'
  if (save.player.coachTrust >= 68) return 'starter'
  if (save.player.coachTrust >= 52) return 'rotation'
  return 'reserve'
}

/** Rebuilds transient, deterministic career state from the versioned save payload. */
export function hydrateCareer(save: CareerSave): CareerSimulation {
  const actionEntries = save.eventHistory.filter((entry) => entry.startsWith('action:'))
  const studyCount = actionEntries.filter((entry) => entry.includes(':study:')).length
  const academics = Math.max(0, Math.min(100, 70 + studyCount * 8 - save.month.index))
  const actionsCompleted = save.month.index * 3 + (3 - save.month.actionsRemaining)
  const latestHistoryEntry = save.eventHistory.at(-1) ?? null
  const latestEventId = CAREER_EVENTS.some((event) => event.id === latestHistoryEntry) ? latestHistoryEntry : null
  return {
    save,
    progress: {
      academics,
      growthPoints: Math.max(0, actionEntries.filter((entry) => entry.includes(':growth:')).length * 3),
      actionsCompleted,
      lineupStatus: lineupStatus(save, academics),
      depthRank: save.player.coachTrust >= 68 ? 1 : save.player.coachTrust >= 52 ? 2 : 3,
      latestEventId,
    },
    schedule: createCareerSchedule(save.seed, save.player.schoolId, save.resolvedGames),
  }
}
