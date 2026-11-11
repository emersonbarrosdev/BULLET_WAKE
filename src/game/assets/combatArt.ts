import Phaser from 'phaser';
import { loadReviewArt, registerReviewArt } from './reviewArt';
import { loadPolishArt, registerPolishArt } from './polishArt';

/** Hand-painted combat art is separate from legacy pixel sheets and menu assets. */
export const COMBAT_SHEETS = ['rivet', 'peregrine', 'biogun', 'kestrel', 'supply-parachute', 'scout', 'dart', 'lancer', 'cutter', 'bomb'] as const;

export function loadCombatArt(scene: Phaser.Scene, base: string): void {
  for(const name of ['talassarca-top','inner-top'])if(!scene.textures.exists('hd-'+name))scene.load.spritesheet('hd-'+name,`${base}/assets/combat-hd/${name}.webp`,{frameWidth:512,frameHeight:512});
  loadReviewArt(scene,base);
  loadPolishArt(scene,base);
  for (const name of COMBAT_SHEETS) {
    if (!scene.textures.exists(`hd-${name}`)) {
      scene.load.spritesheet(`hd-${name}`, `${base}/assets/combat-hd/${name}.webp`, { frameWidth: 256, frameHeight: 256 });
    }
  }
  for (const name of ['ocean', 'capsule']) {
    if (!scene.textures.exists(`hd-${name}`)) scene.load.image(`hd-${name}`, `${base}/assets/combat-hd/${name}.webp`);
  }
  if (!scene.textures.exists('hd-portrait-nolan')) {
    scene.load.image('hd-portrait-nolan', `${base}/assets/pilot-selection/portrait-nolan.webp`);
  }
}

export function registerCombatArt(scene: Phaser.Scene): void {
  if(!scene.anims.exists('hd-supply-parachute-loop'))scene.anims.create({key:'hd-supply-parachute-loop',frames:scene.anims.generateFrameNumbers('hd-supply-parachute',{start:0,end:3}),frameRate:5,repeat:-1});
  registerReviewArt(scene);
  registerPolishArt(scene);
  for (const name of [...COMBAT_SHEETS, 'ocean', 'capsule', 'portrait-nolan']) {
    scene.textures.get(`hd-${name}`).setFilter(Phaser.Textures.FilterMode.LINEAR);
  }
  for (const name of ['scout', 'dart', 'lancer', 'cutter']) {
    for (const [suffix, frames] of [['fly', [0, 1, 0, 3]], ['warning', [2, 3, 2]]] as const) {
      const key = `hd-${name}-${suffix}`;
      if (!scene.anims.exists(key)) scene.anims.create({ key, frames: frames.map(frame => ({ key: `hd-${name}`, frame })), frameRate: 6, repeat: -1 });
    }
  }
  if (!scene.anims.exists('hd-bomb-play')) {
    scene.anims.create({ key: 'hd-bomb-play', frames: scene.anims.generateFrameNumbers('hd-bomb', { start: 0, end: 3 }), frameRate: 9, repeat: 0 });
  }
  createEnergyTextures(scene);
}

/** Energy is painted at 4× resolution, animated in-game, independent of damage. */
function createEnergyTextures(scene: Phaser.Scene): void {
  const colors = { blue: '#38bdf8', green: '#4ade80', enemy: '#ff5675' };
  for (const [name, color] of Object.entries(colors)) {
    const key = `hd-shot-${name}`;
    if (scene.textures.exists(key)) continue;
    const canvas = scene.textures.createCanvas(key, 128, 64);
    if (!canvas) continue;
    const ctx = canvas.context;
    if (name === 'enemy') {
      const halo = ctx.createRadialGradient(64, 32, 2, 64, 32, 31);
      halo.addColorStop(0, '#fff2d9'); halo.addColorStop(.3, '#ffb0b0');
      halo.addColorStop(.52, color); halo.addColorStop(.7, '#5d1420'); halo.addColorStop(1, '#ff567500');
      ctx.fillStyle = halo; ctx.fillRect(32, 0, 64, 64);
      ctx.strokeStyle = '#ffddca'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(64, 32, 15, 0, Math.PI * 2); ctx.stroke();
      canvas.refresh(); canvas.setFilter(Phaser.Textures.FilterMode.LINEAR);
      // A square source frame keeps a circular hostile projectile at 12×12.
      canvas.add('orb', 0, 32, 0, 64, 64);
      continue;
    }
    const halo = ctx.createRadialGradient(64, 32, 2, 64, 32, 60);
    halo.addColorStop(0, color); halo.addColorStop(.35, color + 'a0'); halo.addColorStop(1, color + '00');
    ctx.fillStyle = halo; ctx.fillRect(0, 0, 128, 64);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(116, 32); ctx.lineTo(55, 19); ctx.lineTo(15, 32); ctx.lineTo(55, 45); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f3fcff';
    ctx.beginPath(); ctx.moveTo(113, 32); ctx.lineTo(59, 27); ctx.lineTo(28, 32); ctx.lineTo(59, 37); ctx.closePath(); ctx.fill();
    canvas.refresh(); canvas.setFilter(Phaser.Textures.FilterMode.LINEAR);
  }
}
