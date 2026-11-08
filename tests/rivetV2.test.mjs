import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import test from 'node:test';

const states = [
  ['idle', 8],
  ['subida', 8],
  ['descida', 8],
  ['disparo', 8],
  ['dano', 6],
  ['destruicao', 8],
];
const W = 112;
const H = 54;

for (const [name, count] of states) {
  test('Rivet V2 ' + name + ' is a valid transparent animated PNG', () => {
    const png = readFileSync('public/assets/ships/rivet/v2/' + name + '.png');
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16), W * count);
    assert.equal(png.readUInt32BE(20), H);
    assert.equal(png[25], 3, 'indexed PNG color type');
    let off = 8;
    let alpha = null;
    const idat = [];
    while (off < png.length) {
      const len = png.readUInt32BE(off);
      const type = png.toString('ascii', off + 4, off + 8);
      if (type === 'tRNS') alpha = png.subarray(off + 8, off + 8 + len);
      if (type === 'IDAT') idat.push(png.subarray(off + 8, off + 8 + len));
      off += len + 12;
    }
    assert.ok(alpha !== null && alpha.includes(0), 'fully transparent indexed color');
    const raw = inflateSync(Buffer.concat(idat));
    assert.equal(raw.length, H * (W * count + 1));
    const distinct = new Set();
    for (let f = 0; f < count; f++) {
      const pixels = [];
      for (let y = 0; y < H; y++) {
        const row = y * (W * count + 1);
        assert.equal(raw[row], 0, 'unfiltered PNG scanline');
        for (let x = 0; x < W; x++) pixels.push(raw[row + 1 + f * W + x]);
      }
      assert.ok(pixels.some(index => alpha[index] !== 0), name + ' frame has visible pixels');
      distinct.add(pixels.join(','));
    }
    assert.ok(distinct.size >= 4, name + ' needs genuinely different animation frames');
  });
}
