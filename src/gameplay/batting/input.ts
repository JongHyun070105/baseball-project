import type { SwingCommand, SwingType } from '../../contracts'
import { normalizeKey } from '../core'

export type BattingInputAction =
  | { type: 'aim'; aim: { x: number; y: number } }
  | { type: 'swing'; swingType: SwingType }
  | { type: 'bunt' }
  | { type: 'request-time' }

export function mapBattingPointerMove(x: number, y: number): BattingInputAction {
  return { type: 'aim', aim: { x, y } }
}

export function mapBattingPointerButton(button: number): BattingInputAction | undefined {
  if (button === 0) return { type: 'swing', swingType: 'normal' }
  if (button === 2) return { type: 'swing', swingType: 'contact' }
  return undefined
}

export function mapBattingKey(key: string): BattingInputAction | undefined {
  switch (normalizeKey(key)) {
    case ' ':
    case 'Space':
      return { type: 'swing', swingType: 'power' }
    case 'b':
      return { type: 'bunt' }
    case 't':
      return { type: 'request-time' }
    default:
      return undefined
  }
}

export function createSwingCommand(
  swingType: SwingType,
  aim: Readonly<{ x: number; y: number }>,
  timingSeconds: number,
): SwingCommand {
  return { swingType, aim: { ...aim }, timingSeconds }
}
