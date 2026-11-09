import Phaser from 'phaser';
import '../../title-screen.css';
import { GAME_BACKGROUND } from '../constants';
import { saveSystem } from '../systems/saveSystem.ts';
import { globalAudio } from '../audio/audioSystem.ts';

type TitleMode = 'attract' | 'main' | 'options' | 'controls';
type TitleAction = 'pilots' | 'options' | 'music' | 'effects' | 'difficulty' | 'controls' | 'back';

/**
 * Tela inicial independente da resolução lógica do gameplay.
 * A ilustração aprovada ocupa a janela em resolução nativa (cover, sem distorção).
 * Após PRESS START, o menu tem sua PRÓPRIA tela sem a aeronave.
 */
export class TitleScene extends Phaser.Scene {
  private mode: TitleMode = 'attract';
  private selectedIndex = 0;
  private root?: HTMLDivElement;

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.root) return;
    const key = event.key.toLowerCase();
    if (!['enter', ' ', 'escape', 'arrowup', 'arrowdown', 'w', 's'].includes(key)) return;

    // Evita rolagem da página e conflito com o listener de teclado do Phaser.
    event.preventDefault();
    event.stopPropagation();

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

    if (key === 'arrowup' || key === 'w') {
      this.moveSelection(-1);
    } else if (key === 'arrowdown' || key === 's') {
      this.moveSelection(1);
    } else if (key === 'enter' || key === ' ') {
      this.activateSelected();
    }
  };

  constructor() {
    super({ key: 'TitleScene' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(GAME_BACKGROUND);
    this.mode = 'attract';
    this.selectedIndex = 0;

    // DOM separado do canvas de 768×432: a abertura fica nítida em 1080p,
    // ultrawide e resoluções intermediárias sem mudar escala/hitboxes do jogo.
    this.root = document.createElement('div');
    this.root.id = 'bw-title-screen';
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

  private showMode(mode: TitleMode): void {
    this.mode = mode;
    this.selectedIndex = 0;
    this.renderMode();
  }

  private renderMode(): void {
    if (!this.root) return;
    this.root.className = this.mode === 'attract' ? 'bw-title-screen bw-is-attract' : 'bw-title-screen bw-is-menu';

    if (this.mode === 'attract') {
      // O PRESS START faz parte da arte aprovada. Uma máscara obtida da
      // própria ilustração alterna sua visibilidade, sem caixa ou botão sólido.
      this.root.innerHTML = `
        <div class="bw-title-artwork" aria-hidden="true">
          <div class="bw-title-press-mask"></div>
        </div>
        <button class="bw-title-start-area" type="button" aria-label="PRESS START — abrir menu principal"></button>
      `;
      const start = this.root.querySelector<HTMLButtonElement>('.bw-title-start-area');
      start?.addEventListener('click', () => this.revealMenu());
      return;
    }

    const title = this.mode === 'main' ? 'MENU PRINCIPAL' : this.mode === 'options' ? 'OPÇÕES' : 'CONTROLES';
    const subtitle = this.mode === 'main'
      ? 'SUA MISSÃO COMEÇA AQUI'
      : this.mode === 'options'
        ? 'PERSONALIZE SUA EXPERIÊNCIA'
        : 'COMANDOS DE VOO';

    this.root.innerHTML = `
      <div class="bw-menu-ambient" aria-hidden="true">
        <div class="bw-menu-orbit bw-menu-orbit-one"></div>
        <div class="bw-menu-orbit bw-menu-orbit-two"></div>
      </div>
      <main class="bw-menu-shell">
        <div class="bw-menu-mark" aria-label="BULLET WAKE">
          <span>BULLET</span><strong>WAKE</strong>
        </div>
        <div class="bw-menu-divider" aria-hidden="true"></div>
        <div class="bw-menu-heading">
          <p class="bw-menu-eyebrow">${subtitle}</p>
          <h1>${title}</h1>
        </div>
        <nav class="bw-menu-options" aria-label="${title}">
          ${this.renderActions()}
        </nav>
        <p class="bw-menu-help">${this.mode === 'controls' ? 'ESC OU ENTER PARA VOLTAR' : '↑ ↓ NAVEGAR  ·  ENTER SELECIONAR  ·  ESC VOLTAR'}</p>
      </main>
      <div class="bw-menu-studio">A GAME BY <strong>BOTAN STUDIO</strong></div>
    `;
    this.bindActions();
    this.updateSelection(false);
  }

  private renderActions(): string {
    if (this.mode === 'main') {
      return this.actionButton('pilots', 'SELECIONAR PILOTO', 0, true)
        + this.actionButton('options', 'OPÇÕES', 1);
    }
    if (this.mode === 'options') {
      const { settings } = saveSystem.getSaveData();
      const difficulty = settings.difficulty || 'normal';
      const difficultyNames: Record<'normal' | 'hard' | 'arcade', string> = {
        normal: 'NORMAL', hard: 'DIFÍCIL', arcade: 'ARCADE',
      };
      return [
        this.actionButton('music', `MÚSICA <em>${settings.musicVolume > 0 ? 'LIGADA' : 'DESLIGADA'}</em>`, 0),
        this.actionButton('effects', `EFEITOS <em>${settings.sfxVolume > 0 ? 'LIGADOS' : 'DESLIGADOS'}</em>`, 1),
        this.actionButton('difficulty', `DIFICULDADE <em>${difficultyNames[difficulty]}</em>`, 2),
        this.actionButton('controls', 'CONTROLES', 3),
        this.actionButton('back', 'VOLTAR', 4),
      ].join('');
    }
    return `
      <div class="bw-controls-list" aria-label="Comandos de jogo">
        <div><span>WASD / SETAS</span><strong>MOVIMENTAR</strong></div>
        <div><span>ESPAÇO</span><strong>ATIRAR</strong></div>
        <div><span>SHIFT</span><strong>DASH (3 POR FASE)</strong></div>
        <div><span>X</span><strong>BOMBA</strong></div>
        <div><span>V</span><strong>ESPECIAL</strong></div>
        <div><span>C</span><strong>CARREGAR (SE DISPONÍVEL)</strong></div>
        <div><span>ESC</span><strong>PAUSAR</strong></div>
      </div>
      ${this.actionButton('back', 'VOLTAR', 0)}
    `;
  }

  private actionButton(action: TitleAction, label: string, index: number, primary = false): string {
    return `<button type="button" class="bw-nav-button${primary ? ' bw-nav-primary' : ''}" data-action="${action}" data-index="${index}" aria-selected="false"><span class="bw-nav-indicator" aria-hidden="true"></span><span class="bw-nav-label">${label}</span><span class="bw-nav-arrow" aria-hidden="true">›</span></button>`;
  }

  private bindActions(): void {
    if (!this.root) return;
    this.root.querySelectorAll<HTMLButtonElement>('.bw-nav-button').forEach((btn) => {
      const index = Number(btn.dataset.index);
      btn.addEventListener('mouseenter', () => {
        this.selectedIndex = index;
        this.updateSelection(false);
      });
      btn.addEventListener('focus', () => {
        this.selectedIndex = index;
        this.updateSelection(false);
      });
      btn.addEventListener('click', () => {
        this.selectedIndex = index;
        this.activateSelected();
      });
    });
  }

  private moveSelection(direction: number): void {
    const total = this.root?.querySelectorAll('.bw-nav-button').length ?? 0;
    if (!total) return;
    this.selectedIndex = (this.selectedIndex + direction + total) % total;
    globalAudio.playShot('cora', 1);
    this.updateSelection(true);
  }

  private updateSelection(focus: boolean): void {
    const rows = this.root?.querySelectorAll<HTMLButtonElement>('.bw-nav-button');
    if (!rows) return;
    rows.forEach((btn, index) => {
      const selected = this.selectedIndex === index;
      btn.classList.toggle('bw-nav-active', selected);
      btn.setAttribute('aria-selected', String(selected));
    });
    if (focus) rows[this.selectedIndex]?.focus({ preventScroll: true });
  }

  private activateSelected(): void {
    const action = this.root?.querySelectorAll<HTMLButtonElement>('.bw-nav-button')[this.selectedIndex]?.dataset.action as TitleAction | undefined;
    if (!action) return;
    globalAudio.playPickup('upgrade');
    switch (action) {
      case 'pilots':
        // A nave não aparece na tela intermediária; o piloto é escolhido na cena existente.
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
        const on = saveSystem.getSaveData().settings.musicVolume > 0;
        saveSystem.updateSettings({ musicVolume: on ? 0 : 1 });
        if (on) globalAudio.stopMusic();
        break;
      }
      case 'effects': {
        const on = saveSystem.getSaveData().settings.sfxVolume > 0;
        saveSystem.updateSettings({ sfxVolume: on ? 0 : 1 });
        break;
      }
      case 'difficulty': {
        const current = saveSystem.getSaveData().settings.difficulty || 'normal';
        const values = ['normal', 'hard', 'arcade'] as const;
        saveSystem.updateSettings({ difficulty: values[(values.indexOf(current) + 1) % values.length] });
        break;
      }
    }
    // Recria somente os rótulos dinâmicos, mantendo o item selecionado.
    this.renderMode();
  }
}
