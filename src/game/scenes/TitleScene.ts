import Phaser from 'phaser';
import { GAME_BACKGROUND, GAME_HEIGHT, GAME_WIDTH, FONT_HUD, FONT_TITLE } from '../constants';
import { saveSystem } from '../systems/saveSystem.ts';
import { globalAudio } from '../audio/audioSystem.ts';

/**
 * Tela-título aprovada: arte cinematográfica do BULLET WAKE + fluxo arcade.
 * Primeiro gesto: PRESS START -> SELECIONAR PILOTO / OPÇÕES.
 * Não modifica regras, cenas ou controles da gameplay.
 */
export class TitleScene extends Phaser.Scene {
  private mode: 'attract' | 'main' | 'options' | 'controls' = 'attract';
  private elapsedMs = 0;
  private selectedIndex = 0;
  private promptCover!: Phaser.GameObjects.Image;
  private mainGroup!: Phaser.GameObjects.Container;
  private optionsGroup!: Phaser.GameObjects.Container;
  private controlsGroup!: Phaser.GameObjects.Container;
  private mainRows: { background: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text }[] = [];
  private optionRows: { background: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text }[] = [];
  private keys?: Record<'up' | 'down' | 'w' | 's' | 'enter' | 'space' | 'esc', Phaser.Input.Keyboard.Key>;

  constructor() {
    super({ key: 'TitleScene' });
  }

  preload(): void {
    // Arte aprovada pelo criador. O logo, a nave e a assinatura do estúdio
    // fazem parte da ilustração original e NÃO são redesenhados por CSS/texto.
    this.load.image('bw-approved-title', 'assets/title/bulletwake-title-approved.webp');
    this.load.image('bw-title-prompt-cover', 'assets/title/bulletwake-title-prompt-cover.webp');
  }

  create(): void {
    this.mode = 'attract';
    this.elapsedMs = 0;
    this.selectedIndex = 0;
    this.cameras.main.setBackgroundColor(GAME_BACKGROUND);
    // A gameplay mantém pixel art; somente a arte cinematográfica do título
    // usa filtragem linear, evitando serrilhados por redimensionamento.
    this.textures.get('bw-approved-title').setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.textures.get('bw-title-prompt-cover').setFilter(Phaser.Textures.FilterMode.LINEAR);

    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'bw-approved-title')
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setDepth(0);

    // A camada foi extraída da mesma imagem aprovada, com somente o texto
    // PRESS START reconstruído ao fundo. Permite piscar sem uma caixa preta.
    // Coordenadas derivadas do enquadramento original 1672 × 941.
    const scaleX = GAME_WIDTH / 1672;
    const scaleY = GAME_HEIGHT / 941;
    this.promptCover = this.add.image(
      ((430 + 1240) / 2) * scaleX,
      ((657 + 812) / 2) * scaleY,
      'bw-title-prompt-cover',
    ).setDisplaySize((1240 - 430) * scaleX, (812 - 657) * scaleY)
      .setAlpha(0).setDepth(1);

    this.createMainMenu();
    this.createOptions();
    this.createControls();
    this.showMode('attract');

    const keyboard = this.input.keyboard;
    if (keyboard) {
      const codes = Phaser.Input.Keyboard.KeyCodes;
      this.keys = {
        up: keyboard.addKey(codes.UP),
        down: keyboard.addKey(codes.DOWN),
        w: keyboard.addKey(codes.W),
        s: keyboard.addKey(codes.S),
        enter: keyboard.addKey(codes.ENTER),
        space: keyboard.addKey(codes.SPACE),
        esc: keyboard.addKey(codes.ESC),
      };
    }

    // Mouse exclusivamente na interface. O primeiro clique revela o menu.
    this.input.on('pointerdown', () => {
      if (this.mode === 'attract') this.revealMenu();
    });
  }

  update(_time: number, delta: number): void {
    this.elapsedMs += Math.min(delta, 100);
    // ~0,6 s aceso / ~0,6 s apagado, como nos menus de arcade.
    this.promptCover.setAlpha(this.mode === 'attract'
      ? (Math.floor(this.elapsedMs / 620) % 2 === 0 ? 0 : 1)
      : 1);

    if (!this.keys) return;
    const justDown = Phaser.Input.Keyboard.JustDown;
    const confirm = justDown(this.keys.enter) || justDown(this.keys.space);
    const escape = justDown(this.keys.esc);
    const up = justDown(this.keys.up) || justDown(this.keys.w);
    const down = justDown(this.keys.down) || justDown(this.keys.s);

    if (this.mode === 'attract') {
      if (confirm) this.revealMenu();
      return;
    }
    if (escape) {
      if (this.mode === 'controls') this.showMode('options');
      else if (this.mode === 'options') this.showMode('main');
      else this.showMode('attract');
      return;
    }
    if (this.mode === 'controls') {
      if (confirm) this.showMode('options');
      return;
    }
    if (up) this.select((this.selectedIndex + this.rowCount() - 1) % this.rowCount());
    if (down) this.select((this.selectedIndex + 1) % this.rowCount());
    if (confirm) this.activateSelected();
  }

  private revealMenu(): void {
    if (this.mode !== 'attract') return;
    globalAudio.unlock();
    globalAudio.playPickup('upgrade');
    this.showMode('main');
  }

  private showMode(mode: 'attract' | 'main' | 'options' | 'controls'): void {
    this.mode = mode;
    this.selectedIndex = 0;
    this.mainGroup.setVisible(mode === 'main');
    this.optionsGroup.setVisible(mode === 'options');
    this.controlsGroup.setVisible(mode === 'controls');
    this.refreshFocus();
  }

  private createMainMenu(): void {
    this.mainGroup = this.add.container(0, 0).setDepth(6);
    const panel = this.add.rectangle(GAME_WIDTH / 2, 331, 332, 91, 0x031421, 0.87)
      .setStrokeStyle(1, 0x42dfff, 0.27);
    this.mainGroup.add(panel);
    this.mainRows = [
      this.menuRow(this.mainGroup, 'SELECIONAR PILOTO', 314, () => this.openPilotSelect(), true),
      this.menuRow(this.mainGroup, 'OPÇÕES', 348, () => this.showMode('options')),
    ];
  }

  private menuRow(
    container: Phaser.GameObjects.Container,
    text: string,
    y: number,
    action: () => void,
    primary = false,
  ): { background: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text } {
    const background = this.add.rectangle(GAME_WIDTH / 2, y, 303, 31, 0x082538, 0.83)
      .setStrokeStyle(1, 0x3e8ca8, 0.55)
      .setInteractive({ useHandCursor: true });
    const label = this.add.text(GAME_WIDTH / 2, y, text, {
      fontFamily: primary ? FONT_TITLE : FONT_HUD,
      fontSize: primary ? '18px' : '20px',
      fontStyle: 'bold',
      color: '#eafaff',
      letterSpacing: 2,
      align: 'center',
    }).setOrigin(0.5).setResolution(3);
    container.add([background, label]);
    background.on('pointerover', () => {
      this.selectedIndex = this.mode === 'options'
        ? this.optionRows.findIndex(row => row.background === background)
        : this.mainRows.findIndex(row => row.background === background);
      this.refreshFocus();
    });
    background.on('pointerdown', () => {
      if (this.mode === 'main' || this.mode === 'options') {
        globalAudio.playPickup('upgrade');
        action();
      }
    });
    return { background, label };
  }

  private createOptions(): void {
    this.optionsGroup = this.add.container(0, 0).setDepth(7);
    this.optionsGroup.add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020a14, 0.85));
    this.optionsGroup.add(this.add.text(GAME_WIDTH / 2, 91, 'OPÇÕES', {
      fontFamily: FONT_TITLE, fontSize: '34px', color: '#e9f8ff',
      fontStyle: 'bold', letterSpacing: 4,
    }).setOrigin(0.5).setResolution(3));

    this.optionRows = [
      this.menuRow(this.optionsGroup, '', 153, () => this.toggleMusic()),
      this.menuRow(this.optionsGroup, '', 194, () => this.toggleSfx()),
      this.menuRow(this.optionsGroup, '', 235, () => this.cycleDifficulty()),
      this.menuRow(this.optionsGroup, 'CONTROLES', 276, () => this.showMode('controls')),
      this.menuRow(this.optionsGroup, 'VOLTAR', 333, () => this.showMode('main')),
    ];
    this.refreshSettingsLabels();
  }

  private createControls(): void {
    this.controlsGroup = this.add.container(0, 0).setDepth(8);
    this.controlsGroup.add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020a14, 0.9));
    this.controlsGroup.add(this.add.text(GAME_WIDTH / 2, 82, 'CONTROLES', {
      fontFamily: FONT_TITLE, fontSize: '32px', fontStyle: 'bold', color: '#e9f8ff',
    }).setOrigin(0.5).setResolution(3));
    this.controlsGroup.add(this.add.text(GAME_WIDTH / 2, 183,
      'WASD / SETAS     MOVIMENTAR\n' +
      'ESPAÇO             ATIRAR\n' +
      'SHIFT                DASH (3 POR FASE)\n' +
      'X                        BOMBA\n' +
      'V                        ESPECIAL\n' +
      'C                        CARREGAR (SE DISPONÍVEL)\n' +
      'ESC                   PAUSAR', {
        fontFamily: FONT_HUD, fontSize: '19px', fontStyle: 'bold',
        color: '#cfe8f5', lineSpacing: 7, align: 'left',
      }).setOrigin(0.5).setResolution(3));
    const back = this.add.text(GAME_WIDTH / 2, 360, 'ENTER / ESC — VOLTAR', {
      fontFamily: FONT_HUD, fontSize: '18px', fontStyle: 'bold', color: '#62e7ff',
    }).setOrigin(0.5).setResolution(3).setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.showMode('options'));
    this.controlsGroup.add(back);
  }

  private rowCount(): number {
    return this.mode === 'options' ? this.optionRows.length : this.mainRows.length;
  }

  private select(index: number): void {
    this.selectedIndex = index;
    this.refreshFocus();
    globalAudio.playShot('cora', 1);
  }

  private refreshFocus(): void {
    const rows = this.mode === 'options' ? this.optionRows : this.mainRows;
    rows.forEach((row, i) => {
      const active = i === this.selectedIndex;
      row.background.setFillStyle(active ? 0x15526c : 0x082538, active ? 0.92 : 0.83)
        .setStrokeStyle(active ? 2 : 1, active ? 0x67edff : 0x3e8ca8, active ? 0.98 : 0.55);
      row.label.setColor(active ? '#ffffff' : '#b7d9ea');
    });
  }

  private activateSelected(): void {
    globalAudio.playPickup('upgrade');
    if (this.mode === 'main') {
      if (this.selectedIndex === 0) this.openPilotSelect();
      else this.showMode('options');
    } else if (this.mode === 'options') {
      if (this.selectedIndex === 0) this.toggleMusic();
      else if (this.selectedIndex === 1) this.toggleSfx();
      else if (this.selectedIndex === 2) this.cycleDifficulty();
      else if (this.selectedIndex === 3) this.showMode('controls');
      else this.showMode('main');
    }
  }

  private openPilotSelect(): void {
    this.scene.start('PilotSelectScene', { stageNumber: 1 });
  }

  private refreshSettingsLabels(): void {
    const s = saveSystem.getSaveData().settings;
    const difficulty = s.difficulty || 'normal';
    const difficultyText: Record<'normal' | 'hard' | 'arcade', string> = {
      normal: 'NORMAL', hard: 'DIFÍCIL', arcade: 'ARCADE',
    };
    if (this.optionRows.length < 3) return;
    this.optionRows[0].label.setText(`MÚSICA: ${s.musicVolume > 0 ? 'LIGADA' : 'DESLIGADA'}`);
    this.optionRows[1].label.setText(`EFEITOS: ${s.sfxVolume > 0 ? 'LIGADOS' : 'DESLIGADOS'}`);
    this.optionRows[2].label.setText(`DIFICULDADE: ${difficultyText[difficulty]}`);
  }

  private toggleMusic(): void {
    const enabled = saveSystem.getSaveData().settings.musicVolume > 0;
    saveSystem.updateSettings({ musicVolume: enabled ? 0 : 1 });
    if (enabled) globalAudio.stopMusic();
    this.refreshSettingsLabels();
  }

  private toggleSfx(): void {
    const enabled = saveSystem.getSaveData().settings.sfxVolume > 0;
    saveSystem.updateSettings({ sfxVolume: enabled ? 0 : 1 });
    this.refreshSettingsLabels();
  }

  private cycleDifficulty(): void {
    const current = saveSystem.getSaveData().settings.difficulty || 'normal';
    const values = ['normal', 'hard', 'arcade'] as const;
    const next = values[(values.indexOf(current) + 1) % values.length];
    saveSystem.updateSettings({ difficulty: next });
    this.refreshSettingsLabels();
  }
}
