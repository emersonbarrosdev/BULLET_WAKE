import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

const mothSheets = [
  ['ships/moth/v2/idle.png', 136, 72, 4],
  ['ships/moth/v2/climb.png', 136, 72, 4],
  ['ships/moth/v2/dive.png', 136, 72, 4],
  ['ships/moth/v2/fire.png', 136, 72, 4],
  ['ships/moth/v2/hit.png', 136, 72, 4],
  ['ships/moth/v2/destruction.png', 136, 72, 8],
];

const knuckleSheets = [
  ['ships/knuckle/v2/idle.png', 144, 88, 4],
  ['ships/knuckle/v2/climb.png', 144, 88, 4],
  ['ships/knuckle/v2/dive.png', 144, 88, 4],
  ['ships/knuckle/v2/fire.png', 144, 88, 4],
  ['ships/knuckle/v2/hit.png', 144, 88, 4],
  ['ships/knuckle/v2/destruction.png', 144, 88, 8],
];

for (const [relPath, fw, fh, count] of [...mothSheets, ...knuckleSheets]) {
  test('Nave ' + relPath + ' tem PNG alfa e frames animados', () => {
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
