import Phaser from 'phaser';
import '../../title-screen.css';
import { GAME_BACKGROUND } from '../constants';
import { saveSystem } from '../systems/saveSystem.ts';
import { globalAudio } from '../audio/audioSystem.ts';

type TitleMode = 'attract' | 'main' | 'options' | 'controls';
type TitleAction = 'pilots' | 'options' | 'music' | 'effects' | 'difficulty' | 'controls' | 'back';

/**
 * Abertura cinematográfica aprovada — somente apresentação e menu do jogo.
 * A arte ocupa o viewport inteiro, sem reescalar o canvas lógico do gameplay.
 * As interações ficam no DOM (nativas, acessíveis e nítidas em Full HD).
 */
export class TitleScene extends Phaser.Scene {
  private mode: TitleMode = 'attract';
  private selectedIndex = 0;
  private root?: HTMLDivElement;

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.root || event.altKey || event.ctrlKey || event.metaKey) return;
    const key = event.key.toLowerCase();
    if (!['enter', ' ', 'escape', 'arrowup', 'arrowdown', 'w', 's'].includes(key)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.repeat) return;

    if (this.mode === 'attract') {
      if (key === 'enter' || key === ' ') this.revealMenu();
      return;
    }

    if (key === 'escape') {
      if (this.mode === 'controls') this.showMode('options');
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
        <h1>${controls ? 'CONTROLES' : 'OPÇÕES'}</h1>
        <nav class="bw-submenu-list" aria-label="${controls ? 'Controles' : 'Opções'}">
          ${this.renderActions()}
        </nav>
        <p class="bw-submenu-help">↑ ↓ NAVEGAR&nbsp;&nbsp; · &nbsp;&nbsp;ENTER SELECIONAR&nbsp;&nbsp; · &nbsp;&nbsp;ESC VOLTAR</p>
      </main>
    `;
    this.bindActions();
    this.updateSelection(false);
  }

  private renderActions(): string {
    if (this.mode === 'options') {
      const { settings } = saveSystem.getSaveData();
      const difficulty = settings.difficulty || 'normal';
      const difficultyNames = { normal: 'NORMAL', hard: 'DIFÍCIL', arcade: 'ARCADE' };
      return [
        this.actionButton('music', 'MÚSICA', settings.musicVolume > 0 ? 'LIGADA' : 'DESLIGADA', 0),
        this.actionButton('effects', 'EFEITOS', settings.sfxVolume > 0 ? 'LIGADOS' : 'DESLIGADOS', 1),
        this.actionButton('difficulty', 'DIFICULDADE', difficultyNames[difficulty], 2),
        this.actionButton('controls', 'CONTROLES', '', 3),
        this.actionButton('back', 'VOLTAR', '', 4),
      ].join('');
    }
    return `
      <div class="bw-controls-list">
        <div><span>WASD / SETAS</span><strong>MOVIMENTO</strong></div>
        <div><span>ESPAÇO</span><strong>DISPARAR</strong></div>
        <div><span>SHIFT ESQUERDO</span><strong>DASH (3 POR FASE)</strong></div>
        <div><span>X</span><strong>BOMBA</strong></div>
        <div><span>V</span><strong>ESPECIAL</strong></div>
        <div><span>C</span><strong>CARREGAR (SE DISPONÍVEL)</strong></div>
        <div><span>ESC</span><strong>PAUSA</strong></div>
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
        this.scene.start('PilotSelectScene', { stageNumber: 1 });
        return;
      case 'options':
        this.showMode('options');
        return;
      case 'controls':
        this.showMode('controls');
        return;
      case 'back':
        this.showMode(this.mode === 'controls' ? 'options' : 'main');
        return;
      case 'music': {
        const enabled = saveSystem.getSaveData().settings.musicVolume > 0;
        saveSystem.updateSettings({ musicVolume: enabled ? 0 : 1 });
        if (enabled) globalAudio.stopMusic();
        break;
      }
      case 'effects': {
        const enabled = saveSystem.getSaveData().settings.sfxVolume > 0;
        saveSystem.updateSettings({ sfxVolume: enabled ? 0 : 1 });
        break;
      }
      case 'difficulty': {
        const current = saveSystem.getSaveData().settings.difficulty || 'normal';
        const values = ['normal', 'hard', 'arcade'] as const;
        saveSystem.updateSettings({ difficulty: values[(values.indexOf(current) + 1) % values.length] });
        break;
      }
    }
    this.renderMode();
  }
}
