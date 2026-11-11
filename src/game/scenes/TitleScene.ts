import { SECRET_PILOT_CODE } from '../data/pilotStories.ts';
import { connectedPad, GamepadReader, padLabels } from '../systems/gamepadInput';
import Phaser from 'phaser';
import '../../title-screen.css';
import { GAME_BACKGROUND } from '../constants';
import { saveSystem } from '../systems/saveSystem.ts';
import { globalAudio } from '../audio/audioSystem.ts';
import { NORMAL_GUIDE_ITEMS, PICKUP_GUIDE } from '../data/pickupGuide';

const SECRET_ELIGIBLE_AT_BOOT=saveSystem.getSaveData().completedCampaignPilots.length>0;

type TitleMode = 'attract' | 'main' | 'options' | 'controls' | 'guide';
type TitleAction = 'pilots' | 'options' | 'music' | 'effects' | 'difficulty' | 'rapid' | 'controls' | 'guide' | 'back';

/**
 * Abertura cinematográfica aprovada — somente apresentação e menu do jogo.
 * A arte ocupa o viewport inteiro, sem reescalar o canvas lógico do gameplay.
 * As interações ficam no DOM (nativas, acessíveis e nítidas em Full HD).
 */
export class TitleScene extends Phaser.Scene {
  private pad = new GamepadReader();
  private padId = '';
  update(): void {
    const device=connectedPad(), p=this.pad.sample(device);
    if(this.padId !== (device?.id ?? '')){this.padId=device?.id??'';if(this.root)this.renderMode();}
    if(p.confirm||p.menuOrBack){if(this.mode==='attract')this.revealMenu();else this.activateSelected();}
    if(p.up)this.moveSelection(-1);if(p.down)this.moveSelection(1);
    if(p.back)this.handleKeyDown(new KeyboardEvent('keydown',{key:'Escape'}));
  }
  private secretBuffer='';private secretEligibleAtBoot=false;
  private mode: TitleMode = 'attract';
  private selectedIndex = 0;
  private root?: HTMLDivElement;

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.root || event.altKey || event.ctrlKey || event.metaKey) return;
    const key = event.key.toLowerCase();
    if(this.mode==='attract'&&!event.repeat&&this.secretEligibleAtBoot&&/^[a-z]$/.test(key)){this.secretBuffer=(this.secretBuffer+key).slice(-SECRET_PILOT_CODE.length);if(saveSystem.enterSecretCode(this.secretBuffer)){globalAudio.playPickup('upgrade');this.root.setAttribute('aria-label','Hien desbloqueado');}}
    if (!['enter', ' ', 'escape', 'arrowup', 'arrowdown', 'w', 's'].includes(key)) return;
    event.preventDefault();
    event.stopPropagation();
    if (this.mode === 'guide' && (key === 'arrowup' || key === 'arrowdown')) {
      this.root.querySelector('.bw-item-guide')?.scrollBy({ top: key === 'arrowup' ? -75 : 75 });
      return;
    }
    if (event.repeat) return;

    if (this.mode === 'attract') {
      if (key === 'enter' || key === ' ') this.revealMenu();
      return;
    }

    if (key === 'escape') {
      if (this.mode === 'controls' || this.mode === 'guide') this.showMode('options');
      else if (this.mode === 'options') this.showMode('main');
      else this.showMode('attract');
      return;
    }

    if (key === 'arrowup' || key === 'w') this.moveSelection(-1);
    else if (key === 'arrowdown' || key === 's') this.moveSelection(1);
    else if (key === 'enter' || key === ' ') this.activateSelected();
  };

  constructor() {
    super({ key: 'TitleScene' });
  }

  create(): void {
    globalAudio.setEnvironment('atmosphere');globalAudio.startMenuMusic();this.game.registry.set('audio',globalAudio);
    const audioSettings=saveSystem.getSaveData().settings;globalAudio.setMix(audioSettings.musicVolume,audioSettings.sfxVolume);
    this.secretEligibleAtBoot=SECRET_ELIGIBLE_AT_BOOT;this.secretBuffer='';
    this.pad.sample(connectedPad());
    this.cameras.main.setBackgroundColor(GAME_BACKGROUND);
    this.mode = 'attract';
    this.selectedIndex = 0;
    this.root = document.createElement('div');
    this.root.id = 'bw-title-screen';
    this.root.className = 'bw-title-screen';
    this.root.setAttribute('aria-label', 'BULLET WAKE — tela inicial');
    document.body.appendChild(this.root);

    this.renderMode();
    document.addEventListener('keydown', this.handleKeyDown, true);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanup, this);
  }

  private cleanup(): void {
    document.removeEventListener('keydown', this.handleKeyDown, true);
    this.root?.remove();
    this.root = undefined;
  }

  private revealMenu(): void {
    if (this.mode !== 'attract') return;
    globalAudio.unlock();
    globalAudio.playPickup('upgrade');
    this.showMode('main');
  }

  private showMode(next: TitleMode): void {
    this.mode = next;
    this.selectedIndex = 0;
    this.renderMode();
  }

  private renderMode(): void {
    if (!this.root) return;
    this.root.className = `bw-title-screen bw-mode-${this.mode}`;

    if (this.mode === 'attract') {
      this.root.innerHTML = `
        <div class="bw-art-frame bw-attract-art" aria-hidden="true">
          <div class="bw-press-text"><span class="bw-press-text-arrow">▶</span><span class="bw-press-text-label">PRESS START</span><span class="bw-press-text-arrow">◀</span></div>
        </div>
        <button type="button" class="bw-press-activation" aria-label="PRESS START — abrir menu principal"></button>
      `;
      this.root.querySelector<HTMLButtonElement>('.bw-press-activation')
        ?.addEventListener('click', () => this.revealMenu());
      return;
    }

    if (this.mode === 'main') {
      // O título, as duas opções e a assinatura do estúdio fazem parte
      // da arte aprovada. Hotspots invisíveis preservam a composição.
      this.root.innerHTML = `
        <main class="bw-art-frame bw-main-art" aria-label="Menu principal">
          <nav class="bw-visual-navigation" aria-label="Escolha uma opção">
            <button type="button" class="bw-visual-choice bw-choice-pilot" data-index="0" data-action="pilots" aria-label="Selecionar piloto"><span class="bw-sr-only">Selecionar piloto</span></button>
            <button type="button" class="bw-visual-choice bw-choice-options" data-index="1" data-action="options" aria-label="Opções"><span class="bw-sr-only">Opções</span></button>
          </nav>
          <span class="bw-choice-pointer" aria-hidden="true">▶</span>
        </main>
      `;
      this.bindActions();
      this.updateSelection(false);
      return;
    }

    const controls = this.mode === 'controls';
    this.root.innerHTML = `
      <div class="bw-art-frame bw-submenu-art" aria-hidden="true"></div>
      <div class="bw-submenu-shade" aria-hidden="true"></div>
      <main class="bw-submenu-shell">
        <h1>${this.mode === 'guide' ? 'ITENS E ARMAS' : controls ? 'CONTROLES' : 'OPÇÕES'}</h1>
        <nav class="bw-submenu-list" aria-label="${controls ? 'Controles' : 'Opções'}">
          ${this.renderActions()}
        </nav>
        <p class="bw-submenu-help">${this.mode === 'guide' ? '↑ ↓ ROLAR LEGENDA' : '↑ ↓ NAVEGAR'}&nbsp;&nbsp; · &nbsp;&nbsp;${connectedPad()?padLabels(connectedPad()?.id).shoot:'ENTER'} SELECIONAR&nbsp;&nbsp; · &nbsp;&nbsp;${connectedPad()?padLabels(connectedPad()?.id).back:'ESC'} VOLTAR</p>
      </main>
    `;
    this.bindActions();
    this.updateSelection(false);
  }

  private renderActions(): string {
    if (this.mode === 'guide') {
      return `<p class="bw-guide-intro">Colete por contato. RIVET: 2/2/2/3 P até NV5 FULL. Demais naves: 3 P por nível até NV4. RIVET: leque vermelho · MOTH: ondas verdes · KNUCKLE: fluxo rubro · KESTREL: tiro de precisão · PEREGRINE: rajada alternada. 3 vidas iniciais, máximo 5; ao ser abatido, a potência volta ao NV1. Um único P comum pode ser recuperado.</p><div class="bw-item-guide" tabindex="0" aria-label="Legenda de itens, role para ver todos">${NORMAL_GUIDE_ITEMS.map(type => {
        const item = PICKUP_GUIDE[type];
        return `<article><div class="bw-guide-icon bw-guide-raster" style="background-image:url('${import.meta.env.BASE_URL}assets/combat-hd/review/pickups-${type}.webp')" role="img" aria-label="${item.label}"></div><div><h2 style="color:${item.color}">${item.letter} · ${item.label}</h2><p>${item.description}</p></div></article>`;
      }).join('')}</div>${this.actionButton('back', 'VOLTAR', '', 0)}`;
    }
    if (this.mode === 'options') {
      const { settings } = saveSystem.getSaveData();
      return [
        this.actionButton('music', 'MÚSICA', settings.musicVolume > 0 ? 'LIGADA' : 'DESLIGADA', 0),
        this.actionButton('effects', 'EFEITOS', settings.sfxVolume > 0 ? 'LIGADOS' : 'DESLIGADOS', 1),
        this.actionButton('difficulty', 'DIFICULDADE', 'NORMAL · EM AJUSTE', 2),
        this.actionButton('controls', 'CONTROLES', '', 3),
        this.actionButton('guide', 'GUIA DE ITENS E ARMAS', '', 4),
        this.actionButton('back', 'VOLTAR', '', 5),
      ].join('');
    }
    return `
      <div class="bw-controls-list">
        <div><span>${connectedPad()?'ANALÓGICO / DIRECIONAL':'WASD / SETAS'}</span><strong>MOVIMENTO</strong></div>
        <div><span>${connectedPad()?padLabels(connectedPad()?.id).shoot:'ESPAÇO'}</span><strong>SEGURAR PARA DISPARO RÁPIDO</strong></div>
        <div><span>${connectedPad()?padLabels(connectedPad()?.id).special:'X'}</span><strong>ESPECIAL · 2 INICIAIS / MÁX. 5</strong></div>
        <div><span>${connectedPad()?padLabels(connectedPad()?.id).pause:'ESC'}</span><strong>PAUSA</strong></div>
      </div>
      ${this.actionButton('back', 'VOLTAR', '', 0)}
    `;
  }

  private actionButton(action: TitleAction, title: string, state: string, index: number): string {
    return `<button class="bw-submenu-choice" type="button" data-action="${action}" data-index="${index}"><span class="bw-submenu-marker" aria-hidden="true">▶</span><span class="bw-submenu-label">${title}</span><span class="bw-submenu-state">${state}</span></button>`;
  }

  private bindActions(): void {
    if (!this.root) return;
    this.root.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((button) => {
      const index = Number(button.dataset.index);
      const select = (): void => {
        this.selectedIndex = index;
        this.updateSelection(false);
      };
      button.addEventListener('mouseenter', select);
      button.addEventListener('focus', select);
      button.addEventListener('click', () => {
        this.selectedIndex = index;
        this.activateSelected();
      });
    });
  }

  private moveSelection(direction: number): void {
    const total = this.root?.querySelectorAll('[data-action]').length ?? 0;
    if (!total) return;
    this.selectedIndex = (this.selectedIndex + direction + total) % total;
    globalAudio.playShot('cora', 1);
    this.updateSelection(true);
  }

  private updateSelection(focus: boolean): void {
    if (!this.root) return;
    this.root.classList.toggle('bw-selected-option', this.mode === 'main' && this.selectedIndex === 1);
    const rows = this.root.querySelectorAll<HTMLButtonElement>('[data-action]');
    rows.forEach((button, index) => {
      const active = index === this.selectedIndex;
      button.classList.toggle('bw-active', active);
      button.setAttribute('aria-current', active ? 'true' : 'false');
    });
    if (focus) rows[this.selectedIndex]?.focus({ preventScroll: true });
  }

  private activateSelected(): void {
    const button = this.root?.querySelectorAll<HTMLButtonElement>('[data-action]')[this.selectedIndex];
    const action = button?.dataset.action as TitleAction | undefined;
    if (!action) return;
    globalAudio.playPickup('upgrade');
    switch (action) {
      case 'pilots':
        this.cleanup();
        this.scene.start('PilotSelectScene');
        return;
      case 'options':
        this.showMode('options');
        return;
      case 'controls':
        this.showMode('controls');
        return;
      case 'guide':
        this.showMode('guide');
        return;
      case 'back':
        this.showMode(this.mode === 'controls' || this.mode === 'guide' ? 'options' : 'main');
        return;
      case 'music': {
        const enabled = saveSystem.getSaveData().settings.musicVolume > 0;
        saveSystem.updateSettings({ musicVolume: enabled ? 0 : 1 });
        if (enabled) globalAudio.stopMusic();else globalAudio.startMenuMusic();
        break;
      }
      case 'effects': {
        const enabled = saveSystem.getSaveData().settings.sfxVolume > 0;
        saveSystem.updateSettings({ sfxVolume: enabled ? 0 : 1 });
        break;
      }
      case 'difficulty': {
        saveSystem.updateSettings({ difficulty: 'normal' });
        break;
      }
      case 'rapid': {
        saveSystem.updateSettings({rapidFire: !saveSystem.getSaveData().settings.rapidFire});
        break;
      }
    }
    const audioSettings=saveSystem.getSaveData().settings;globalAudio.setMix(audioSettings.musicVolume,audioSettings.sfxVolume);
    this.renderMode();
  }
}
