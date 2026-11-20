import type Phaser from 'phaser';
import { HULL_STATES, hullCondition } from './HullIntegrity';

/** The same chamfered armor cells serve the cockpit, horizontal strip and portrait HUD. */
export function drawHullSegments(g: Phaser.GameObjects.Graphics, x: number, y: number, width: number, height: number, current: number, maximum: number): void {
  const gap = 3, cell = (width - gap * (maximum - 1)) / maximum;
  const color = HULL_STATES[hullCondition(current, maximum)].color;
  for (let i = 0; i < maximum; i++) {
    const left = x + i * (cell + gap), cut = Math.min(4, height * .25);
    const outline = () => g.beginPath().moveTo(left + cut, y).lineTo(left + cell, y).lineTo(left + cell, y + height - cut).lineTo(left + cell - cut, y + height).lineTo(left, y + height).lineTo(left, y + cut).closePath();
    g.fillStyle(i < current ? color : 0x09223f, i < current ? .95 : .8); outline().fillPath();
    g.lineStyle(1, i < current ? 0xd9ffff : 0x416182, .9); outline().strokePath();
    if (i < current) g.lineStyle(1, 0xffffff, .6).lineBetween(left + cut + 1, y + 2, left + cell - 3, y + 2);
  }
}
