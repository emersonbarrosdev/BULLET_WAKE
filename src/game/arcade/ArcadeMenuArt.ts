import Phaser from 'phaser';
import bayekHudHdUrl from '../../../scripts/assets/hud-v27/bayek-portrait-hd.jpg?url';

export const UI_FONT = 'Oxanium, Arial, sans-serif';

export const UI = {
    ink: 0x061938,
    navy: 0x0a254f,
    cobalt: 0x164180,
    cobaltHex: '#16385b',
    cyan: 0x4ce6ff,
    cyanHex: '#4ce6ff',
    gold: 0xffdf5a,
    goldHex: '#ffdf5a',
    white: '#f4faff',
    silver: '#bcdfff',
    slate: '#8eb2da',
    crimson: 0xff5268,
    crimsonHex: '#ff6b7a',
} as const;

export const UI_TEX = {
    skyPanorama: 'ui-sky-panorama',
    logo: 'ui-logo',
    routePelagic: 'ui-route-pelagic',
    hudRoutePelagic: 'ui-hud-route-pelagic',
    hudPelagicSky: 'ui-hud-pelagic-sky',
    hudBayekHd: 'ui-hud-bayek-hd',
    hudPelagicChassis: 'ui-hud-pelagic-chassis',
    rivetProfile: 'ui-rivet-profile',
    rivetCruise: 'ui-rivet-cruise',
    wingmenAnim: 'ui-wingmen-anim',
    menuHeliSide: 'ui-menu-heli-side',
    menuHeliPatrolSide: 'ui-menu-heli-patrol-side',
    padDualSense: 'ui-pad-dualsense',
    padXbox: 'ui-pad-xbox',
    mobileLandscape: 'ui-mobile-landscape',
    vfx: 'ui-vfx',
    panelCobalt: 'ui-panel-cobalt',
    panelGold: 'ui-panel-gold',
    btnIdle: 'ui-btn-idle',
    btnFocus: 'ui-btn-focus',
    ribbonGold: 'ui-ribbon-gold',
    ribbonRed: 'ui-ribbon-red',
    gaugeTray: 'ui-gauge-tray',
    pips: 'ui-pips',
    icons: 'ui-icons',
    glow: 'ui-tex-glow',
    flare: 'ui-tex-flare',
    confetti: 'ui-tex-confetti',
    scanline: 'ui-tex-scanline',
} as const;

export const UI_ICON = {
    gamepad: 0,
    keyWhite: 1,
    keyGold: 2,
    keySpace: 3,
    padlock: 4,
    warning: 5,
    crown: 6,
    lightning: 7,
    coin0: 8,
    coin1: 9,
    coin2: 10,
    coin3: 11,
    music: 12,
    speaker: 13,
    botan: 14,
    radar: 15,
} as const;

export const UI_PIP = { cyan: 0, gold: 1, off: 2, green: 3 } as const;

export function preloadMenuAssets(scene: Phaser.Scene, base: string): void {
    const p = `${base}assets/arcade/ui/`;
    scene.load.image(UI_TEX.skyPanorama, `${p}sky-panorama.webp`);
    scene.load.image(UI_TEX.logo, `${p}logo-arcade.webp`);
    scene.load.image(UI_TEX.routePelagic, `${p}route-pelagic.webp`);
    scene.load.image(UI_TEX.hudRoutePelagic, `${p}hud-route-pelagic.webp`);
    scene.load.image(UI_TEX.hudPelagicSky, `${p}hud-pelagic-sky.webp`);
    scene.load.image(UI_TEX.hudBayekHd, bayekHudHdUrl);
    scene.load.image(UI_TEX.hudPelagicChassis, `${p}hud-pelagic-chassis.webp`);
    scene.load.image(UI_TEX.rivetProfile, `${p}rivet-profile.webp`);
    scene.load.spritesheet(UI_TEX.rivetCruise, `${p}rivet-cruise.webp`, { frameWidth: 256, frameHeight: 256 });
    scene.load.spritesheet(UI_TEX.wingmenAnim, `${p}wingmen-anim.webp`, { frameWidth: 256, frameHeight: 256 });
    scene.load.spritesheet(UI_TEX.menuHeliSide, `${p}menu-heli-side.webp`, { frameWidth: 256, frameHeight: 256 });
    scene.load.spritesheet(UI_TEX.menuHeliPatrolSide, `${p}menu-heli-patrol-side.webp`, { frameWidth: 256, frameHeight: 256 });
    scene.load.image(UI_TEX.padDualSense, `${p}pad-dualsense.webp`);
    scene.load.image(UI_TEX.padXbox, `${p}pad-xbox.webp`);
    scene.load.image(UI_TEX.mobileLandscape, `${p}mobile-landscape.webp`);
    scene.load.spritesheet(UI_TEX.vfx, `${p}vfx-sheet.webp`, { frameWidth: 256, frameHeight: 256 });
    scene.load.image(UI_TEX.panelCobalt, `${p}panel-cobalt.webp`);
    scene.load.image(UI_TEX.panelGold, `${p}panel-gold.webp`);
    scene.load.image(UI_TEX.btnIdle, `${p}btn-idle.webp`);
    scene.load.image(UI_TEX.btnFocus, `${p}btn-focus.webp`);
    scene.load.image(UI_TEX.ribbonGold, `${p}ribbon-gold.webp`);
    scene.load.image(UI_TEX.ribbonRed, `${p}ribbon-red.webp`);
    scene.load.image(UI_TEX.gaugeTray, `${p}gauge-tray.webp`);
    scene.load.spritesheet(UI_TEX.pips, `${p}pips.webp`, { frameWidth: 64, frameHeight: 64 });
    scene.load.spritesheet(UI_TEX.icons, `${p}icons.webp`, { frameWidth: 256, frameHeight: 256 });
}

export function installMenuTextures(scene: Phaser.Scene): void {
    const tx = scene.textures;
    if (!tx.exists(UI_TEX.glow)) {
        const ct = tx.createCanvas(UI_TEX.glow, 128, 128); if (ct) {
            const c = ct.getContext();
            const g = c.createRadialGradient(64, 64, 4, 64, 64, 62);
            g.addColorStop(0, 'rgba(255,255,255,1)');
            g.addColorStop(.35, 'rgba(120,235,255,0.55)');
            g.addColorStop(1, 'rgba(76,230,255,0)');
            c.fillStyle = g; c.fillRect(0, 0, 128, 128); ct.refresh();
        }
    }
    if (!tx.exists(UI_TEX.flare)) {
        const ct = tx.createCanvas(UI_TEX.flare, 192, 192); if (ct) {
            const c = ct.getContext();
            const g = c.createRadialGradient(96, 96, 6, 96, 96, 94);
            g.addColorStop(0, 'rgba(255,252,224,0.85)');
            g.addColorStop(.35, 'rgba(255,220,120,0.42)');
            g.addColorStop(.72, 'rgba(90,215,255,0.14)');
            g.addColorStop(1, 'rgba(90,215,255,0)');
            c.fillStyle = g; c.fillRect(0, 0, 192, 192); ct.refresh();
        }
    }
    if (!tx.exists(UI_TEX.confetti)) {
        const ct = tx.createCanvas(UI_TEX.confetti, 14, 10); if (ct) {
            const c = ct.getContext(); c.fillStyle = '#ffffff'; c.fillRect(1, 1, 12, 8); ct.refresh();
        }
    }
    if (!tx.exists(UI_TEX.scanline)) {
        const ct = tx.createCanvas(UI_TEX.scanline, 4, 4); if (ct) {
            const c = ct.getContext();
            c.fillStyle = 'rgba(4,16,42,0.55)'; c.fillRect(0, 0, 4, 2);
            c.fillStyle = 'rgba(8,32,74,0.32)'; c.fillRect(0, 2, 4, 2);
            ct.refresh();
        }
    }
}

export function installMenuAnims(scene: Phaser.Scene): void {
    installMenuTextures(scene);
    const mk = (key: string, tex: string, frames: number[], frameRate: number, repeat = -1) => {
        if (scene.anims.exists(key) || !scene.textures.exists(tex)) return;
        scene.anims.create({ key, frames: scene.anims.generateFrameNumbers(tex, { frames }), frameRate, repeat });
    };
    mk('ui-afterburner', UI_TEX.vfx, [0, 1, 2, 3], 11, -1);
    mk('ui-shockwave', UI_TEX.vfx, [4, 5, 6, 7], 11, 0);
    mk('ui-sparkle', UI_TEX.vfx, [8, 9, 10, 11], 9, -1);
    mk('ui-streak', UI_TEX.vfx, [12, 13, 14, 15], 22, -1);
    mk('ui-rivet-cruise', UI_TEX.rivetCruise, [0, 1, 2, 3], 12, -1);
    mk('ui-wingman-0', UI_TEX.wingmenAnim, [0, 1, 2, 3], 16, -1);
    mk('ui-wingman-1', UI_TEX.wingmenAnim, [4, 5, 6, 7], 16, -1);
    mk('ui-wingman-2', UI_TEX.wingmenAnim, [8, 9, 10, 11], 16, -1);
    mk('ui-wingman-3', UI_TEX.wingmenAnim, [12, 13, 14, 15], 16, -1);
    mk('ui-menu-heli-side', UI_TEX.menuHeliSide, [0, 1, 2, 3], 16, -1);
    mk('ui-menu-heli-patrol-side', UI_TEX.menuHeliPatrolSide, [0, 1, 2, 3], 16, -1);
    mk('ui-coin-spin', UI_TEX.icons, [8, 9, 10, 11], 7, -1);
}

export function makePanel(
    scene: Phaser.Scene,
    cx: number,
    cy: number,
    w: number,
    h: number,
    kind: 'cobalt' | 'gold' = 'cobalt',
    container?: Phaser.GameObjects.Container,
): Phaser.GameObjects.NineSlice {
    const key = kind === 'gold' ? UI_TEX.panelGold : UI_TEX.panelCobalt;
    const scale = 0.5;
    const uw = Math.max(132, w / scale), uh = Math.max(132, h / scale);
    const ns = scene.add.nineslice(cx, cy, key, undefined, uw, uh, 64, 64, 64, 64).setScale(scale);
    container?.add(ns);
    return ns;
}

export function makeRibbon(
    scene: Phaser.Scene,
    cx: number,
    cy: number,
    w: number,
    h: number,
    kind: 'gold' | 'red' = 'gold',
    container?: Phaser.GameObjects.Container,
): Phaser.GameObjects.NineSlice {
    const key = kind === 'red' ? UI_TEX.ribbonRed : UI_TEX.ribbonGold;
    const scale = Math.max(0.22, h / 96);
    const uw = Math.max(176, w / scale);
    const ns = scene.add.nineslice(cx, cy, key, undefined, uw, 96, 84, 84, 28, 28).setScale(scale);
    container?.add(ns);
    return ns;
}

export interface SpriteButton {
    idle: Phaser.GameObjects.NineSlice;
    focus: Phaser.GameObjects.NineSlice;
    primary?: boolean;
    setFocused: (focused: boolean) => void;
}

export function makeButtonBg(
    scene: Phaser.Scene,
    cx: number,
    cy: number,
    w: number,
    h = 40,
    container?: Phaser.GameObjects.Container,
    primary = false,
): SpriteButton {
    const scale = Math.max(0.28, h / 96);
    const uw = Math.max(176, w / scale);
    const idle = scene.add.nineslice(cx, cy, UI_TEX.btnIdle, undefined, uw, 96, 84, 84, 26, 26).setScale(scale).setVisible(!primary);
    const focus = scene.add.nineslice(cx, cy, UI_TEX.btnFocus, undefined, uw, 96, 84, 84, 26, 26).setScale(scale).setVisible(primary);
    container?.add(idle); container?.add(focus);
    return {
        idle,
        focus,
        primary,
        setFocused(f: boolean) {
            if (primary) {
                idle.setVisible(false);
                focus.setVisible(true);
                focus.setScale(f ? scale * 1.035 : scale);
                return;
            }
            idle.setVisible(!f);
            focus.setVisible(f);
        },
    };
}

export interface PipMeter {
    tray: Phaser.GameObjects.NineSlice;
    pips: Phaser.GameObjects.Sprite[];
    setValue: (filled: number) => void;
}

export function makeGaugeMeter(
    scene: Phaser.Scene,
    cx: number,
    cy: number,
    w: number,
    h: number,
    total: number,
    filled: number,
    pipFrame: number = UI_PIP.cyan,
    container?: Phaser.GameObjects.Container,
): PipMeter {
    const scale = Math.max(0.24, h / 96);
    const uw = Math.max(136, w / scale);
    const tray = scene.add.nineslice(cx, cy, UI_TEX.gaugeTray, undefined, uw, 96, 64, 64, 24, 24).setScale(scale);
    container?.add(tray);
    const innerW = w - 20;
    const step = innerW / Math.max(1, total);
    const pipSize = Math.min(h - 5, step * 0.92);
    const pips: Phaser.GameObjects.Sprite[] = [];
    for (let i = 0; i < total; i++) {
        const px = cx - innerW / 2 + step * (i + 0.5);
        const spr = scene.add.sprite(px, cy, UI_TEX.pips, i < filled ? pipFrame : UI_PIP.off).setDisplaySize(pipSize, pipSize * 1.08);
        container?.add(spr); pips.push(spr);
    }
    return {
        tray,
        pips,
        setValue(v: number) {
            const n = Math.max(0, Math.min(total, Math.round(v)));
            for (let i = 0; i < total; i++)pips[i].setFrame(i < n ? pipFrame : UI_PIP.off);
        },
    };
}

export function makeIcon(
    scene: Phaser.Scene,
    cx: number,
    cy: number,
    frame: number,
    size: number,
    container?: Phaser.GameObjects.Container,
): Phaser.GameObjects.Sprite {
    const s = scene.add.sprite(cx, cy, UI_TEX.icons, frame).setDisplaySize(size, size);
    container?.add(s);
    return s;
}

export function makeKeyBadge(
    scene: Phaser.Scene,
    cx: number,
    cy: number,
    label: string,
    opts?: { wide?: boolean; gold?: boolean; size?: number; fontSize?: number; container?: Phaser.GameObjects.Container },
): Phaser.GameObjects.Sprite {
    const h = opts?.size ?? 34;
    const wide = !!opts?.wide;
    const frame = wide ? UI_ICON.keySpace : (opts?.gold ? UI_ICON.keyGold : UI_ICON.keyWhite);
    const w = wide ? Math.round(h * 2.68) : h;
    const dispH = wide ? Math.round(h * 1.58) : h;
    const keySpr = scene.add.sprite(cx, cy, UI_TEX.icons, frame).setDisplaySize(w, dispH);
    opts?.container?.add(keySpr);
    const color = opts?.gold ? '#4e2600' : '#0f2d56';
    const glyph = /[✕□○△]/.test(label);
    const txt = scene.add.text(cx, cy - (wide ? 2 : glyph ? 1 : 1.5), label, {
        fontFamily: glyph ? 'system-ui, "Segoe UI Symbol", sans-serif' : UI_FONT,
        fontSize: (opts?.fontSize ?? (wide ? 9.5 : 13)) + 'px',
        fontStyle: 'bold',
        color,
        align: 'center',
    }).setResolution(2).setOrigin(.5);
    opts?.container?.add(txt);
    return keySpr;
}
