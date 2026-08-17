// Focal point → CSS object-position. 50/50 = center = today's default behavior.
export function focalObjectPosition(x?: number | null, y?: number | null) {
  return { objectPosition: `${x ?? 50}% ${y ?? 50}%` }
}
