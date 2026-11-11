import Phaser from 'phaser';
import { NORMAL_GUIDE_ITEMS } from '../data/pickupGuide';
export const REVIEW_SHEETS: Record<string, number> = {
  ...Object.fromEntries(['nolan','cora','harlan','lyra','bento'].map(id=>['pickups-life-'+id,64])),
  raia: 512,
  talassarca: 512,
  surface: 256,
  swimmer: 256,
  special: 256,
  ...Object.fromEntries([...NORMAL_GUIDE_ITEMS,'speed','score','weapon_ion','weapon_green','weapon_red','health'].map((t) => ['pickups-' + t, 64])),
  ...Object.fromEntries(
    ['scout', 'dart', 'lancer', 'cutter', 'surface', 'raia'].map((t) => [
      'hostile-' + t,
      64,
    ]),
  ),
  ...Object.fromEntries(
    ['blue', 'green', 'fire', 'missile', 'charge', 'explosion'].map((t) => [
      'effects-' + t,
      128,
    ]),
  ),
};
export function loadReviewArt(scene: Phaser.Scene, base: string): void {
  for (const [name, size] of Object.entries(REVIEW_SHEETS))
    if (!scene.textures.exists('review-' + name))
      scene.load.spritesheet(
        'review-' + name,
        `${base}/assets/combat-hd/review/${name}.webp`,
        { frameWidth: size, frameHeight: size },
      );
  if (!scene.textures.exists('review-ocean'))
    scene.load.image(
      'review-ocean',
      `${base}/assets/combat-hd/review/ocean.webp`,
    );
}
export function registerReviewArt(scene: Phaser.Scene): void {
  for (const name of Object.keys(REVIEW_SHEETS)) {
    const key = 'review-' + name;
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
    if (!scene.anims.exists(key + '-loop'))
      scene.anims.create({
        key: key + '-loop',
        frames: scene.anims.generateFrameNumbers(key, { start: 0, end: 3 }),
        frameRate: name.startsWith('hostile') ? 14 : name.startsWith('effects') ? 18 : 8,
        repeat: name === 'effects-explosion' ? 0 : -1,
      });
  }
}
