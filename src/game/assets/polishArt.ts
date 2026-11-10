import Phaser from 'phaser';

export const POLISH_SHEETS = {
  scout: [256, 256, 8], dart: [256, 256, 8], lancer: [256, 256, 8], cutter: [256, 256, 8],
  surface: [256, 256, 8], ambush: [256, 256, 8], carrier: [256, 256, 8],
  ocean: [256, 512, 8], turbulent: [256, 512, 8], rift: [256, 512, 8], inner: [512, 512, 8], metamorphosis: [512, 512, 8], special: [384, 384, 8], talassarca: [512, 512, 8], raia: [384, 384, 8],
  explosion: [192, 192, 16], blue: [128, 128, 8], green: [128, 128, 8], fire: [128, 128, 8],
} as const;

export function loadPolishArt(scene: Phaser.Scene, base: string): void {
  for (const [name, [frameWidth, frameHeight]] of Object.entries(POLISH_SHEETS)) {
    const key = 'polish-' + name;
    if (!scene.textures.exists(key)) scene.load.spritesheet(key, `${base}/assets/combat-hd/polish/${name}.webp`, { frameWidth, frameHeight });
  }
}

export function registerPolishArt(scene: Phaser.Scene): void {
  for (const [name, [, , frames]] of Object.entries(POLISH_SHEETS)) {
    const key = 'polish-' + name;
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
    if (!scene.anims.exists(key + '-loop')) scene.anims.create({ key: key + '-loop', frames: scene.anims.generateFrameNumbers(key, { start: 0, end: frames - 1 }), frameRate: name === 'explosion' ? 40 : 12, repeat: name === 'explosion' ? 0 : -1 });
  }
}
