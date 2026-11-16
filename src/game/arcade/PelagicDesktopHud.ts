import Phaser from 'phaser';
import { UI_TEX } from './ArcadeMenuArt';
import type { ArcadeWorld } from './ArcadeWorld';
import type { PelagicCommsState } from './PelagicComms';
import { subTotalHp } from './PelagicSubmarineBoss';

const FONT = 'Trebuchet MS, Segoe UI, sans-serif';

export interface PelagicHudStateSnapshot {
    visible: boolean;
    scoreText: string;
    weaponLevel: number;
    weaponLevelText: string;
    lives: number;
    specialCharges: number;
    radioActive: boolean;
    radioText: string;
    radioExpression: number;
    assisted: boolean;
    pauseCenter: { x: number; y: number } | null;
    arena: { left: number; right: number; top: number; bottom: number; width: number };
}

/**
 * Modular PC Horizontal Desktop HUD for Fenda Pelágica (Stage 1 UP).
 * Assembles the unified 3-region cabinet frame (Left 192u | Center 384u | Right 192u)
 * cleanly out of separate layered textures, live portraits, animated waveform, and Phaser text.
 */
export class PelagicDesktopHud {
    readonly bayekSky: Phaser.GameObjects.Image;
    readonly bayekPortrait: Phaser.GameObjects.Sprite;
    readonly routeThumb: Phaser.GameObjects.Image;
    readonly radioSky: Phaser.GameObjects.Image;
    readonly radioPortrait: Phaser.GameObjects.Sprite;
    readonly chassis: Phaser.GameObjects.Image;
    readonly logo: Phaser.GameObjects.Image;
    readonly rivetSide: Phaser.GameObjects.Sprite;
    readonly bayekTag: Phaser.GameObjects.Text;
    readonly rivetTitle: Phaser.GameObjects.Text;
    readonly vanguardaTag: Phaser.GameObjects.Text;
    readonly vidasLabel: Phaser.GameObjects.Text;
    readonly especialLabel: Phaser.GameObjects.Text;
    readonly scoreLabel: Phaser.GameObjects.Text;
    readonly scoreValue: Phaser.GameObjects.Text;
    readonly rotaTag: Phaser.GameObjects.Text;
    readonly rotaName: Phaser.GameObjects.Text;
    readonly radioHeader: Phaser.GameObjects.Text;
    readonly radioName: Phaser.GameObjects.Text;

    private readonly allNodes: Array<Phaser.GameObjects.Components.Visible & Phaser.GameObjects.GameObject>;
    private visible = false;
    private lastScoreStr = '';
    private lastRadioExpr = 0;

    constructor(scene: Phaser.Scene) {
        const mkText = (
            x: number,
            y: number,
            txt: string,
            size: number,
            color: string,
            opts?: { ox?: number; oy?: number; stroke?: string; strokeThickness?: number; depth?: number; style?: string },
        ) =>
            scene.add
                .text(x, y, txt, {
                    fontFamily: FONT,
                    fontSize: `${size}px`,
                    fontStyle: opts?.style ?? 'bold italic',
                    color,
                    stroke: opts?.stroke ?? '#041430',
                    strokeThickness: opts?.strokeThickness ?? 2.6,
                })
                .setResolution(2)
                .setOrigin(opts?.ox ?? 0.5, opts?.oy ?? 0.5)
                .setDepth(opts?.depth ?? 42)
                .setVisible(false);

        // Underlay sky apertures + live Bayek portraits + coastal mission artwork (behind chassis frame bevels)
        this.bayekSky = scene.add.image(96, 166, UI_TEX.hudPelagicSky).setDisplaySize(160, 122).setDepth(38.5).setVisible(false);
        this.bayekPortrait = scene.add.sprite(96, 170, 'arc-pilots', 0).setDisplaySize(148, 148).setDepth(39.0).setVisible(false);
        this.routeThumb = scene.add
            .image(672, 120, UI_TEX.hudRoutePelagic)
            .setDisplaySize(160, 76)
            .setDepth(38.8)
            .setVisible(false);
        this.radioSky = scene.add.image(623, 223, UI_TEX.hudPelagicSky).setDisplaySize(54, 54).setDepth(38.5).setVisible(false);
        this.radioPortrait = scene.add.sprite(623, 225, 'arc-pilots', 0).setDisplaySize(54, 54).setDepth(39.0).setVisible(false);

        // Unified 2x metallic cobalt & glowing cyan cabinet frame (with transparent windows)
        this.chassis = scene.add.image(384, 216, UI_TEX.hudPelagicChassis).setDisplaySize(768, 432).setDepth(39.6).setVisible(false);

        // Foreground modular art & arcade typography (above graphics depth 41)
        this.logo = scene.add.image(96, 51, UI_TEX.logo).setDisplaySize(156, 100).setDepth(42).setVisible(false);
        this.rivetSide = scene.add.sprite(53, 277, UI_TEX.rivetCruise, 0).setDisplaySize(66, 66).setDepth(42).setVisible(false);
        if (scene.anims.exists('ui-rivet-cruise')) this.rivetSide.play('ui-rivet-cruise');

        this.bayekTag = mkText(96, 228.5, 'BAYEK', 13.5, '#071d44', { stroke: '#fff7b8', strokeThickness: 1 });
        this.rivetTitle = mkText(132, 269.5, 'RIVET', 14.5, '#ffffff', { strokeThickness: 3 });
        this.vanguardaTag = mkText(132, 289.5, 'VANGUARDA', 8.5, '#ffffff', { stroke: '#052b5e', strokeThickness: 2 });
        this.vidasLabel = mkText(22, 326, 'VIDAS', 10, '#ffffff', { ox: 0, strokeThickness: 2.4 });
        this.especialLabel = mkText(22, 367, 'ESPECIAL', 9.5, '#ffffff', { ox: 0, strokeThickness: 2.4 });

        this.scoreLabel = mkText(224, 14.5, 'PONTUAÇÃO', 11.5, '#ffffff', { ox: 0, stroke: '#04122b', strokeThickness: 2.8 });
        this.scoreValue = mkText(308, 14.5, '0000000', 13.5, '#ffdf33', { ox: 0, stroke: '#04122b', strokeThickness: 2.8 });

        this.rotaTag = mkText(643, 48.5, 'ROTA 01', 10.5, '#071d44', { stroke: '#fff7b8', strokeThickness: 1 });
        this.rotaName = mkText(672, 70, 'FENDA PELÁGICA', 13, '#ffffff', { strokeThickness: 2.8 });
        this.radioHeader = mkText(618, 180.5, 'RÁDIO', 11, '#ffffff', { ox: 0, strokeThickness: 2.4 });
        this.radioName = mkText(695, 206.5, 'BAYEK', 10.5, '#071d44', { stroke: '#fff7b8', strokeThickness: 1 });

        this.allNodes = [
            this.bayekSky,
            this.bayekPortrait,
            this.routeThumb,
            this.radioSky,
            this.radioPortrait,
            this.chassis,
            this.logo,
            this.rivetSide,
            this.bayekTag,
            this.rivetTitle,
            this.vanguardaTag,
            this.vidasLabel,
            this.especialLabel,
            this.scoreLabel,
            this.scoreValue,
            this.rotaTag,
            this.rotaName,
            this.radioHeader,
            this.radioName,
        ];
    }

    setVisible(show: boolean): void {
        if (this.visible === show) return;
        this.visible = show;
        for (const node of this.allNodes) node.setVisible(show);
        if (!show) {
            this.lastScoreStr = '';
            this.lastRadioExpr = 0;
        }
    }

    isVisible(): boolean {
        return this.visible;
    }

    draw(
        world: ArcadeWorld,
        g: Phaser.GameObjects.Graphics,
        lifeIcons: Phaser.GameObjects.Image[],
        levelText: Phaser.GameObjects.Text,
        assistBadge: Phaser.GameObjects.Text,
        bossHudLabel: Phaser.GameObjects.Text,
        comms: PelagicCommsState | null,
        introRadioActive: boolean,
        clock: number,
    ): void {
        if (!this.visible) this.setVisible(true);

        // 1. Dynamic ribbons / pills on top of chassis (`depth 41`)
        drawChamferRibbon(g, 96, 228.5, 134, 21, 'gold', 7);
        drawChamferRibbon(g, 132, 289.5, 78, 15, 'cyan', 5);
        drawAngledTag(g, 592, 40, 108, 17, 'gold', 8);
        drawAngledTag(g, 656, 198, 82, 17, 'gold', 7);

        // Small matching yellow diagonal accent next to BAYEK radio nameplate
        g.fillStyle(0xffe029, 1)
            .beginPath()
            .moveTo(741, 198)
            .lineTo(747, 198)
            .lineTo(742, 215)
            .lineTo(736, 215)
            .closePath()
            .fillPath();

        // Cyan radio signal icon ((•)) beside RÁDIO header
        g.fillStyle(0x36f2ff, 1).fillCircle(604, 180.5, 2.2);
        g.lineStyle(1.4, 0x36f2ff, 0.95);
        for (const r of [4.8, 7.6]) {
            g.beginPath().arc(604, 180.5, r, -0.75, 0.75, false).strokePath();
            g.beginPath().arc(604, 180.5, r, Math.PI - 0.75, Math.PI + 0.75, false).strokePath();
        }

        // 2. VIDAS (5 RIVET UP mini-icons, active bright vs lost dim slate)
        lifeIcons.forEach((sprite, i) => {
            sprite.setPosition(76 + i * 18.5, 326).setDisplaySize(16, 19).setVisible(true);
            if (i < world.lives) sprite.clearTint().setAlpha(1);
            else sprite.setTint(0x6998cc).setAlpha(0.46);
        });

        // 3. ESPECIAL lightning icon + 5 chamfered segments
        g.fillStyle(0xffe033, 1)
            .lineStyle(1.4, 0x051636, 1)
            .beginPath()
            .moveTo(82, 358.5)
            .lineTo(75.5, 367.5)
            .lineTo(80, 367.5)
            .lineTo(78, 375.5)
            .lineTo(86.5, 365.5)
            .lineTo(81.5, 365.5)
            .closePath()
            .fillPath()
            .strokePath();

        for (let i = 0; i < 5; i++) {
            const sx = 95 + i * 14.5;
            const sy = 360.5;
            const filled = i < world.weapons.specialCharges;
            g.fillStyle(filled ? 0xffe033 : 0x092454, 1).fillRoundedRect(sx, sy, 12, 12.5, 2.5);
            if (filled) g.fillStyle(0xfff9b8, 0.55).fillRect(sx + 1.5, sy + 1.3, 9, 2.5);
            g.lineStyle(1.1, filled ? 0xfff07a : 0x42c4e8, filled ? 0.95 : 0.85).strokeRoundedRect(sx, sy, 12, 12.5, 2.5);
        }

        // 4. Unified Top Bar Score (`0000000`) & Weapon Level (`NV 1..5`) + 5 glowing segments
        const scoreStr = String(Math.max(0, Math.floor(world.score))).padStart(7, '0');
        if (scoreStr !== this.lastScoreStr) {
            this.scoreValue.setText(scoreStr);
            this.lastScoreStr = scoreStr;
        }

        levelText
            .setStyle({
                fontFamily: FONT,
                fontSize: '11.5px',
                fontStyle: 'bold italic',
                color: '#ffffff',
                stroke: '#04122b',
                strokeThickness: 2.8,
            })
            .setResolution(2)
            .setOrigin(0, 0.5)
            .setPosition(408, 14.5)
            .setText(`NV ${world.weapons.weaponLevel}`)
            .setVisible(true);

        for (let i = 0; i < 5; i++) {
            const x = 450 + i * 19;
            const y = 8;
            const active = i < world.weapons.weaponLevel;
            g.fillStyle(active ? 0x1ae6ff : 0x0a2452, 1).fillRoundedRect(x, y, 16, 12.5, 3);
            if (active) g.fillStyle(0xb6feff, 0.55).fillRoundedRect(x + 1.5, y + 1.4, 13, 2.6, 1);
            g.lineStyle(1.1, active ? 0x7ef5ff : 0x3b96c8, active ? 0.96 : 0.85).strokeRoundedRect(x, y, 16, 12.5, 3);
        }

        // Subtle ASSISTIDO tag cleanly inside top-right header strip beside Pause button (never crowds top score bar)
        if (world.isAssisted) {
            assistBadge
                .setStyle({
                    fontFamily: FONT,
                    fontSize: '8.5px',
                    fontStyle: 'bold italic',
                    color: '#8cfff3',
                    stroke: '#041430',
                    strokeThickness: 2,
                })
                .setOrigin(0.5)
                .setPosition(648, 14.5)
                .setVisible(true);
        } else {
            assistBadge.setVisible(false);
        }

        // 5. Boss HP bar cleanly tucked directly under the unified top bar inside center arena when boss is live
        if (world.boss?.sub && world.boss.sub.phase !== 'done') {
            const sub = world.boss.sub;
            const sec = sub.sections[sub.activeSection];
            const totals = subTotalHp(sub);
            g.fillStyle(0x041430, 0.88).fillRoundedRect(204, 32, 360, 14, 4);
            g.lineStyle(1.1, 0x4ae6ff, 0.85).strokeRoundedRect(204, 32, 360, 14, 4);
            bossHudLabel.setPosition(212, 39).setFontSize(8.5).setText(`${sec.index + 1}/5 ${sec.name}`).setVisible(true);
            for (let i = 0; i < sub.sections.length; i++) {
                const px = 452 + i * 21;
                const pw = 18.5;
                const sItem = sub.sections[i];
                const sCur = Math.max(0, sItem.hullHp) + sItem.parts.reduce((acc, p) => acc + Math.max(0, p.hp), 0);
                const sMax = sItem.hullMaxHp + sItem.parts.reduce((acc, p) => acc + p.maxHp, 0);
                const ratio = sMax > 0 ? Math.max(0, Math.min(1, sCur / sMax)) : 0;
                g.fillStyle(0x0b2649, 0.95).fillRoundedRect(px, 35.5, pw, 7, 2);
                if (ratio > 0) {
                    const col = i === sub.activeSection ? (totals.current < totals.max * 0.25 ? 0xff6e54 : 0xffd84d) : 0x2292d6;
                    g.fillStyle(col, 0.96).fillRoundedRect(px, 35.5, pw * ratio, 7, 2);
                }
                g.lineStyle(0.8, i === sub.activeSection ? 0xfff1a6 : 0x66d7ff, 0.85).strokeRoundedRect(px, 35.5, pw, 7, 2);
            }
        } else if (world.boss && world.boss.phase !== 'absent' && world.boss.phase !== 'sink' && world.boss.parts.length > 0) {
            const curHp = world.boss.parts.reduce((acc, p) => acc + Math.max(0, p.hp), 0);
            const maxHp = Math.max(1, world.boss.parts.reduce((acc, p) => acc + Math.max(0, p.maxHp), 0));
            const ratio = Math.max(0, Math.min(1, curHp / maxHp));
            bossHudLabel.setPosition(214, 39).setFontSize(8.5).setText('FORÇA NAVAL').setVisible(curHp > 0);
            if (curHp > 0) {
                g.fillStyle(0x041430, 0.88).fillRoundedRect(204, 32, 360, 14, 4);
                g.lineStyle(1.1, 0x4ae6ff, 0.85).strokeRoundedRect(204, 32, 360, 14, 4);
                g.fillStyle(0x280c18, 0.95).fillRoundedRect(306, 35.5, 248, 7, 2.5);
                if (ratio > 0) g.fillStyle(0xff4f52, 1).fillRoundedRect(306, 35.5, Math.max(4, 248 * ratio), 7, 2.5);
            }
        } else {
            bossHudLabel.setVisible(false);
        }

        // 6. RÁDIO Pilot Portrait Expression + Animated / Quiet Audio Waveform
        const speaking = !!comms || introRadioActive;
        const targetExpr = speaking ? (comms?.expression ?? 0) : 0;
        if (targetExpr !== this.lastRadioExpr) {
            this.radioPortrait.setFrame(targetExpr);
            this.lastRadioExpr = targetExpr;
        }

        const bars = 18;
        const baseX = 660;
        const stepX = 4.9;
        const centerY = 236;
        for (let i = 0; i < bars; i++) {
            const bx = baseX + i * stepX;
            const env = Math.sin((i / (bars - 1)) * Math.PI);
            if (speaking) {
                const wave = 0.35 + 0.65 * Math.abs(Math.sin(clock * 11.5 + i * 0.82) * Math.cos(clock * 6.3 - i * 0.41));
                const bh = 3.5 + 21 * (0.28 + 0.72 * env) * wave;
                g.fillStyle(0x2cf0ff, 0.92).fillRoundedRect(bx, centerY - bh * 0.5, 2.8, bh, 1.3);
                g.fillStyle(0xb5feff, 0.7).fillRect(bx + 0.6, centerY - bh * 0.28, 1.6, bh * 0.56);
            } else {
                // Quiet rest state when no radio transmission is active
                const dotH = 2.4 + env * 1.4;
                g.fillStyle(0x32c5e8, 0.36).fillRoundedRect(bx, centerY - dotH * 0.5, 2.6, dotH, 1.2);
            }
        }
    }

    snapshot(
        world: ArcadeWorld,
        levelText: Phaser.GameObjects.Text,
        radioTextNode: Phaser.GameObjects.Text,
        pauseBtn?: Phaser.GameObjects.Container,
    ): PelagicHudStateSnapshot {
        return {
            visible: this.visible,
            scoreText: this.scoreValue.text,
            weaponLevel: world.weapons.weaponLevel,
            weaponLevelText: levelText.text,
            lives: world.lives,
            specialCharges: world.weapons.specialCharges,
            radioActive: radioTextNode.visible && radioTextNode.text.length > 0,
            radioText: radioTextNode.text,
            radioExpression: this.lastRadioExpr,
            assisted: !!world.isAssisted,
            pauseCenter: pauseBtn ? { x: pauseBtn.x, y: pauseBtn.y } : null,
            arena: {
                left: world.arena.left,
                right: world.arena.right,
                top: world.arena.top,
                bottom: world.arena.bottom,
                width: world.arenaWidth,
            },
        };
    }

    getLevelTextPreview(levelText: Phaser.GameObjects.Text): string {
        return levelText.text;
    }
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
    const fill = style === 'gold' ? 0xffe029 : 0x0cb8f5;
    const hi = style === 'gold' ? 0xfff8b5 : 0x7ef2ff;
    const line = style === 'gold' ? 0x061a3d : 0x052854;

    g.fillStyle(fill, 1)
        .lineStyle(1.4, line, 1)
        .beginPath()
        .moveTo(x0 + skew, y0)
        .lineTo(x1 - skew, y0)
        .lineTo(x1, cy)
        .lineTo(x1 - skew, y1)
        .lineTo(x0 + skew, y1)
        .lineTo(x0, cy)
        .closePath()
        .fillPath()
        .strokePath();

    g.lineStyle(1, hi, 0.72).lineBetween(x0 + skew + 2, y0 + 2, x1 - skew - 2, y0 + 2);
}

function drawAngledTag(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    style: 'gold' | 'cyan',
    slant = 7,
): void {
    const fill = style === 'gold' ? 0xffe029 : 0x0cb8f5;
    const hi = style === 'gold' ? 0xfff8b5 : 0x7ef2ff;
    const line = style === 'gold' ? 0x061a3d : 0x052854;

    g.fillStyle(fill, 1)
        .lineStyle(1.3, line, 1)
        .beginPath()
        .moveTo(x + 3, y)
        .lineTo(x + w, y)
        .lineTo(x + w - slant, y + h)
        .lineTo(x, y + h)
        .lineTo(x, y + 3)
        .closePath()
        .fillPath()
        .strokePath();

    g.lineStyle(1, hi, 0.65).lineBetween(x + 4, y + 1.8, x + w - 3, y + 1.8);
}
