import type { ArcadeScene } from '../game/arcade/ArcadeScene.ts';
import {
  PELAGIC_ENEMY_AIR_SHEET,
  PELAGIC_RIVET_SHEET,
  PELAGIC_UFO_SHEET,
  PELAGIC_VFX_SHEET,
} from '../game/arcade/PelagicActorAnimsMath.ts';
import {
  PELAGIC_ENEMY_MISSILE_SHEET,
  PELAGIC_HELI_SHEET,
  PELAGIC_ROTOR_SHEET,
  PELAGIC_SUB_CLEAN_SHEET,
  PELAGIC_TOWER_CLEAN_SHEET,
  PELAGIC_TURRETS_SHEET,
  TURRET_PIVOT_ORIGIN_Y,
} from '../game/arcade/PelagicWeaponMounts.ts';

export type DevAssetCategory =
  | 'RIVET'
  | 'Aeronaves'
  | 'Helicópteros'
  | 'Barcos'
  | 'Submarinos'
  | 'Canhões'
  | 'Explosões'
  | 'Mísseis'
  | 'Especiais';

export interface DevTextureInspectEntry {
  key: string;
  label: string;
  category: DevAssetCategory;
  defaultOriginX: number;
  defaultOriginY: number;
}

const KNOWN_INSPECT_ENTRIES: readonly DevTextureInspectEntry[] = [
  { key: PELAGIC_RIVET_SHEET, label: 'RIVET UP (2.5D)', category: 'RIVET', defaultOriginX: 0.5, defaultOriginY: 0.5 },
  { key: 'arc-rivet', label: 'RIVET Arcade Sheet', category: 'RIVET', defaultOriginX: 0.5, defaultOriginY: 0.5 },
  { key: PELAGIC_ENEMY_AIR_SHEET, label: 'Aeronaves Pelágicas (2.5D)', category: 'Aeronaves', defaultOriginX: 0.5, defaultOriginY: 0.5 },
  { key: 'arc-enemies', label: 'Elenco Geral Aéreo', category: 'Aeronaves', defaultOriginX: 0.5, defaultOriginY: 0.5 },
  { key: PELAGIC_UFO_SHEET, label: 'UFO / Sonda Rara', category: 'Aeronaves', defaultOriginX: 0.5, defaultOriginY: 0.5 },
  { key: PELAGIC_HELI_SHEET, label: 'Helicópteros (4 arquétipos)', category: 'Helicópteros', defaultOriginX: 0.5, defaultOriginY: 0.5 },
  { key: PELAGIC_ROTOR_SHEET, label: 'Rotores Principais & Cauda', category: 'Helicópteros', defaultOriginX: 0.5, defaultOriginY: 0.5 },
  { key: 'arc-wet-hull-4', label: 'Lancha Patrulha (2.5D)', category: 'Barcos', defaultOriginX: 0.5, defaultOriginY: 0.5 },
  { key: 'arc-wet-hull-5', label: 'Contratorpedeiro (2.5D)', category: 'Barcos', defaultOriginX: 0.5, defaultOriginY: 0.5 },
  { key: PELAGIC_SUB_CLEAN_SHEET, label: 'Submarino Limpo (Sem Canos)', category: 'Submarinos', defaultOriginX: 0.5, defaultOriginY: 0.57 },
  { key: 'colossal-sub-hull', label: 'Colosso Abissal — Casco', category: 'Submarinos', defaultOriginX: 0.5, defaultOriginY: 0.5 },
  { key: 'colossal-sub-parts', label: 'Colosso Abissal — Módulos', category: 'Submarinos', defaultOriginX: 0.5, defaultOriginY: 0.5 },
  { key: PELAGIC_TURRETS_SHEET, label: 'Torretas Articuladas (7 tipos)', category: 'Canhões', defaultOriginX: 0.5, defaultOriginY: TURRET_PIVOT_ORIGIN_Y },
  { key: PELAGIC_TOWER_CLEAN_SHEET, label: 'Torre Costeira Limpa + Ruína', category: 'Canhões', defaultOriginX: 0.5, defaultOriginY: 0.78 },
  { key: 'arc-boss', label: 'Chefes & Torretas Arcade', category: 'Canhões', defaultOriginX: 0.5, defaultOriginY: 0.5 },
  { key: 'arc-explosion', label: 'Explosão Arcade (16f)', category: 'Explosões', defaultOriginX: 0.5, defaultOriginY: 0.5 },
  { key: PELAGIC_VFX_SHEET, label: 'VFX Pelágico (Propulsor/Flash/Fumaça)', category: 'Explosões', defaultOriginX: 0.5, defaultOriginY: 0.5 },
  { key: PELAGIC_ENEMY_MISSILE_SHEET, label: 'Míssil Warhawk (4f)', category: 'Mísseis', defaultOriginX: 0.5, defaultOriginY: 0.5 },
  { key: 'arc-missile', label: 'Míssil Teleguiado RIVET', category: 'Mísseis', defaultOriginX: 0.5, defaultOriginY: 0.5 },
  { key: 'arc-bomb-v2', label: 'Especial — Bomba Tormenta', category: 'Especiais', defaultOriginX: 0.5, defaultOriginY: 0.5 },
  { key: 'arc-supply-v2', label: 'Suprimentos & Caixas', category: 'Especiais', defaultOriginX: 0.5, defaultOriginY: 0.5 },
];

export interface DevFrameInspectionMeta {
  key: string;
  frameIndex: number;
  totalFrames: number;
  frameWidth: number;
  frameHeight: number;
  originX: number;
  originY: number;
  transparentPct: number;
}

/**
 * Inspects real loaded Phaser textures/spritesheets and renders frames onto a dedicated canvas
 * with pivot crosshairs, transparency grid, frame-stepping, and jump/seam diagnostics.
 */
export class DevAnimationPreviewer {
  private playing = true;
  private fps = 10;
  private frameIndex = 0;
  private clock = 0;
  private showPivot = true;
  private showBounds = true;
  private selectedKey = PELAGIC_HELI_SHEET;

  listAvailable(scene: ArcadeScene, category?: DevAssetCategory): DevTextureInspectEntry[] {
    return KNOWN_INSPECT_ENTRIES.filter((entry) => {
      if (!scene.textures.exists(entry.key)) return false;
      if (category && entry.category !== category) return false;
      return true;
    });
  }

  getSelectedKey(): string {
    return this.selectedKey;
  }

  selectTexture(key: string): void {
    this.selectedKey = key;
    this.frameIndex = 0;
    this.clock = 0;
  }

  setPlaying(playing: boolean): void {
    this.playing = playing;
  }

  isPlaying(): boolean {
    return this.playing;
  }

  setFps(fps: number): void {
    this.fps = Math.max(1, Math.min(30, Math.round(fps)));
  }

  getFps(): number {
    return this.fps;
  }

  setGuides(pivot: boolean, bounds: boolean): void {
    this.showPivot = pivot;
    this.showBounds = bounds;
  }

  stepFrame(scene: ArcadeScene, delta: number): number {
    const total = this.getFrameNames(scene, this.selectedKey).length;
    if (total <= 0) return 0;
    this.playing = false;
    this.frameIndex = ((this.frameIndex + delta) % total + total) % total;
    return this.frameIndex;
  }

  setFrame(scene: ArcadeScene, index: number): number {
    const total = this.getFrameNames(scene, this.selectedKey).length;
    if (total <= 0) return 0;
    this.frameIndex = Math.max(0, Math.min(total - 1, Math.round(index)));
    return this.frameIndex;
  }

  private getFrameNames(scene: ArcadeScene, key: string): string[] {
    if (!scene.textures.exists(key)) return [];
    const tex = scene.textures.get(key);
    const names = tex.getFrameNames();
    const numeric = names.filter((n) => n !== '__BASE');
    if (numeric.length > 0) {
      return numeric.sort((a, b) => Number(a) - Number(b));
    }
    return names.length ? names : ['__BASE'];
  }

  renderToCanvas(scene: ArcadeScene, canvas: HTMLCanvasElement, dtSec: number): DevFrameInspectionMeta | null {
    if (!scene.textures.exists(this.selectedKey)) return null;
    const names = this.getFrameNames(scene, this.selectedKey);
    if (!names.length) return null;

    if (this.playing && names.length > 1) {
      this.clock += dtSec;
      const period = 1 / Math.max(1, this.fps);
      if (this.clock >= period) {
        const adv = Math.floor(this.clock / period);
        this.clock -= adv * period;
        this.frameIndex = (this.frameIndex + adv) % names.length;
      }
    }
    if (this.frameIndex >= names.length) this.frameIndex = 0;

    const tex = scene.textures.get(this.selectedKey);
    const frameName = names[this.frameIndex];
    const frame = tex.get(frameName);
    const src = tex.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const entry = KNOWN_INSPECT_ENTRIES.find((e) => e.key === this.selectedKey);
    const ox = entry?.defaultOriginX ?? 0.5;
    const oy = entry?.defaultOriginY ?? 0.5;

    const ctx = canvas.getContext('2d');
    if (!ctx || !frame || !src) return null;

    const cw = canvas.width;
    const ch = canvas.height;
    ctx.clearRect(0, 0, cw, ch);

    // Checkerboard transparency backdrop
    const tile = 12;
    for (let y = 0; y < ch; y += tile) {
      for (let x = 0; x < cw; x += tile) {
        ctx.fillStyle = ((x / tile + y / tile) | 0) % 2 === 0 ? '#111827' : '#1e293b';
        ctx.fillRect(x, y, tile, tile);
      }
    }

    const fw = Math.max(1, frame.cutWidth || frame.width);
    const fh = Math.max(1, frame.cutHeight || frame.height);
    const fitScale = Math.min((cw - 24) / fw, (ch - 24) / fh);
    const dw = fw * fitScale;
    const dh = fh * fitScale;
    const dx = (cw - dw) * 0.5;
    const dy = (ch - dh) * 0.5;

    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(src, frame.cutX, frame.cutY, fw, fh, dx, dy, dw, dh);

    // Sample alpha transparency % on canvas
    let transparentPct = 0;
    try {
      const sample = ctx.getImageData(Math.round(dx), Math.round(dy), Math.max(1, Math.round(dw)), Math.max(1, Math.round(dh))).data;
      let transparent = 0;
      const totalPx = sample.length / 4;
      for (let i = 3; i < sample.length; i += 16) {
        if (sample[i] < 16) transparent++;
      }
      transparentPct = Math.round((transparent / Math.max(1, totalPx / 4)) * 100);
    } catch {
      transparentPct = 0;
    }

    if (this.showBounds) {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
      ctx.lineWidth = 1;
      ctx.strokeRect(dx, dy, dw, dh);
    }

    if (this.showPivot) {
      const px = dx + dw * ox;
      const py = dy + dh * oy;
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.9)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px - 10, py);
      ctx.lineTo(px + 10, py);
      ctx.moveTo(px, py - 10);
      ctx.lineTo(px, py + 10);
      ctx.stroke();
    }

    return {
      key: this.selectedKey,
      frameIndex: this.frameIndex,
      totalFrames: names.length,
      frameWidth: fw,
      frameHeight: fh,
      originX: ox,
      originY: oy,
      transparentPct,
    };
  }
}
