/**
 * BULLET WAKE V2 — Camada de Entrada Unificada (InputSystem)
 * 
 * Desacopla hardware físico (teclado, mouse, touch, gamepad) em comandos semânticos de gameplay.
 * Diretrizes Canônicas V2:
 * 1. MOUSE NÃO ATIRA NO PC. Cliques esquerdo/direito e cursor do mouse são 100% ignorados no gameplay.
 * 2. WASD / Setas são os únicos comandos de movimentação no PC (diagonais normalizadas).
 * 3. ESPAÇO: Disparo principal (contínuo segurando, manual tapando).
 * 4. SHIFT Esquerdo: Dash / Propulsão de emergência (exatamente 3 por fase).
 * 5. C: Carregar arma (quando aplicável).
 * 6. X: Bomba defensiva.
 * 7. V: Especial de ressonância do piloto.
 * 8. ESC: Pausa / Menu.
 * 9. O mouse é permitido EXCLUSIVAMENTE para navegação em menus e interfaces.
 */

export interface RawInputFrame {
  // Teclas de Movimentação (WASD / Setas)
  keyW: boolean;
  keyA: boolean;
  keyS: boolean;
  keyD: boolean;
  arrowUp: boolean;
  arrowDown: boolean;
  arrowLeft: boolean;
  arrowRight: boolean;

  // Teclas de Ação
  keySpace: boolean;
  keySpaceJustDown: boolean;
  keyShift: boolean;
  keyShiftJustDown: boolean;
  keyC: boolean;
  keyCJustDown: boolean;
  keyCJustUp: boolean;
  keyX: boolean;
  keyXJustDown: boolean;
  keyV: boolean;
  keyVJustDown: boolean;
  keyM: boolean;
  keyMJustDown: boolean;
  keyB: boolean;
  keyBJustDown: boolean;
  keyR: boolean;
  keyRJustDown: boolean;
  keyEsc: boolean;
  keyEscJustDown: boolean;

  // Touch móvel (wasTouch estritamente verdadeiro no mobile)
  isTouch: boolean;
  touchPointerDown: boolean;
  touchX: number;
  touchY: number;

  // Coordenadas da nave
  shipX: number;
  shipY: number;
}

export interface PlayerActionCommands {
  /** Movimento horizontal normalizado (-1 = esquerda, 0 = neutro, 1 = direita) */
  moveX: number;
  /** Movimento vertical normalizado (-1 = cima, 0 = neutro, 1 = baixo) */
  moveY: number;
  /** Disparo contínuo (Espaço mantido pressionado) */
  firePrimary: boolean;
  /** Toque de disparo manual (Espaço JustDown) */
  firePrimaryTap: boolean;
  /** Acionamento de Dash / Propulsão de Emergência (Shift JustDown) */
  dashTrigger: boolean;
  /** Carga de arma mantida (C mantido) */
  chargeHeld: boolean;
  /** Momento em que a carga é liberada (C solto) */
  chargeReleased: boolean;
  /** Lançamento de bomba (X) */
  bomb: boolean;
  /** Ativação do especial de ressonância do piloto (V) */
  special: boolean;
  /** Disparo de mísseis secundários (M) */
  missile: boolean;
  /** Reinício da fase (R) */
  restart: boolean;
  /** Pausa ou retorno ao menu (ESC) */
  menuOrBack: boolean;
}

/**
 * Função pura e determinística que processa entradas brutas e retorna comandos semânticos.
 * Totalmente testável e livre de dependências de DOM/Phaser.
 */
export function processInputFrame(input: RawInputFrame): PlayerActionCommands {
  // 1. Movimentação via Teclado (WASD / Setas)
  let rawMoveX = Number(input.keyD || input.arrowRight) - Number(input.keyA || input.arrowLeft);
  let rawMoveY = Number(input.keyS || input.arrowDown) - Number(input.keyW || input.arrowUp);

  // 2. Normalização estrita de diagonal para velocidade constante
  let moveX = rawMoveX;
  let moveY = rawMoveY;
  if (rawMoveX !== 0 && rawMoveY !== 0) {
    const factor = Math.SQRT1_2; // 1 / sqrt(2) ≈ 0.7071
    moveX = rawMoveX * factor;
    moveY = rawMoveY * factor;
  }

  // 3. Suporte Touch no Mobile (apenas se for estritamente evento Touch)
  if (input.isTouch && input.touchPointerDown) {
    const minArenaY = 16;
    const maxArenaY = 416;
    if (input.touchY > minArenaY && input.touchY < maxArenaY) {
      const dx = input.touchX - input.shipX;
      const dy = input.touchY - input.shipY;
      const dist = Math.hypot(dx, dy);
      if (dist > 8) {
        moveX = dx / dist;
        moveY = dy / dist;
      }
    }
  }

  // REGRA MESTRE: No Desktop PC, o mouse NUNCA gera moveX, moveY, nem dispara armas.

  // 4. Disparo Principal: estritamente ESPAÇO no PC
  const firePrimary = Boolean(input.keySpace || (input.isTouch && input.touchPointerDown));
  const firePrimaryTap = Boolean(input.keySpaceJustDown);

  // 5. Dash / Propulsão de Emergência: SHIFT
  const dashTrigger = Boolean(input.keyShiftJustDown);

  // 6. Carga de Arma: Tecla C
  const chargeHeld = Boolean(input.keyC);
  const chargeReleased = Boolean(input.keyCJustUp);

  // 7. Bomba (X ou B) e Especial (V)
  const bomb = Boolean(input.keyXJustDown || input.keyBJustDown);
  const special = Boolean(input.keyVJustDown);

  // 8. Secundário / Mísseis (M)
  const missile = Boolean(input.keyMJustDown);

  // 9. Reinício (R) e Pausa (ESC)
  const restart = Boolean(input.keyRJustDown);
  const menuOrBack = Boolean(input.keyEscJustDown);

  return {
    moveX,
    moveY,
    firePrimary,
    firePrimaryTap,
    dashTrigger,
    chargeHeld,
    chargeReleased,
    bomb,
    special,
    missile,
    restart,
    menuOrBack,
  };
}

/**
 * Helper seguro para verificar ativação instantânea de tecla (JustDown)
 * compatível com Phaser no browser e testável em ambiente Node.js.
 */
function isKeyJustDown(key?: unknown): boolean {
  if (!key || typeof key !== 'object') return false;
  const anyKey = key as { _justDown?: boolean };
  if (anyKey._justDown) {
    anyKey._justDown = false;
    return true;
  }
  return false;
}

/**
 * Adaptador de runtime para integração direta com a cena do Phaser.
 */
export class InputManager {
  private readonly scene: Phaser.Scene;
  private prevCDown = false;

  private keys?: Record<
    'W' | 'A' | 'S' | 'D' | 'SPACE' | 'SHIFT' | 'C' | 'X' | 'V' | 'M' | 'B' | 'R' | 'ESC',
    Phaser.Input.Keyboard.Key
  >;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    if (scene.input && scene.input.keyboard) {
      this.keys = scene.input.keyboard.addKeys(
        'W,A,S,D,SPACE,SHIFT,C,X,V,M,B,R,ESC',
      ) as Record<string, Phaser.Input.Keyboard.Key> as Record<
        'W' | 'A' | 'S' | 'D' | 'SPACE' | 'SHIFT' | 'C' | 'X' | 'V' | 'M' | 'B' | 'R' | 'ESC',
        Phaser.Input.Keyboard.Key
      >;
      this.cursors = scene.input.keyboard.createCursorKeys();
    }

    if (scene.input && scene.input.mouse) {
      scene.input.mouse.disableContextMenu();
    }
  }

  sample(shipX: number, shipY: number): PlayerActionCommands {
    const pointer = this.scene.input.activePointer;
    const isDesktop = this.scene.game.device.os.desktop;
    const isTouch = !isDesktop && Boolean(pointer.wasTouch);

    const cDown = Boolean(this.keys?.C.isDown);
    const cJustUp = !cDown && this.prevCDown;
    this.prevCDown = cDown;

    const frame: RawInputFrame = {
      keyW: Boolean(this.keys?.W.isDown),
      keyA: Boolean(this.keys?.A.isDown),
      keyS: Boolean(this.keys?.S.isDown),
      keyD: Boolean(this.keys?.D.isDown),
      arrowUp: Boolean(this.cursors?.up.isDown),
      arrowDown: Boolean(this.cursors?.down.isDown),
      arrowLeft: Boolean(this.cursors?.left.isDown),
      arrowRight: Boolean(this.cursors?.right.isDown),

      keySpace: Boolean(this.keys?.SPACE.isDown || this.cursors?.space.isDown),
      keySpaceJustDown: Boolean(
        isKeyJustDown(this.keys?.SPACE) ||
        isKeyJustDown(this.cursors?.space),
      ),

      keyShift: Boolean(this.keys?.SHIFT.isDown),
      keyShiftJustDown: isKeyJustDown(this.keys?.SHIFT),

      keyC: cDown,
      keyCJustDown: isKeyJustDown(this.keys?.C),
      keyCJustUp: cJustUp,

      keyX: Boolean(this.keys?.X.isDown),
      keyXJustDown: isKeyJustDown(this.keys?.X),

      keyV: Boolean(this.keys?.V.isDown),
      keyVJustDown: isKeyJustDown(this.keys?.V),

      keyM: Boolean(this.keys?.M.isDown),
      keyMJustDown: isKeyJustDown(this.keys?.M),

      keyB: Boolean(this.keys?.B.isDown),
      keyBJustDown: isKeyJustDown(this.keys?.B),

      keyR: Boolean(this.keys?.R.isDown),
      keyRJustDown: isKeyJustDown(this.keys?.R),

      keyEsc: Boolean(this.keys?.ESC.isDown),
      keyEscJustDown: isKeyJustDown(this.keys?.ESC),

      isTouch,
      touchPointerDown: pointer.isDown && isTouch,
      touchX: pointer.x,
      touchY: pointer.y,
      shipX,
      shipY,
    };

    return processInputFrame(frame);
  }
}
