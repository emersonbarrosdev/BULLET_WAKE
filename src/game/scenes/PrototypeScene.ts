import Phaser from 'phaser';
import { GAME_BACKGROUND, GAME_HEIGHT, GAME_WIDTH } from '../constants';
import { clamp, moveInBounds } from '../systems/movement';

type Keys = Record<'W' | 'A' | 'S' | 'D' | 'SPACE', Phaser.Input.Keyboard.Key>;
interface Shot {
  node: Phaser.GameObjects.Rectangle;
}
interface Target {
  node: Phaser.GameObjects.Rectangle;
  row: number;
}

/**
 * Sandbox temporário T02 para sentir os controles e o tiro.
 * TODOS os retângulos representam telemetria/debug, NÃO arte ou sprites finais.
 * A nave real Rivet e os inimigos com animações estão agendados no roadmap.
 */
export class PrototypeScene extends Phaser.Scene {
  private ship!: Phaser.GameObjects.Container;
  private keyboardControls?: Keys;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private scoreText!: Phaser.GameObjects.Text;
  private shots: Shot[] = [];
  private targets: Target[] = [];
  private shootCooldown = 0;
  private targetWave = 0;
  private score = 0;

  constructor() {
    super({ key: 'PrototypeScene' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(GAME_BACKGROUND);
    this.keyboardControls = this.input.keyboard?.addKeys('W,A,S,D,SPACE') as Keys | undefined;
    this.cursors = this.input.keyboard?.createCursorKeys();

    this.add.text(7, 6, 'BULLET WAKE  •  TESTE DE CONTROLES', {
      fontFamily: 'monospace', fontSize: '9px', color: '#eaf2f5',
    });
    this.scoreText = this.add.text(7, 20, 'SCORE 00000', {
      fontFamily: 'monospace', fontSize: '9px', color: '#61d7da',
    });
    this.add.text(7, GAME_HEIGHT - 10, 'WASD / SETAS: MOVER    ESPACO / TOQUE: ATIRAR', {
      fontFamily: 'monospace', fontSize: '7px', color: '#95b0c3',
    });

    // Marcador provisório de gameplay, feito deliberadamente no renderizador.
    const marker = this.add.graphics();
    marker.fillStyle(0x263447, 1);
    marker.fillRect(-13, -4, 25, 8);
    marker.fillRect(-8, -7, 14, 3);
    marker.fillRect(-8, 4, 14, 3);
    marker.fillStyle(0x61d7da, 1);
    marker.fillRect(12, -2, 8, 4);
    marker.fillStyle(0xeaf2f5, 1);
    marker.fillRect(-17, -2, 4, 4);
    this.ship = this.add.container(64, GAME_HEIGHT / 2, [marker]);

    for (let i = 0; i < 3; i += 1) {
      const node = this.add.rectangle(272 + i * 46, 51 + i * 54, 17, 17, 0xd75e56);
      node.setStrokeStyle(2, 0xf7a96c);
      this.targets.push({ node, row: i });
    }
  }

  update(_time: number, delta: number): void {
    const dt = clamp(delta, 0, 50);
    const key = (name: keyof Keys): boolean => Boolean(this.keyboardControls?.[name].isDown);
    let dx = Number(key('D') || this.cursors?.right.isDown) - Number(key('A') || this.cursors?.left.isDown);
    let dy = Number(key('S') || this.cursors?.down.isDown) - Number(key('W') || this.cursors?.up.isDown);
    const pointer = this.input.activePointer;

    // Prova inicial de toque: arrastar a nave e disparar. Controles mobile finais virão depois.
    if (pointer.isDown) {
      const offsetX = pointer.x - this.ship.x;
      const offsetY = pointer.y - this.ship.y;
      dx = Math.abs(offsetX) > 8 ? Math.sign(offsetX) : 0;
      dy = Math.abs(offsetY) > 8 ? Math.sign(offsetY) : 0;
    }

    const moved = moveInBounds(
      { x: this.ship.x, y: this.ship.y },
      dx, dy, 190, dt,
      { minX: 23, maxX: GAME_WIDTH - 24, minY: 43, maxY: GAME_HEIGHT - 25 },
    );
    this.ship.setPosition(moved.x, moved.y);

    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    if ((key('SPACE') || this.cursors?.space.isDown || pointer.isDown) && this.shootCooldown === 0) {
      this.fire();
      this.shootCooldown = 125;
    }

    // Primeiros alvos de teste: não são inimigos com IA, HP ou ataques da campanha.
    for (const target of this.targets) {
      target.node.x -= 18 * dt / 1000;
      if (target.node.x < -20) this.resetTarget(target);
    }
    for (let i = this.shots.length - 1; i >= 0; i -= 1) {
      const shot = this.shots[i];
      shot.node.x += 300 * dt / 1000;
      let hit = false;
      for (const target of this.targets) {
        if (Math.abs(shot.node.x - target.node.x) < 11 && Math.abs(shot.node.y - target.node.y) < 9) {
          this.score += 100;
          this.scoreText.setText('SCORE ' + String(this.score).padStart(5, '0'));
          this.resetTarget(target);
          hit = true;
          break;
        }
      }
      if (hit || shot.node.x > GAME_WIDTH + 6) {
        shot.node.destroy();
        this.shots.splice(i, 1);
      }
    }
  }

  private fire(): void {
    const node = this.add.rectangle(this.ship.x + 20, this.ship.y, 7, 3, 0x61d7da);
    this.shots.push({ node });
  }

  private resetTarget(target: Target): void {
    this.targetWave += 1;
    target.node.setPosition(GAME_WIDTH + 12 + this.targetWave % 3 * 20, 51 + target.row * 54);
  }
}
