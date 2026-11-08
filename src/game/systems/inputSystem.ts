/**
 * BULLET WAKE — Camada de Entrada Unificada (InputSystem)
 * 
 * Desacopla hardware físico (teclado, mouse, touch, gamepad) em comandos semânticos de gameplay.
 * Regras estritas:
 * 1. No Desktop PC, o clique do mouse (esquerdo ou direito) NUNCA altera moveX, moveY, velocidade ou posição da nave.
 * 2. WASD / Setas são os únicos controles de movimentação no PC.
 * 3. Barra de Espaço e Botão Esquerdo do Mouse acionam o mesmo disparo principal.
 * 4. Pressionar Espaço e Mouse simultaneamente NÃO duplica disparos (ação tratada como única).
 * 5. Botão Direito do Mouse ou tecla SHIFT acionam o disparo carregado (Wave Cannon).
 * 6. Suporte a touch apenas quando o evento for originado por toque em tela móvel (wasTouch).
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
  keyShiftJustUp: boolean;
  keyM: boolean;
  keyMJustDown: boolean;
  keyX: boolean;
  keyXJustDown: boolean;
  keyK: boolean;
  keyKJustDown: boolean;
  keyB: boolean;
  keyBJustDown: boolean;
  keyL: boolean;
  keyLJustDown: boolean;
  keyR: boolean;
  keyRJustDown: boolean;
  keyEsc: boolean;
  keyEscJustDown: boolean;

  // Ponteiro / Mouse / Touch
  pointerActive: boolean;
  pointerDown: boolean;
  pointerLeftDown: boolean;
  pointerLeftJustDown: boolean;
  pointerLeftJustUp: boolean;
  pointerRightDown: boolean;
  pointerRightJustDown: boolean;
  pointerRightJustUp: boolean;
  isTouch: boolean;
  pointerX: number;
  pointerY: number;

  // Coordenadas da nave (usadas exclusivamente em drag no mobile touch)
  shipX: number;
  shipY: number;
}

export interface PlayerActionCommands {
  /** Movimento horizontal normalizado (-1 = esquerda, 0 = neutro, 1 = direita) */
  moveX: number;
  /** Movimento vertical normalizado (-1 = cima, 0 = neutro, 1 = baixo) */
  moveY: number;
  /** Intenção de disparo contínuo (Espaço ou Botão Esquerdo mantido pressionado) */
  firePrimary: boolean;
  /** Intenção de disparo manual por toque rápido (JustDown de Espaço ou Clique Esquerdo) */
  firePrimaryTap: boolean;
  /** Intenção de carga secundária mantida (Shift ou Botão Direito mantido pressionado) */
  chargeHeld: boolean;
  /** Momento exato em que a carga secundária é solta para disparar */
  chargeReleased: boolean;
  /** Disparo de mísseis / arma secundária (M) */
  missile: boolean;
  /** Ativação de habilidade especial de ressonância (X, K) */
  special: boolean;
  /** Lançamento de bomba defensiva (B, L) */
  bomb: boolean;
  /** Reinício da fase (R) */
  restart: boolean;
  /** Pausa ou menu (ESC) */
  menuOrBack: boolean;
}

/**
 * Função pura e determinística que processa entradas brutas e retorna comandos semânticos.
 * Totalmente testável sem depender de instâncias reais do navegador ou Phaser.
 */
export function processInputFrame(input: RawInputFrame): PlayerActionCommands {
  // 1. Movimentação via Teclado (WASD / Setas)
  let moveX = Number(input.keyD || input.arrowRight) - Number(input.keyA || input.arrowLeft);
  let moveY = Number(input.keyS || input.arrowDown) - Number(input.keyW || input.arrowUp);

  // 2. Movimentação Mobile Touch Drag
  // Apenas se o dispositivo/evento for estritamente Touch
  if (input.isTouch && input.pointerDown) {
    const minHudY = 32;
    const maxHudY = 400;
    if (input.pointerY > minHudY && input.pointerY < maxHudY) {
      moveX = Math.abs(input.pointerX - input.shipX) > 12 ? Math.sign(input.pointerX - input.shipX) : 0;
      moveY = Math.abs(input.pointerY - input.shipY) > 12 ? Math.sign(input.pointerY - input.shipY) : 0;
    }
  }

  // REGRA MESTRE PC: Se NÃO for touch, o ponteiro do mouse JAMAIS altera moveX ou moveY.
  // moveX e moveY permanecem 100% controlados pelo teclado.

  // 3. Disparo Principal (Espaço ou Clique Esquerdo)
  // Tratado como intenção única: se ambos estiverem pressionados, o resultado é firePrimary=true (sem duplicação).
  const mouseFireHeld = !input.isTouch && (input.pointerLeftDown || (input.pointerDown && !input.pointerRightDown));
  const mouseFireTap = !input.isTouch && input.pointerLeftJustDown;

  const firePrimary = Boolean(input.keySpace || mouseFireHeld);
  const firePrimaryTap = Boolean(input.keySpaceJustDown || mouseFireTap);

  // 4. Disparo Carregado (Shift ou Botão Direito)
  const mouseChargeHeld = !input.isTouch && input.pointerRightDown;
  const mouseChargeReleased = !input.isTouch && input.pointerRightJustUp;

  const chargeHeld = Boolean(input.keyShift || mouseChargeHeld);
  const chargeReleased = Boolean(input.keyShiftJustUp || mouseChargeReleased);

  // 5. Habilidades e Utilitários
  const missile = Boolean(input.keyMJustDown);
  const special = Boolean(input.keyXJustDown || input.keyKJustDown);
  const bomb = Boolean(input.keyBJustDown || input.keyLJustDown);
  const restart = Boolean(input.keyRJustDown);
  const menuOrBack = Boolean(input.keyEscJustDown);

  return {
    moveX,
    moveY,
    firePrimary,
    firePrimaryTap,
    chargeHeld,
    chargeReleased,
    missile,
    special,
    bomb,
    restart,
    menuOrBack,
  };
}

/**
 * Adaptador de runtime para integração direta com a cena do Phaser.
 */
export class InputManager {
  private readonly scene: Phaser.Scene;
  private prevPointerLeftDown = false;
  private prevPointerRightDown = false;
  private prevShiftDown = false;

  private keys?: Record<
    'W' | 'A' | 'S' | 'D' | 'SPACE' | 'R' | 'ESC' | 'M' | 'X' | 'K' | 'B' | 'L' | 'SHIFT',
    Phaser.Input.Keyboard.Key
  >;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    if (scene.input && scene.input.keyboard) {
      this.keys = scene.input.keyboard.addKeys(
        'W,A,S,D,SPACE,R,ESC,M,X,K,B,L,SHIFT',
      ) as Record<string, Phaser.Input.Keyboard.Key> as Record<
        'W' | 'A' | 'S' | 'D' | 'SPACE' | 'R' | 'ESC' | 'M' | 'X' | 'K' | 'B' | 'L' | 'SHIFT',
        Phaser.Input.Keyboard.Key
      >;
      this.cursors = scene.input.keyboard.createCursorKeys();
    }

    // Desativa menu de contexto do navegador para permitir botão direito como comando de carga
    if (scene.input && scene.input.mouse) {
      scene.input.mouse.disableContextMenu();
    }
  }

  sample(shipX: number, shipY: number): PlayerActionCommands {
    const pointer = this.scene.input.activePointer;
    const isDesktop = this.scene.game.device.os.desktop;
    const isTouch = !isDesktop || Boolean(pointer.wasTouch);

    const pointerLeftDown = pointer.isDown && (pointer.leftButtonDown() || pointer.button === 0);
    const pointerRightDown = pointer.isDown && (pointer.rightButtonDown() || pointer.button === 2);

    const pointerLeftJustDown = pointerLeftDown && !this.prevPointerLeftDown;
    const pointerLeftJustUp = !pointerLeftDown && this.prevPointerLeftDown;

    const pointerRightJustDown = pointerRightDown && !this.prevPointerRightDown;
    const pointerRightJustUp = !pointerRightDown && this.prevPointerRightDown;

    this.prevPointerLeftDown = pointerLeftDown;
    this.prevPointerRightDown = pointerRightDown;

    const shiftDown = Boolean(this.keys?.SHIFT.isDown);
    const shiftJustUp = !shiftDown && this.prevShiftDown;
    this.prevShiftDown = shiftDown;

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
        (this.keys?.SPACE && Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) ||
        (this.cursors?.space && Phaser.Input.Keyboard.JustDown(this.cursors.space)),
      ),

      keyShift: shiftDown,
      keyShiftJustDown: Boolean(this.keys?.SHIFT && Phaser.Input.Keyboard.JustDown(this.keys.SHIFT)),
      keyShiftJustUp: shiftJustUp,

      keyM: Boolean(this.keys?.M.isDown),
      keyMJustDown: Boolean(this.keys?.M && Phaser.Input.Keyboard.JustDown(this.keys.M)),

      keyX: Boolean(this.keys?.X.isDown),
      keyXJustDown: Boolean(this.keys?.X && Phaser.Input.Keyboard.JustDown(this.keys.X)),

      keyK: Boolean(this.keys?.K.isDown),
      keyKJustDown: Boolean(this.keys?.K && Phaser.Input.Keyboard.JustDown(this.keys.K)),

      keyB: Boolean(this.keys?.B.isDown),
      keyBJustDown: Boolean(this.keys?.B && Phaser.Input.Keyboard.JustDown(this.keys.B)),

      keyL: Boolean(this.keys?.L.isDown),
      keyLJustDown: Boolean(this.keys?.L && Phaser.Input.Keyboard.JustDown(this.keys.L)),

      keyR: Boolean(this.keys?.R.isDown),
      keyRJustDown: Boolean(this.keys?.R && Phaser.Input.Keyboard.JustDown(this.keys.R)),

      keyEsc: Boolean(this.keys?.ESC.isDown),
      keyEscJustDown: Boolean(this.keys?.ESC && Phaser.Input.Keyboard.JustDown(this.keys.ESC)),

      pointerActive: pointer.active,
      pointerDown: pointer.isDown,
      pointerLeftDown,
      pointerLeftJustDown,
      pointerLeftJustUp,
      pointerRightDown,
      pointerRightJustDown,
      pointerRightJustUp,
      isTouch,
      pointerX: pointer.x,
      pointerY: pointer.y,
      shipX,
      shipY,
    };

    return processInputFrame(frame);
  }
}
