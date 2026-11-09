import Phaser from 'phaser';
import type { CrimsonLaserState, LaserPoint } from '../systems/crimsonLaserSystem';
import type { WeaponFamily, WeaponLevel } from '../systems/weaponSystem';

export interface RenderableShotTrail {
  x: number;
  y: number;
  baseX: number;
  ageMs: number;
  velocityX: number;
  velocityY: number;
  waveAmplitude?: number;
  waveFrequency?: number;
  wavePhase?: number;
}

/**
 * Renderizador Neo-Arcade HD 2D de alta eficiência para os 3 Armamentos Canônicos (estilo Fire Shark):
 * - VERMELHO (LASER RUBRO): Colunas vivas de plasma rubro-alaranjado em movimento contínuo,
 *   com volumes luminosos conectados subindo pelo fluxo, bordas irregulares animadas,
 *   núcleo incandescente e Asas de Energia + cobertura posterior no Nível 4.
 * - VERDE (ENERGIA ESPIRALADA): Feixes e fitas helicoidais de energia esmeralda-lima
 *   em ondulação real com anéis de fase espiralados (Níveis 1 a 4).
 * - AZUL (DISPERSÃO): Lanças energéticas direcionais independentes de safira-ciano
 *   em leque progressivo (3, 5, 7 e 9 direções).
 */
export class CrimsonLaserRenderer {
  private readonly graphics: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, private readonly paintedShots = false) {
    this.graphics = scene.add.graphics();
    // Depth 8: Acima do oceano (-10..-7) e dos inimigos (5), mas ABAIXO da nave (15) e dos tiros inimigos (18)
    // para garantir legibilidade absoluta dos projéteis hostis mesmo no Nível 4 máximo.
    this.graphics.setDepth(8);
  }

  render(
    state: CrimsonLaserState,
    activeShots: readonly RenderableShotTrail[] = [],
    weaponFamily: WeaponFamily = 'green',
    weaponLevel: WeaponLevel = 1,
    timeMs = 0,
  ): void {
    const g = this.graphics;
    g.clear();

    // 1. Renderiza trilhas energéticas helicoidais (ENERGIA ESPIRALADA) ou lanças direcionais (DISPERSÃO)
    if (activeShots.length > 0 && !(this.paintedShots && weaponFamily === 'ion')) {
      this.renderProjectileEnergyStreams(g, activeShots, weaponFamily, weaponLevel, timeMs);
    }

    // 2. Renderiza colunas de plasma rubro-alaranjado contínuas (LASER RUBRO)
    if (!state.isEmitting || state.intensity <= 0.01 || state.beams.length === 0) {
      return;
    }

    const alpha = state.intensity;
    const phaseSec = state.phaseMs / 1000;
    const pulse = 1 + Math.sin(phaseSec * 26) * 0.15;

    // Camada 1: Bainha Externa Irregular de Calor Rubro-Alaranjado (bordas orgânicas animadas)
    for (let bIdx = 0; bIdx < state.beams.length; bIdx++) {
      const beam = state.beams[bIdx];
      this.strokeScallopedPlasmaColumn(
        g,
        beam.points,
        beam.outerWidth * 1.18 * pulse,
        0x991b1b,
        0.34 * alpha,
        phaseSec,
        bIdx,
      );
      this.strokeScallopedPlasmaColumn(
        g,
        beam.points,
        beam.outerWidth * 0.92 * pulse,
        0xea580c,
        0.42 * alpha,
        phaseSec + 0.15,
        bIdx,
      );
    }

    // Camada 2: Fluxo Contínuo de Plasma Rubro-Alaranjado
    for (let bIdx = 0; bIdx < state.beams.length; bIdx++) {
      const beam = state.beams[bIdx];
      const primaryColor =
        beam.role === 'central'
          ? 0xff1e42
          : beam.role === 'lateral-sweep'
            ? 0xff3b1f
            : 0xf97316;
      this.strokeScallopedPlasmaColumn(
        g,
        beam.points,
        beam.midWidth * 1.08 * pulse,
        primaryColor,
        0.86 * alpha,
        phaseSec + 0.3,
        bIdx,
      );
    }

    // Camada 3: Volumes Luminosos Conectados em Movimento (efeito Fire Shark 11–13s e 21–23s)
    // Múltiplos lóbulos de plasma sobrepostos que sobem continuamente pela coluna energética
    for (let bIdx = 0; bIdx < state.beams.length; bIdx++) {
      const beam = state.beams[bIdx];
      const pts = beam.points;
      if (pts.length < 2) continue;

      const isRear = beam.role === 'rear-wing';
      const nodeCount = isRear ? 8 : 14;
      const flowSpeed = isRear ? 3.2 : 4.1;

      for (let n = 0; n < nodeCount; n++) {
        const progress = (phaseSec * flowSpeed + n / nodeCount + bIdx * 0.17) % 1;
        const pos = this.samplePolyline(pts, progress);
        const taper = isRear ? 1 - progress * 0.32 : 1 - progress * 0.18;
        const ripple = Math.sin(progress * Math.PI * 8 - phaseSec * 30 + bIdx) * (beam.midWidth * 0.18);
        const lobeRadius = Math.max(3.5, beam.midWidth * 0.68 * taper);

        // Volume externo rubro-alaranjado conectado
        g.fillStyle(0xff2a1f, 0.58 * alpha);
        g.fillCircle(pos.x + ripple, pos.y, lobeRadius * 1.38);

        // Volume intermediário laranja-solar pulsante
        g.fillStyle(0xfb923c, 0.78 * alpha);
        g.fillCircle(pos.x - ripple * 0.5, pos.y, lobeRadius * 0.92);

        // Núcleo térmico amarelo-incandescente do volume
        g.fillStyle(0xfef08a, 0.9 * alpha);
        g.fillCircle(pos.x, pos.y, lobeRadius * 0.46);
      }
    }

    // Camada 4: Espinha Dorsal Incandescente Contínua (une todos os volumes sem deixar lacunas)
    for (const beam of state.beams) {
      this.strokePolyline(g, beam.points, beam.coreWidth * 1.35, 0xfde047, 0.85 * alpha);
      this.strokePolyline(g, beam.points, beam.coreWidth * 0.75, 0xfff7ed, 0.96 * alpha);
    }

    // Camada 5: Coronas de Emissão de Plasma nos Canhões da Nave
    for (const beam of state.beams) {
      const origin = beam.points[0];
      if (!origin) continue;
      const r = beam.midWidth * 0.92 * pulse;
      g.fillStyle(0xea580c, 0.52 * alpha);
      g.fillCircle(origin.x, origin.y, r * 1.55);
      g.fillStyle(0xff1e42, 0.75 * alpha);
      g.fillCircle(origin.x, origin.y, r * 1.1);
      g.fillStyle(0xfff7ed, 0.96 * alpha);
      g.fillCircle(origin.x, origin.y, r * 0.6);
    }

    // Camada 6: Efeitos de Impacto Térmico Contínuo nos Alvos Atingidos
    for (let i = 0; i < state.impacts.length; i++) {
      const imp = state.impacts[i];
      const sparkAngle = phaseSec * 20 + i * 1.1;
      const r = 7 + (i % 3) * 1.8;

      g.fillStyle(0xea580c, 0.6 * alpha);
      g.fillCircle(imp.x, imp.y, r * 1.6);
      g.fillStyle(0xff1e42, 0.8 * alpha);
      g.fillCircle(imp.x, imp.y, r * 1.15);
      g.fillStyle(0xfff7ed, 0.98 * alpha);
      g.fillCircle(imp.x, imp.y, r * 0.55);

      g.lineStyle(2.0, 0xfef08a, 0.92 * alpha);
      for (let s = 0; s < 4; s++) {
        const ang = sparkAngle + (s * Math.PI) / 2;
        const sx = imp.x + Math.cos(ang) * (r * 1.85);
        const sy = imp.y + Math.sin(ang) * (r * 1.85);
        g.lineBetween(imp.x, imp.y, sx, sy);
      }
    }
  }

  /**
   * Renderiza a identidade visual distinta da Arma 1 (ENERGIA ESPIRALADA — Verde)
   * e da Arma 2 (DISPERSÃO — Azul) para que nunca pareçam simples bolinhas coloridas.
   */
  private renderProjectileEnergyStreams(
    g: Phaser.GameObjects.Graphics,
    shots: readonly RenderableShotTrail[],
    weaponFamily: WeaponFamily,
    weaponLevel: WeaponLevel,
    timeMs: number,
  ): void {
    const phaseSec = timeMs / 1000;

    for (let i = 0; i < shots.length; i++) {
      const shot = shots[i];

      // 1. ARMA VERDE — ENERGIA ESPIRALADA (Fitas helicoidais ondulantes + anéis de fase escalando do NV1 ao NV4)
      if (shot.waveAmplitude && shot.waveAmplitude > 0) {
        const freq = shot.waveFrequency ?? 0.019;
        const phase = shot.wavePhase ?? 0;
        const amp = shot.waveAmplitude;
        const ribbonPts: LaserPoint[] = [];
        const steps = 8;
        const trailSpanMs = 28 + (weaponLevel - 1) * 18;

        for (let s = 0; s <= steps; s++) {
          const backMs = (s / steps) * trailSpanMs;
          const sampleAge = Math.max(0, shot.ageMs - backMs);
          const dtSec = (shot.ageMs - sampleAge) / 1000;
          const bx = shot.baseX - shot.velocityX * dtSec;
          const by = shot.y - shot.velocityY * dtSec;
          const wx = bx + Math.sin(sampleAge * freq + phase) * amp;
          ribbonPts.push({ x: wx, y: by });
        }

        const outerW = 4.2 + (weaponLevel - 1) * 1.8;
        const midW = 2.4 + (weaponLevel - 1) * 1.1;
        const coreW = 1.2 + (weaponLevel - 1) * 0.45;

        // Aura esmeralda externa da hélice
        this.strokePolyline(g, ribbonPts, outerW, 0x059669, 0.36);
        // Fita espiralada verde-lima vibrante
        this.strokePolyline(g, ribbonPts, midW, 0x10b981, 0.82);
        // Filamento central incandescente
        this.strokePolyline(g, ribbonPts, coreW, 0xd9f99d, 0.94);

        // Anel energético espiralado na crista da onda
        const head = ribbonPts[0];
        const ringPulse = 1 + 0.16 * Math.sin(phaseSec * 22 + i);
        g.fillStyle(0x4ade80, 0.52);
        g.fillCircle(head.x, head.y, (3.0 + (weaponLevel - 1) * 0.9) * ringPulse);
        g.fillStyle(0xecfccb, 0.95);
        g.fillCircle(head.x, head.y, (1.7 + (weaponLevel - 1) * 0.4) * ringPulse);
      } else if (weaponFamily === 'ion') {
        // 2. ARMA AZUL — DISPERSÃO (Wide Shot — começa compacto no NV1 e cresce em leque de lanças até o NV4)
        const speed = Math.hypot(shot.velocityX, shot.velocityY) || 1;
        const dirX = shot.velocityX / speed;
        const dirY = shot.velocityY / speed;
        const perpX = -dirY;
        const perpY = dirX;
        const tailLen = 8 + (weaponLevel - 1) * 5;
        const tipLead = 3 + (weaponLevel - 1) * 1.2;

        const tailX = shot.x - dirX * tailLen;
        const tailY = shot.y - dirY * tailLen;
        const tipX = shot.x + dirX * tipLead;
        const tipY = shot.y + dirY * tipLead;

        const sheathW = 3.2 + (weaponLevel - 1) * 1.2;
        const coreW = 1.6 + (weaponLevel - 1) * 0.65;
        const chevronHalfW = 2.0 + (weaponLevel - 1) * 1.1;

        // Bainha safira direcional
        g.lineStyle(sheathW, 0x0284c7, 0.42);
        g.lineBetween(tailX, tailY, tipX, tipY);

        // Corpo ciano elétrico da lança
        g.lineStyle(coreW, 0x00f0ff, 0.88);
        g.lineBetween(tailX + dirX * 2, tailY + dirY * 2, tipX, tipY);

        // Chevron energético frontal (ponta direcional proporcional ao nível)
        const wingBackX = shot.x - dirX * (1.8 + (weaponLevel - 1) * 0.7);
        const wingBackY = shot.y - dirY * (1.8 + (weaponLevel - 1) * 0.7);
        g.lineStyle(1.4 + (weaponLevel - 1) * 0.3, 0xe0f2fe, 0.95);
        g.beginPath();
        g.moveTo(wingBackX + perpX * chevronHalfW, wingBackY + perpY * chevronHalfW);
        g.lineTo(tipX, tipY);
        g.lineTo(wingBackX - perpX * chevronHalfW, wingBackY - perpY * chevronHalfW);
        g.strokePath();
      }
    }
  }

  /**
   * Desenha uma coluna de plasma com espessura variável e bordas onduladas ao longo dos segmentos,
   * evitando aparência de linha reta estática.
   */
  private strokeScallopedPlasmaColumn(
    g: Phaser.GameObjects.Graphics,
    points: readonly LaserPoint[],
    baseWidth: number,
    color: number,
    alpha: number,
    phaseSec: number,
    beamIdx: number,
  ): void {
    if (points.length < 2) return;
    for (let i = 0; i < points.length - 1; i++) {
      const segRatio = i / (points.length - 1);
      const wave = 1 + 0.28 * Math.sin(phaseSec * 30 - segRatio * 14 + beamIdx * 1.5);
      const segWidth = Math.max(1.5, baseWidth * wave);
      g.lineStyle(segWidth, color, alpha);
      g.lineBetween(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
    }
  }

  private strokePolyline(
    g: Phaser.GameObjects.Graphics,
    points: readonly LaserPoint[],
    width: number,
    color: number,
    alpha: number,
  ): void {
    if (points.length < 2) return;
    g.lineStyle(width, color, alpha);
    g.beginPath();
    g.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      g.lineTo(points[i].x, points[i].y);
    }
    g.strokePath();
  }

  private samplePolyline(points: readonly LaserPoint[], t: number): LaserPoint {
    const clamped = Math.max(0, Math.min(0.9999, t));
    const scaled = clamped * (points.length - 1);
    const idx = Math.floor(scaled);
    const frac = scaled - idx;
    const a = points[idx];
    const b = points[Math.min(points.length - 1, idx + 1)];
    return {
      x: a.x + (b.x - a.x) * frac,
      y: a.y + (b.y - a.y) * frac,
    };
  }

  clear(): void {
    this.graphics.clear();
  }

  destroy(): void {
    this.graphics.destroy();
  }
}
