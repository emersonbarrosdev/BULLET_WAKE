import Phaser from 'phaser';
import '../../combat-hud.css';
import { type PlayerHealth } from '../systems/combat';
import type { SectorId } from '../systems/stageDirector';
import { maxWeaponLevel, powerItemsForNextLevel, type WeaponLevel, type WeaponFamily } from '../systems/weaponSystem';
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
  private pilotId="nolan";
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
          <img data-field="portrait" src="${import.meta.env.BASE_URL}assets/pilot-selection/portrait-nolan.webp" alt="Bayek" />
          <div><small>OPERADOR</small><strong data-field="name">BAYEK</strong><b data-field="ship">RIVET</b></div>
        </section>
        <section class="bw-combat-panel bw-combat-results"><small>TRAJETO DA MISSÃO</small><div class="bw-combat-progress"><i data-field="progress"></i></div></section>
        <section class="bw-combat-panel bw-combat-score-panel"><small>PONTUAÇÃO <i data-field="combo"></i></small><strong class="bw-combat-score" data-field="score">000000</strong></section>
        <section class="bw-combat-panel"><div class="bw-combat-line"><small>VIDAS</small><b data-field="lives-count">3</b></div><div class="bw-resource-icons bw-life-icons" data-field="lives" aria-label="3 vidas"><i></i><i></i><i></i><i></i><i></i></div></section>
        <section class="bw-combat-panel"><div class="bw-combat-line"><small>ESPECIAL</small><b data-field="special">PRONTO</b></div><div class="bw-resource-icons bw-special-icons" data-field="special-stock" aria-label="2 especiais"><i></i><i></i><i></i><i></i><i></i></div></section>
        <div class="bw-combat-bottom"><button type="button" data-action="restart" aria-label="Pausar jogo" title="Pausar jogo"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg></button></div>
      </aside>
      <div class="bw-combat-center">
        <div class="bw-combat-boss" hidden><small data-field="boss-name"></small><div><i data-field="boss-fill"></i></div></div>
        <p class="bw-combat-toast" data-field="toast" hidden></p>
      </div>
      <aside class="bw-combat-side bw-combat-right" aria-label="Telemetria de armamento">
        <div class="bw-combat-mission"><small>OPERAÇÃO PELÁGICA</small><strong>FENDA PELÁGICA</strong><span data-field="sector">ÁGUAS COSTEIRAS</span></div>
        <section class="bw-combat-panel bw-combat-armament"><small>ARMA EQUIPADA</small><strong class="bw-combat-weapon" data-field="weapon">DISPERSÃO VERMELHA</strong><div class="bw-combat-line"><span>POTÊNCIA</span><b data-field="level">NV 1/4</b></div><div class="bw-combat-pips" data-field="pips"><i></i><i></i><i></i><i></i></div><div class="bw-combat-evolution"><div class="bw-combat-line"><small data-field="power-title">PRÓXIMO NÍVEL</small><b data-field="power">0 / 3</b></div><div class="bw-combat-segments" data-field="power-segments"><i>P</i><i>P</i><i>P</i></div></div></section>
        <section class="bw-combat-radio" aria-label="Comunicação do piloto"><small>CANAL DO PILOTO <i data-field="radio-status">EM ESCUTA</i></small><p data-field="radio">Canal aberto.</p></section>
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
    this.pilotId=id;
    this.field("pips").innerHTML="<i></i>".repeat(maxWeaponLevel(id));
    const name = getPilot(id).name;
    const portrait = this.field('portrait') as HTMLImageElement;
    portrait.src = `${import.meta.env.BASE_URL}assets/pilot-selection/portrait-${id}.webp`; portrait.alt = name;
    this.text('name', name.toUpperCase()); this.text('ship', shipName.toUpperCase());
    for (let frame=0; frame<4; frame++) {
      const url = new URL(`${import.meta.env.BASE_URL}assets/combat-hd/hud/life-${id}-${frame}.webp`, document.baseURI).href;
      this.field('lives').style.setProperty(`--life-image-${frame}`, `url('${url}')`);
      const image = new Image(); image.src = url; // Warm all four frames before their first HUD switch.
    }
  }
  setScore(score: number, comboCount = 0, multiplier = 1): void {
    this.text('score', String(Math.max(0, Math.floor(score))).padStart(6, '0'));
    this.text('combo', comboCount > 1 ? `×${multiplier.toFixed(1)}` : '');
  }
  setHealth(state: PlayerHealth, _shield = false): void {
    this.text('lives-count',String(state.lives));this.segments('lives',state.lives);
    this.field('lives').setAttribute('aria-label',`${state.lives} vidas`);

  }
  setWeapon(family: WeaponFamily, level: WeaponLevel, powerMeter = 0): void {
    const rivet = this.pilotId === 'nolan' && family === 'ion';
    const color = rivet ? '#ff655c' : family === 'ion' ? '#79deff' : family === 'green' ? '#86efac' : '#ff735e';
    this.text('weapon', rivet ? 'DISPERSÃO VERMELHA' : family === 'ion' ? 'DISPERSÃO AZUL' : family === 'green' ? 'ENERGIA ESPIRALADA' : 'LASER RUBRO');
    this.field('weapon').style.color = color; this.field('pips').style.setProperty('--weapon', color);
    this.text('level', level>=maxWeaponLevel(this.pilotId)?'FULL':`NV ${level}/${maxWeaponLevel(this.pilotId)}`); this.segments('pips', level); this.setPowerMeter(powerMeter, level);
    this.text('power-title',level<maxWeaponLevel(this.pilotId)?'PRÓXIMO NÍVEL':'POTÊNCIA MÁXIMA');
  }
  setPowerMeter(meter: number, level: WeaponLevel): void {
    const next=powerItemsForNextLevel(this.pilotId,level);
    this.text('power', level >= maxWeaponLevel(this.pilotId) ? 'MÁXIMO' : `${Math.max(0, Math.min(next, meter))} / ${next}`);
    this.field('power-segments').hidden=level>=maxWeaponLevel(this.pilotId);
    this.field('power-segments').querySelectorAll<HTMLElement>('i').forEach((n,i)=>{n.hidden=i>=next;n.style.display=i>=next?'none':'';});this.segments('power-segments', meter);
  }
  setHeat(_heat: number, _isOverheated: boolean): void { /* Autofire never blocks for heat. */ }
  setSpecialStock(n: number, active=false): void {
    const count=Math.max(0,Math.min(5,n));this.segments('special-stock',count);
    this.field('special-stock').setAttribute('aria-label',`${count} especiais`);
    this.text('special',active?'ATIVO':count>0?'PRONTO':'VAZIO');
  }
  setRadio(message:string,active:boolean):void {this.text('radio',active?message:'Canal aberto.');this.text('radio-status',active?'TRANSMITINDO':'EM ESCUTA');this.field('radio').parentElement!.classList.toggle('bw-radio-active',active);}
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
