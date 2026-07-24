import type { PitchCommand, PitchType, SwingCommand } from '../../contracts'
import type { SeededRng } from '../core/rng'
import { createBattedBall, simulateBall } from '../physics/ball-flight'
import type { ContactResolution, PitchResolution, PlateResult } from './types'

const PITCH_DIFFICULTY: Record<PitchType, number> = {
  'four-seam': 0.42,
  'two-seam': 0.48,
  changeup: 0.57,
  slider: 0.62,
  curveball: 0.66,
}

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.min(maximum, Math.max(minimum, value))
}

export interface ContactClassificationInput {
  flightClassification: 'in-flight' | 'strike' | 'ball' | 'foul' | 'grounded' | 'caught' | 'home-run' | 'dead'
  sprayAngle: number
  launchAngle: number
  distance: number
  contactQuality: number
  catchProbability: number
  fieldingRoll: number
}

export function classifyContact(
  input: ContactClassificationInput,
): Pick<ContactResolution, 'classification' | 'plateResult'> {
  if (input.flightClassification === 'foul' || Math.abs(input.sprayAngle) > 45) {
    return { classification: 'foul', plateResult: 'foul' }
  }
  if (input.flightClassification === 'home-run') {
    return { classification: 'home-run', plateResult: 'home-run' }
  }
  if (input.flightClassification === 'caught') {
    return { classification: 'catch', plateResult: 'out' }
  }
  if (input.launchAngle > 8 && input.fieldingRoll < input.catchProbability) {
    return { classification: 'catch', plateResult: 'out' }
  }
  if (input.distance >= 120) {
    return { classification: 'fence', plateResult: input.launchAngle < 18 ? 'triple' : 'double' }
  }
  if (input.launchAngle <= 8) {
    const plateResult = input.contactQuality <= 0.68 && input.fieldingRoll < 0.56 ? 'out' : 'single'
    return {
      classification: 'ground',
      plateResult,
    }
  }
  let plateResult: 'double' | 'single' | 'out'
  if (input.distance > 82) plateResult = 'double'
  else if (input.contactQuality > 0.55) plateResult = 'single'
  else plateResult = 'out'
  return {
    classification: 'fair',
    plateResult,
  }
}

export function resolvePitch(command: PitchCommand, rng: SeededRng): PitchResolution {
  const accuracy = clamp((command.gestureAccuracy + command.releaseAccuracy) / 2)
  const miss = (1 - accuracy) * 0.75
  const actual = {
    x: command.target.x + (rng.next() * 2 - 1) * miss,
    y: command.target.y + (rng.next() * 2 - 1) * miss,
  }
  const edgeDistance = Math.max(Math.abs(actual.x) / 0.83, Math.abs(actual.y - 0.5) / 0.55)
  return {
    command,
    actual,
    inZone: Math.abs(actual.x) <= 0.83 && actual.y >= -0.05 && actual.y <= 1.05,
    quality: clamp(accuracy * 0.55 + PITCH_DIFFICULTY[command.pitchType] * 0.3 + clamp(edgeDistance) * 0.15),
  }
}

export function createAiPitch(rng: SeededRng): PitchCommand {
  const pitchTypes: readonly PitchType[] = ['four-seam', 'two-seam', 'changeup', 'slider', 'curveball']
  return {
    pitchType: rng.pick(pitchTypes),
    target: { x: rng.next() * 1.5 - 0.75, y: rng.next() * 0.9 + 0.05 },
    gestureAccuracy: 0.62 + rng.next() * 0.34,
    releaseAccuracy: 0.62 + rng.next() * 0.34,
  }
}

export function createAiSwing(pitch: PitchResolution, rng: SeededRng): SwingCommand | undefined {
  const chaseChance = pitch.inZone ? 0.78 : 0.23
  if (rng.next() > chaseChance) return undefined
  let swingType: SwingCommand['swingType']
  if (rng.next() < 0.18) swingType = 'power'
  else if (rng.next() < 0.42) swingType = 'contact'
  else swingType = 'normal'
  return {
    swingType,
    aim: {
      x: pitch.actual.x + (rng.next() * 2 - 1) * 0.28,
      y: pitch.actual.y + (rng.next() * 2 - 1) * 0.28,
    },
    timingSeconds: (rng.next() * 2 - 1) * 0.14,
  }
}

function contactBiasFor(swingType: SwingCommand['swingType']): number {
  if (swingType === 'contact') return 0.14
  if (swingType === 'power') return -0.1
  return 0
}

function powerMultiplierFor(swingType: SwingCommand['swingType']): number {
  if (swingType === 'power') return 1.13
  if (swingType === 'contact') return 0.9
  return 1
}

export function resolveSwing(
  pitch: PitchResolution,
  swing: SwingCommand | undefined,
  rng: SeededRng,
): { result: PlateResult; contact?: ContactResolution } {
  if (!swing) return { result: pitch.inZone ? 'called-strike' : 'ball' }

  const aimError = Math.hypot(swing.aim.x - pitch.actual.x, swing.aim.y - pitch.actual.y)
  const timingError = Math.abs(swing.timingSeconds)
  const contactBias = contactBiasFor(swing.swingType)
  const contactQuality = clamp(1.08 - aimError * 1.15 - timingError * 4.2 - pitch.quality * 0.26 + contactBias)
  if (rng.next() > clamp(0.12 + contactQuality * 0.92)) return { result: 'swinging-strike' }

  const powerMultiplier = powerMultiplierFor(swing.swingType)
  const exitVelocity = 18 + contactQuality * 37 * powerMultiplier + (rng.next() * 2 - 1) * 2.5
  const launchAngle = -7 + contactQuality * 38 + (rng.next() * 2 - 1) * 13
  const timingSpray = swing.timingSeconds * 190
  const sprayAngle = timingSpray + (swing.aim.x - pitch.actual.x) * 28 + (rng.next() * 2 - 1) * 10
  const flight = simulateBall(createBattedBall(exitVelocity, launchAngle, sprayAngle))
  const fieldingRoll = rng.next()
  const distance = Math.hypot(flight.state.position.x, flight.state.position.z)
  const catchProbability = clamp((flight.state.tick / 480) * 0.44 + (1 - distance / 125) * 0.35 - contactQuality * 0.12)

  const { classification, plateResult } = classifyContact({
    flightClassification: flight.classification,
    sprayAngle,
    launchAngle,
    distance,
    contactQuality,
    catchProbability,
    fieldingRoll,
  })

  return {
    result: plateResult,
    contact: { classification, plateResult, flight, catchProbability, fieldingRoll },
  }
}
