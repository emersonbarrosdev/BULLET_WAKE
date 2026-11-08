import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import test from 'node:test';

const specs = [
  ['ships/rivet/flight.png', 48, 24, 20],
  ['ships/moth/flight.png', 48, 24, 20],
  ['ships/knuckle/flight.png', 48, 24, 20],
  ['enemies/scout.png', 24, 16, 15],
  ['enemies/lancer.png', 40, 24, 17],
  ['projectiles/rivet.png', 12, 8, 4],
  ['projectiles/moth.png', 12, 8, 4],
  ['projectiles/knuckle.png', 16, 10, 4],
  ['projectiles/enemy.png', 10, 10, 4],
  ['fx/muzzle.png', 16, 16, 4],
  ['fx/hit.png', 16, 16, 6],
  ['fx/explosion.png', 24, 24, 8],
  ['fx/warning.png', 16, 16, 4],
];

for (const [name, fw, fh, count] of specs) {
  test(name + ' has valid transparent PNG and original frames', () => {
    const buffer = readFileSync('public/assets/' + name);
    assert.equal(buffer.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    assert.equal(width, fw * count);
    assert.equal(height, fh);
    assert.equal(buffer[25], 3); // indexed 8-bit pixels
    let offset = 8, hasAlpha = false;
    const idat = [];
    while (offset < buffer.length) {
      const len = buffer.readUInt32BE(offset);
      const name = buffer.toString('ascii', offset + 4, offset + 8);
      if (name === 'tRNS') hasAlpha = buffer[offset + 8] === 0;
      if (name === 'IDAT') idat.push(buffer.subarray(offset + 8, offset + 8 + len));
      offset += len + 12;
    }
    assert.ok(hasAlpha, 'transparency palette required');
    const raw = inflateSync(Buffer.concat(idat));
    const columns = width;
    const tiles = [];
    for (let frame = 0; frame < count; frame++) {
      const pixels = [];
      for (let y = 0; y < fh; y++) {
        const filterOffset = y * (columns + 1);
        assert.equal(raw[filterOffset], 0);
        for (let x = 0; x < fw; x++) {
          pixels.push(raw[filterOffset + 1 + frame * fw + x]);
        }
      }
      assert.ok(pixels.some(value => value > 0), 'empty sprite frame ' + frame);
      tiles.push(pixels.join(','));
    }
    assert.ok(new Set(tiles).size >= Math.min(3, count), 'sprite should have distinct frames');
  });
}
