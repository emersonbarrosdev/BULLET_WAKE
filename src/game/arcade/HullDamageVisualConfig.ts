/** Fractional positions in the approved sprite frame, relative to its center. */
export interface HullVisualAnchor { x: number; y: number; scale: number; }
export interface HullPerspectiveVisual {
  smoke: readonly HullVisualAnchor[];
  flame: readonly HullVisualAnchor[];
  spark: readonly HullVisualAnchor[];
  scarsScale: number;
  /** Direction of the exhaust trail in sprite-local space. */
  trailAngle: number;
}
export interface HullShipVisual { up: HullPerspectiveVisual; side: HullPerspectiveVisual; }

function ship(rear: number, span: number, scale: number): HullShipVisual {
  return {
    up: {
      smoke: [{ x: -span, y: rear, scale }, { x: span, y: rear - .05, scale: scale * .88 }],
      flame: [{ x: -span, y: rear - .06, scale: scale * .8 }, { x: span, y: rear - .1, scale: scale * .62 }],
      spark: [{ x: -.23, y: .06, scale: .55 }, { x: .22, y: .12, scale: .48 }, { x: .04, y: -.2, scale: .4 }],
      scarsScale: 1, trailAngle: Math.PI,
    },
    side: {
      smoke: [{ x: -rear, y: -span * .5, scale }, { x: -rear + .08, y: span * .7, scale: scale * .8 }],
      flame: [{ x: -rear + .04, y: -span * .5, scale: scale * .75 }, { x: -.08, y: span * .55, scale: scale * .56 }],
      spark: [{ x: -.23, y: -.06, scale: .5 }, { x: .12, y: .1, scale: .48 }, { x: -.06, y: -.18, scale: .38 }],
      scarsScale: 1, trailAngle: -Math.PI / 2,
    },
  };
}

/** Alternate pilots currently use the approved tinted frame; offsets are conservative, not new ship art. */
export const HULL_SHIP_VISUALS: Readonly<Record<string, HullShipVisual>> = {
  nolan: ship(.21, .13, .8),
  cora: ship(.19, .15, .72),
  lyra: ship(.22, .12, .72),
  harlan: ship(.2, .17, .9),
  bento: ship(.23, .12, .76),
};

export const HULL_DAMAGE_SHEETS = [
  { key: 'hull-scars-up', size: 64, frames: 3 },
  { key: 'hull-scars-side', size: 64, frames: 3 },
  { key: 'hull-smoke', size: 64, frames: 8 },
  { key: 'hull-flame', size: 64, frames: 8 },
  { key: 'hull-spark', size: 64, frames: 4 },
  { key: 'hull-repair', size: 64, frames: 8 },
  { key: 'hull-destruction', size: 128, frames: 8 },
  { key: 'hull-repair-pickup', size: 64, frames: 8 },
] as const;
