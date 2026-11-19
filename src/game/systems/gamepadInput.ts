/** Standard browser mapping; no guessed bindings for unmapped controllers. */
export interface PadSnapshot {
  id: string;
  mapping: string;
  axes: readonly number[];
  buttons: readonly { pressed: boolean; value: number }[];
}

export type LogicalAction = 'FIRE' | 'CHARGE' | 'SPECIAL' | 'CONFIRM' | 'CANCEL' | 'PAUSE' | 'MOVE';
export type PadProfile = 'playstation' | 'xbox' | 'nintendo';

/** W3C Standard Gamepad button indices. */
export const STANDARD_GAMEPAD_BUTTON = {
  SPECIAL_FACE: 0, // PS: × (Xis)    | Xbox: A -> gameplay SPECIAL, menu CONFIRM / SELECT
  CIRCLE: 1,       // PS: ○ (Círculo)| Xbox: B -> gameplay FIRE, menu CANCEL / BACK
  CHARGE: 2,       // PS: □ (Quad.)  | Xbox: X -> gameplay CHARGE (tiro carregado)
  NORTH: 3,        // PS: △ (Triân.) | Xbox: Y -> reserved in combat / pilot profile preview
  L1: 4,           // PS: L1         | Xbox: LB -> gameplay FOCUS (movimento preciso)
  R1: 5,           // PS: R1         | Xbox: RB -> gameplay FIRE alternative
  L2: 6,
  R2: 7,           // PS: R2         | Xbox: RT -> gameplay SPECIAL alternative
  PAUSE: 9,        // PS: OPTIONS    | Xbox: START / MENU
  DPAD_UP: 12,
  DPAD_DOWN: 13,
  DPAD_LEFT: 14,
  DPAD_RIGHT: 15,
} as const;

export const TRIGGER_PRESS_THRESHOLD = 0.45;
export const STICK_DEADZONE = 0.2;

export function connectedPad(): Gamepad | undefined {
  return Array.from(navigator.getGamepads?.() ?? []).find((p): p is Gamepad => !!p?.connected && p.mapping === 'standard');
}

export function detectPadProfile(id = ''): PadProfile {
  if (/nintendo|switch|057e/i.test(id)) return 'nintendo';
  if (/xbox|xinput|045e/i.test(id)) return 'xbox';
  return /playstation|dualsense|dualshock|wireless controller|054c/i.test(id) ? 'playstation' : 'xbox';
}

export function padLabels(id = '') {
  const profile = detectPadProfile(id);
  if (profile === 'nintendo') {
    return {
      profile,
      shoot: 'A / R',
      charge: 'Y',
      special: 'B / ZR',
      confirm: 'A',
      cancel: 'B',
      back: 'B',
      pause: '+',
      dash: 'L',
      focus: 'L',
      missile: 'X',
    };
  }
  if (profile === 'playstation') {
    return {
      profile,
      shoot: '○ / R1',
      charge: '□',
      special: '× / R2',
      confirm: '×',
      cancel: '○',
      back: '○',
      pause: 'OPTIONS',
      dash: 'L1',
      focus: 'L1',
      missile: '△',
    };
  }
  return {
    profile,
    shoot: 'B / RB',
    charge: 'X',
    special: 'A / RT',
    confirm: 'A',
    cancel: 'B',
    back: 'B',
    pause: 'START',
    dash: 'LB',
    focus: 'LB',
    missile: 'Y',
  };
}

export interface GamepadInputState {
  connected: boolean;
  padProfile: PadProfile;
  moveX: number;
  moveY: number;
  firePrimary: boolean;
  firePrimaryTap: boolean;
  chargeHeld: boolean;
  chargeJustDown: boolean;
  chargeReleased: boolean;
  special: boolean;
  specialHeld: boolean;
  focusHeld: boolean;
  dashTrigger: false;
  /** Preserved property name used by PilotSelectScene tests (`action.profile`). */
  profile: boolean;
  missile: false;
  pause: boolean;
  menuOrBack: boolean;
  confirm: boolean;
  cancel: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
}

export class GamepadReader {
  private previousButtons = new Set<number>();
  private prevFireHeld = false;
  private prevChargeHeld = false;
  private prevSpecialHeld = false;
  private id = '';
  private nav = new Set<string>();

  sample(pad?: PadSnapshot): GamepadInputState {
    const connected = !!pad && pad.mapping === 'standard';
    if (!connected || this.id !== pad.id) {
      this.previousButtons.clear();
      this.prevFireHeld = false;
      this.prevChargeHeld = false;
      this.prevSpecialHeld = false;
      this.nav.clear();
      this.id = connected ? pad.id : '';
    }

    const buttonHeld = (i: number, threshold = 0.5) => {
      if (!connected) return false;
      const b = pad.buttons[i];
      if (!b) return false;
      return Boolean(b.pressed || b.value >= threshold);
    };
    const triggerHeld = (i: number) => buttonHeld(i, TRIGGER_PRESS_THRESHOLD);
    const buttonDown = (i: number) => buttonHeld(i) && !this.previousButtons.has(i);

    let x = connected ? (pad.axes[0] ?? 0) : 0;
    let y = connected ? (pad.axes[1] ?? 0) : 0;
    const length = Math.hypot(x, y);
    const magnitude = length > STICK_DEADZONE ? Math.min(1, Math.max(0, (length - STICK_DEADZONE) / (1 - STICK_DEADZONE))) : 0;
    x = length > 0 ? (x / length) * magnitude : 0;
    y = length > 0 ? (y / length) * magnitude : 0;

    if (
      buttonHeld(STANDARD_GAMEPAD_BUTTON.DPAD_LEFT) ||
      buttonHeld(STANDARD_GAMEPAD_BUTTON.DPAD_RIGHT) ||
      buttonHeld(STANDARD_GAMEPAD_BUTTON.DPAD_UP) ||
      buttonHeld(STANDARD_GAMEPAD_BUTTON.DPAD_DOWN)
    ) {
      x = Number(buttonHeld(STANDARD_GAMEPAD_BUTTON.DPAD_RIGHT)) - Number(buttonHeld(STANDARD_GAMEPAD_BUTTON.DPAD_LEFT));
      y = Number(buttonHeld(STANDARD_GAMEPAD_BUTTON.DPAD_DOWN)) - Number(buttonHeld(STANDARD_GAMEPAD_BUTTON.DPAD_UP));
    }

    const norm = Math.max(1, Math.hypot(x, y));
    const moveX = x / norm;
    const moveY = y / norm;

    const nav = new Set<string>();
    if (moveX < -0.55) nav.add('left');
    if (moveX > 0.55) nav.add('right');
    if (moveY < -0.55) nav.add('up');
    if (moveY > 0.55) nav.add('down');

    // Logical FIRE (○ or R1 | Xbox B or RB): identical rapid/continuous fire without cadence doubling
    const firePrimary = buttonHeld(STANDARD_GAMEPAD_BUTTON.CIRCLE) || buttonHeld(STANDARD_GAMEPAD_BUTTON.R1);
    const firePrimaryTap = firePrimary && !this.prevFireHeld;
    this.prevFireHeld = firePrimary;

    // Logical CHARGE (□ | Xbox X): hold to accumulate, release to unleash charged shot
    const chargeHeld = buttonHeld(STANDARD_GAMEPAD_BUTTON.CHARGE);
    const chargeJustDown = chargeHeld && !this.prevChargeHeld;
    const chargeReleased = !chargeHeld && this.prevChargeHeld;
    this.prevChargeHeld = chargeHeld;

    // Logical SPECIAL (× or analog R2 | Xbox A or RT): single edge until BOTH are released
    const specialHeld = buttonHeld(STANDARD_GAMEPAD_BUTTON.SPECIAL_FACE) || triggerHeld(STANDARD_GAMEPAD_BUTTON.R2);
    const special = specialHeld && !this.prevSpecialHeld;
    this.prevSpecialHeld = specialHeld;

    // Logical MENU actions (Western PS/Xbox standard): ×/A (0) = confirm, ○/B (1) = cancel/back, Options/Start (9) = pause
    const confirm = buttonDown(STANDARD_GAMEPAD_BUTTON.SPECIAL_FACE);
    const cancel = buttonDown(STANDARD_GAMEPAD_BUTTON.CIRCLE);
    const pause = buttonDown(STANDARD_GAMEPAD_BUTTON.PAUSE);
    const northTap = buttonDown(STANDARD_GAMEPAD_BUTTON.NORTH);
    const focusHeld = buttonHeld(STANDARD_GAMEPAD_BUTTON.L1);

    const prevNav = this.nav;
    this.nav = nav;
    const nextPrev = new Set<number>();
    if (connected) {
      const len = Math.max(17, pad.buttons.length);
      for (let i = 0; i < len; i++) {
        const thresh = i === STANDARD_GAMEPAD_BUTTON.R2 || i === STANDARD_GAMEPAD_BUTTON.L2 ? TRIGGER_PRESS_THRESHOLD : 0.5;
        if (buttonHeld(i, thresh)) nextPrev.add(i);
      }
    }
    this.previousButtons = nextPrev;

    return {
      connected,
      padProfile: detectPadProfile(this.id),
      moveX,
      moveY,
      firePrimary,
      firePrimaryTap,
      chargeHeld,
      chargeJustDown,
      chargeReleased,
      special,
      specialHeld,
      focusHeld,
      dashTrigger: false as const,
      profile: northTap,
      missile: false as const,
      pause,
      menuOrBack: pause,
      confirm,
      cancel,
      back: cancel,
      left: nav.has('left') && !prevNav.has('left'),
      right: nav.has('right') && !prevNav.has('right'),
      up: nav.has('up') && !prevNav.has('up'),
      down: nav.has('down') && !prevNav.has('down'),
    };
  }
}
