import Phaser from 'phaser';
import { connectedPad, GamepadReader, padLabels } from '../systems/gamepadInput';
import '../../combat-briefing.css';

/** Only the produced mission is selectable; campaign routes remain in the Bible. */
export class StageSelectScene extends Phaser.Scene {
  private root?: HTMLDivElement;
  private pad = new GamepadReader();
  private selection = 0;
  private device?: string;

  constructor() { super({ key: 'StageSelectScene' }); }

  private launch = () => this.scene.start('PilotSelectScene', { stageNumber: 1 });
  private back = () => this.scene.start('TitleScene');
  private buttons() { return Array.from(this.root?.querySelectorAll<HTMLButtonElement>('button') ?? []); }

  private move(direction: number): void {
    const buttons = this.buttons();
    if (!buttons.length) return;
    this.selection = (this.selection + direction + buttons.length) % buttons.length;
    buttons[this.selection]?.focus();
  }

  private key = (event: KeyboardEvent): void => {
    if (event.repeat) return;
    if (['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      this.move(event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1);
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.buttons()[this.selection]?.click();
    }
    if (event.key === 'Escape') this.back();
  };

  create(): void {
    this.selection = 0;
    this.device = undefined;
    this.pad.sample(connectedPad());
    this.root = document.createElement('div');
    this.root.className = 'bw-briefing bw-mission-select';
    this.root.innerHTML = `<section class="bw-brief-panel">
      <p class="bw-brief-eyebrow">BULLET WAKE // OPERAÇÕES</p><h1>ESCOLHA SUA MISSÃO</h1>
      <button class="bw-mission-card" data-mission="1">
        <img src="${import.meta.env.BASE_URL}assets/combat-hd/ocean.webp" alt="Oceano da Fenda Pelágica"/>
        <span>MISSÃO 01</span><strong>FENDA PELÁGICA</strong>
        <small>Oceano aberto · invasão alienígena · Talassarca</small>
      </button>
      <p class="bw-brief-note">Intercepte os organismos invasores. Atravesse as águas contaminadas e encontre a origem da fenda.</p>
      <nav><button data-mission-action="launch">ESCOLHER PILOTO · ENTER</button><button data-mission-action="back">VOLTAR · ESC</button></nav>
    </section>`;
    document.body.append(this.root);
    this.buttons().forEach((button, index) => button.addEventListener('focus', () => this.selection = index));
    this.root.querySelector('[data-mission]')!.addEventListener('click', this.launch);
    this.root.querySelector('[data-mission-action="launch"]')!.addEventListener('click', this.launch);
    this.root.querySelector('[data-mission-action="back"]')!.addEventListener('click', this.back);
    document.addEventListener('keydown', this.key);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      document.removeEventListener('keydown', this.key);
      this.root?.remove(); this.root = undefined;
    });
  }

  update(): void {
    const pad = connectedPad(), commands = this.pad.sample(pad);
    if (this.device !== (pad?.id ?? '')) {
      this.device = pad?.id ?? '';
      const labels = padLabels(pad?.id);
      this.root!.querySelector('[data-mission-action="launch"]')!.textContent = 'ESCOLHER PILOTO · ' + (pad ? labels.shoot : 'ENTER');
      this.root!.querySelector('[data-mission-action="back"]')!.textContent = 'VOLTAR · ' + (pad ? labels.back : 'ESC');
    }
    if (commands.left || commands.up) this.move(-1);
    if (commands.right || commands.down) this.move(1);
    if (commands.confirm) this.buttons()[this.selection]?.click();
    if (commands.back) this.back();
  }
}
