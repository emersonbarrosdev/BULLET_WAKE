import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

const bossSheets = [
  ['bosses/krm17/hull.png', 144, 96, 4],
  ['bosses/krm17/drill.png', 48, 48, 4],
  ['bosses/krm17/turret.png', 32, 24, 4],
  ['bosses/krm17/core.png', 32, 32, 4],
];

for (const [relPath, fw, fh, count] of bossSheets) {
  test('Chefe KRM-17 ' + relPath + ' tem PNG alfa e frames animados', () => {
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
      assert.ok(a < fw * fh * 0.9, 'frame sem transparencia: ' + f);
      seen.add(Buffer.from(px).toString('base64'));
    }
    assert.ok(seen.size >= 2, 'animacao estatica: ' + relPath);
  });
}

import { BossKrm17 } from '../src/game/systems/bossKrm17.ts';

test('Boss KRM-17 transitions from intro to combat and fires aimed shots', () => {
  const boss = new BossKrm17();
  assert.equal(boss.phase, 'intro');

  // Advance through intro
  const tick1 = boss.update(2900, 200, 216);
  assert.equal(tick1.phase, 'phase1_turrets');
  assert.equal(tick1.hp, 140);

  // Advance to shoot
  const tick2 = boss.update(1500, 200, 216);
  assert.ok(tick2.shots.length > 0, 'boss shoots from turrets');
});

test('Boss KRM-17 modular destruction of turrets and phase 2 transition', () => {
  const boss = new BossKrm17();
  boss.update(2900, 200, 216); // Exit intro

  // Destroy top turret
  const hitTop = boss.damage(20, boss.x + boss.modules[0].offsetX, boss.y + boss.modules[0].offsetY);
  assert.equal(hitTop.moduleDestroyed, 'turret_top');
  assert.equal(boss.modules[0].destroyed, true);

  // Deal damage to trigger phase 2
  boss.damage(50, boss.x, boss.y);
  assert.ok(boss.hp <= 95);

  const tick = boss.update(100, 200, 216);
  assert.equal(tick.phase, 'phase2_drill');
});

test('Boss KRM-17 phase 3 core vulnerability and defeat condition', () => {
  const boss = new BossKrm17();
  boss.update(2900, 200, 216);

  // Reduce HP to trigger phase 3
  boss.damage(100, boss.x, boss.y);
  const tick = boss.update(100, 200, 216);
  assert.equal(tick.phase, 'phase3_core');

  // Core shot gets damage boost
  const coreHit = boss.damage(10, boss.x - 10, boss.y);
  assert.ok(coreHit.bossDamage > 10, 'core shot receives critical multiplier');

  // Defeat boss
  const finish = boss.damage(100, boss.x, boss.y);
  assert.equal(finish.killed, true);
  assert.equal(boss.phase, 'defeated');
});
