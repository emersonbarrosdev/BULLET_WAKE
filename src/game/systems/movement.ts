/**
 * Núcleo matemático sem Phaser: movimentos reproduzíveis em qualquer FPS.
 * O sprite real será integrado em tarefa artística posterior.
 */
export interface Position {
  x: number;
  y: number;
}

export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function moveInBounds(
  position: Position,
  rawX: number,
  rawY: number,
  speedPxPerSecond: number,
  deltaMs: number,
  bounds: Bounds,
): Position {
  // Impede saltos após perder o foco e diagonal mais veloz.
  const durationSeconds = clamp(deltaMs, 0, 50) / 1000;
  const magnitude = Math.hypot(rawX, rawY);
  const normalization = magnitude > 1 ? 1 / magnitude : 1;
  return {
    x: clamp(position.x + rawX * normalization * speedPxPerSecond * durationSeconds, bounds.minX, bounds.maxX),
    y: clamp(position.y + rawY * normalization * speedPxPerSecond * durationSeconds, bounds.minY, bounds.maxY),
  };
}
