import type { BallClassification, BallFlightResult, BallState, Vec3 } from '../../contracts'
import { add, cross, magnitude, quantize, scale } from './vector'

export const FIXED_STEP_SECONDS = 1 / 120
const GRAVITY: Vec3 = { x: 0, y: -9.80665, z: 0 }
const AIR_DENSITY = 1.204
const BALL_AREA = 0.0042
const BALL_MASS = 0.145
const DRAG_COEFFICIENT = 0.34
const MAGNUS_COEFFICIENT = 0.00042

export interface FieldGeometry {
  leftFoulXAtFence: number
  rightFoulXAtFence: number
  fenceDepth: number
  fenceHeight: number
}

export const DEFAULT_FIELD: FieldGeometry = {
  leftFoulXAtFence: -100,
  rightFoulXAtFence: 100,
  fenceDepth: 120,
  fenceHeight: 3.6,
}

function acceleration(state: BallState): Vec3 {
  const speed = magnitude(state.velocity)
  if (speed === 0) return GRAVITY
  const dragFactor = (-0.5 * AIR_DENSITY * DRAG_COEFFICIENT * BALL_AREA * speed) / BALL_MASS
  const drag = scale(state.velocity, dragFactor)
  const magnus = scale(cross(state.spin, state.velocity), MAGNUS_COEFFICIENT)
  return add(GRAVITY, add(drag, magnus))
}

export function stepBall(state: BallState, dt = FIXED_STEP_SECONDS): BallState {
  const nextVelocity = add(state.velocity, scale(acceleration(state), dt))
  const nextPosition = add(state.position, scale(nextVelocity, dt))
  return {
    position: quantize(nextPosition),
    velocity: quantize(nextVelocity),
    spin: quantize(state.spin),
    tick: state.tick + 1,
  }
}

export function isFair(position: Vec3): boolean {
  if (position.z <= 0) return false
  return Math.abs(position.x) <= position.z
}

export function classifyBall(state: BallState, field = DEFAULT_FIELD): BallClassification {
  if (!Object.values(state.position).every(Number.isFinite)) return 'dead'
  if (state.position.z >= field.fenceDepth && state.position.y >= field.fenceHeight) {
    return isFair(state.position) ? 'home-run' : 'foul'
  }
  if (state.position.y <= 0) return isFair(state.position) ? 'grounded' : 'foul'
  return 'in-flight'
}

export function simulateBall(
  initial: BallState,
  maxTicks = 2_400,
  field = DEFAULT_FIELD,
): BallFlightResult {
  let state = initial
  let classification: BallClassification = 'in-flight'
  for (let index = 0; index < maxTicks && classification === 'in-flight'; index += 1) {
    state = stepBall(state)
    classification = classifyBall(state, field)
  }
  const horizontalSpeed = Math.hypot(initial.velocity.x, initial.velocity.z)
  return {
    state,
    classification,
    contactQuality: Math.min(1, magnitude(initial.velocity) / 55),
    exitVelocityMps: magnitude(initial.velocity),
    launchAngleDegrees: (Math.atan2(initial.velocity.y, horizontalSpeed) * 180) / Math.PI,
  }
}

export function createBattedBall(exitVelocityMps: number, launchDegrees: number, sprayDegrees: number): BallState {
  const launch = (launchDegrees * Math.PI) / 180
  const spray = (sprayDegrees * Math.PI) / 180
  const horizontal = exitVelocityMps * Math.cos(launch)
  return {
    position: { x: 0, y: 1, z: 0 },
    velocity: {
      x: horizontal * Math.sin(spray),
      y: exitVelocityMps * Math.sin(launch),
      z: horizontal * Math.cos(spray),
    },
    spin: { x: 80, y: 20 * Math.sin(spray), z: -30 },
    tick: 0,
  }
}
