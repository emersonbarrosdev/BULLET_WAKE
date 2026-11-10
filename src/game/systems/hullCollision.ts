export interface Point {
  x: number;
  y: number;
}
/** Visible RIVET hull at 46px. Empty corners and exhaust do not take damage. */
export const RIVET_HULL: readonly Point[] = [
  { x: 0, y: -20 },
  { x: 5, y: -9 },
  { x: 9, y: -5 },
  { x: 18, y: 10 },
  { x: 8, y: 8 },
  { x: 6, y: 16 },
  { x: -6, y: 16 },
  { x: -8, y: 8 },
  { x: -18, y: 10 },
  { x: -9, y: -5 },
  { x: -5, y: -9 },
];
export function circleHitsHull(
  x: number,
  y: number,
  radius: number,
  shipX: number,
  shipY: number,
): boolean {
  const px = x - shipX,
    py = y - shipY;
  let inside = false;
  for (let i = 0, j = RIVET_HULL.length - 1; i < RIVET_HULL.length; j = i++) {
    const a = RIVET_HULL[j],
      b = RIVET_HULL[i];
    if (
      a.y > py !== b.y > py &&
      px < ((b.x - a.x) * (py - a.y)) / (b.y - a.y) + a.x
    )
      inside = !inside;
    const dx = b.x - a.x,
      dy = b.y - a.y,
      t = Math.max(
        0,
        Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / (dx * dx + dy * dy)),
      );
    if (Math.hypot(px - a.x - t * dx, py - a.y - t * dy) <= radius) return true;
  }
  return inside;
}
