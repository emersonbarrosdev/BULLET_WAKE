import Phaser from 'phaser';

/** Contratos de sprites PNG: Rivet V2 validada para integração; demais unidades continuam com arte v0.1 provisória. */
export const SPRITE_SHEETS = [
  { key: 'rivet-v3-idle', url: 'assets/ships/rivet/v3/ship/idle.png', frameWidth: 160, frameHeight: 110 },
  { key: 'rivet-v3-climb', url: 'assets/ships/rivet/v3/ship/climb.png', frameWidth: 160, frameHeight: 110 },
  { key: 'rivet-v3-dive', url: 'assets/ships/rivet/v3/ship/dive.png', frameWidth: 160, frameHeight: 110 },
  { key: 'rivet-v3-fire', url: 'assets/ships/rivet/v3/ship/fire.png', frameWidth: 160, frameHeight: 110 },
  { key: 'rivet-v3-missile_launch', url: 'assets/ships/rivet/v3/ship/missile_launch.png', frameWidth: 160, frameHeight: 110 },
  { key: 'rivet-v3-prism_charge', url: 'assets/ships/rivet/v3/ship/prism_charge.png', frameWidth: 160, frameHeight: 110 },
  { key: 'rivet-v3-hit', url: 'assets/ships/rivet/v3/ship/hit.png', frameWidth: 160, frameHeight: 110 },
  { key: 'rivet-v3-destruction', url: 'assets/ships/rivet/v3/ship/destruction.png', frameWidth: 160, frameHeight: 110 },
  { key: 'rivet-v3-engine', url: 'assets/ships/rivet/v3/fx/engine.png', frameWidth: 48, frameHeight: 54 },
  { key: 'rivet-v3-muzzle', url: 'assets/ships/rivet/v3/fx/muzzle.png', frameWidth: 38, frameHeight: 28 },
  { key: 'rivet-v3-pulse-1', url: 'assets/ships/rivet/v3/weapons/pulse_lv1.png', frameWidth: 64, frameHeight: 24 },
  { key: 'rivet-v3-pulse-2', url: 'assets/ships/rivet/v3/weapons/pulse_lv2.png', frameWidth: 64, frameHeight: 24 },
  { key: 'rivet-v3-pulse-3', url: 'assets/ships/rivet/v3/weapons/pulse_lv3.png', frameWidth: 64, frameHeight: 24 },
  { key: 'rivet-v3-missile', url: 'assets/ships/rivet/v3/weapons/missile.png', frameWidth: 72, frameHeight: 32 },
  { key: 'rivet-v3-prism', url: 'assets/ships/rivet/v3/weapons/tempestade_prismatica.png', frameWidth: 96, frameHeight: 52 },
  { key: 'ship-rivet-v2-idle', url: 'assets/ships/rivet/v2/idle.png', frameWidth: 112, frameHeight: 54 },
  { key: 'ship-rivet-v2-up', url: 'assets/ships/rivet/v2/subida.png', frameWidth: 112, frameHeight: 54 },
  { key: 'ship-rivet-v2-down', url: 'assets/ships/rivet/v2/descida.png', frameWidth: 112, frameHeight: 54 },
  { key: 'ship-rivet-v2-fire', url: 'assets/ships/rivet/v2/disparo.png', frameWidth: 112, frameHeight: 54 },
  { key: 'ship-rivet-v2-hit', url: 'assets/ships/rivet/v2/dano.png', frameWidth: 112, frameHeight: 54 },
  { key: 'ship-rivet-v2-death', url: 'assets/ships/rivet/v2/destruicao.png', frameWidth: 112, frameHeight: 54 },
  { key: 'ship-moth', url: 'assets/ships/moth/flight.png', frameWidth: 48, frameHeight: 24 },
  { key: 'ship-knuckle', url: 'assets/ships/knuckle/flight.png', frameWidth: 48, frameHeight: 24 },
  { key: 'ship-moth-v2-idle', url: 'assets/ships/moth/v2/idle.png', frameWidth: 136, frameHeight: 72 },
  { key: 'ship-moth-v2-climb', url: 'assets/ships/moth/v2/climb.png', frameWidth: 136, frameHeight: 72 },
  { key: 'ship-moth-v2-dive', url: 'assets/ships/moth/v2/dive.png', frameWidth: 136, frameHeight: 72 },
  { key: 'ship-moth-v2-fire', url: 'assets/ships/moth/v2/fire.png', frameWidth: 136, frameHeight: 72 },
  { key: 'ship-moth-v2-hit', url: 'assets/ships/moth/v2/hit.png', frameWidth: 136, frameHeight: 72 },
  { key: 'ship-moth-v2-death', url: 'assets/ships/moth/v2/destruction.png', frameWidth: 136, frameHeight: 72 },
  { key: 'ship-knuckle-v2-idle', url: 'assets/ships/knuckle/v2/idle.png', frameWidth: 144, frameHeight: 88 },
  { key: 'ship-knuckle-v2-climb', url: 'assets/ships/knuckle/v2/climb.png', frameWidth: 144, frameHeight: 88 },
  { key: 'ship-knuckle-v2-dive', url: 'assets/ships/knuckle/v2/dive.png', frameWidth: 144, frameHeight: 88 },
  { key: 'ship-knuckle-v2-fire', url: 'assets/ships/knuckle/v2/fire.png', frameWidth: 144, frameHeight: 88 },
  { key: 'ship-knuckle-v2-hit', url: 'assets/ships/knuckle/v2/hit.png', frameWidth: 144, frameHeight: 88 },
  { key: 'ship-knuckle-v2-death', url: 'assets/ships/knuckle/v2/destruction.png', frameWidth: 144, frameHeight: 88 },
  { key: 'enemy-scout', url: 'assets/enemies/scout.png', frameWidth: 24, frameHeight: 16 },
  { key: 'enemy-dart', url: 'assets/enemies/dart.png', frameWidth: 24, frameHeight: 16 },
  { key: 'enemy-lancer', url: 'assets/enemies/lancer.png', frameWidth: 40, frameHeight: 24 },
  { key: 'enemy-cutter', url: 'assets/enemies/cutter.png', frameWidth: 40, frameHeight: 24 },
  { key: 'shot-rivet', url: 'assets/projectiles/rivet.png', frameWidth: 12, frameHeight: 8 },
  { key: 'shot-moth', url: 'assets/projectiles/moth.png', frameWidth: 12, frameHeight: 8 },
  { key: 'shot-knuckle', url: 'assets/projectiles/knuckle.png', frameWidth: 16, frameHeight: 10 },
  { key: 'shot-enemy', url: 'assets/projectiles/enemy.png', frameWidth: 10, frameHeight: 10 },
  { key: 'fx-muzzle', url: 'assets/fx/muzzle.png', frameWidth: 16, frameHeight: 16 },
  { key: 'fx-hit', url: 'assets/fx/hit.png', frameWidth: 16, frameHeight: 16 },
  { key: 'fx-explosion', url: 'assets/fx/explosion.png', frameWidth: 24, frameHeight: 24 },
  { key: 'fx-warning', url: 'assets/fx/warning.png', frameWidth: 16, frameHeight: 16 },
  { key: 'pickup-upgrade', url: 'assets/pickups/upgrade.png', frameWidth: 24, frameHeight: 24 },
  { key: 'pickup-repair', url: 'assets/pickups/repair.png', frameWidth: 24, frameHeight: 24 },
  { key: 'pickup-bomb', url: 'assets/pickups/bomb.png', frameWidth: 24, frameHeight: 24 },
  { key: 'pickup-resonance', url: 'assets/pickups/resonance.png', frameWidth: 24, frameHeight: 24 },
  { key: 'pickup-shield', url: 'assets/pickups/shield.png', frameWidth: 24, frameHeight: 24 },
  { key: 'pickup-score', url: 'assets/pickups/score.png', frameWidth: 24, frameHeight: 24 },
  { key: 'fx-shield', url: 'assets/fx/shield.png', frameWidth: 48, frameHeight: 48 },
  { key: 'fx-bomb-wave', url: 'assets/fx/bomb_wave.png', frameWidth: 96, frameHeight: 96 },
  { key: 'fx-nova-wave', url: 'assets/fx/nova_wave.png', frameWidth: 128, frameHeight: 128 },
  { key: 'boss-krm17-hull', url: 'assets/bosses/krm17/hull.png', frameWidth: 144, frameHeight: 96 },
  { key: 'boss-krm17-drill', url: 'assets/bosses/krm17/drill.png', frameWidth: 48, frameHeight: 48 },
  { key: 'boss-krm17-turret', url: 'assets/bosses/krm17/turret.png', frameWidth: 32, frameHeight: 24 },
  { key: 'boss-krm17-core', url: 'assets/bosses/krm17/core.png', frameWidth: 32, frameHeight: 32 },
  { key: 'boss-serpent-head', url: 'assets/bosses/serpent/head.png', frameWidth: 64, frameHeight: 64 },
  { key: 'boss-serpent-body', url: 'assets/bosses/serpent/body.png', frameWidth: 48, frameHeight: 48 },
  { key: 'boss-fortress-chassis', url: 'assets/bosses/fortress/chassis.png', frameWidth: 128, frameHeight: 128 },
  { key: 'boss-fortress-core', url: 'assets/bosses/fortress/core.png', frameWidth: 40, frameHeight: 40 },
  { key: 'boss-interceptor-chassis', url: 'assets/bosses/interceptor/chassis.png', frameWidth: 96, frameHeight: 48 },
  { key: 'boss-interceptor-wing', url: 'assets/bosses/interceptor/wing.png', frameWidth: 48, frameHeight: 32 },
  { key: 'boss-mesh_core-monolith', url: 'assets/bosses/mesh_core/monolith.png', frameWidth: 112, frameHeight: 112 },
  { key: 'boss-mesh_core-heart', url: 'assets/bosses/mesh_core/heart.png', frameWidth: 48, frameHeight: 48 },
  { key: 'portrait-nolan', url: 'assets/pilots/nolan.png', frameWidth: 64, frameHeight: 64 },
  { key: 'portrait-cora', url: 'assets/pilots/cora.png', frameWidth: 64, frameHeight: 64 },
  { key: 'portrait-harlan', url: 'assets/pilots/harlan.png', frameWidth: 64, frameHeight: 64 },
] as const;

export function loadGameSprites(scene: Phaser.Scene): void {
  // Registra o erro por arquivo em vez de renderizar apenas o ícone
  // verde de textura faltante sem contexto para depuração.
  scene.load.on('loaderror', (file: Phaser.Loader.File) => {
    console.error('[BULLET WAKE] Falha ao carregar sprite:', file.key);
  });
  const base = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL.slice(0, -1)
    : import.meta.env.BASE_URL;
  for (const sheet of SPRITE_SHEETS) {
    if (scene.textures.exists(sheet.key)) continue;
    // Caminho absoluto relativo ao base do Vite funciona em dev e deploy.
    scene.load.spritesheet(sheet.key, base + '/' + sheet.url, {
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

for (const ship of ['moth', 'knuckle']) {
  const sheet = 'ship-' + ship;
  animations.push(
    { id: sheet + '-idle', sheet, first: 0, last: 3, frameRate: 8, repeat: -1 },
    { id: sheet + '-up', sheet, first: 4, last: 6, frameRate: 10, repeat: -1 },
    { id: sheet + '-down', sheet, first: 7, last: 9, frameRate: 10, repeat: -1 },
    { id: sheet + '-hit', sheet, first: 10, last: 11, frameRate: 14 },
    { id: sheet + '-death', sheet, first: 12, last: 19, frameRate: 13 },
  );
}
animations.push({ id: 'ship-rivet-idle', sheet: 'ship-rivet-v2-idle', first: 0, last: 7, frameRate: 11, repeat: -1 });
animations.push({ id: 'ship-rivet-up', sheet: 'ship-rivet-v2-up', first: 0, last: 7, frameRate: 12, repeat: -1 });
animations.push({ id: 'ship-rivet-down', sheet: 'ship-rivet-v2-down', first: 0, last: 7, frameRate: 12, repeat: -1 });
animations.push({ id: 'ship-rivet-fire', sheet: 'ship-rivet-v2-fire', first: 0, last: 7, frameRate: 16, repeat: -1 });
animations.push({ id: 'ship-rivet-hit', sheet: 'ship-rivet-v2-hit', first: 0, last: 5, frameRate: 20, repeat: 0 });
animations.push({ id: 'ship-rivet-death', sheet: 'ship-rivet-v2-death', first: 0, last: 7, frameRate: 15, repeat: 0 });
animations.push({ id: 'rivet-v3-idle-anim', sheet: 'rivet-v3-idle', first: 0, last: 3, frameRate: 12, repeat: -1 });
animations.push({ id: 'rivet-v3-climb-anim', sheet: 'rivet-v3-climb', first: 0, last: 3, frameRate: 12, repeat: -1 });
animations.push({ id: 'rivet-v3-dive-anim', sheet: 'rivet-v3-dive', first: 0, last: 3, frameRate: 12, repeat: -1 });
animations.push({ id: 'rivet-v3-fire-anim', sheet: 'rivet-v3-fire', first: 0, last: 3, frameRate: 12, repeat: -1 });
animations.push({ id: 'rivet-v3-missile_launch-anim', sheet: 'rivet-v3-missile_launch', first: 0, last: 3, frameRate: 12, repeat: -1 });
animations.push({ id: 'rivet-v3-prism_charge-anim', sheet: 'rivet-v3-prism_charge', first: 0, last: 3, frameRate: 12, repeat: -1 });
animations.push({ id: 'rivet-v3-hit-anim', sheet: 'rivet-v3-hit', first: 0, last: 3, frameRate: 12, repeat: 0 });
animations.push({ id: 'rivet-v3-destruction-anim', sheet: 'rivet-v3-destruction', first: 0, last: 7, frameRate: 12, repeat: 0 });

animations.push({ id: 'moth-v2-idle-anim', sheet: 'ship-moth-v2-idle', first: 0, last: 3, frameRate: 10, repeat: -1 });
animations.push({ id: 'moth-v2-climb-anim', sheet: 'ship-moth-v2-climb', first: 0, last: 3, frameRate: 12, repeat: -1 });
animations.push({ id: 'moth-v2-dive-anim', sheet: 'ship-moth-v2-dive', first: 0, last: 3, frameRate: 12, repeat: -1 });
animations.push({ id: 'moth-v2-fire-anim', sheet: 'ship-moth-v2-fire', first: 0, last: 3, frameRate: 16, repeat: -1 });
animations.push({ id: 'moth-v2-hit-anim', sheet: 'ship-moth-v2-hit', first: 0, last: 3, frameRate: 18, repeat: 0 });
animations.push({ id: 'moth-v2-destruction-anim', sheet: 'ship-moth-v2-destruction', first: 0, last: 7, frameRate: 15, repeat: 0 });

animations.push({ id: 'knuckle-v2-idle-anim', sheet: 'ship-knuckle-v2-idle', first: 0, last: 3, frameRate: 9, repeat: -1 });
animations.push({ id: 'knuckle-v2-climb-anim', sheet: 'ship-knuckle-v2-climb', first: 0, last: 3, frameRate: 10, repeat: -1 });
animations.push({ id: 'knuckle-v2-dive-anim', sheet: 'ship-knuckle-v2-dive', first: 0, last: 3, frameRate: 10, repeat: -1 });
animations.push({ id: 'knuckle-v2-fire-anim', sheet: 'ship-knuckle-v2-fire', first: 0, last: 3, frameRate: 14, repeat: -1 });
animations.push({ id: 'knuckle-v2-hit-anim', sheet: 'ship-knuckle-v2-hit', first: 0, last: 3, frameRate: 16, repeat: 0 });
animations.push({ id: 'knuckle-v2-destruction-anim', sheet: 'ship-knuckle-v2-destruction', first: 0, last: 7, frameRate: 14, repeat: 0 });
animations.push({ id: 'rivet-v3-engine-anim', sheet: 'rivet-v3-engine', first: 0, last: 7, frameRate: 14, repeat: -1 });
animations.push({ id: 'rivet-v3-muzzle-anim', sheet: 'rivet-v3-muzzle', first: 0, last: 3, frameRate: 14, repeat: 0 });
animations.push({ id: 'rivet-v3-pulse-1-anim', sheet: 'rivet-v3-pulse-1', first: 0, last: 3, frameRate: 14, repeat: -1 });
animations.push({ id: 'rivet-v3-pulse-2-anim', sheet: 'rivet-v3-pulse-2', first: 0, last: 3, frameRate: 14, repeat: -1 });
animations.push({ id: 'rivet-v3-pulse-3-anim', sheet: 'rivet-v3-pulse-3', first: 0, last: 3, frameRate: 14, repeat: -1 });
animations.push({ id: 'rivet-v3-missile-anim', sheet: 'rivet-v3-missile', first: 0, last: 3, frameRate: 14, repeat: -1 });
animations.push({ id: 'rivet-v3-prism-anim', sheet: 'rivet-v3-prism', first: 0, last: 3, frameRate: 14, repeat: -1 });
for (const [kind, deathEnd] of [['scout', 14], ['dart', 14], ['lancer', 16], ['cutter', 16]] as const) {
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
  { id: 'pickup-upgrade-loop', sheet: 'pickup-upgrade', first: 0, last: 3, frameRate: 8, repeat: -1 },
  { id: 'pickup-repair-loop', sheet: 'pickup-repair', first: 0, last: 3, frameRate: 8, repeat: -1 },
  { id: 'pickup-bomb-loop', sheet: 'pickup-bomb', first: 0, last: 3, frameRate: 8, repeat: -1 },
  { id: 'pickup-resonance-loop', sheet: 'pickup-resonance', first: 0, last: 3, frameRate: 8, repeat: -1 },
  { id: 'pickup-shield-loop', sheet: 'pickup-shield', first: 0, last: 3, frameRate: 8, repeat: -1 },
  { id: 'pickup-score-loop', sheet: 'pickup-score', first: 0, last: 3, frameRate: 8, repeat: -1 },
  { id: 'fx-shield-loop', sheet: 'fx-shield', first: 0, last: 3, frameRate: 12, repeat: -1 },
  { id: 'fx-bomb-wave-play', sheet: 'fx-bomb-wave', first: 0, last: 7, frameRate: 18, repeat: 0 },
  { id: 'fx-nova-wave-play', sheet: 'fx-nova-wave', first: 0, last: 7, frameRate: 16, repeat: 0 },
  { id: 'boss-krm17-hull-idle', sheet: 'boss-krm17-hull', first: 0, last: 3, frameRate: 6, repeat: -1 },
  { id: 'boss-krm17-drill-spin', sheet: 'boss-krm17-drill', first: 0, last: 3, frameRate: 16, repeat: -1 },
  { id: 'boss-krm17-turret-aim', sheet: 'boss-krm17-turret', first: 0, last: 3, frameRate: 10, repeat: -1 },
  { id: 'boss-krm17-core-pulse', sheet: 'boss-krm17-core', first: 0, last: 3, frameRate: 12, repeat: -1 },
  { id: 'boss-serpent-head-loop', sheet: 'boss-serpent-head', first: 0, last: 3, frameRate: 8, repeat: -1 },
  { id: 'boss-serpent-body-loop', sheet: 'boss-serpent-body', first: 0, last: 3, frameRate: 8, repeat: -1 },
  { id: 'boss-fortress-chassis-loop', sheet: 'boss-fortress-chassis', first: 0, last: 3, frameRate: 6, repeat: -1 },
  { id: 'boss-fortress-core-pulse', sheet: 'boss-fortress-core', first: 0, last: 3, frameRate: 10, repeat: -1 },
  { id: 'boss-interceptor-chassis-flight', sheet: 'boss-interceptor-chassis', first: 0, last: 3, frameRate: 12, repeat: -1 },
  { id: 'boss-interceptor-wing-spark', sheet: 'boss-interceptor-wing', first: 0, last: 3, frameRate: 14, repeat: -1 },
  { id: 'boss-mesh_core-monolith-loop', sheet: 'boss-mesh_core-monolith', first: 0, last: 3, frameRate: 6, repeat: -1 },
  { id: 'boss-mesh_core-heart-pulse', sheet: 'boss-mesh_core-heart', first: 0, last: 3, frameRate: 12, repeat: -1 },
);

export function registerGameAnimations(scene: Phaser.Scene): void {
  for (const animation of animations) {
    // Não registrar animação apontando para __MISSING: quando o combate
    // pré-carregar o arquivo novamente, a animação poderá ser registrada.
    if (!scene.textures.exists(animation.sheet)) continue;
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
