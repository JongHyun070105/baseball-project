import type { Vec3 } from '../../contracts'

export function add(left: Vec3, right: Vec3): Vec3 {
  return { x: left.x + right.x, y: left.y + right.y, z: left.z + right.z }
}

export function scale(value: Vec3, multiplier: number): Vec3 {
  return { x: value.x * multiplier, y: value.y * multiplier, z: value.z * multiplier }
}

export function cross(left: Vec3, right: Vec3): Vec3 {
  return {
    x: left.y * right.z - left.z * right.y,
    y: left.z * right.x - left.x * right.z,
    z: left.x * right.y - left.y * right.x,
  }
}

export function magnitude(value: Vec3): number {
  return Math.hypot(value.x, value.y, value.z)
}

export function quantize(value: Vec3): Vec3 {
  return {
    x: Math.round(value.x * 1_000_000) / 1_000_000,
    y: Math.round(value.y * 1_000_000) / 1_000_000,
    z: Math.round(value.z * 1_000_000) / 1_000_000,
  }
}
