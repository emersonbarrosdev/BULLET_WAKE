import Phaser from 'phaser';
import { UI_FONT, UI_TEX } from './ArcadeMenuArt';
import type { ArcadeWorld } from './ArcadeWorld';
import { PELAGIC_RIVET_SHEET } from './PelagicActorAnimsMath';
import type { PelagicCommsState } from './PelagicComms';
import { subTotalHp } from './PelagicSubmarineBoss';

const ICON_AMMO = 'ui-hud-ammo-icon';
const ICON_SPECIAL = 'ui-hud-special-icon';
const ICON_HEART = 'ui-hud-heart-icon';

const FONT_HEAD = UI_FONT;
const FONT_BODY = 'Rajdhani, "Segoe UI", Arial, sans-serif';

export interface PelagicHudStateSnapshot {
    visible: boolean;
    scoreText: string;
    weaponLevel: number;
    weaponLevelText: string;
    lives: number;
    livesText: string;
    specialCharges: number;
    radioActive: boolean;
    radioText: string;
    radioPageIndex: number;
    radioPageCount: number;
    radioExpression: number;
    assisted: boolean;
    pauseCenter: { x: number; y: number } | null;
    hasLogoInGameplay: boolean;
    hasBayekInRadio: boolean;
    bayekTextureKey: string;
    rivetTextureKey: string;
    chargePercent: number;
    chargePhase: string;
    chargeTier: string;
    arena: { left: number; right: number; top: number; bottom: number; width: number };
}

/**
 * Installs crisp 3x procedural vector icon textures once per Phaser scene
 * (3-cartridge ammo icon for POWER, golden lightning bolt for ESPECIAL,
 * and glossy stylized crimson heart for VIDAS).
 */
function ensureHudIcons(scene: Phaser.Scene): void {
    const tx = scene.textures;

    if (!tx.exists(ICON_AMMO)) {
        const c = tx.createCanvas(ICON_AMMO, 60, 48);
        if (c) {
            const ctx = c.context;
            ctx.scale(3, 3);
            for (const bx of [2.5, 8.2, 13.9]) {
                ctx.fillStyle = '#08183a';
                ctx.beginPath();
                ctx.roundRect(bx - 0.6, 1.4, 4.8, 13.2, 1.8);
                ctx.fill();

                const tip = ctx.createLinearGradient(bx, 2, bx, 6.5);
                tip.addColorStop(0, '#fff7b0');
                tip.addColorStop(1, '#ffb800');
                ctx.fillStyle = tip;
                ctx.beginPath();
                ctx.moveTo(bx + 1.8, 1.8);
                ctx.lineTo(bx + 3.6, 6.2);
                ctx.lineTo(bx, 6.2);
                ctx.closePath();
                ctx.fill();

                const body = ctx.createLinearGradient(bx, 6.2, bx + 3.6, 13.8);
                body.addColorStop(0, '#ffe866');
                body.addColorStop(0.55, '#ffc81c');
                body.addColorStop(1, '#c97a00');
                ctx.fillStyle = body;
                ctx.beginPath();
                ctx.roundRect(bx, 6.4, 3.6, 7.6, 0.8);
                ctx.fill();

                ctx.fillStyle = 'rgba(255,255,255,0.65)';
                ctx.fillRect(bx + 0.6, 7.0, 0.9, 5.8);
            }
            c.refresh();
        }
    }

    if (!tx.exists(ICON_SPECIAL)) {
        const c = tx.createCanvas(ICON_SPECIAL, 48, 54);
        if (c) {
            const ctx = c.context;
            ctx.scale(3, 3);
            const path = () => {
                ctx.beginPath();
                ctx.moveTo(9.8, 1.2);
                ctx.lineTo(2.4, 9.6);
                ctx.lineTo(7.4, 9.6);
                ctx.lineTo(5.1, 16.8);
                ctx.lineTo(13.8, 7.6);
                ctx.lineTo(8.7, 7.6);
                ctx.closePath();
            };
            const grad = ctx.createLinearGradient(4, 1, 12, 17);
            grad.addColorStop(0, '#fff7a8');
            grad.addColorStop(0.5, '#ffda29');
            grad.addColorStop(1, '#f59e0b');
            ctx.lineJoin = 'round';
            ctx.lineWidth = 2.1;
            ctx.strokeStyle = '#071738';
            path();
            ctx.stroke();
            ctx.fillStyle = grad;
            path();
            ctx.fill();
            c.refresh();
        }
    }

    if (!tx.exists(ICON_HEART)) {
        const c = tx.createCanvas(ICON_HEART, 72, 66);
        if (c) {
            const ctx = c.context;
            ctx.scale(3, 3);
            const heartPath = () => {
                ctx.beginPath();
                ctx.moveTo(12, 19.8);
                ctx.bezierCurveTo(6.2, 16.0, 2.2, 11.8, 2.2, 7.3);
                ctx.bezierCurveTo(2.2, 4.1, 4.7, 2.0, 7.6, 2.0);
                ctx.bezierCurveTo(9.6, 2.0, 11.2, 3.1, 12.0, 4.5);
                ctx.bezierCurveTo(12.8, 3.1, 14.4, 2.0, 16.4, 2.0);
                ctx.bezierCurveTo(19.3, 2.0, 21.8, 4.1, 21.8, 7.3);
                ctx.bezierCurveTo(21.8, 11.8, 17.8, 16.0, 12, 19.8);
                ctx.closePath();
            };
            ctx.save();
            ctx.lineJoin = 'round';
            ctx.lineWidth = 2.4;
            ctx.strokeStyle = '#081433';
            heartPath();
            ctx.stroke();
            ctx.restore();

            const grad = ctx.createRadialGradient(8.5, 6.2, 1.2, 12, 10, 13);
            grad.addColorStop(0, '#ff8aa0');
            grad.addColorStop(0.32, '#ff2a4d');
            grad.addColorStop(0.85, '#cc0f2e');
            grad.addColorStop(1, '#85061c');
            ctx.fillStyle = grad;
            heartPath();
            ctx.fill();

            ctx.lineWidth = 0.85;
            ctx.strokeStyle = 'rgba(255, 200, 210, 0.55)';
            heartPath();
            ctx.stroke();

            // Specular anime gloss
            ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
            ctx.beginPath();
            ctx.ellipse(6.8, 6.0, 2.1, 1.1, -0.55, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(5.1, 8.2, 0.7, 0, Math.PI * 2);
            ctx.fill();
            c.refresh();
        }
    }
}

function paginateMessage(text: string, maxCharsPerPage = 135): string[] {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (!clean) return [];
    if (clean.length <= maxCharsPerPage) return [clean];
    const words = clean.split(' ');
    const pages: string[] = [];
    let current = '';
    for (const w of words) {
        const next = current ? `${current} ${w}` : w;
        if (next.length > maxCharsPerPage && current) {
            pages.push(current);
            current = w;
        } else {
            current = next;
        }
    }
    if (current) pages.push(current);
    return pages;
}

/**
 * Modular PC Desktop HUD for Fenda Pelágica (Stage 1 UP).
 * Uses true 160 / 448 / 160 composition with full-height [0..432] center arena,
 * real Phaser side cards (MISSÃO, BAYEK half-body, persistent RÁDIO, minimal central score,
 * top-down RIVET/VANGUARDA, POWER, ESPECIAL, cumulative heart × N VIDAS), and zero full-screen overlays.
 */
export class PelagicDesktopHud {
    private readonly sideBg: Phaser.GameObjects.Graphics;
    private readonly frontChromeGfx: Phaser.GameObjects.Graphics;
    private readonly slotsGfx: Phaser.GameObjects.Graphics;
    private readonly routeMaskGfx: Phaser.GameObjects.Graphics;
    private readonly bayekMaskGfx: Phaser.GameObjects.Graphics;

    private readonly routeThumb: Phaser.GameObjects.Image;
    private readonly bayekPortrait: Phaser.GameObjects.Image;
    private readonly rivetSprite: Phaser.GameObjects.Sprite;

    private readonly ammoIcon: Phaser.GameObjects.Image;
    private readonly specialIcon: Phaser.GameObjects.Image;
    private readonly heartMiniIcon: Phaser.GameObjects.Image;
    private readonly heartMainIcon: Phaser.GameObjects.Image;

    private readonly missionBadgeText: Phaser.GameObjects.Text;
    private readonly missionTitleText: Phaser.GameObjects.Text;
    private readonly bayekNameText: Phaser.GameObjects.Text;
    private readonly radioHeaderText: Phaser.GameObjects.Text;
    private readonly radioBodyText: Phaser.GameObjects.Text;
    private readonly radioPageHint: Phaser.GameObjects.Text;

    private readonly scoreValue: Phaser.GameObjects.Text;

    private readonly rivetNameText: Phaser.GameObjects.Text;
    private readonly vanguardaText: Phaser.GameObjects.Text;
    private readonly powerHeaderText: Phaser.GameObjects.Text;
    private readonly chargeLabelText: Phaser.GameObjects.Text;
    private readonly chargeStateText: Phaser.GameObjects.Text;
    private readonly especialHeaderText: Phaser.GameObjects.Text;
    private readonly vidasHeaderText: Phaser.GameObjects.Text;
    private readonly vidasMultiplierText: Phaser.GameObjects.Text;

    private readonly allNodes: Array<Phaser.GameObjects.Components.Visible & Phaser.GameObjects.GameObject>;
    private visible = false;
    private chromeDrawn = false;

    private lastScoreStr = '';
    private lastWeaponLevel = -1;
    private lastSpecialCharges = -1;
    private lastLives = -1;
    private lastRadioExpr = 0;
    private lastChargeSig = '';

    private persistentRadioSource = '';
    private persistentRadioPages: string[] = [];
    private radioPageIndex = 0;
    private radioPageTimer = 0;
    private lastRenderedRadioPage = '';
    private lastBossSignature = '';

    constructor(scene: Phaser.Scene) {
        ensureHudIcons(scene);

        const mkText = (
            x: number,
            y: number,
            txt: string,
            size: number,
            color: string,
            opts?: {
                family?: string;
                weight?: string;
                ox?: number;
                oy?: number;
                stroke?: string;
                strokeThickness?: number;
                depth?: number;
                wrap?: number;
                lineSpacing?: number;
            },
        ) =>
            scene.add
                .text(x, y, txt, {
                    fontFamily: opts?.family ?? FONT_HEAD,
                    fontSize: `${size}px`,
                    fontStyle: opts?.weight ?? '600',
                    color,
                    ...(opts?.strokeThickness ? { stroke: opts?.stroke ?? '#04122e', strokeThickness: opts.strokeThickness } : {}),
                    ...(opts?.wrap ? { wordWrap: { width: opts.wrap } } : {}),
                    ...(opts?.lineSpacing ? { lineSpacing: opts.lineSpacing } : {}),
                })
                .setResolution(2)
                .setOrigin(opts?.ox ?? 0.5, opts?.oy ?? 0.5)
                .setDepth(opts?.depth ?? 43)
                .setVisible(false);

        this.sideBg = scene.add.graphics().setDepth(39.4).setVisible(false);
        this.frontChromeGfx = scene.add.graphics().setDepth(41.5).setVisible(false);
        this.slotsGfx = scene.add.graphics().setDepth(42.5).setVisible(false);

        // Masked coastal route thumbnail (x=11..149, y=42..103 => 138x61, native ratio 420:186)
        this.routeMaskGfx = scene.add.graphics().setVisible(false);
        chamferPath(this.routeMaskGfx, 11, 42, 138, 61, 3, 3, 6, 3);
        const routeMask = this.routeMaskGfx.createGeometryMask();
        this.routeThumb = scene.add
            .image(80, 72.5, UI_TEX.hudRoutePelagic)
            .setDisplaySize(138, 61)
            .setDepth(40.2)
            .setMask(routeMask)
            .setVisible(false);

        // Masked Bayek half-body portrait (x=9..151, y=114..280 => 142x166, native ratio 432:504)
        this.bayekMaskGfx = scene.add.graphics().setVisible(false);
        chamferPath(this.bayekMaskGfx, 9, 114, 142, 166, 12, 6, 8, 8);
        const bayekMask = this.bayekMaskGfx.createGeometryMask();
        this.bayekPortrait = scene.add
            .image(80, 197, UI_TEX.hudBayekPortrait)
            .setDisplaySize(142, 166)
            .setDepth(40.2)
            .setMask(bayekMask)
            .setVisible(false);

        // Top-down gameplay RIVET sprite (neutral column 3 of PELAGIC_RIVET_SHEET, 1:1 ratio, centered inside radar)
        this.rivetSprite = scene.add
            .sprite(688, 113, PELAGIC_RIVET_SHEET, 3)
            .setDisplaySize(48, 48)
            .setDepth(43)
            .setVisible(false);

        this.ammoIcon = scene.add.image(638, 195, ICON_AMMO).setDisplaySize(19, 15).setDepth(43).setVisible(false);
        this.specialIcon = scene.add.image(638, 279, ICON_SPECIAL).setDisplaySize(15, 17).setDepth(43).setVisible(false);
        this.heartMiniIcon = scene.add.image(638, 359, ICON_HEART).setDisplaySize(14, 13).setDepth(43).setVisible(false);
        this.heartMainIcon = scene.add.image(668, 391, ICON_HEART).setDisplaySize(24, 22).setDepth(43).setVisible(false);

        // Typography hierarchy: balanced bold/600 weights, dark ink on bright badges, zero heavy black blur
        this.missionBadgeText = mkText(39, 16, 'MISSÃO', 9.5, '#051536', { weight: 'bold' });
        this.missionTitleText = mkText(80, 31.5, 'FENDA PELÁGICA', 10.5, '#f2f9ff', { weight: '600', strokeThickness: 1.5 });
        this.bayekNameText = mkText(80, 281, 'BAYEK', 11.5, '#051536', { weight: 'bold' });
        this.radioHeaderText = mkText(33, 313, 'RÁDIO', 10.5, '#f2f9ff', { ox: 0, weight: 'bold', strokeThickness: 1.4 });
        this.radioBodyText = mkText(17, 330, '', 9.5, '#ebf6ff', {
            family: FONT_BODY,
            weight: '600',
            ox: 0,
            oy: 0,
            wrap: 126,
            lineSpacing: 2.5,
        });
        this.radioPageHint = mkText(143, 413, '', 7.5, '#6ee7ff', {
            family: FONT_BODY,
            weight: '600',
            ox: 1,
            oy: 1,
        });

        this.scoreValue = mkText(384, 9.5, '0', 12, '#ffffff', { weight: 'bold', strokeThickness: 1.5, depth: 46 });

        this.rivetNameText = mkText(672, 19.5, 'RIVET', 13.5, '#ffffff', { weight: 'bold', strokeThickness: 1.8 });
        this.vanguardaText = mkText(672, 37.5, 'VANGUARDA', 8, '#ffffff', {
            weight: 'bold',
            stroke: '#04224a',
            strokeThickness: 2.2,
        });
        this.powerHeaderText = mkText(653, 195, 'POWER', 10.5, '#f2f9ff', { ox: 0, weight: 'bold', strokeThickness: 1.4 });
        this.chargeLabelText = mkText(629, 239.5, 'CARGA', 7.2, '#7dd3fc', { ox: 0, weight: 'bold', strokeThickness: 1.2 });
        this.chargeStateText = mkText(746, 239.5, '', 6.8, '#fde047', { ox: 1, weight: 'bold', strokeThickness: 1.2 });
        this.especialHeaderText = mkText(651, 279, 'ESPECIAL', 10.5, '#f2f9ff', { ox: 0, weight: 'bold', strokeThickness: 1.4 });
        this.vidasHeaderText = mkText(651, 359, 'VIDAS', 10.5, '#f2f9ff', { ox: 0, weight: 'bold', strokeThickness: 1.4 });
        this.vidasMultiplierText = mkText(687, 391, '× 3', 15.5, '#ffffff', { ox: 0, weight: 'bold', strokeThickness: 1.8 });

        this.allNodes = [
            this.sideBg,
            this.frontChromeGfx,
            this.slotsGfx,
            this.routeThumb,
            this.bayekPortrait,
            this.rivetSprite,
            this.ammoIcon,
            this.specialIcon,
            this.heartMiniIcon,
            this.heartMainIcon,
            this.missionBadgeText,
            this.missionTitleText,
            this.bayekNameText,
            this.radioHeaderText,
            this.radioBodyText,
            this.radioPageHint,
            this.scoreValue,
            this.rivetNameText,
            this.vanguardaText,
            this.powerHeaderText,
            this.chargeLabelText,
            this.chargeStateText,
            this.especialHeaderText,
            this.vidasHeaderText,
            this.vidasMultiplierText,
        ];
    }

    resetComms(): void {
        this.persistentRadioSource = '';
        this.persistentRadioPages = [];
        this.radioPageIndex = 0;
        this.radioPageTimer = 0;
        this.lastRenderedRadioPage = '';
        this.radioBodyText.setText('');
        this.radioPageHint.setText('');
    }

    setVisible(show: boolean): void {
        if (this.visible === show) return;
        this.visible = show;
        for (const node of this.allNodes) node.setVisible(show);
        if (show && !this.chromeDrawn) {
            this.drawStaticChrome();
            this.chromeDrawn = true;
        }
        if (!show) {
            this.lastScoreStr = '';
            this.lastWeaponLevel = -1;
            this.lastSpecialCharges = -1;
            this.lastLives = -1;
            this.lastBossSignature = '';
            this.lastRadioExpr = 0;
            this.lastChargeSig = '';
        }
    }

    isVisible(): boolean {
        return this.visible;
    }

    private drawStaticChrome(): void {
        const g = this.sideBg;
        g.clear();

        // 1. Left & Right 160px side panel backdrops (NEVER touching center [160..608])
        g.fillGradientStyle(0x04235e, 0x04235e, 0x021238, 0x021238, 1);
        g.fillRect(0, 0, 160, 432);
        g.fillRect(608, 0, 160, 432);

        // Subtle diagonal tech streaks inside side columns only
        g.fillStyle(0x2878ff, 0.06);
        g.fillTriangle(0, 140, 160, 40, 160, 95);
        g.fillTriangle(0, 340, 160, 220, 160, 275);
        g.fillTriangle(608, 120, 768, 20, 768, 70);
        g.fillTriangle(608, 330, 768, 230, 768, 280);

        // Discrete vertical cyan arena divider lines at X = 160 & X = 608 (full height 0..432)
        g.lineStyle(3.2, 0x0ea5e9, 0.35).lineBetween(160, 0, 160, 432).lineBetween(608, 0, 608, 432);
        g.lineStyle(1.4, 0x6ce9ff, 0.92).lineBetween(160, 0, 160, 432).lineBetween(608, 0, 608, 432);

        // 2. Center Top Minimal Placar pill flush at Y = 0 (no bar across battlefield!)
        drawTopPlacarChrome(g);

        // 3. LEFT PANEL CARDS (X = 6..154)
        // A. MISSÃO
        drawCard(g, 6, 6, 148, 102, 5, 8, 6, 5);
        drawAngledPill(g, 11, 9.5, 58, 13, 6, 'gold');
        drawSlashes(g, [126, 134, 142], 10, 20);
        strokeGlow(g, () => chamferPath(g, 11, 42, 138, 61, 3, 3, 6, 3), 1.2);

        // B. BAYEK Portrait Frame + overlapping Gold Nameplate (drawn on frontChromeGfx above portrait!)
        drawCard(g, 6, 112, 148, 174, 12, 6, 8, 8, true);
        const fg = this.frontChromeGfx;
        fg.clear();
        // Outer cyan portrait stroke cleanly above portrait mask + yellow corner & BAYEK chamfer nameplate
        strokeGlow(fg, () => chamferPath(fg, 6, 112, 148, 174, 12, 6, 8, 8), 1.4);
        fg.fillStyle(0xffdc26, 0.96).beginPath()
            .moveTo(10, 132).lineTo(10, 123).lineTo(23, 112).lineTo(31, 112).closePath().fillPath();
        drawChamferRibbon(fg, 80, 281, 118, 20, 'gold', 8);

        // C. RÁDIO Card (enlarged bottom-left, zero portrait inside, zero Bullet Wake logo)
        drawCard(g, 6, 300, 148, 126, 5, 8, 8, 6);
        drawRadioGlyph(g, 20, 313);
        drawSlashes(g, [126, 134, 142], 308, 318);
        // Inner dialogue well
        g.fillStyle(0x021233, 0.92).fillRoundedRect(11, 324, 138, 96, 5);
        g.lineStyle(1.1, 0x26ceff, 0.72).strokeRoundedRect(11, 324, 138, 96, 5);

        // 4. RIGHT PANEL OUTER SHELL + INNER CHAMFERED OCTAGONAL CARDS (matching approved layout!)
        drawCard(g, 613, 6, 150, 420, 12, 8, 8, 12);
        drawChamferRibbon(g, 672, 37.5, 86, 13, 'cyan', 5);
        drawSlashes(g, [724, 731, 738], 32.5, 42.5);

        // A. RIVET Radar Showcase (large chamfered octagon + grid & concentric circles)
        drawCard(g, 621, 50, 134, 126, 14, 14, 14, 14);
        g.lineStyle(0.7, 0x28c8ff, 0.14);
        for (let gx = 638; gx <= 738; gx += 25) g.lineBetween(gx, 56, gx, 170);
        for (let gy = 68; gy <= 158; gy += 22.5) g.lineBetween(627, gy, 749, gy);
        g.lineStyle(0.9, 0x28c8ff, 0.24);
        for (const r of [46, 30, 15]) g.strokeCircle(688, 113, r);
        g.lineStyle(0.8, 0x28c8ff, 0.2)
            .lineBetween(636, 113, 740, 113)
            .lineBetween(688, 61, 688, 165);

        // B. POWER Card (chamfered octagon, NO inner divider line)
        drawCard(g, 621, 182, 134, 74, 12, 12, 12, 12);
        drawSlashes(g, [725, 732, 739], 190, 200);

        // C. ESPECIAL Card (chamfered octagon, NO inner divider line)
        drawCard(g, 621, 262, 134, 74, 12, 12, 12, 12);
        drawSlashes(g, [725, 732, 739], 274, 284);

        // D. VIDAS Card (chamfered octagon, NO inner divider line)
        drawCard(g, 621, 342, 134, 74, 12, 12, 12, 12);
        drawSlashes(g, [725, 732, 739], 354, 364);
    }

    draw(
        world: ArcadeWorld,
        lifeIcons: Phaser.GameObjects.Image[],
        levelText: Phaser.GameObjects.Text,
        assistBadge: Phaser.GameObjects.Text,
        bossHudLabel: Phaser.GameObjects.Text,
        comms: PelagicCommsState | null,
        fallbackRadioText: string,
        introRadioActive: boolean,
        clock: number,
        dt: number,
    ): void {
        if (!this.visible) this.setVisible(true);

        // Legacy per-icon sprites stay hidden on desktop Fenda (single cumulative heart × N is used instead)
        for (const icon of lifeIcons) icon.setVisible(false);
        levelText.setVisible(false);

        // Top-down RIVET gameplay thruster frame cycle (column 3 neutral across rows 0..3)
        const rivetFrame = (Math.floor(clock * 10) % 4) * 7 + 3;
        if (this.rivetSprite.frame.name !== String(rivetFrame)) {
            this.rivetSprite.setFrame(rivetFrame);
        }

        // Minimal Center Score WITHOUT leading zeros
        const scoreStr = String(Math.max(0, Math.floor(world.score)));
        if (scoreStr !== this.lastScoreStr) {
            this.scoreValue.setText(scoreStr);
            this.lastScoreStr = scoreStr;
        }

        // Lives cumulative multiplier (e.g. "× 3", "× 12")
        if (world.lives !== this.lastLives) {
            this.lastLives = world.lives;
            this.vidasMultiplierText.setText(`× ${Math.max(0, world.lives)}`);
        }

        // Assisted subtle badge right beside top-right Pause button if enabled
        if (world.isAssisted) {
            assistBadge
                .setStyle({
                    fontFamily: FONT_HEAD,
                    fontSize: '7.5px',
                    fontStyle: '700',
                    color: '#8cfff3',
                    stroke: '#041430',
                    strokeThickness: 1.5,
                })
                .setOrigin(0.5)
                .setPosition(640, 412)
                .setVisible(false); // keep right panel uncluttered; status tracked cleanly in snapshot
        } else {
            assistBadge.setVisible(false);
        }

        // Persistent Radio Message (replaces ONLY when a new message arrives; NEVER cleared on cooldown!)
        const incoming = introRadioActive
            ? 'Entrando na Fenda Pelágica. Radar limpo por enquanto... Mas fiquem atentos, é uma rota instável!'
            : (comms?.text || fallbackRadioText || '');
        const cleanIncoming = incoming.replace(/\n+/g, ' ').trim();
        this.lastRadioExpr = comms?.expression ?? 0;

        if (cleanIncoming && cleanIncoming !== this.persistentRadioSource) {
            this.persistentRadioSource = cleanIncoming;
            this.persistentRadioPages = paginateMessage(cleanIncoming, 135);
            this.radioPageIndex = 0;
            this.radioPageTimer = 0;
        } else if (this.persistentRadioPages.length > 1 && dt > 0) {
            this.radioPageTimer += dt;
            if (this.radioPageTimer >= 3.4) {
                this.radioPageTimer = 0;
                this.radioPageIndex = (this.radioPageIndex + 1) % this.persistentRadioPages.length;
            }
        }

        const pageText = this.persistentRadioPages[this.radioPageIndex] ?? '';
        const hintText = this.persistentRadioPages.length > 1 ? `${this.radioPageIndex + 1}/${this.persistentRadioPages.length}` : '';
        if (pageText !== this.lastRenderedRadioPage) {
            this.lastRenderedRadioPage = pageText;
            this.radioBodyText.setText(pageText);
            this.radioPageHint.setText(hintText);
        } else if (this.radioPageHint.text !== hintText) {
            this.radioPageHint.setText(hintText);
        }

        // Redraw dynamic gauges / CARGA bar / boss HP only when state changes
        const bossSig = this.computeBossSignature(world);
        const cSnap = world.chargedShot.snapshot();
        const chargeSig = `${cSnap.phase}:${Math.round(cSnap.ratio * 100)}`;
        if (
            world.weapons.weaponLevel !== this.lastWeaponLevel ||
            world.weapons.specialCharges !== this.lastSpecialCharges ||
            chargeSig !== this.lastChargeSig ||
            bossSig !== this.lastBossSignature
        ) {
            this.lastWeaponLevel = world.weapons.weaponLevel;
            this.lastSpecialCharges = world.weapons.specialCharges;
            this.lastChargeSig = chargeSig;
            this.lastBossSignature = bossSig;
            this.redrawDynamicSlots(world, bossHudLabel);
        }
    }

    private computeBossSignature(world: ArcadeWorld): string {
        if (world.boss?.sub && world.boss.sub.phase !== 'done') {
            const sub = world.boss.sub;
            const sec = sub.sections[sub.activeSection];
            const secRatios = sub.sections.map((s) => {
                const cur = Math.max(0, s.hullHp) + s.parts.reduce((acc, p) => acc + Math.max(0, p.hp), 0);
                return Math.round(cur);
            }).join(',');
            return `sub:${sub.activeSection}:${sec.name}:${secRatios}`;
        }
        if (world.boss && world.boss.phase !== 'absent' && world.boss.phase !== 'sink' && world.boss.parts.length > 0) {
            const cur = world.boss.parts.reduce((acc, p) => acc + Math.max(0, p.hp), 0);
            const max = Math.max(1, world.boss.parts.reduce((acc, p) => acc + Math.max(0, p.maxHp), 0));
            return `boss:${Math.round((cur / max) * 100)}`;
        }
        return '';
    }

    private redrawDynamicSlots(world: ArcadeWorld, bossHudLabel: Phaser.GameObjects.Text): void {
        const g = this.slotsGfx;
        g.clear();

        // Shared horizontal rounded-rectangle gauge renderer for both POWER & ESPECIAL
        const drawGaugeRow = (rowY: number, count: number) => {
            const w = 21.5;
            const h = 15.5;
            for (let i = 0; i < 5; i++) {
                const x = 629 + i * 24;
                if (i < count) {
                    g.fillGradientStyle(0xfff48a, 0xfff48a, 0xe8a400, 0xe8a400, 1).fillRoundedRect(x, rowY, w, h, 3.5);
                    g.fillStyle(0xffffff, 0.58).fillRoundedRect(x + 2, rowY + 1.5, w - 4, 3, 1.5);
                    g.fillStyle(0xb87200, 0.35).fillRoundedRect(x + 2, rowY + h - 3.5, w - 4, 2, 1);
                    g.lineStyle(1.3, 0xffe86b, 0.98).strokeRoundedRect(x, rowY, w, h, 3.5);
                } else {
                    g.fillStyle(0x04173c, 0.52).fillRoundedRect(x, rowY, w, h, 3.5);
                    g.lineStyle(1.1, 0x3b86d1, 0.84).strokeRoundedRect(x, rowY, w, h, 3.5);
                }
            }
        };

        // 1. POWER: 5 horizontal rounded rectangles inside [621..755, y=209..224]
        drawGaugeRow(209, world.weapons.weaponLevel);

        // 1b. Compact CARGA bar tucked cleanly inside lower strip of POWER card (y=236..243)
        const cSnap = world.chargedShot.snapshot();
        const barX = 664;
        const barY = 236;
        const barW = cSnap.isFull ? 58 : 82;
        const barH = 7;
        g.fillStyle(0x041430, 0.92).fillRoundedRect(barX, barY, barW, barH, 3);
        if (cSnap.ratio > 0) {
            const fillW = Math.max(4, barW * cSnap.ratio);
            if (cSnap.isFull) {
                g.fillGradientStyle(0xfef08a, 0xfef08a, 0xf59e0b, 0xf59e0b, 1).fillRoundedRect(barX, barY, barW, barH, 3);
                g.fillStyle(0xffffff, 0.55).fillRoundedRect(barX + 1.5, barY + 1.2, barW - 3, 2.2, 1.5);
            } else if (cSnap.ratio >= 0.72) {
                g.fillGradientStyle(0x67e8f9, 0xfde047, 0x06b6d4, 0xf59e0b, 1).fillRoundedRect(barX, barY, fillW, barH, 3);
            } else {
                g.fillGradientStyle(0x67e8f9, 0x67e8f9, 0x0284c7, 0x0284c7, 1).fillRoundedRect(barX, barY, fillW, barH, 3);
            }
        }
        g.lineStyle(1, cSnap.isFull ? 0xfef08a : cSnap.isPartialReady ? 0x67e8f9 : 0x2e6ba3, cSnap.isFull ? 0.98 : 0.85)
            .strokeRoundedRect(barX, barY, barW, barH, 3);
        this.chargeLabelText.setColor(cSnap.isFull ? '#fef08a' : cSnap.isHolding ? '#a5f3fc' : '#7dd3fc');
        this.chargeStateText.setText(cSnap.isFull ? 'MAX' : '').setVisible(this.visible && cSnap.isFull);

        // 2. ESPECIAL: identical horizontal rounded rectangles inside [621..755, y=299..314.5]
        drawGaugeRow(299, world.weapons.specialCharges);

        // 3. Boss HP compact bar tucked below central Placar ONLY during boss fight
        if (world.boss?.sub && world.boss.sub.phase !== 'done') {
            const sub = world.boss.sub;
            const sec = sub.sections[sub.activeSection];
            const totals = subTotalHp(sub);
            g.fillStyle(0x041430, 0.86).fillRoundedRect(236, 24, 296, 13, 4);
            g.lineStyle(1.1, 0x4ae6ff, 0.85).strokeRoundedRect(236, 24, 296, 13, 4);
            bossHudLabel
                .setStyle({ fontFamily: FONT_HEAD, fontSize: '8px', fontStyle: '700', color: '#ffe654', stroke: '#041430', strokeThickness: 1.8 })
                .setPosition(244, 30.5)
                .setText(`${sec.index + 1}/5 ${sec.name}`)
                .setVisible(true);
            for (let i = 0; i < sub.sections.length; i++) {
                const px = 428 + i * 19.5;
                const pw = 17;
                const sItem = sub.sections[i];
                const sCur = Math.max(0, sItem.hullHp) + sItem.parts.reduce((acc, p) => acc + Math.max(0, p.hp), 0);
                const sMax = sItem.hullMaxHp + sItem.parts.reduce((acc, p) => acc + p.maxHp, 0);
                const ratio = sMax > 0 ? Math.max(0, Math.min(1, sCur / sMax)) : 0;
                g.fillStyle(0x0b2649, 0.95).fillRoundedRect(px, 27, pw, 7, 2);
                if (ratio > 0) {
                    const col = i === sub.activeSection ? (totals.current < totals.max * 0.25 ? 0xff6e54 : 0xffd84d) : 0x2292d6;
                    g.fillStyle(col, 0.96).fillRoundedRect(px, 27, pw * ratio, 7, 2);
                }
                g.lineStyle(0.8, i === sub.activeSection ? 0xfff1a6 : 0x66d7ff, 0.85).strokeRoundedRect(px, 27, pw, 7, 2);
            }
        } else if (world.boss && world.boss.phase !== 'absent' && world.boss.phase !== 'sink' && world.boss.parts.length > 0) {
            const curHp = world.boss.parts.reduce((acc, p) => acc + Math.max(0, p.hp), 0);
            const maxHp = Math.max(1, world.boss.parts.reduce((acc, p) => acc + Math.max(0, p.maxHp), 0));
            const ratio = Math.max(0, Math.min(1, curHp / maxHp));
            bossHudLabel
                .setStyle({ fontFamily: FONT_HEAD, fontSize: '8px', fontStyle: '700', color: '#ffe654', stroke: '#041430', strokeThickness: 1.8 })
                .setPosition(244, 30.5)
                .setText('FORÇA NAVAL')
                .setVisible(curHp > 0);
            if (curHp > 0) {
                g.fillStyle(0x041430, 0.86).fillRoundedRect(236, 24, 296, 13, 4);
                g.lineStyle(1.1, 0x4ae6ff, 0.85).strokeRoundedRect(236, 24, 296, 13, 4);
                g.fillStyle(0x280c18, 0.95).fillRoundedRect(326, 27, 198, 7, 2.5);
                if (ratio > 0) g.fillStyle(0xff4f52, 1).fillRoundedRect(326, 27, Math.max(4, 198 * ratio), 7, 2.5);
            }
        } else {
            bossHudLabel.setVisible(false);
        }
    }

    snapshot(
        world: ArcadeWorld,
        pauseBtn?: Phaser.GameObjects.Container,
    ): PelagicHudStateSnapshot {
        const cSnap = world.chargedShot.snapshot();
        return {
            visible: this.visible,
            scoreText: this.scoreValue.text,
            weaponLevel: world.weapons.weaponLevel,
            weaponLevelText: this.powerHeaderText.text,
            lives: world.lives,
            livesText: this.vidasMultiplierText.text,
            specialCharges: world.weapons.specialCharges,
            radioActive: this.visible && this.persistentRadioSource.length > 0,
            radioText: this.radioBodyText.text,
            radioPageIndex: this.radioPageIndex,
            radioPageCount: this.persistentRadioPages.length,
            radioExpression: this.lastRadioExpr,
            assisted: !!world.isAssisted,
            pauseCenter: pauseBtn ? { x: pauseBtn.x, y: pauseBtn.y } : null,
            hasLogoInGameplay: false,
            hasBayekInRadio: false,
            bayekTextureKey: this.bayekPortrait.texture.key,
            rivetTextureKey: this.rivetSprite.texture.key,
            chargePercent: cSnap.percent,
            chargePhase: cSnap.phase,
            chargeTier: cSnap.tier,
            arena: {
                left: world.arena.left,
                right: world.arena.right,
                top: world.arena.top,
                bottom: world.arena.bottom,
                width: world.arenaWidth,
            },
        };
    }
}

function chamferPath(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    tl = 6,
    tr = 6,
    br = 6,
    bl = 6,
): void {
    g.beginPath()
        .moveTo(x + tl, y)
        .lineTo(x + w - tr, y)
        .lineTo(x + w, y + tr)
        .lineTo(x + w, y + h - br)
        .lineTo(x + w - br, y + h)
        .lineTo(x + bl, y + h)
        .lineTo(x, y + h - bl)
        .lineTo(x, y + tl)
        .closePath();
}

function strokeGlow(g: Phaser.GameObjects.Graphics, draw: () => void, width = 1.4): void {
    g.lineStyle(width + 1.8, 0x0ea5e9, 0.35);
    draw();
    g.strokePath();
    g.lineStyle(width, 0x6ce9ff, 0.94);
    draw();
    g.strokePath();
}

function drawCard(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    tl = 6,
    tr = 6,
    br = 6,
    bl = 6,
    transparentCenter = false,
): void {
    if (!transparentCenter) {
        g.fillGradientStyle(0x042154, 0x042154, 0x021336, 0x021336, 0.95);
        chamferPath(g, x, y, w, h, tl, tr, br, bl);
        g.fillPath();
    }
    strokeGlow(g, () => chamferPath(g, x, y, w, h, tl, tr, br, bl), 1.4);
}

function drawTopPlacarChrome(g: Phaser.GameObjects.Graphics): void {
    const drawPlate = () =>
        g.beginPath()
            .moveTo(334, 0)
            .lineTo(434, 0)
            .lineTo(426, 19)
            .lineTo(342, 19)
            .closePath();

    g.fillGradientStyle(0x032257, 0x032257, 0x021336, 0x021336, 0.94);
    drawPlate();
    g.fillPath();

    // Small yellow angled end-caps matching reference #4
    g.fillStyle(0xffd91f, 0.96).beginPath()
        .moveTo(324, 0).lineTo(332, 0).lineTo(339, 16).lineTo(332, 16).closePath().fillPath();
    g.fillStyle(0xffd91f, 0.96).beginPath()
        .moveTo(436, 0).lineTo(444, 0).lineTo(436, 16).lineTo(429, 16).closePath().fillPath();

    g.lineStyle(2.4, 0x0ea5e9, 0.35);
    g.beginPath().moveTo(334, 0).lineTo(342, 19).lineTo(426, 19).lineTo(434, 0).strokePath();
    g.lineStyle(1.2, 0x6ce9ff, 0.95);
    g.beginPath().moveTo(334, 0).lineTo(342, 19).lineTo(426, 19).lineTo(434, 0).strokePath();
}

function drawAngledPill(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    slant: number,
    style: 'gold' | 'cyan',
): void {
    const cTop = style === 'gold' ? 0xfff07a : 0x62f2ff;
    const cBot = style === 'gold' ? 0xf5b800 : 0x0eb5e6;
    g.fillGradientStyle(cTop, cTop, cBot, cBot, 1)
        .beginPath()
        .moveTo(x + 2, y)
        .lineTo(x + w, y)
        .lineTo(x + w - slant, y + h)
        .lineTo(x, y + h)
        .lineTo(x, y + 2)
        .closePath()
        .fillPath();
    g.lineStyle(1.2, 0x06193b, 0.95).strokePath();
}

function drawChamferRibbon(
    g: Phaser.GameObjects.Graphics,
    cx: number,
    cy: number,
    w: number,
    h: number,
    style: 'gold' | 'cyan',
    skew = 7,
): void {
    const x0 = cx - w * 0.5;
    const x1 = cx + w * 0.5;
    const y0 = cy - h * 0.5;
    const y1 = cy + h * 0.5;
    const cTop = style === 'gold' ? 0xfff07a : 0x5ef0ff;
    const cBot = style === 'gold' ? 0xf2b000 : 0x0fb5e6;
    const draw = () =>
        g.beginPath()
            .moveTo(x0 + skew, y0)
            .lineTo(x1 - skew, y0)
            .lineTo(x1, cy)
            .lineTo(x1 - skew, y1)
            .lineTo(x0 + skew, y1)
            .lineTo(x0, cy)
            .closePath();

    g.fillGradientStyle(cTop, cTop, cBot, cBot, 1);
    draw();
    g.fillPath();
    g.lineStyle(1.3, 0x06193b, 0.95);
    draw();
    g.strokePath();
}

function drawSlashes(g: Phaser.GameObjects.Graphics, xs: number[], y0: number, y1: number): void {
    g.fillStyle(0xffd91f, 0.95);
    for (const x of xs) {
        g.beginPath()
            .moveTo(x, y1)
            .lineTo(x + 4.2, y1)
            .lineTo(x + 9.0, y0)
            .lineTo(x + 4.8, y0)
            .closePath()
            .fillPath();
    }
}

function drawRadioGlyph(g: Phaser.GameObjects.Graphics, cx: number, cy: number): void {
    g.fillStyle(0x38efff, 1).fillCircle(cx, cy, 2.0);
    g.lineStyle(1.3, 0x38efff, 0.95);
    for (const r of [4.6, 7.4]) {
        g.beginPath().arc(cx, cy, r, -0.78, 0.78, false).strokePath();
        g.beginPath().arc(cx, cy, r, Math.PI - 0.78, Math.PI + 0.78, false).strokePath();
    }
}
