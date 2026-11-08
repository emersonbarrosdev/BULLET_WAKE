import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

import { createStageBoss } from '../src/game/systems/bosses/factory.ts';
import { BossKrm17 } from '../src/game/systems/bossKrm17.ts';
import { BossSerpent } from '../src/game/systems/bosses/bossSerpent.ts';
import { BossFortress } from '../src/game/systems/bosses/bossFortress.ts';
import { BossInterceptor } from '../src/game/systems/bosses/bossInterceptor.ts';
import { BossMeshCore } from '../src/game/systems/bosses/bossMeshCore.ts';

const bossSheets = [
  ['bosses/serpent/head.png', 64, 64, 4],
  ['bosses/serpent/body.png', 48, 48, 4],
  ['bosses/fortress/chassis.png', 128, 128, 4],
  ['bosses/fortress/core.png', 40, 40, 4],
  ['bosses/interceptor/chassis.png', 96, 48, 4],
  ['bosses/interceptor/wing.png', 48, 32, 4],
  ['bosses/mesh_core/monolith.png', 112, 112, 4],
  ['bosses/mesh_core/heart.png', 48, 48, 4],
];

for (const [relPath, fw, fh, count] of bossSheets) {
  test('Chefe sprite ' + relPath + ' tem PNG alfa e frames animados', () => {
    const b = readFileSync('public/assets/' + relPath);
    assert.equal(b.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(b.readUInt32BE(16), fw * count);
    assert.equal(b.readUInt32BE(20), fh);
    assert.equal(b[25], 6); // RGBA

    let pos = 8;
    const payload = [];
    while (pos < b.length) {
      const n = b.readUInt32BE(pos);
      const kind = b.toString('ascii', pos + 4, pos + 8);
      if (kind === 'IDAT') payload.push(b.subarray(pos + 8, pos + 8 + n));
      pos += n + 12;
    }
    const raw = inflateSync(Buffer.concat(payload));
    assert.equal(raw.length, (fw * count * 4 + 1) * fh);

    const seen = new Set();
    for (let f = 0; f < count; f++) {
      let a = 0;
      const px = [];
      for (let y = 0; y < fh; y++) {
        const start = y * (fw * count * 4 + 1);
        assert.equal(raw[start], 0);
        for (let x = 0; x < fw; x++) {
          const p = start + 1 + (f * fw + x) * 4;
          const alpha = raw[p + 3];
          if (alpha > 0) a++;
          px.push(raw[p], raw[p + 1], raw[p + 2], alpha);
        }
      }
      assert.ok(a > 0, 'frame vazio: ' + f);
      assert.ok(a < fw * fh * 0.95, 'frame sem transparencia: ' + f);
      seen.add(Buffer.from(px).toString('base64'));
    }
    assert.ok(seen.size >= 2, 'animacao estatica: ' + relPath);
  });
}

test('createStageBoss creates correct boss instances for all 5 stages', () => {
  const b1 = createStageBoss(1);
  const b2 = createStageBoss(2);
  const b3 = createStageBoss(3);
  const b4 = createStageBoss(4);
  const b5 = createStageBoss(5);

  assert.equal(b1.name, 'KRM-17 Excavator');
  assert.equal(b2.name, 'Serpente de Extração');
  assert.equal(b3.name, 'Fortaleza de Núcleos');
  assert.equal(b4.name, 'Interceptador de Tempestade');
  assert.equal(b5.name, 'Coração da MALHA');
});

test('BossSerpent transitions through phases and exposes weak point', () => {
  const boss = new BossSerpent();
  assert.equal(boss.phase, 'intro');
  assert.equal(boss.hp, 130);

  // Advance past intro
  boss.update(3000, 100, 216);
  assert.equal(boss.phase, 'phase1');

  // Damage to phase 2
  boss.damage(60, boss.x, boss.y);
  boss.update(50, 100, 216);
  assert.equal(boss.phase, 'phase2');

  // Damage to phase 3
  boss.damage(45, boss.x, boss.y);
  boss.update(50, 100, 216);
  assert.equal(boss.phase, 'phase3');

  // Head weak point in phase 3 deals amplified damage
  const hit = boss.damage(10, boss.x - 60, boss.y);
  assert.ok(hit.bossDamage > 10, 'Expected weak point critical damage');

  // Complete defeat
  boss.damage(100, boss.x, boss.y);
  assert.equal(boss.hp, 0);
  assert.equal(boss.phase, 'defeated');
});

test('BossFortress barrier absorbs damage until penetrated', () => {
  const boss = new BossFortress();
  boss.update(3500, 100, 216);
  assert.equal(boss.phase, 'phase1');

  // Hull hit with barrier active deals reduced damage
  const reducedHit = boss.damage(10, boss.x, boss.y);
  assert.ok(reducedHit.bossDamage < 10, 'Barrier should reduce hull damage');

  // Destroying barrier
  boss.damage(50, boss.x - 65, boss.y);
  const barrierMod = boss.modules.find(m => m.id === 'barrier');
  assert.equal(barrierMod.destroyed, true);

  // Defeat condition
  boss.damage(200, boss.x, boss.y);
  assert.equal(boss.hp, 0);
  assert.equal(boss.phase, 'defeated');
});

test('BossInterceptor maneuvers and telegraphs ion railgun', () => {
  const boss = new BossInterceptor();
  boss.update(3000, 100, 250);
  assert.equal(boss.phase, 'phase1');

  // Transition to phase 2
  boss.damage(85, boss.x, boss.y);
  boss.update(50, 100, 250);
  assert.equal(boss.phase, 'phase2');

  // Update until telegraph triggers
  let telegraphed = false;
  for (let t = 0; t < 4000; t += 100) {
    const tick = boss.update(100, 100, 250);
    if (tick.telegraph) {
      telegraphed = true;
      break;
    }
  }
  assert.ok(telegraphed, 'Expected telegraph in phase 2');

  // Transition to phase 3 and defeat
  boss.damage(150, boss.x, boss.y);
  assert.equal(boss.phase, 'defeated');
});

test('BossMeshCore executes Wake pulse with gaps and concludes campaign', () => {
  const boss = new BossMeshCore();
  boss.update(3500, 100, 216);
  assert.equal(boss.phase, 'phase1');

  // Transition to phase 2
  boss.damage(110, boss.x, boss.y);
  boss.update(50, 100, 216);
  assert.equal(boss.phase, 'phase2');

  // Phase 2 fires Wake pulse with safe gaps
  let firedWakePulse = false;
  for (let t = 0; t < 5000; t += 100) {
    const tick = boss.update(100, 100, 216);
    if (tick.shots.length >= 4) {
      firedWakePulse = true;
      break;
    }
  }
  assert.ok(firedWakePulse, 'Expected Wake pulse shot wave');

  // Phase 3 and defeat
  boss.damage(100, boss.x, boss.y);
  boss.update(50, 100, 216);
  assert.equal(boss.phase, 'phase3');

  boss.damage(100, boss.x, boss.y);
  assert.equal(boss.hp, 0);
  assert.equal(boss.phase, 'defeated');
});
