import Phaser from 'phaser';
import { isMobileDisplay } from './MobileDisplay';
import {
    COAST_MAP_KEY, COAST_MAP_OFFSET, COAST_MAP_PERIOD, COAST_MAP_SCALE,
    coastBankShift, rawCoastBoundaryAtMapY, wrapCoast,
} from './PelagicCoastMap';

export const COAST_SHOAL_KEY = 'pelagic-coast-shoal-v1';
export const COAST_SURF_KEY = 'pelagic-coast-surf-v1';
/** Open-water split column separating left/right bank crops without slicing protruding headlands (e.g. circus cliff). */
export const COAST_SPLIT_X = 332;
const COAST_SPLIT_HALF = COAST_SPLIT_X >> 1;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const smoothstep = (t: number) => { const x = clamp(t, 0, 1); return x * x * (3 - 2 * x); };

/** Assemble once. Visibility never chooses art, removes land or changes a connection.
 * Traces real painted rock, beach, cliff and harbor-piling silhouettes in 2D so coastal shallows
 * and animated surf hug the true shoreline organically while deep-channel sea reveals the live ocean.
 */
export function installCoastPainting(scene: Phaser.Scene): string {
    if (scene.textures.exists(COAST_MAP_KEY) && scene.textures.exists(COAST_SHOAL_KEY) && scene.textures.exists(COAST_SURF_KEY)) return COAST_MAP_KEY;
    const texture = scene.textures.createCanvas(COAST_MAP_KEY, 768, 4096)!;
    const ctx = texture.context;
    const a = scene.textures.get('pelagic-coast-harbor-v2').getSourceImage() as HTMLImageElement;
    const b = scene.textures.get('pelagic-coast-leisure-v2').getSourceImage() as HTMLImageElement;
    ctx.drawImage(b, 0, -2176, 768, 2304); ctx.drawImage(b, 0, 1920, 768, 2304);
    ctx.drawImage(a, 0, -128, 768, 2304); ctx.drawImage(a, 0, 3968, 768, 2304);
    // A broad dissolve makes rocks and palms transparent. A minimum-error seam
    // follows matching foliage/water instead; only a 2px antialias band is blended.
    const join = (upper: HTMLImageElement, lower: HTMLImageElement) => {
        const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 256;
        const c = canvas.getContext('2d', { willReadFrequently: true })!;
        c.drawImage(upper, 0, upper.height * 2048 / 2304, upper.width, upper.height * 256 / 2304, 0, 0, 768, 256);
        const u = c.getImageData(0, 0, 768, 256);
        c.drawImage(lower, 0, 0, lower.width, lower.height * 256 / 2304, 0, 0, 768, 256);
        const l = c.getImageData(0, 0, 768, 256), result = c.createImageData(768, 256);
        const parent = new Int16Array(768 * 256); let previous = new Float64Array(256), next = new Float64Array(256);
        for (let x = 0; x < 768; x++) {
            next.fill(Infinity);
            for (let y = 24; y < 232; y++) {
                const i = (y * 768 + x) * 4;
                const error = Math.abs(u.data[i] - l.data[i]) + Math.abs(u.data[i + 1] - l.data[i + 1]) + Math.abs(u.data[i + 2] - l.data[i + 2]);
                let best = y;
                for (let candidate = Math.max(24, y - 2); candidate <= Math.min(231, y + 2); candidate++)if (previous[candidate] < previous[best]) best = candidate;
                next[y] = previous[best] + error + Math.abs(y - 128) * .12; parent[x * 256 + y] = best;
            }
            [previous, next] = [next, previous];
        }
        const path = new Int16Array(768); let y = 128;
        for (let candidate = 24; candidate < 232; candidate++)if (previous[candidate] < previous[y]) y = candidate;
        for (let x = 767; x >= 0; x--) { path[x] = y; y = parent[x * 256 + y]; }
        for (let row = 0; row < 256; row++)for (let x = 0; x < 768; x++) {
            const i = (row * 768 + x) * 4, t = Math.max(0, Math.min(1, (row - path[x] + 1) / 2));
            for (let channel = 0; channel < 3; channel++)result.data[i + channel] = u.data[i + channel] * (1 - t) + l.data[i + channel] * t;
            result.data[i + 3] = 255;
        }
        c.putImageData(result, 0, 0); return canvas;
    };
    const wrap = join(b, a); ctx.drawImage(wrap, 0, -128); ctx.drawImage(wrap, 0, 3968);
    ctx.drawImage(join(a, b), 0, 1920);

    const srcImg = ctx.getImageData(0, 0, 768, 4096), src = srcImg.data;
    // Cleanly heal the 4 isolated mid-channel rocks in the source paintings using pure deep-water
    // center-channel donor pixels and a flat-top plateau so zero ghosted rock/foam remnants survive.
    const healPatches: readonly [number, number, number, number, number, number][] = [
        [477, 394, 44, 36, -80, 0],   // harbor-v2 upper-right mid-channel rock (above lighthouse)
        [244, 1403, 42, 34, 120, 0],  // harbor-v2 lower-left mid-channel rock (above fishing hut)
        [517, 2943, 44, 38, -120, 0], // leisure-v2 mid-right mid-channel rock (below skatepark)
        [158, 3177, 32, 26, 95, 0],   // leisure-v2 mid-left cove rock
    ];
    for (const [cx, cy, rx, ry, dx, dy] of healPatches) {
        for (let y = Math.max(0, cy - ry); y <= Math.min(4095, cy + ry); y++) {
            const ny = (y - cy) / ry;
            const donorY = (y + dy + 4096) % 4096;
            for (let x = Math.max(0, cx - rx); x <= Math.min(767, cx + rx); x++) {
                const nx = (x - cx) / rx, d2 = nx * nx + ny * ny;
                if (d2 >= 1) continue;
                const w = 1 - smoothstep((Math.sqrt(d2) - .45) / .55);
                const donorX = clamp(x + dx, 0, 767);
                const dstIdx = (y * 768 + x) * 4, srcIdx = (donorY * 768 + donorX) * 4;
                for (let c = 0; c < 3; c++) src[dstIdx + c] = src[dstIdx + c] * (1 - w) + src[srcIdx + c] * w;
            }
        }
    }

    const dstImg = ctx.createImageData(768, 4096), dst = dstImg.data;
    const sample = (rowOffset: number, fx: number, ch: number) => {
        const clamped = Math.max(0, Math.min(767, fx));
        const x0 = Math.floor(clamped), x1 = Math.min(767, x0 + 1), f = clamped - x0;
        return src[rowOffset + x0 * 4 + ch] * (1 - f) + src[rowOffset + x1 * 4 + ch] * f;
    };
    const W = 384, H = 2048;
    const isOceanWater = new Uint8Array(W * H);
    const hasLeftBank = new Uint8Array(H);
    const hasRightBank = new Uint8Array(H);

    for (let texY = 0; texY < 4096; texY++) {
        const mapY = texY * COAST_MAP_SCALE;
        const rawL = rawCoastBoundaryAtMapY(mapY, -1) * 2;
        const rawR = rawCoastBoundaryAtMapY(mapY, 1) * 2;
        const shiftL = coastBankShift(mapY, -1) * 2;
        const shiftR = coastBankShift(mapY, 1) * 2;
        const newL = Math.max(28, rawL - shiftL);
        const newR = Math.min(768, rawR + shiftR);
        const center = (newL + newR) * .5;
        const rawCenter = (rawL + rawR) * .5;
        // Preserve protruding rock tips and shoreline contours unghosted before feathering open water.
        const halfGap = Math.max(8, (newR - newL) * .5);
        const pad = Math.min(18, Math.max(0, halfGap - 48));
        const effL = newL > 32 ? newL + pad : newL;
        const effR = newR < 764 ? newR - pad : newR;
        const feather = Math.min(56, Math.max(16, (effR - effL) * .45));
        const rowOffset = texY * 768 * 4;
        const wy = texY >> 1, sampleLow = (texY & 1) === 0;
        if (sampleLow) {
            hasLeftBank[wy] = newL > 32 ? 1 : 0;
            hasRightBank[wy] = newR < 764 ? 1 : 0;
        }

        for (let x = 0; x < 768; x++) {
            const out = rowOffset + x * 4;
            const sxMid = rawCenter + (x - center) * .66;
            let r: number, g: number, bl: number;
            if (x <= effL) {
                const sx = x + shiftL;
                r = sample(rowOffset, sx, 0); g = sample(rowOffset, sx, 1); bl = sample(rowOffset, sx, 2);
            } else if (x >= effR) {
                const sx = x - shiftR;
                r = sample(rowOffset, sx, 0); g = sample(rowOffset, sx, 1); bl = sample(rowOffset, sx, 2);
            } else if (x < effL + feather) {
                const t = .5 - .5 * Math.cos(((x - effL) / feather) * Math.PI);
                const sx = x + shiftL;
                r = sample(rowOffset, sx, 0) * (1 - t) + sample(rowOffset, sxMid, 0) * t;
                g = sample(rowOffset, sx, 1) * (1 - t) + sample(rowOffset, sxMid, 1) * t;
                bl = sample(rowOffset, sx, 2) * (1 - t) + sample(rowOffset, sxMid, 2) * t;
            } else if (x > effR - feather) {
                const t = .5 - .5 * Math.cos(((effR - x) / feather) * Math.PI);
                const sx = x - shiftR;
                r = sample(rowOffset, sx, 0) * (1 - t) + sample(rowOffset, sxMid, 0) * t;
                g = sample(rowOffset, sx, 1) * (1 - t) + sample(rowOffset, sxMid, 1) * t;
                bl = sample(rowOffset, sx, 2) * (1 - t) + sample(rowOffset, sxMid, 2) * t;
            } else {
                r = sample(rowOffset, sxMid, 0); g = sample(rowOffset, sxMid, 1); bl = sample(rowOffset, sxMid, 2);
            }
            dst[out] = r; dst[out + 1] = g; dst[out + 2] = bl; dst[out + 3] = 255;

            if (sampleLow && (x & 1) === 0) {
                const wx = x >> 1;
                const blueLead = bl - r;
                // Identify true ocean / turquoise bay water so flood-fill traces real cliff/beach coves
                // without ever cutting polygon lines through bay water or piercing enclosed blue roofs.
                const waterColor = blueLead >= 34 && bl >= 115 && g <= bl + 6;
                const inOpenCorridor = Math.abs(wx - COAST_SPLIT_HALF) <= 6;
                if (waterColor || inOpenCorridor) isOceanWater[wy * W + wx] = 1;
            }
        }
    }

    // Pass 1: Flood-fill open ocean strictly from the center channel (COAST_SPLIT_HALF).
    // Real bays and coves fill right up to the painted rock/sand shoreline, while enclosed
    // inland features (blue roofs, umbrellas, skatepark pool) remain 100% solid island interiors.
    const isOcean = new Uint8Array(W * H);
    const qx = new Int32Array(W * H);
    const qy = new Int32Array(W * H);
    {
        let head = 0, tail = 0;
        for (let y = 0; y < H; y++) {
            const idx = y * W + COAST_SPLIT_HALF;
            isOcean[idx] = 1;
            qx[tail] = COAST_SPLIT_HALF; qy[tail] = y; tail++;
        }
        while (head < tail) {
            const cx = qx[head], cy = qy[head]; head++;
            const yp = (cy - 1 + H) % H, yn = (cy + 1) % H;
            const minX = hasLeftBank[cy] ? 2 : 0;
            const maxX = hasRightBank[cy] ? W - 3 : W - 1;
            if (cx > minX) {
                const ni = cy * W + cx - 1;
                if (!isOcean[ni] && isOceanWater[ni]) { isOcean[ni] = 1; qx[tail] = cx - 1; qy[tail] = cy; tail++; }
            }
            if (cx < maxX) {
                const ni = cy * W + cx + 1;
                if (!isOcean[ni] && isOceanWater[ni]) { isOcean[ni] = 1; qx[tail] = cx + 1; qy[tail] = cy; tail++; }
            }
            const up = yp * W + cx;
            if (!isOcean[up] && isOceanWater[up]) { isOcean[up] = 1; qx[tail] = cx; qy[tail] = yp; tail++; }
            const dn = yn * W + cx;
            if (!isOcean[dn] && isOceanWater[dn]) { isOcean[dn] = 1; qx[tail] = cx; qy[tail] = yn; tail++; }
        }
    }

    // Pass 2: Build solid inland terrain mask from non-ocean pixels, despeckle, then flood-fill
    // strictly from outer mainland borders (x = 0 and x = W - 1) so zero offshore fragments survive.
    const rawMask = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) {
        const isDeepInland = !isOcean[i];
        if (isDeepInland) rawMask[i] = 1;
    }
    const cleanMask = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
        const yp = (y - 1 + H) % H, yn = (y + 1) % H;
        for (let x = 0; x < W; x++) {
            const idx = y * W + x;
            if (!rawMask[idx]) continue;
            if (x <= 1 || x >= W - 2) { cleanMask[idx] = 1; continue; }
            const nbr = rawMask[idx - 1] + rawMask[idx + 1] + rawMask[yp * W + x] + rawMask[yn * W + x];
            if (nbr >= 2) cleanMask[idx] = 1;
        }
    }

    const connectedMask = new Uint8Array(W * H);
    const floodBank = (startX: number, minX: number, maxX: number) => {
        let head = 0, tail = 0;
        for (let y = 0; y < H; y++) {
            const idx = y * W + startX;
            if (cleanMask[idx] && !connectedMask[idx]) {
                connectedMask[idx] = 1;
                qx[tail] = startX; qy[tail] = y; tail++;
            }
        }
        while (head < tail) {
            const cx = qx[head], cy = qy[head]; head++;
            const yp = (cy - 1 + H) % H, yn = (cy + 1) % H;
            if (cx > minX) {
                const ni = cy * W + cx - 1;
                if (cleanMask[ni] && !connectedMask[ni]) { connectedMask[ni] = 1; qx[tail] = cx - 1; qy[tail] = cy; tail++; }
            }
            if (cx < maxX) {
                const ni = cy * W + cx + 1;
                if (cleanMask[ni] && !connectedMask[ni]) { connectedMask[ni] = 1; qx[tail] = cx + 1; qy[tail] = cy; tail++; }
            }
            const up = yp * W + cx;
            if (cleanMask[up] && !connectedMask[up]) { connectedMask[up] = 1; qx[tail] = cx; qy[tail] = yp; tail++; }
            const dn = yn * W + cx;
            if (cleanMask[dn] && !connectedMask[dn]) { connectedMask[dn] = 1; qx[tail] = cx; qy[tail] = yn; tail++; }
        }
    };
    floodBank(0, 0, COAST_SPLIT_HALF - 5);
    floodBank(W - 1, COAST_SPLIT_HALF + 4, W - 1);

    const landDist = new Float32Array(W * H);
    landDist.fill(36);
    for (let i = 0; i < W * H; i++) {
        if (connectedMask[i]) landDist[i] = 0;
    }
    for (let pass = 0; pass < 2; pass++) {
        for (let y = 0; y < H; y++) {
            const yp = (y - 1 + H) % H;
            for (let x = 1; x < W - 1; x++) {
                const i = y * W + x;
                landDist[i] = Math.min(landDist[i], landDist[y * W + x - 1] + 1, landDist[yp * W + x] + 1, landDist[yp * W + x - 1] + 1.414, landDist[yp * W + x + 1] + 1.414);
            }
        }
        for (let y = H - 1; y >= 0; y--) {
            const yn = (y + 1) % H;
            for (let x = W - 2; x >= 1; x--) {
                const i = y * W + x;
                landDist[i] = Math.min(landDist[i], landDist[y * W + x + 1] + 1, landDist[yn * W + x] + 1, landDist[yn * W + x + 1] + 1.414, landDist[yn * W + x - 1] + 1.414);
            }
        }
    }

    // Carve dstImg water alpha strictly and monotonically from radial 2D distance to connected coastline.
    // Immediate shoreline contact (d <= 5.5) keeps crisp rock/foam silhouettes; outer turquoise shelf
    // fades smoothly to 0 by d = 18 while softening painted open-water caustic highlights into ocean blue.
    for (let texY = 0; texY < 4096; texY++) {
        const wy = texY >> 1, wyNext = (wy + 1) % H, fy = (texY & 1) * .5;
        const rowOffset = texY * 768 * 4;
        for (let x = 0; x < 768; x++) {
            const out = rowOffset + x * 4;
            const wx = clamp(x >> 1, 0, W - 2), fx = (x & 1) * .5;
            const d00 = landDist[wy * W + wx], d10 = landDist[wy * W + wx + 1];
            const d01 = landDist[wyNext * W + wx], d11 = landDist[wyNext * W + wx + 1];
            const d = (d00 * (1 - fx) + d10 * fx) * (1 - fy) + (d01 * (1 - fx) + d11 * fx) * fy;
            if (d <= 1.8) { dst[out + 3] = 255; continue; }
            if (d >= 18) { dst[out + 3] = 0; continue; }
            const r = dst[out], g = dst[out + 1], bl = dst[out + 2];
            const shoreContact = 1 - smoothstep((d - 1.8) / 3.2);
            const solidMask = clamp(Math.max((r - 108) / 34, (32 - (bl - r)) / 16), 0, 1) * shoreContact;
            const waterFade = 1 - smoothstep((d - 1.8) / 16.2);
            const splitMargin = clamp((Math.abs(x - (COAST_SPLIT_X - .5)) - 1.5) / 6, 0, 1);
            const alpha = Math.max(solidMask, waterFade * .86) * splitMargin;
            if (d > 4.2 && r > 86) {
                const soften = smoothstep((d - 4.2) / 3.8) * clamp((r - 86) / 90, 0, 1) * .62;
                dst[out] = Math.round(r + (18 - r) * soften);
                dst[out + 1] = Math.round(g + (96 - g) * soften);
                dst[out + 2] = Math.round(bl + (168 - bl) * soften);
            }
            dst[out + 3] = Math.round(clamp(alpha, 0, 1) * 255);
        }
    }
    ctx.putImageData(dstImg, 0, 0);
    texture.refresh();

    const shoalTex = scene.textures.createCanvas(COAST_SHOAL_KEY, W, H)!;
    const surfTex = scene.textures.createCanvas(COAST_SURF_KEY, W, H)!;
    const shoalImg = shoalTex.context.createImageData(W, H);
    const surfImg = surfTex.context.createImageData(W, H);
    const TAU = Math.PI * 2;
    for (let y = 0; y < H; y++) {
        const wyNorm = y / H * TAU;
        for (let x = 0; x < W; x++) {
            const i = y * W + x, d = landDist[i];
            if (d <= .2 || d > 20) continue;
            const splitFade = clamp((Math.abs(x - (COAST_SPLIT_HALF - .5)) - 1.5) / 4, 0, 1);
            if (splitFade <= 0) continue;
            const idx = i * 4;
            const waveMod = 2.0 * Math.sin(wyNorm * 22 + x * .09) + 1.2 * Math.cos(x * .13 - wyNorm * 14);
            const shoalD = Math.max(0, d + waveMod * .35);
            if (shoalD <= 20) {
                const s = 1 - smoothstep(shoalD / 20);
                shoalImg.data[idx] = Math.round(14 + s * 32);
                shoalImg.data[idx + 1] = Math.round(146 + s * 84);
                shoalImg.data[idx + 2] = Math.round(198 + s * 42);
                shoalImg.data[idx + 3] = Math.round(s * (1 - clamp(d - 14, 0, 6) / 6) * 135 * splitFade);
            }
            // True rock/sand/piling shoreline lapping foam strictly anchored to real connected terrain (d = 0.8..5.8px)
            if (d >= .8 && d <= 5.8) {
                const surfNoise = .58 + .42 * Math.sin(wyNorm * 44 + x * .22) + .22 * Math.cos(x * .31 - wyNorm * 32);
                const inner = Math.max(0, 1 - Math.abs(d - 1.9) / 1.5);
                const outer = Math.max(0, 1 - Math.abs(d - 3.9) / 1.6) * .42;
                const band = clamp((inner + outer) * Math.max(.14, surfNoise), 0, 1) * splitFade;
                if (band > .04) {
                    const white = inner / (inner + outer + .01);
                    surfImg.data[idx] = Math.round(125 + white * 122);
                    surfImg.data[idx + 1] = Math.round(236 + white * 19);
                    surfImg.data[idx + 2] = 255;
                    surfImg.data[idx + 3] = Math.round(band * 148);
                }
            }
        }
    }
    shoalTex.context.putImageData(shoalImg, 0, 0); shoalTex.refresh();
    surfTex.context.putImageData(surfImg, 0, 0); surfTex.refresh();
    return COAST_MAP_KEY;
}

/** Two copies cover every view vertically, with left/right coastal crops anchored cleanly to outer arena edges. */
export class PelagicCoastPainting {
    readonly strips: Phaser.GameObjects.Image[];
    readonly rightStrips: Phaser.GameObjects.Image[];
    readonly shoalStrips: Phaser.GameObjects.Image[];
    readonly rightShoalStrips: Phaser.GameObjects.Image[];
    readonly surfStrips: Phaser.GameObjects.Image[];
    readonly rightSurfStrips: Phaser.GameObjects.Image[];
    constructor(scene: Phaser.Scene) {
        const key = installCoastPainting(scene);
        this.strips = [0, 1].map(() => scene.add.image(192, 0, key).setOrigin(0, 0).setScale(COAST_MAP_SCALE).setCrop(0, 0, COAST_SPLIT_X, 4096).setDepth(-18.8).setVisible(false));
        this.rightStrips = [0, 1].map(() => scene.add.image(192, 0, key).setOrigin(0, 0).setScale(COAST_MAP_SCALE).setCrop(COAST_SPLIT_X, 0, 768 - COAST_SPLIT_X, 4096).setDepth(-18.8).setVisible(false));
        this.shoalStrips = [0, 1].map(() => scene.add.image(192, 0, COAST_SHOAL_KEY).setOrigin(0, 0).setCrop(0, 0, COAST_SPLIT_HALF, 2048).setDepth(-18.92).setVisible(false));
        this.rightShoalStrips = [0, 1].map(() => scene.add.image(192, 0, COAST_SHOAL_KEY).setOrigin(0, 0).setCrop(COAST_SPLIT_HALF, 0, 384 - COAST_SPLIT_HALF, 2048).setDepth(-18.92).setVisible(false));
        this.surfStrips = [0, 1].map(() => scene.add.image(192, 0, COAST_SURF_KEY).setOrigin(0, 0).setCrop(0, 0, COAST_SPLIT_HALF, 2048).setDepth(-18.77).setBlendMode(Phaser.BlendModes.ADD).setVisible(false));
        this.rightSurfStrips = [0, 1].map(() => scene.add.image(192, 0, COAST_SURF_KEY).setOrigin(0, 0).setCrop(COAST_SPLIT_HALF, 0, 384 - COAST_SPLIT_HALF, 2048).setDepth(-18.77).setBlendMode(Phaser.BlendModes.ADD).setVisible(false));
    }
    draw(scroll: number, visible: boolean, alpha = 1, time = 0, quality = 2, arenaLeft = 192, arenaWidth = 384, viewH = 432): void {
        const top = -wrapCoast(COAST_MAP_OFFSET - scroll);
        const shown = visible && alpha > .01;
        const rightX = arenaLeft + arenaWidth - 384;
        const shoalAlpha = alpha * (.34 + .10 * Math.sin(time * 1.35));
        const surge = Math.sin(time * 2.15);
        const surfAlpha = alpha * (.28 + .24 * (.5 + .5 * surge)) * (quality === 1 ? .78 : 1);
        const surfShiftY = surge * 1.1;
        const minVisY = -COAST_MAP_PERIOD - 32;
        const maxVisY = viewH + 32;
        for (let i = 0; i < 2; i++) {
            const y = top + i * COAST_MAP_PERIOD;
            const inView = shown && y > minVisY && y < maxVisY;
            this.strips[i].setVisible(inView).setAlpha(alpha).setPosition(arenaLeft, y);
            this.rightStrips[i].setVisible(inView).setAlpha(alpha).setPosition(rightX, y);
            const showFx = inView && quality >= 1 && !isMobileDisplay();
            this.shoalStrips[i].setVisible(showFx).setAlpha(shoalAlpha).setPosition(arenaLeft, y);
            this.rightShoalStrips[i].setVisible(showFx).setAlpha(shoalAlpha).setPosition(rightX, y);
            this.surfStrips[i].setVisible(showFx).setAlpha(surfAlpha).setPosition(arenaLeft, y + surfShiftY);
            this.rightSurfStrips[i].setVisible(showFx).setAlpha(surfAlpha).setPosition(rightX, y + surfShiftY);
        }
    }
    destroy(): void {
        for (const list of [this.strips, this.rightStrips, this.shoalStrips, this.rightShoalStrips, this.surfStrips, this.rightSurfStrips]) {
            list.forEach(image => image.destroy());
        }
    }
}
