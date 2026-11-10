import { connectedPad, GamepadReader, padLabels } from '../systems/gamepadInput';
import Phaser from 'phaser';
import '../../pilot-select.css';
import { GAME_BACKGROUND } from '../constants';
import { PILOTS, type PilotDefinition } from '../data/pilots';
import { globalAudio } from '../audio/audioSystem';

type PilotView = 'cards' | 'profile';

const portrait = (pilot: PilotDefinition): string => `/assets/pilot-selection/portrait-${pilot.id}.webp`;
const ship = (pilot: PilotDefinition): string => `/assets/pilot-selection/ship-${pilot.id}.webp`;

/**
 * Approved cinematic pilot selection. The full-resolution DOM overlay only belongs
 * to this scene; gameplay's logical canvas, hitboxes and shooting are unchanged.
 */
export class PilotSelectScene extends Phaser.Scene {
  private pad = new GamepadReader();
  private padId = '';
  update(): void {
    const device=connectedPad(), p=this.pad.sample(device);
    if(this.padId !== (device?.id ?? '')){this.padId=device?.id??'';this.updateSelection();}
    if(p.left)this.select((this.selectedIndex+PILOTS.length-1)%PILOTS.length);
    if(p.right)this.select((this.selectedIndex+1)%PILOTS.length);
    if(p.confirm){if(this.chosenIndex===this.selectedIndex)this.startGame();else this.choose(this.selectedIndex);}
    if(p.missile)this.setView(this.view==='profile'?'cards':'profile');
    if(p.back)this.handleKey(new KeyboardEvent('keydown',{key:'Escape'}));
  }
  private selectedIndex = 0;
  private chosenIndex: number | null = null;
  private chosenAt = 0;
  private stageNumber = 1;
  private view: PilotView = 'cards';
  private root?: HTMLDivElement;

  private readonly handleKey = (event: KeyboardEvent): void => {
    if (!this.root || event.ctrlKey || event.altKey || event.metaKey || event.repeat) return;
    const key = event.key.toLowerCase();
    const supported = ['arrowleft', 'arrowright', 'a', 'd', '1', '2', '3', 'enter', ' ', 'escape', 'i'];
    if (!supported.includes(key)) return;
    event.preventDefault();
    event.stopPropagation();

    if (key === 'escape') {
      if (this.view === 'profile') this.setView('cards');
      else if (this.chosenIndex !== null) {
        this.chosenIndex = null;
        this.updateSelection();
      }
      else this.leaveSelection();
      return;
    }
    if (key === 'enter' || key === ' ') {
      const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('button');
      if (button && this.root.contains(button) && button.dataset.action !== undefined) {
        this.activateAction(button);
      } else if (this.view === 'profile') {
        this.choose(this.selectedIndex);
      } else if (this.chosenIndex === this.selectedIndex) {
        this.startGame();
      } else {
        this.choose(this.selectedIndex);
      }
      return;
    }
    if (key === 'i') {
      this.setView(this.view === 'cards' ? 'profile' : 'cards');
      return;
    }
    if (key >= '1' && key <= '3') {
      this.select(Number(key) - 1);
    } else if (key === 'arrowleft' || key === 'a') {
      this.select((this.selectedIndex + PILOTS.length - 1) % PILOTS.length);
    } else if (key === 'arrowright' || key === 'd') {
      this.select((this.selectedIndex + 1) % PILOTS.length);
    }
  };

  constructor() {
    super({ key: 'PilotSelectScene' });
  }

  init(data: { selectedPilotId?: string; stageNumber?: number } = {}): void {
    this.selectedIndex = Math.max(0, PILOTS.findIndex(pilot => pilot.id === data.selectedPilotId));
    this.stageNumber = data.stageNumber || 1;
    this.view = 'cards';
    this.chosenIndex = null;
  }

  create(): void {
    this.pad.sample(connectedPad());
    this.cameras.main.setBackgroundColor(GAME_BACKGROUND);
    this.cleanup();
    this.root = document.createElement('div');
    this.root.id = 'bw-pilot-select';
    this.root.className = 'bw-pilot-select';
    this.root.setAttribute('aria-label', 'BULLET WAKE — seleção de pilotos');
    document.body.appendChild(this.root);
    document.addEventListener('keydown', this.handleKey, true);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanup, this);
    this.render();
  }

  private cleanup(): void {
    document.removeEventListener('keydown', this.handleKey, true);
    this.root?.remove();
    this.root = undefined;
  }

  private setView(next: PilotView): void {
    this.view = next;
    globalAudio.playPickup('upgrade');
    this.render();
    const focus = next === 'profile'
      ? this.root?.querySelector<HTMLElement>('.bw-pilot-profile-name h2')
      : this.root?.querySelector<HTMLElement>(`[data-pilot-index="${this.selectedIndex}"]`);
    focus?.focus({ preventScroll: true });
  }

  private select(index: number): void {
    if (index < 0 || index >= PILOTS.length) return;
    if (index !== this.selectedIndex) globalAudio.playPickup('upgrade');
    if (index !== this.selectedIndex) this.chosenIndex = null;
    this.selectedIndex = index;
    if (this.view === 'profile') this.render();
    else this.updateSelection();
  }

  private choose(index: number): void {
    this.select(index);
    this.chosenIndex = index;
    this.chosenAt = performance.now();
    globalAudio.playPickup('upgrade');
    if (this.view === 'profile') this.setView('cards');
    else this.updateSelection();
  }

  private activateAction(button: HTMLButtonElement): void {
    const action = button.dataset.action;
    if (action === 'start') this.startGame();
    else if (action === 'profile') {
      this.select(Number(button.dataset.profileIndex));
      this.setView('profile');
    } else if (action === 'cards') this.setView('cards');
    else if (action === 'choose') this.choose(this.selectedIndex);
  }

  private render(): void {
    if (!this.root) return;
    const current = PILOTS[this.selectedIndex];
    this.root.innerHTML = `
      <div class="bw-pilot-backdrop" aria-hidden="true"></div>
      <div class="bw-pilot-vignette" aria-hidden="true"></div>
      <main class="bw-pilot-ui ${this.view === 'profile' ? 'bw-pilot-ui-profile' : ''}">
        <header class="bw-pilot-header">
          <div class="bw-pilot-brand">BULLET <em>WAKE</em></div>
          <h1>CENTRO DE OPERAÇÕES</h1>
          <p>SELEÇÃO DE PILOTO DE COMBATE — ESCOLHA SEU OPERADOR</p>
        </header>
        ${this.view === 'cards' ? this.renderCards() : this.renderProfile(current)}
        <footer class="bw-pilot-footer">
          <div class="bw-pilot-help"></div>
          <div class="bw-pilot-footer-actions">
            ${this.view === 'profile' ? '<button type="button" class="bw-pilot-info-action" data-action="cards">VOLTAR À SELEÇÃO [I]</button>' : ''}
            <span class="bw-pilot-awaiting" aria-live="polite">ESCOLHA UM PILOTO PARA CONTINUAR</span>

          </div>
        </footer>
      </main>
    `;
    this.bindActions();
    this.updateSelection();
  }

  private renderCards(): string {
    return `
      <section class="bw-pilot-cards" aria-label="Pilotos disponíveis">
        ${PILOTS.map((pilot, index) => `
          <article class="bw-pilot-card" data-card-index="${index}" aria-label="${pilot.name}">
            <button type="button" class="bw-pilot-launch bw-pilot-card-confirm" data-action="start" data-confirm-index="${index}" hidden></button>
            <button type="button" class="bw-pilot-card-select" data-pilot-index="${index}" aria-label="Escolher ${pilot.name}" aria-pressed="false"></button>
            <div class="bw-pilot-card-head">
              <strong>${pilot.name}</strong>
              <small>${pilot.callsign}</small>
            </div>
            <div class="bw-pilot-portrait-wrap">
              <img src="${portrait(pilot)}" alt="Retrato de ${pilot.name}" draggable="false" />
            </div>
            <div class="bw-pilot-card-role">${pilot.role}</div>
            <div class="bw-pilot-card-special">ESP: ${pilot.specialName}</div>
            <div class="bw-pilot-ship-row"><span>NAVE: <b>${pilot.shipName}</b></span><img src="${ship(pilot)}" alt="Nave ${pilot.shipName}" draggable="false" /></div>
            <div class="bw-pilot-stats">${this.renderStats(pilot)}</div>
            <button type="button" class="bw-pilot-card-profile" data-action="profile" data-profile-index="${index}" aria-label="Ver perfil de ${pilot.name}">VER PERFIL <span aria-hidden="true">↗</span></button>
          </article>
        `).join('')}
      </section>
      <section class="bw-pilot-brief" aria-live="polite">
        <p class="bw-pilot-brief-bio"></p>
        <p class="bw-pilot-brief-special"></p>
      </section>
    `;
  }

  private renderProfile(pilot: PilotDefinition): string {
    return `
      <section class="bw-pilot-profile" aria-label="Perfil de ${pilot.name}">
        <div class="bw-pilot-profile-art"><img src="${portrait(pilot)}" alt="Retrato de ${pilot.name}" /></div>
        <div class="bw-pilot-profile-content">
          <div class="bw-pilot-profile-name"><small>PERFIL DO PILOTO</small><h2 tabindex="-1">${pilot.name}</h2><p>${pilot.callsign}</p></div>
          <p class="bw-pilot-profile-bio">${pilot.bio}</p>
          <div class="bw-pilot-profile-ship"><span>NAVE: <b>${pilot.shipName}</b></span><img src="${ship(pilot)}" alt="Nave ${pilot.shipName}" /></div>
          <div class="bw-pilot-profile-special"><small>HABILIDADE ESPECIAL</small><strong>${pilot.specialName}</strong><p>${pilot.specialDescription}</p></div>
          <div class="bw-pilot-profile-stats">${this.renderStats(pilot)}</div>
          ${this.chosenIndex !== this.selectedIndex ? '<button type="button" class="bw-pilot-profile-choose" data-action="choose">ESCOLHER ESTE PILOTO</button>' : ''}
        </div>
      </section>
    `;
  }

  private renderStats(pilot: PilotDefinition): string {
    const stats = [
      { label: 'VEL', value: pilot.speed, lo: 175, hi: 215, title: `${pilot.speed} unidades/s` },
      { label: 'CAD', value: pilot.shotsPerSecond, lo: 5, hi: 8, title: `${pilot.shotsPerSecond} disparos/s` },
      { label: 'PWR', value: pilot.damage, lo: 1, hi: 1.6, title: `${pilot.damage.toFixed(2)}× dano` },
    ];
    return stats.map(stat => {
      const active = Math.max(1, Math.min(5, Math.round(2 + 3 * (stat.value - stat.lo) / (stat.hi - stat.lo))));
      const bars = Array.from({ length: 5 }, (_, i) => `<i class="${i < active ? 'bw-lit' : ''}"></i>`).join('');
      return `<span class="bw-pilot-stat" title="${stat.title}"><b>${stat.label}</b><span class="bw-pilot-stat-bars">${bars}</span></span>`;
    }).join('');
  }

  private bindActions(): void {
    if (!this.root) return;
    this.root.querySelectorAll<HTMLButtonElement>('[data-pilot-index]').forEach(button => {
      const index = Number(button.dataset.pilotIndex);
      button.addEventListener('focus', () => this.select(index));
      button.addEventListener('click', () => this.choose(index));
    });
    this.root.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(button => {
      button.addEventListener('click', () => {
        if(button.dataset.action==='start'&&performance.now()-this.chosenAt<250)return;
        this.activateAction(button);
      });
    });
  }

  private updateSelection(): void {
    if (!this.root) return;
    const pilot = PILOTS[this.selectedIndex];
    this.root.querySelectorAll<HTMLButtonElement>('[data-pilot-index]').forEach((button, index) => {
      const selected = index === this.selectedIndex;
      const chosen = this.chosenIndex === index;
      button.closest('.bw-pilot-card')?.classList.toggle('bw-pilot-active', selected);
      button.closest('.bw-pilot-card')?.classList.toggle('bw-pilot-chosen', chosen);
      button.setAttribute('aria-pressed', String(chosen));
    });
    const bio = this.root.querySelector<HTMLElement>('.bw-pilot-brief-bio');
    const detail = this.root.querySelector<HTMLElement>('.bw-pilot-brief-special');
    if (bio) bio.textContent = `${pilot.name} // ${pilot.bio}`;
    if (detail) detail.textContent = `HABILIDADE ESPECIAL: ${pilot.specialDescription} (2 CARGAS INICIAIS · MÁX. 3)`;
    const chosen = this.chosenIndex === this.selectedIndex;
    this.root.querySelectorAll<HTMLButtonElement>('[data-confirm-index]').forEach((launch, index) => {
      launch.hidden = !chosen || index !== this.selectedIndex;
      launch.innerHTML = 'CONFIRMAR ' + pilot.name.split(' ')[0].toUpperCase() + ' <span>['+(connectedPad()?padLabels(connectedPad()?.id).shoot:'ENTER')+']</span>';
      launch.setAttribute('aria-label', 'Confirmar ' + pilot.name + ' e iniciar operação');
    });
    const awaiting = this.root.querySelector<HTMLElement>('.bw-pilot-awaiting');
    if (awaiting) awaiting.hidden = chosen || this.view === 'profile';
    const help = this.root.querySelector<HTMLElement>('.bw-pilot-help');
    if (help && connectedPad()) { const l=padLabels(connectedPad()?.id);help.textContent='DIRECIONAL: PILOTO · '+l.shoot+': ESCOLHER / CONFIRMAR · '+l.missile+': PERFIL · '+l.back+': VOLTAR';return; }
    if (help) help.textContent = this.view === 'profile'
      ? '[← →] TROCAR PILOTO · [ESC] FECHAR PERFIL'
      : chosen
        ? `${pilot.name.toUpperCase()} ESCOLHIDO · [ENTER] CONFIRMAR · [ESC] CANCELAR`
        : '[← → / 1 2 3] NAVEGAR · [ENTER] ESCOLHER · [ESC] VOLTAR';
  }

  private leaveSelection(): void {
    this.cleanup();
    this.scene.start('TitleScene');
  }

  private startGame(): void {
    if (this.chosenIndex !== this.selectedIndex) return;
    const pilot = PILOTS[this.selectedIndex];
    globalAudio.playPickup('upgrade');
    this.cleanup();
    this.scene.start('PrototypeScene', { pilotId: pilot.id, stageNumber: this.stageNumber });
  }
}
