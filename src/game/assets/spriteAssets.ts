import Phaser from 'phaser';

/** Contratos do pacote PNG de sprites v0.1; todos quadros têm alfa transparente. */
export const SPRITE_SHEETS = [
  { key: 'ship-rivet', url: 'assets/ships/rivet/flight.png', frameWidth: 48, frameHeight: 24 },
  { key: 'ship-moth', url: 'assets/ships/moth/flight.png', frameWidth: 48, frameHeight: 24 },
  { key: 'ship-knuckle', url: 'assets/ships/knuckle/flight.png', frameWidth: 48, frameHeight: 24 },
  { key: 'enemy-scout', url: 'assets/enemies/scout.png', frameWidth: 24, frameHeight: 16 },
  { key: 'enemy-lancer', url: 'assets/enemies/lancer.png', frameWidth: 40, frameHeight: 24 },
  { key: 'shot-rivet', url: 'assets/projectiles/rivet.png', frameWidth: 12, frameHeight: 8 },
  { key: 'shot-moth', url: 'assets/projectiles/moth.png', frameWidth: 12, frameHeight: 8 },
  { key: 'shot-knuckle', url: 'assets/projectiles/knuckle.png', frameWidth: 16, frameHeight: 10 },
  { key: 'shot-enemy', url: 'assets/projectiles/enemy.png', frameWidth: 10, frameHeight: 10 },
  { key: 'fx-muzzle', url: 'assets/fx/muzzle.png', frameWidth: 16, frameHeight: 16 },
  { key: 'fx-hit', url: 'assets/fx/hit.png', frameWidth: 16, frameHeight: 16 },
  { key: 'fx-explosion', url: 'assets/fx/explosion.png', frameWidth: 24, frameHeight: 24 },
  { key: 'fx-warning', url: 'assets/fx/warning.png', frameWidth: 16, frameHeight: 16 },
] as const;

export function loadGameSprites(scene: Phaser.Scene): void {
  for (const sheet of SPRITE_SHEETS) {
    if (scene.textures.exists(sheet.key)) continue;
    scene.load.spritesheet(sheet.key, sheet.url, {
      frameWidth: sheet.frameWidth,
      frameHeight: sheet.frameHeight,
    });
  }
}

interface AnimationDefinition {
  id: string;
  sheet: string;
  first: number;
  last: number;
  frameRate: number;
  repeat?: number;
}

const animations: AnimationDefinition[] = [];

for (const ship of ['rivet', 'moth', 'knuckle']) {
  const sheet = 'ship-' + ship;
  animations.push(
    { id: sheet + '-idle', sheet, first: 0, last: 3, frameRate: 8, repeat: -1 },
    { id: sheet + '-up', sheet, first: 4, last: 6, frameRate: 10, repeat: -1 },
    { id: sheet + '-down', sheet, first: 7, last: 9, frameRate: 10, repeat: -1 },
    { id: sheet + '-hit', sheet, first: 10, last: 11, frameRate: 14 },
    { id: sheet + '-death', sheet, first: 12, last: 19, frameRate: 13 },
  );
}
for (const [kind, deathEnd] of [['scout', 14], ['lancer', 16]] as const) {
  const sheet = 'enemy-' + kind;
  animations.push(
    { id: sheet + '-fly', sheet, first: 0, last: 3, frameRate: 9, repeat: -1 },
    { id: sheet + '-warning', sheet, first: 4, last: 6, frameRate: 9, repeat: -1 },
    { id: sheet + '-hit', sheet, first: 7, last: 8, frameRate: 14 },
    { id: sheet + '-death', sheet, first: 9, last: deathEnd, frameRate: 13 },
  );
}
for (const key of ['shot-rivet', 'shot-moth', 'shot-knuckle', 'shot-enemy']) {
  animations.push({ id: key + '-loop', sheet: key, first: 0, last: 3, frameRate: 14, repeat: -1 });
}
animations.push(
  { id: 'fx-muzzle-play', sheet: 'fx-muzzle', first: 0, last: 3, frameRate: 18 },
  { id: 'fx-hit-play', sheet: 'fx-hit', first: 0, last: 5, frameRate: 20 },
  { id: 'fx-explosion-play', sheet: 'fx-explosion', first: 0, last: 7, frameRate: 17 },
  { id: 'fx-warning-loop', sheet: 'fx-warning', first: 0, last: 3, frameRate: 10, repeat: -1 },
);

export function registerGameAnimations(scene: Phaser.Scene): void {
  for (const animation of animations) {
    if (scene.anims.exists(animation.id)) continue;
    scene.anims.create({
      key: animation.id,
      frames: scene.anims.generateFrameNumbers(animation.sheet, {
        start: animation.first,
        end: animation.last,
      }),
      frameRate: animation.frameRate,
      repeat: animation.repeat ?? 0,
    });
  }
}
