import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
    rivetBankColumn,
    rivetSheetFrame,
    enemyAirFrame,
    ufoAnimFrame,
} from '../src/game/arcade/PelagicActorAnimsMath.ts';

function readWebpSize(filePath) {
    const buf = fs.readFileSync(filePath);
    assert.equal(buf.toString('ascii', 0, 4), 'RIFF', `${filePath} missing RIFF header`);
    assert.equal(buf.toString('ascii', 8, 12), 'WEBP', `${filePath} missing WEBP signature`);
    const chunk = buf.toString('ascii', 12, 16);
    if (chunk === 'VP8X') {
        const w = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16));
        const h = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16));
        return { width: w, height: h, alpha: (buf[20] & 0x10) !== 0 };
    }
    if (chunk === 'VP8L') {
        const bits = buf.readUInt32LE(21);
        const w = 1 + (bits & 0x3fff);
        const h = 1 + ((bits >> 14) & 0x3fff);
        const alpha = ((bits >> 28) & 1) !== 0;
        return { width: w, height: h, alpha };
    }
    throw new Error(`Unsupported WebP chunk "${chunk}" in ${filePath}`);
}

test('pelagic animation spritesheets exist with exact grid dimensions and alpha channel', () => {
    const dir = path.resolve('public/assets/arcade/pelagic-review');
    const specs = [
        { file: 'rivet-up-sheet.webp', width: 1792, height: 1024 },
        { file: 'pelagic-enemy-air.webp', width: 896, height: 2048 },
        { file: 'pelagic-ufo-anim.webp', width: 768, height: 128 },
        { file: 'pelagic-vfx.webp', width: 512, height: 512 },
    ];
    for (const spec of specs) {
        const meta = readWebpSize(path.join(dir, spec.file));
        assert.equal(meta.width, spec.width, `${spec.file} width`);
        assert.equal(meta.height, spec.height, `${spec.file} height`);
        assert.equal(meta.alpha, true, `${spec.file} must have transparent alpha channel`);
    }
});

test('RIVET bank columns are symmetric, clamped and monotonic across [-1, 1]', () => {
    assert.equal(rivetBankColumn(-2), 0);
    assert.equal(rivetBankColumn(-1), 0);
    assert.equal(rivetBankColumn(0), 3);
    assert.equal(rivetBankColumn(1), 6);
    assert.equal(rivetBankColumn(2), 6);
    let prev = -1;
    for (let b = -1; b <= 1.0001; b += 0.1) {
        const col = rivetBankColumn(b);
        assert(col >= prev, `column decreased at bank=${b}`);
        assert.equal(col + rivetBankColumn(-b), 6, `asymmetric column at bank=${b}`);
        prev = col;
    }
});

test('RIVET sheet frame stays within 7x4 grid and animates over time', () => {
    const neutralFrames = new Set();
    for (let i = 0; i < 8; i++) {
        const frame = rivetSheetFrame(0, i * 0.072, false);
        assert(frame >= 0 && frame < 28);
        assert.equal(frame % 7, 3);
        neutralFrames.add(frame);
    }
    assert.equal(neutralFrames.size, 4, 'RIVET thruster flames must cycle through all 4 frames');

    const boostFrames = new Set();
    for (let i = 0; i < 8; i++) boostFrames.add(rivetSheetFrame(-0.9, i * 0.05, true));
    assert.equal(boostFrames.size, 4, 'Boosted flames must cycle through all 4 frames');
    assert([...boostFrames].every(f => f % 7 === 0));
});

test('enemyAirFrame maps each air family to its dedicated rows, columns and spin cycle', () => {
    const ranges = [
        { family: 'fighter', rowBase: 0, cols: 5 },
        { family: 'interceptor', rowBase: 4, cols: 5 },
        { family: 'acrobat', rowBase: 8, cols: 7 },
        { family: 'bomber', rowBase: 12, cols: 5 },
    ];
    for (const r of ranges) {
        const seenRows = new Set();
        const seenCols = new Set();
        for (let step = 0; step < 20; step++) {
            const bank = -1 + (2 * step) / 19;
            const frame = enemyAirFrame(r.family, bank, step * 0.03, 0);
            const row = Math.floor(frame / 7);
            const col = frame % 7;
            assert(row >= r.rowBase && row < r.rowBase + 4, `${r.family} row out of range: ${row}`);
            assert(col >= 0 && col < r.cols, `${r.family} col out of range: ${col}`);
            seenRows.add(row);
            seenCols.add(col);
        }
        assert.equal(seenRows.size, 4, `${r.family} must cycle all 4 motion rows`);
        assert.equal(seenCols.size, r.cols, `${r.family} must use all ${r.cols} bank columns`);
    }
    assert.equal(enemyAirFrame('boat', 0.5, 1.2), 0);
});

test('ufoAnimFrame cycles across all 6 saucer frames without exceeding bounds', () => {
    const seen = new Set();
    for (let i = 0; i < 12; i++) {
        const f = ufoAnimFrame(i * 0.05, 0.3);
        assert(f >= 0 && f < 6);
        seen.add(f);
    }
    assert.equal(ufoAnimFrame(0, 0) >= 0, true);
    assert.equal(seen.size, 6);
});

import { ArcadeWorld } from '../src/game/arcade/ArcadeWorld.ts';
import { FENDA, SOLAR } from '../src/game/arcade/content.ts';

test('RIVET UP lateral roll transitions smoothly across all 7 Sonic Wings poses without skipping or tilting bullets', () => {
    const w = new ArcadeWorld({ ...FENDA, encounters: [] });
    w.state = 'play';
    w.waveIndex = 999;
    w.supplyIndex = 999;

    const dt = 1 / 60;
    const x0 = w.player.x;
    const leftCols = [];
    for (let i = 0; i < 24; i++) {
        w.step(dt, { x: -1, y: 0, fire: i === 20, special: false });
        leftCols.push(rivetBankColumn(w.player.bank));
        if (i === 0) assert(w.player.x < x0, 'Horizontal velocity must respond immediately on frame 1');
    }
    for (const reqCol of [2, 1, 0]) assert(leftCols.includes(reqCol), `Left roll must pass through col ${reqCol}`);
    assert.equal(leftCols.at(-1), 0, 'Holding left sustains extreme left roll col 0');

    // Primary shot while maximally rolled left must still travel straight UP
    const bAtMaxLeft = w.bullets.find(b => b.active && !b.enemy);
    assert(bAtMaxLeft && bAtMaxLeft.vy < -300 && Math.abs(bAtMaxLeft.vx) < 1e-6, 'Primary shot stays dead-vertical UP even at extreme roll');

    // Rapid reversal LEFT -> RIGHT must step smoothly across every intermediate pose (0 -> 1 -> 2 -> 3 -> 4 -> 5 -> 6)
    const revCols = [];
    for (let i = 0; i < 36; i++) {
        w.step(dt, { x: 1, y: 0, fire: false, special: false });
        const c = rivetBankColumn(w.player.bank);
        if (revCols.at(-1) !== c) revCols.push(c);
    }
    for (let idx = 1; idx < revCols.length; idx++) {
        assert(Math.abs(revCols[idx] - revCols[idx - 1]) <= 1, `Reversal must never skip poses: ${revCols.join('->')}`);
    }
    for (const c of [1, 2, 3, 4, 5, 6]) assert(revCols.includes(c), `Reversal missing pose col ${c}: ${revCols.join('->')}`);

    // Release input -> smooth return to neutral col 3
    const backCols = [];
    for (let i = 0; i < 40; i++) {
        w.step(dt, { x: 0, y: 0, fire: false, special: false });
        const c = rivetBankColumn(w.player.bank);
        if (backCols.at(-1) !== c) backCols.push(c);
    }
    assert.equal(backCols.at(-1), 3, 'Releasing horizontal movement restores neutral col 3 smoothly');

    // Cidade Solar (SIDE) remains unaffected
    const side = new ArcadeWorld({ ...SOLAR, encounters: [] });
    side.state = 'play';
    assert.equal(side.up, false);
});
