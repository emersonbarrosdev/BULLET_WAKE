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
 * Uses the 1920x1080 (2.5x) vector/HD-rebuilt chassis (with crisp baked frames, static 1-thruster
 * RIVET profile, Bayek portraits, ROTA 01 artwork, RÁDIO dialogue box & static labels) and renders
 * ONLY dynamic live telemetry on top: Score, POWER gauge squares, VIDAS icons, ESPECIAL slots,
 * active boss HP bar, and animated RÁDIO waveform.
 */
export class PelagicDesktopHud {
    readonly chassis: Phaser.GameObjects.Image;
    readonly scoreValue: Phaser.GameObjects.Text;

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
            opts?: { ox?: number; oy?: number; stroke?: string; strokeThickness?: number; depth?: number },
        ) =>
            scene.add
                .text(x, y, txt, {
                    fontFamily: FONT,
                    fontSize: `${size}px`,
                    fontStyle: 'bold italic',
                    color,
                    stroke: opts?.stroke ?? '#041430',
                    strokeThickness: opts?.strokeThickness ?? 2.6,
                })
                .setResolution(2)
                .setOrigin(opts?.ox ?? 0.5, opts?.oy ?? 0.5)
                .setDepth(opts?.depth ?? 42)
                .setVisible(false);

        this.chassis = scene.add
            .image(384, 216, UI_TEX.hudPelagicChassis)
            .setDisplaySize(768, 432)
            .setDepth(39.6)
            .setVisible(false);

        // Top Bar: Score value ONLY (centered cleanly in left half [209..368], midline y=14)
        this.scoreValue = mkText(290, 14, '0000000', 15, '#ffdf33', { stroke: '#04122b', strokeThickness: 3 });

        this.allNodes = [
            this.chassis,
            this.scoreValue,
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

        // 1. VIDAS (5 crisp RIVET UP mini-icons evenly aligned beside baked VIDAS label at y=317.5)
        lifeIcons.forEach((sprite, i) => {
            sprite.setPosition(78 + i * 19.5, 317.5).setDisplaySize(15, 18).setVisible(true);
            if (i < world.lives) sprite.clearTint().setAlpha(1);
            else sprite.setTint(0x6998cc).setAlpha(0.46);
        });

        // 2. ESPECIAL 5 chamfered slots aligned beside baked lightning bolt (x=113..176, cy=352.5)
        for (let i = 0; i < 5; i++) {
            const sx = 113 + i * 13;
            const sy = 346.2;
            const filled = i < world.weapons.specialCharges;
            g.fillStyle(filled ? 0xffdf2e : 0x092252, 1).fillRoundedRect(sx, sy, 11.2, 12.6, 2.4);
            if (filled) g.fillStyle(0xfff9b8, 0.6).fillRect(sx + 1.3, sy + 1.1, 8.6, 2.3);
            g.lineStyle(1.1, filled ? 0xffe866 : 0x3b80b8, filled ? 0.96 : 0.85).strokeRoundedRect(sx, sy, 11.2, 12.6, 2.4);
        }

        // 3. Unified Top Bar: value-only Score | (baked divider at x=368) | POWER + 5 Power-Up gold squares
        const scoreStr = String(Math.max(0, Math.floor(world.score))).padStart(7, '0');
        if (scoreStr !== this.lastScoreStr) {
            this.scoreValue.setText(scoreStr);
            this.lastScoreStr = scoreStr;
        }

        levelText
            .setStyle({
                fontFamily: FONT,
                fontSize: '12px',
                fontStyle: 'bold italic',
                color: '#ffffff',
                stroke: '#04122b',
                strokeThickness: 2.8,
            })
            .setResolution(2)
            .setOrigin(0, 0.5)
            .setPosition(382, 14)
            .setText('POWER')
            .setVisible(true);

        for (let i = 0; i < 5; i++) {
            const x = 442 + i * 19.5;
            const y = 8;
            const active = i < world.weapons.weaponLevel;
            g.fillStyle(active ? 0xffdf2e : 0x08214e, 1).fillRoundedRect(x, y, 16.5, 12, 2.8);
            if (active) {
                g.fillStyle(0xfff9b8, 0.65).fillRoundedRect(x + 1.4, y + 1.3, 13.7, 2.6, 1);
                g.fillStyle(0xd97706, 0.48).fillRect(x + 1.5, y + 9.2, 13.5, 1.8);
            }
            g.lineStyle(1.1, active ? 0xfff078 : 0x3c7db4, active ? 0.98 : 0.85).strokeRoundedRect(x, y, 16.5, 12, 2.8);
        }

        // Subtle ASSISTIDO tag cleanly inside top-right header strip beside Pause button
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
                .setPosition(665, 16)
                .setVisible(true);
        } else {
            assistBadge.setVisible(false);
        }

        // 4. Boss HP bar cleanly tucked directly under the unified top bar inside center arena when boss is live
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

        // 5. RÁDIO Animated / Quiet Audio Waveform (x = 661..749, cy = 243 below BAYEK plate)
        const speaking = !!comms || introRadioActive;
        this.lastRadioExpr = speaking ? (comms?.expression ?? 0) : 0;

        const bars = 18;
        const baseX = 661;
        const stepX = 5.1;
        const centerY = 243;
        for (let i = 0; i < bars; i++) {
            const bx = baseX + i * stepX;
            const env = Math.sin((i / (bars - 1)) * Math.PI);
            if (speaking) {
                const wave = 0.35 + 0.65 * Math.abs(Math.sin(clock * 11.5 + i * 0.82) * Math.cos(clock * 6.3 - i * 0.41));
                const bh = 3.5 + 21 * (0.28 + 0.72 * env) * wave;
                g.fillStyle(0x2cf0ff, 0.92).fillRoundedRect(bx, centerY - bh * 0.5, 2.8, bh, 1.3);
                g.fillStyle(0xb5feff, 0.7).fillRect(bx + 0.6, centerY - bh * 0.28, 1.6, bh * 0.56);
            } else {
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
}
