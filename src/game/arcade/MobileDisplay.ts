export type MobileOrientation = 'portrait' | 'landscape';

declare global {
  interface Window {
    BulletWakeAndroid?: {
      isControllerConnected(): boolean;
      setOrientation(orientation: MobileOrientation): boolean;
      menuFeedback?(): void;
      vibrate?(ms: number, amplitude?: number): void;
    };
  }
}

export function isMobileDisplay(): boolean {
  return !!window.BulletWakeAndroid || matchMedia('(pointer: coarse)').matches ||
    (navigator.maxTouchPoints > 0 && Math.min(innerWidth, innerHeight) <= 900);
}

/** 14% larger than the former 384-unit portrait field; fit the actual safe-area host. */
export function mobilePortraitViewport(width: number, height: number, arena?: { left: number; right: number; bottom: number }) {
  const w = Math.max(336, arena ? arena.right - arena.left : 0);
  const h = Math.max(w * Math.max(1, height) / Math.max(1, width), arena ? arena.bottom + 14 : 0);
  return { w, h, cx: arena ? (arena.left + arena.right) / 2 : w / 2 };
}

/** A camera fit, never a stretched canvas. The current sortie keeps its simulation/replay geometry. */
export function mobileLandscapeViewport(width: number, height: number, arena: { left: number; right: number; top: number; bottom: number }, up: boolean) {
  const sidebar = Math.min(184, Math.max(136, width * .22));
  const h = up ? arena.bottom + 14 : 432;
  const w = Math.max(arena.right - arena.left + 24, h * Math.max(1, width - sidebar) / Math.max(1, height));
  return { sidebar, fraction: sidebar / width, w, h, cx: (arena.left + arena.right) / 2, cy: h / 2 };
}

/** Native input-device presence includes USB/Bluetooth pads before their first browser button event. */
export class MobileDisplay {
  connected = false;
  private lastCheck = -Infinity;
  private announced = false;
  private nativeConnected = false;
  poll(now: number, browserConnected: boolean, ready: boolean): 'connected' | 'disconnected' | undefined {
    if (now - this.lastCheck >= .35) {
      this.lastCheck = now;
      this.nativeConnected = !!window.BulletWakeAndroid?.isControllerConnected();
    }
    this.connected = browserConnected || this.nativeConnected;
    if (!ready || this.connected === this.announced) return;
    this.announced = this.connected;
    return this.connected ? 'connected' : 'disconnected';
  }
  async orient(mode: MobileOrientation): Promise<boolean> {
    if (mode === 'landscape' && !this.connected) return false;
    if (window.BulletWakeAndroid) return window.BulletWakeAndroid.setOrientation(mode);
    // Browser builds can rotate manually if their browser does not permit orientation locking.
    const orientation = screen.orientation as ScreenOrientation & { lock?: (value: string) => Promise<void> };
    try { await orientation?.lock?.(mode); } catch { /* Native APK has its own orientation bridge. */ }
    return true;
  }
}
