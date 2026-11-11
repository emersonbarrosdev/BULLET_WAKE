/** Standard browser mapping; no guessed bindings for unmapped controllers. */
export interface PadSnapshot { id: string; mapping: string; axes: readonly number[]; buttons: readonly { pressed: boolean; value: number }[]; }
export function connectedPad(): Gamepad | undefined {
  return Array.from(navigator.getGamepads?.() ?? []).find((p): p is Gamepad => !!p?.connected && p.mapping === 'standard');
}
export function padLabels(id = '') {
  const ps = /playstation|dualsense|dualshock|054c/i.test(id);
  if(/nintendo|switch|057e/i.test(id))return {shoot:'B',special:'Y',dash:'R',charge:'ZL',missile:'X',pause:'+',back:'A'};
  return { shoot: ps ? '✕' : 'A', special: ps ? '□' : 'X', dash: ps ? 'R1' : 'RB',
    charge: ps ? 'L2' : 'LT', missile: ps ? '△' : 'Y', pause: ps ? 'OPTIONS' : 'MENU', back: ps ? '○' : 'B' };
}
export class GamepadReader {
  private previous = new Set<number>();
  private id = '';
  private nav = new Set<string>();
  sample(pad?: PadSnapshot) {
    const connected = !!pad && pad.mapping === 'standard';
    if (!connected) { this.previous.clear(); this.nav.clear(); this.id = ''; }
    if (connected && this.id !== pad.id) { this.previous.clear(); this.id = pad.id; }
    const held = (i: number) => connected && !!(pad.buttons[i]?.pressed || pad.buttons[i]?.value > .5);
    const down = (i: number) => held(i) && !this.previous.has(i);
    let x = connected ? pad.axes[0] || 0 : 0, y = connected ? pad.axes[1] || 0 : 0;
    const length = Math.hypot(x, y);
    const magnitude = Math.min(1, Math.max(0, (length - .2) / .8));
    x = length ? x / length * magnitude : 0; y = length ? y / length * magnitude : 0;
    if (held(14) || held(15) || held(12) || held(13)) { x = Number(held(15)) - Number(held(14)); y = Number(held(13)) - Number(held(12)); }
    const norm = Math.max(1, Math.hypot(x, y));
    const nav=new Set<string>();if(x<-.55)nav.add('left');if(x>.55)nav.add('right');if(y<-.55)nav.add('up');if(y>.55)nav.add('down');
    const result = { connected, moveX: x / norm, moveY: y / norm, firePrimary: held(0), firePrimaryTap: down(0),
      special: down(2), dashTrigger: false, chargeHeld: false, chargeReleased: false,
      profile: down(3), missile: false, menuOrBack: down(9), confirm: down(0), back: down(1),
      left: nav.has('left')&&!this.nav.has('left'), right: nav.has('right')&&!this.nav.has('right'),
      up: nav.has('up')&&!this.nav.has('up'), down: nav.has('down')&&!this.nav.has('down') };
    this.nav=nav;
    this.previous = new Set(Array.from({length: 17}, (_, i) => i).filter(held));
    return result;
  }
}
