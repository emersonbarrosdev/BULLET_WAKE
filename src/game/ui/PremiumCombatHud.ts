import Phaser from 'phaser';
import '../../combat-hud.css';
import { type PlayerHealth } from '../systems/combat';
import type { SectorId } from '../systems/stageDirector';
import type { WeaponLevel, WeaponFamily } from '../systems/weaponSystem';
import { getPilot } from '../data/pilots';

const sectors: Record<SectorId, string> = {
  evacuacao: 'ÁGUAS COSTEIRAS', destrocos: 'RECIFE DOS CASULOS',
  industria: 'FOSSA ABISSAL', aproximacao: 'DOMÍNIO DE TALASSARCA',
};

/** Native-resolution typography; sidebars keep the existing 432px arena clear. */
export class PremiumCombatHud {
  private readonly root: HTMLDivElement;
  private readonly fields = new Map<string, HTMLElement>();
  private statusRemainingMs = 0;
  private readonly align = (): void => {
    const r = this.scene.game.canvas.getBoundingClientRect();
    Object.assign(this.root.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  };

  constructor(private readonly scene: Phaser.Scene, onRestart: () => void) {
    this.root = document.createElement('div');
    this.root.id = 'bw-combat-hud';
    this.root.innerHTML = `
      <aside class="bw-combat-side bw-combat-left" aria-label="Telemetria do piloto">
        <div class="bw-combat-wordmark">BULLET <em>WAKE</em></div>
        <section class="bw-combat-panel bw-combat-identity">
          <img data-field="portrait" src="${import.meta.env.BASE_URL}assets/pilot-selection/portrait-nolan.webp" alt="Nolan Fitch" />
          <div><small>OPERADOR</small><strong data-field="name">NOLAN FITCH</strong><b data-field="ship">RIVET</b></div>
        </section>
        <section class="bw-combat-panel bw-combat-score-panel"><small>PONTUAÇÃO <i data-field="combo"></i></small><strong class="bw-combat-score" data-field="score">000000</strong></section>
        <section class="bw-combat-panel"><div class="bw-combat-line"><small>VIDAS</small><b data-field="lives-count">3</b></div><div class="bw-resource-icons bw-life-icons" data-field="lives" aria-label="3 vidas"><i></i><i></i><i></i></div><small data-field="shield"></small></section>
        <section class="bw-combat-panel"><div class="bw-combat-line"><small>ESPECIAL</small><b data-field="special">PRONTO</b></div><div class="bw-resource-icons bw-special-icons" data-field="special-stock" aria-label="2 especiais"><i></i><i></i><i></i></div></section>
        <div class="bw-combat-bottom"><button type="button" data-action="restart">PAUSAR / OPÇÕES</button></div>
      </aside>
      <div class="bw-combat-center">
        <div class="bw-combat-boss" hidden><small data-field="boss-name"></small><div><i data-field="boss-fill"></i></div></div>
        <p class="bw-combat-toast" data-field="toast" hidden></p>
      </div>
      <aside class="bw-combat-side bw-combat-right" aria-label="Telemetria de armamento">
        <div class="bw-combat-mission"><small>OPERAÇÃO PELÁGICA</small><strong>FENDA PELÁGICA</strong><span data-field="sector">ÁGUAS COSTEIRAS</span></div>
        <section class="bw-combat-panel bw-combat-armament"><small>ARMA EQUIPADA</small><strong class="bw-combat-weapon" data-field="weapon">DISPERSÃO AZUL</strong><div class="bw-combat-line"><span>POTÊNCIA</span><b data-field="level">NV 1/4</b></div><div class="bw-combat-pips" data-field="pips"><i></i><i></i><i></i><i></i></div><div class="bw-combat-evolution"><div class="bw-combat-line"><small data-field="power-title">PRÓXIMO NÍVEL</small><b data-field="power">0 / 3</b></div><div class="bw-combat-segments" data-field="power-segments"><i>P</i><i>P</i><i>P</i></div></div></section>
        <section class="bw-combat-panel bw-combat-results"><small>TRAJETO DA MISSÃO</small><div class="bw-combat-progress"><i data-field="progress"></i></div></section>
        <div class="bw-combat-bottom"><small>FENDA PELÁGICA // FASE 01</small></div>
      </aside>`;
    this.root.querySelectorAll<HTMLElement>('[data-field]').forEach(node => this.fields.set(node.dataset.field!, node));
    document.body.append(this.root);
    this.root.querySelector('[data-action="restart"]')!.addEventListener('click', onRestart);
    this.align(); scene.scale.on('resize', this.align);
    const cleanup = (): void => {
      scene.scale.off('resize', this.align);
      scene.events.off(Phaser.Scenes.Events.SHUTDOWN, cleanup);
      scene.events.off(Phaser.Scenes.Events.DESTROY, cleanup);
      this.root.remove();
    };
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    scene.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
  }

  private field(name: string): HTMLElement { return this.fields.get(name)!; }
  private text(name: string, value: string): void { const node = this.field(name); if (node.textContent !== value) node.textContent = value; }
  private segments(name: string, active: number): void {
    this.field(name).querySelectorAll('i').forEach((node, i) => node.classList.toggle('bw-active', i < active));
  }
  setPilot(id: string, shipName: string): void {
    const name = getPilot(id).name;
    const portrait = this.field('portrait') as HTMLImageElement;
    portrait.src = `${import.meta.env.BASE_URL}assets/pilot-selection/portrait-${id}.webp`; portrait.alt = name;
    this.text('name', name.toUpperCase()); this.text('ship', shipName.toUpperCase());
    this.field('lives').style.setProperty('--life-image', `url('${new URL(`${import.meta.env.BASE_URL}assets/combat-hd/${id==='lyra'?'kestrel':'rivet'}.webp`, document.baseURI).href}')`);
  }
  setScore(score: number, comboCount = 0, multiplier = 1): void {
    this.text('score', String(Math.max(0, Math.floor(score))).padStart(6, '0'));
    this.text('combo', comboCount > 1 ? `×${multiplier.toFixed(1)}` : '');
  }
  setHealth(state: PlayerHealth, shield = false): void {
    this.text('lives-count',String(state.lives));this.segments('lives',state.lives);
    this.field('lives').setAttribute('aria-label',`${state.lives} vidas`);
    this.text('shield',shield?'ESCUDO ATIVO':'');
  }
  setWeapon(family: WeaponFamily, level: WeaponLevel, powerMeter = 0): void {
    const color = family === 'ion' ? '#79deff' : family === 'green' ? '#86efac' : '#ff735e';
    this.text('weapon', family === 'ion' ? 'DISPERSÃO AZUL' : family === 'green' ? 'ENERGIA ESPIRALADA' : 'LASER RUBRO');
    this.field('weapon').style.color = color; this.field('pips').style.setProperty('--weapon', color);
    this.text('level', `NV ${level}/4`); this.segments('pips', level); this.setPowerMeter(powerMeter, level);
    this.text('power-title',level<4?'PRÓXIMO NÍVEL':family==='red'?'POTÊNCIA MÁXIMA':'EVOLUÇÃO LIBERADA');
  }
  setPowerMeter(meter: number, level: WeaponLevel): void {
    this.text('power', level >= 4 ? `RESERVA ${Math.max(0, Math.min(3, meter))}/3` : `${Math.max(0, Math.min(3, meter))} / 3`); this.segments('power-segments', meter);
  }
  setHeat(_heat: number, _isOverheated: boolean): void { /* Autofire never blocks for heat. */ }
  setSpecialStock(n: number, active=false): void {
    const count=Math.max(0,Math.min(3,n));this.segments('special-stock',count);
    this.field('special-stock').setAttribute('aria-label',`${count} especiais`);
    this.text('special',active?'ATIVO':count>0?'PRONTO':'VAZIO');
  }
  setProgress(ratio: number): void { this.field('progress').style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`; }
  setSector(sector: SectorId): void { this.text('sector', sectors[sector]); this.flash(`SETOR: ${sectors[sector]}`, '#dedede', 650); }
  showBossBar(name: string, hp: number, max: number): void {
    this.root.querySelector<HTMLElement>('.bw-combat-boss')!.hidden = false;
    this.text('boss-name', name); this.field('boss-fill').style.width = `${Math.max(0, Math.min(1, hp / (max || 1))) * 100}%`;
  }
  hideBossBar(): void { this.root.querySelector<HTMLElement>('.bw-combat-boss')!.hidden = true; }
  flash(message: string, color = '#dedede', ms = 700): void {
    this.text('toast', message); const toast = this.field('toast'); toast.hidden = false; toast.style.color = color; toast.style.opacity = '1'; this.statusRemainingMs = ms;
  }
  update(dt: number): void {
    this.statusRemainingMs = Math.max(0, this.statusRemainingMs - dt);
    const toast = this.field('toast'); toast.hidden = this.statusRemainingMs === 0;
    if (this.statusRemainingMs < 180) toast.style.opacity = String(this.statusRemainingMs / 180);
  }
}
