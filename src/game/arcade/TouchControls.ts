import { clamp } from './geometry.ts';

export type TouchHandedness = 'right' | 'left';
export type TouchSizePreset = 'compact' | 'standard' | 'large';
export type TouchPositionPreset = 'corner' | 'raised' | 'wide';

export interface TouchControlSettings {
    handedness: TouchHandedness;
    size: TouchSizePreset;
    position: TouchPositionPreset;
    opacity: number;
    offsetX: number;
    offsetY: number;
}

export interface SafeAreaInsets {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

export interface TouchButtonGeometry {
    x: number;
    y: number;
    radius: number;
    hitRadius: number;
}

export interface TouchJoystickGeometry extends TouchButtonGeometry {
    travelRadius: number;
    knobRadius: number;
}

export interface TouchLayout {
    joystick: TouchJoystickGeometry;
    fire: TouchButtonGeometry;
    special: TouchButtonGeometry;
    pause: TouchButtonGeometry;
    moveZoneSplitX: number;
    scale: number;
    opacity: number;
}

export interface TouchOutput {
    x: number;
    y: number;
    fire: boolean;
    special: boolean;
    stickActive: boolean;
    stickOriginX: number;
    stickOriginY: number;
    knobX: number;
    knobY: number;
    firePressed: boolean;
    specialPressed: boolean;
}

export type TouchDownAction = 'none' | 'pause' | 'move' | 'fire' | 'special';

export const WORLD_WIDTH = 768;
export const WORLD_HEIGHT = 432;
export const CENTER_ARENA_LEFT = 184;
export const CENTER_ARENA_RIGHT = 584;

const ZERO_INSETS: SafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };

const SIZE_SCALES: Record<TouchSizePreset, number> = {
    compact: 0.84,
    standard: 1.0,
    large: 1.16,
};

const CARDINAL_SNAP_RAD = (6 * Math.PI) / 180;
const EIGHT_WAY_STEP = Math.PI / 4;

export function defaultTouchSettings(): TouchControlSettings {
    return {
        handedness: 'right',
        size: 'standard',
        position: 'corner',
        opacity: 0.52,
        offsetX: 0,
        offsetY: 0,
    };
}

export function sanitizeTouchSettings(raw: Partial<TouchControlSettings> | undefined | null): TouchControlSettings {
    const def = defaultTouchSettings();
    if (!raw || typeof raw !== 'object') return def;
    const handedness: TouchHandedness = raw.handedness === 'left' ? 'left' : 'right';
    const size: TouchSizePreset = raw.size === 'compact' || raw.size === 'large' ? raw.size : 'standard';
    const position: TouchPositionPreset = raw.position === 'raised' || raw.position === 'wide' ? raw.position : 'corner';
    const opacityRaw = typeof raw.opacity === 'number' && Number.isFinite(raw.opacity) ? raw.opacity : def.opacity;
    const offsetXRaw = typeof raw.offsetX === 'number' && Number.isFinite(raw.offsetX) ? raw.offsetX : 0;
    const offsetYRaw = typeof raw.offsetY === 'number' && Number.isFinite(raw.offsetY) ? raw.offsetY : 0;
    return {
        handedness,
        size,
        position,
        opacity: clamp(Math.round(opacityRaw * 100) / 100, 0.28, 0.8),
        offsetX: clamp(Math.round(offsetXRaw), -24, 24),
        offsetY: clamp(Math.round(offsetYRaw), -32, 18),
    };
}

/**
 * Converts browser DOM safe-area insets (CSS px) and canvas position within the
 * viewport into world-space edge margins (`0..768 x 0..432`).
 */
export function computeWorldSafeInsets(
    canvasRect: { left: number; top: number; width: number; height: number } | null | undefined,
    viewport: { width: number; height: number },
    cssInsets: Partial<SafeAreaInsets> = ZERO_INSETS,
    worldWidth = WORLD_WIDTH,
    worldHeight = WORLD_HEIGHT,
): SafeAreaInsets {
    if (!canvasRect || canvasRect.width <= 0 || canvasRect.height <= 0 || viewport.width <= 0 || viewport.height <= 0) {
        return { ...ZERO_INSETS };
    }
    const scaleX = worldWidth / canvasRect.width;
    const scaleY = worldHeight / canvasRect.height;

    const overhangLeft = Math.max(0, (cssInsets.left ?? 0) - canvasRect.left);
    const overhangTop = Math.max(0, (cssInsets.top ?? 0) - canvasRect.top);
    const canvasRight = canvasRect.left + canvasRect.width;
    const canvasBottom = canvasRect.top + canvasRect.height;
    const overhangRight = Math.max(0, canvasRight - (viewport.width - (cssInsets.right ?? 0)));
    const overhangBottom = Math.max(0, canvasBottom - (viewport.height - (cssInsets.bottom ?? 0)));

    return {
        left: clamp(overhangLeft * scaleX, 0, 48),
        right: clamp(overhangRight * scaleX, 0, 48),
        top: clamp(overhangTop * scaleY, 0, 42),
        bottom: clamp(overhangBottom * scaleY, 0, 38),
    };
}

/**
 * Computes responsive, safe-area-aware positions for joystick, fire, special, and pause.
 * In landscape (`portraitHeight` omitted), controls sit cleanly outside the center lane;
 * in portrait Android UP (`portraitHeight` defined on 384px width), joystick sits bottom-left,
 * TIRO bottom-right, and ESP directly above TIRO.
 */
export function computeTouchLayout(
    settings: TouchControlSettings,
    insets: SafeAreaInsets = ZERO_INSETS,
    portraitHeight?: number,
): TouchLayout {
    const clean = sanitizeTouchSettings(settings);
    const scale = SIZE_SCALES[clean.size];
    const safeLeft = clamp(insets.left, 0, 48);
    const safeRight = clamp(insets.right, 0, 48);
    const safeTop = clamp(insets.top, 0, 42);
    const safeBottom = clamp(insets.bottom, 0, 38);

    if (portraitHeight !== undefined) {
        const pw = 384;
        const ph = Math.max(560, portraitHeight);
        const joyRadius = Math.round(33 * scale * 10) / 10;
        const travelRadius = Math.round(29 * scale * 10) / 10;
        const knobRadius = Math.round(13.5 * scale * 10) / 10;
        const fireRadius = Math.round(27 * scale * 10) / 10;
        const specialRadius = Math.round(21 * scale * 10) / 10;
        const mirrorX = clean.handedness === 'left';
        const pad = 12;
        const lift = clean.position === 'raised' ? 28 : clean.position === 'wide' ? 4 : 10;
        const baseY = ph - safeBottom - joyRadius - 24 - lift + clean.offsetY;
        const leftX = safeLeft + joyRadius + pad + (mirrorX ? -clean.offsetX : clean.offsetX);
        const rightX = pw - safeRight - fireRadius - pad + (mirrorX ? -clean.offsetX : clean.offsetX);
        const joyX = clamp(mirrorX ? pw - safeRight - joyRadius - pad : leftX, safeLeft + joyRadius + 8, pw - safeRight - joyRadius - 8);
        const fireX = clamp(mirrorX ? safeLeft + fireRadius + pad : rightX, safeLeft + fireRadius + 8, pw - safeRight - fireRadius - 8);
        const minControlY = ph * 0.56;
        const joyY = clamp(baseY, minControlY, ph - safeBottom - joyRadius - 10);
        const fireY = clamp(baseY + 4, minControlY, ph - safeBottom - fireRadius - 10);
        const specX = clamp(fireX + (mirrorX ? 4 : -4), safeLeft + specialRadius + 8, pw - safeRight - specialRadius - 8);
        const specY = clamp(fireY - (fireRadius + specialRadius + 20), minControlY - 74, fireY - fireRadius - specialRadius - 14);
        const pauseX = clamp(pw - Math.max(20, safeRight + 20), 344, pw - 16);
        const pauseY = clamp(Math.max(17, safeTop + 15), 16, 26);

        return {
            joystick: { x: joyX, y: joyY, radius: joyRadius, hitRadius: joyRadius + 16, travelRadius, knobRadius },
            fire: { x: fireX, y: fireY, radius: fireRadius, hitRadius: fireRadius + 10 },
            special: { x: specX, y: specY, radius: specialRadius, hitRadius: specialRadius + 6 },
            pause: { x: pauseX, y: pauseY, radius: 17, hitRadius: 23 },
            moveZoneSplitX: pw / 2,
            scale,
            opacity: clean.opacity,
        };
    }

    const joyRadius = Math.round(31 * scale * 10) / 10;
    const travelRadius = Math.round(28 * scale * 10) / 10;
    const knobRadius = Math.round(12.5 * scale * 10) / 10;
    const fireRadius = Math.round(25 * scale * 10) / 10;
    const specialRadius = Math.round(20 * scale * 10) / 10;

    // Base anchors defined in standard right-handed orientation (`joystick` left, actions right),
    // kept inside side columns (x <= 186 and x >= 582) and lower ergonomic corner.
    let baseJoyX = clean.position === 'raised' ? 102 : clean.position === 'wide' ? 68 : 82;
    let baseJoyY = clean.position === 'raised' ? 344 : clean.position === 'wide' ? 378 : 378;

    let baseFireX = clean.position === 'raised' ? 700 : clean.position === 'wide' ? 726 : 716;
    let baseFireY = clean.position === 'raised' ? 344 : clean.position === 'wide' ? 372 : 376;

    let baseSpecX = clean.position === 'raised' ? 622 : clean.position === 'wide' ? 640 : 632;
    let baseSpecY = clean.position === 'raised' ? 360 : clean.position === 'wide' ? 386 : 386;

    const mirrorX = clean.handedness === 'left';
    if (mirrorX) {
        baseJoyX = WORLD_WIDTH - baseJoyX;
        baseFireX = WORLD_WIDTH - baseFireX;
        baseSpecX = WORLD_WIDTH - baseSpecX;
    }

    const edgePad = 8;
    const minY = Math.max(292, safeTop + 260);
    const maxBottomY = (r: number) => WORLD_HEIGHT - safeBottom - r - edgePad;

    const clampLeftCol = (x: number, r: number) => clamp(x, safeLeft + r + edgePad, CENTER_ARENA_LEFT - r - 6);
    const clampRightCol = (x: number, r: number) => clamp(x, CENTER_ARENA_RIGHT + r + 6, WORLD_WIDTH - safeRight - r - edgePad);

    const joyClusterLeft = !mirrorX;
    const joyX = (joyClusterLeft ? clampLeftCol : clampRightCol)(
        baseJoyX + (joyClusterLeft ? clean.offsetX : -clean.offsetX),
        joyRadius,
    );
    const joyY = clamp(baseJoyY + clean.offsetY, minY, maxBottomY(joyRadius));

    const actionClampX = joyClusterLeft ? clampRightCol : clampLeftCol;
    const signedOffsetX = joyClusterLeft ? clean.offsetX : -clean.offsetX;
    let fireX = actionClampX(baseFireX + signedOffsetX, fireRadius);
    let fireY = clamp(baseFireY + clean.offsetY, minY, maxBottomY(fireRadius));

    let specX = actionClampX(baseSpecX + signedOffsetX, specialRadius);
    let specY = clamp(baseSpecY + clean.offsetY, minY, maxBottomY(specialRadius));

    // Guarantee generous separation between FIRE and SPECIAL even on narrow/inset screens.
    const minButtonDist = fireRadius + specialRadius + 20;
    const dist = Math.hypot(fireX - specX, fireY - specY);
    if (dist < minButtonDist) {
        const dir = joyClusterLeft ? -1 : 1;
        specX = actionClampX(fireX + dir * minButtonDist, specialRadius);
    }

    // Keep the pause trigger clear of the HUD score readout (centered around 680, 50)
    // even when landscape safe-area cutouts push controls inward from the top-right bezel.
    const defaultPauseX = WORLD_WIDTH - Math.max(24, safeRight + 24);
    const pauseHitsScoreBox = defaultPauseX < 732 && safeTop + 16 > 28;
    const pauseX = pauseHitsScoreBox
        ? 596
        : clamp(defaultPauseX, 732, WORLD_WIDTH - 24);
    const pauseY = pauseHitsScoreBox
        ? clamp(Math.max(20, safeTop + 12), 18, 34)
        : clamp(Math.max(18, safeTop + 14), 18, 30);

    return {
        joystick: {
            x: joyX,
            y: joyY,
            radius: joyRadius,
            hitRadius: joyRadius + 14,
            travelRadius,
            knobRadius,
        },
        fire: {
            x: fireX,
            y: fireY,
            radius: fireRadius,
            hitRadius: fireRadius + 9,
        },
        special: {
            x: specX,
            y: specY,
            radius: specialRadius,
            hitRadius: specialRadius + 4,
        },
        pause: {
            x: pauseX,
            y: pauseY,
            radius: 18,
            hitRadius: 24,
        },
        moveZoneSplitX: WORLD_WIDTH / 2,
        scale,
        opacity: clean.opacity,
    };
}

/**
 * Converts virtual stick displacement into an 8-way assisted analog vector
 * (`hypot(x, y) <= 1`) with an inner deadzone.
 */
export function computeStickVector(
    dx: number,
    dy: number,
    travelRadius: number,
): { x: number; y: number; knobOffsetX: number; knobOffsetY: number } {
    const safeTravel = Math.max(8, travelRadius);
    const dist = Math.hypot(dx, dy);
    const deadzone = safeTravel * 0.14;
    if (dist <= deadzone || dist === 0) {
        return { x: 0, y: 0, knobOffsetX: 0, knobOffsetY: 0 };
    }

    const rawAngle = Math.atan2(dy, dx);
    const nearest = Math.round(rawAngle / EIGHT_WAY_STEP) * EIGHT_WAY_STEP;
    const angle = Math.abs(rawAngle - nearest) <= CARDINAL_SNAP_RAD ? nearest : rawAngle;
    const mag = clamp((dist - deadzone) / (safeTravel - deadzone), 0, 1);
    const clampedDist = Math.min(dist, safeTravel);

    return {
        x: Math.cos(angle) * mag,
        y: Math.sin(angle) * mag,
        knobOffsetX: Math.cos(angle) * clampedDist,
        knobOffsetY: Math.sin(angle) * clampedDist,
    };
}

/**
 * Pure multi-touch controller tracking isolated pointer IDs for movement, primary fire,
 * special trigger, and pause, preventing accidental special activation while dragging
 * and latching brief special taps reliably across frame boundaries.
 */
export class TouchInputController {
    private layout: TouchLayout;
    private settings: TouchControlSettings;
    private moveId: number | null = null;
    private fireId: number | null = null;
    private specialId: number | null = null;
    private stickOriginX: number;
    private stickOriginY: number;
    private knobX: number;
    private knobY: number;
    private vecX = 0;
    private vecY = 0;
    private firePulsePending = false;
    private specialPulsePending = false;

    constructor(settings: TouchControlSettings = defaultTouchSettings(), insets: SafeAreaInsets = ZERO_INSETS) {
        this.settings = sanitizeTouchSettings(settings);
        this.layout = computeTouchLayout(this.settings, insets);
        this.stickOriginX = this.layout.joystick.x;
        this.stickOriginY = this.layout.joystick.y;
        this.knobX = this.stickOriginX;
        this.knobY = this.stickOriginY;
    }

    getLayout(): TouchLayout {
        return this.layout;
    }

    getSettings(): TouchControlSettings {
        return this.settings;
    }

    configure(settings: TouchControlSettings, insets: SafeAreaInsets = ZERO_INSETS, portraitHeight?: number): void {
        this.settings = sanitizeTouchSettings(settings);
        this.layout = computeTouchLayout(this.settings, insets, portraitHeight);
        if (this.moveId === null) {
            this.stickOriginX = this.layout.joystick.x;
            this.stickOriginY = this.layout.joystick.y;
            this.knobX = this.stickOriginX;
            this.knobY = this.stickOriginY;
        }
    }

    clearAll(): void {
        this.moveId = null;
        this.fireId = null;
        this.specialId = null;
        this.vecX = 0;
        this.vecY = 0;
        this.firePulsePending = false;
        this.specialPulsePending = false;
        this.stickOriginX = this.layout.joystick.x;
        this.stickOriginY = this.layout.joystick.y;
        this.knobX = this.stickOriginX;
        this.knobY = this.stickOriginY;
    }

    onPointerDown(pointerId: number, x: number, y: number): TouchDownAction {
        const l = this.layout;
        if (Math.hypot(x - l.pause.x, y - l.pause.y) <= l.pause.hitRadius) {
            this.clearAll();
            return 'pause';
        }

        const isLeftAction = this.settings.handedness === 'left';
        const inMoveHalf = isLeftAction ? x >= l.moveZoneSplitX : x < l.moveZoneSplitX;

        if (!inMoveHalf) {
            const distSpec = Math.hypot(x - l.special.x, y - l.special.y);
            const distFire = Math.hypot(x - l.fire.x, y - l.fire.y);
            // Special activates only on direct down-press strictly inside its dedicated circle, never via swipe.
            if (this.specialId === null && distSpec <= l.special.hitRadius && distSpec <= distFire) {
                this.specialId = pointerId;
                this.specialPulsePending = true;
                return 'special';
            }
            if (this.fireId === null && distFire <= l.fire.hitRadius) {
                this.fireId = pointerId;
                this.firePulsePending = true;
                return 'fire';
            }
            return 'none';
        }

        if (this.moveId === null) {
            this.moveId = pointerId;
            // Allow comfortable thumb reach around the side zone while anchoring visual origin near pad bounds.
            const distFromBase = Math.hypot(x - l.joystick.x, y - l.joystick.y);
            if (distFromBase <= l.joystick.hitRadius * 1.15) {
                this.stickOriginX = l.joystick.x;
                this.stickOriginY = l.joystick.y;
            } else {
                const minOriginX = isLeftAction ? CENTER_ARENA_RIGHT + l.joystick.radius : l.joystick.radius + 8;
                const maxOriginX = isLeftAction ? WORLD_WIDTH - l.joystick.radius - 8 : CENTER_ARENA_LEFT - l.joystick.radius;
                this.stickOriginX = clamp(x, minOriginX, maxOriginX);
                this.stickOriginY = clamp(y, 260, WORLD_HEIGHT - l.joystick.radius - 8);
            }
            this.updateStickFromPoint(x, y);
            return 'move';
        }

        return 'none';
    }

    onPointerMove(pointerId: number, x: number, y: number): void {
        if (this.moveId !== pointerId) return;
        this.updateStickFromPoint(x, y);
    }

    onPointerUp(pointerId: number): void {
        if (this.moveId === pointerId) {
            this.moveId = null;
            this.vecX = 0;
            this.vecY = 0;
            this.stickOriginX = this.layout.joystick.x;
            this.stickOriginY = this.layout.joystick.y;
            this.knobX = this.stickOriginX;
            this.knobY = this.stickOriginY;
        }
        if (this.fireId === pointerId) {
            this.fireId = null;
        }
        if (this.specialId === pointerId) {
            this.specialId = null;
        }
    }

    /** Peeks live touch state for rendering without consuming latched single-tap pulses. */
    peek(): TouchOutput {
        return {
            x: this.vecX,
            y: this.vecY,
            fire: this.fireId !== null || this.firePulsePending,
            special: this.specialId !== null || this.specialPulsePending,
            stickActive: this.moveId !== null,
            stickOriginX: this.stickOriginX,
            stickOriginY: this.stickOriginY,
            knobX: this.knobX,
            knobY: this.knobY,
            firePressed: this.fireId !== null,
            specialPressed: this.specialId !== null,
        };
    }

    /** Reads one simulation step's touch state and drains any single-tap latches. */
    consumeStep(): TouchOutput {
        const out = this.peek();
        this.firePulsePending = false;
        this.specialPulsePending = false;
        return out;
    }

    private updateStickFromPoint(x: number, y: number): void {
        const v = computeStickVector(x - this.stickOriginX, y - this.stickOriginY, this.layout.joystick.travelRadius);
        this.vecX = v.x;
        this.vecY = v.y;
        this.knobX = this.stickOriginX + v.knobOffsetX;
        this.knobY = this.stickOriginY + v.knobOffsetY;
    }
}
