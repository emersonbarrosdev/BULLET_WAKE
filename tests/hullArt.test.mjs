import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { HULL_DAMAGE_SHEETS, HULL_SHIP_VISUALS } from '../src/game/arcade/HullDamageVisualConfig.ts';
import { HullDamageArt } from '../src/game/arcade/HullDamageArt.ts';

function readRgbaPng(file) {
  const buffer = readFileSync(file);
  assert.equal(buffer.subarray(1, 4).toString(), 'PNG');
  const width = buffer.readUInt32BE(16), height = buffer.readUInt32BE(20);
  assert.equal(buffer[24], 8, '8-bit channels');
  assert.equal(buffer[25], 6, 'True RGBA, not an opaque preview');
  assert.equal(buffer[28], 0, 'Noninterlaced');
  const chunks = [];
  for (let offset = 8; offset < buffer.length;) {
    const length = buffer.readUInt32BE(offset), type = buffer.subarray(offset + 4, offset + 8).toString();
    if (type === 'IDAT') chunks.push(buffer.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const scan = inflateSync(Buffer.concat(chunks)), pixels = Buffer.alloc(width * height * 4), stride = width * 4;
  const paeth = (a, b, c) => { const p = a + b - c, da = Math.abs(p - a), db = Math.abs(p - b), dc = Math.abs(p - c); return da <= db && da <= dc ? a : db <= dc ? b : c; };
  for (let y = 0; y < height; y++) {
    const filter = scan[y * (stride + 1)];
    assert(filter <= 4);
    for (let x = 0; x < stride; x++) {
      const pos = y * stride + x, a = x >= 4 ? pixels[pos - 4] : 0, b = y ? pixels[pos - stride] : 0, c = y && x >= 4 ? pixels[pos - stride - 4] : 0;
      const predictor = filter === 0 ? 0 : filter === 1 ? a : filter === 2 ? b : filter === 3 ? Math.floor((a + b) / 2) : paeth(a, b, c);
      pixels[pos] = (scan[y * (stride + 1) + x + 1] + predictor) & 255;
    }
  }
  return { width, height, pixels };
}

for (const sheet of HULL_DAMAGE_SHEETS) test(`${sheet.key}: real RGBA artwork, every frame painted, transparent and distinct`, () => {
  const image = readRgbaPng(new URL(`../public/assets/arcade/hull/${sheet.key}.png`, import.meta.url));
  assert.equal(image.width, sheet.size * sheet.frames); assert.equal(image.height, sheet.size);
  const signatures = new Set();
  for (let frame = 0; frame < sheet.frames; frame++) {
    let painted = 0, clear = 0;
    const tile = [];
    for (let y = 0; y < sheet.size; y++) for (let x = 0; x < sheet.size; x++) {
      const offset = (y * image.width + frame * sheet.size + x) * 4, rgba = image.pixels.subarray(offset, offset + 4);
      rgba[3] ? painted++ : clear++; tile.push(...rgba);
    }
    assert(painted > 30 && clear > sheet.size * sheet.size * .15, `Frame ${frame} needs painted silhouette and open alpha`);
    signatures.add(Buffer.from(tile).toString('base64'));
  }
  assert.equal(signatures.size, sheet.frames, 'Animation frames must genuinely differ');
});

function fakeScene() {
  const objects = [];
  const make = (x, y, key, frame = 0) => {
    const sprite = { x, y, key, frame, visible: true, rotation: 0, alpha: 1, depth: 18, displayWidth: 40, displayHeight: 40, originX: .5, originY: .5, flipX: false, flipY: false,
      setPosition(x, y) { this.x = x; this.y = y; return this; }, setTexture(key, frame) { this.key = key; this.frame = frame; return this; },
      setDisplaySize(w, h) { this.displayWidth = w; this.displayHeight = h; return this; }, setOrigin(x, y = x) { this.originX = x; this.originY = y; return this; },
      setRotation(v) { this.rotation = v; return this; }, setAlpha(v) { this.alpha = v; return this; }, setDepth(v) { this.depth = v; return this; },
      setFrame(v) { this.frame = v; return this; }, setVisible(v) { this.visible = v; return this; }, setFlip(x, y) { this.flipX = x; this.flipY = y; return this; },
      destroy() { this.dead = true; this.visible = false; },
    };
    objects.push(sprite); return sprite;
  };
  return { add: { sprite: make }, objects };
}
const world = () => ({ survivalRule: 'hull-v1', hull: 1, hullMaximum: 4, hullState: 'critical', player: { x: 100, y: 200, bank: .8 }, elapsed: 40, up: true, pilotId: 'nolan', state: 'play' });

test('Art freezes at dt0, clears fire after repair, keeps a bounded allocation and never edits player/world', () => {
  const scene = fakeScene(), art = new HullDamageArt(scene), player = scene.add.sprite(100, 200, 'approved-rivet'), w = world();
  const beforePlayer = { ...player }, beforeWorld = structuredClone(w), objectCount = scene.objects.length;
  art.update(w, player, .1); const active = art.snapshot(); assert.equal(active.objects, 12); assert(active.visible > 0);
  const positions = scene.objects.slice(0, 12).map(s => [s.x, s.y, s.frame, s.visible]);
  art.update(w, player, 0); assert.equal(art.snapshot().clock, active.clock); assert.deepEqual(scene.objects.slice(0, 12).map(s => [s.x, s.y, s.frame, s.visible]), positions);
  assert.deepEqual(player, beforePlayer); assert.deepEqual(w, beforeWorld);
  w.hull = 3; w.hullState = 'light'; art.triggerRepair(); art.update(w, player, 0);
  assert(scene.objects.filter(s => s.key === 'hull-flame').every(s => !s.visible)); assert(art.snapshot().repairActive);
  for (let i = 0; i < 200; i++) { art.clear(); art.update(world(), player, .02); }
  assert.equal(scene.objects.length, objectCount); art.destroy(); assert.equal(art.snapshot().objects, 0); assert(scene.objects.slice(0, 12).every(s => s.dead));
});

test('Five pilot configurations support both views; destruction runs once, expires, and classic mode hides all layers', () => {
  for (const pilot of ['nolan', 'cora', 'lyra', 'harlan', 'bento']) for (const view of ['up', 'side']) {
    const spec = HULL_SHIP_VISUALS[pilot][view]; assert(spec.smoke.length && spec.flame.length && spec.spark.length);
    assert(spec.smoke.every(a => Math.abs(a.x) < .5 && Math.abs(a.y) < .5));
  }
  const scene = fakeScene(), art = new HullDamageArt(scene), player = scene.add.sprite(11, 12, 'approved-rivet'), w = world();
  w.hull = 0; w.hullState = 'destroyed'; art.triggerDestruction(11, 12, false); art.update(w, player, .2);
  const frame = scene.objects.find(s => s.key === 'hull-destruction').frame;
  art.triggerDestruction(11, 12, false); art.update(w, player, 0); assert.equal(scene.objects.find(s => s.key === 'hull-destruction').frame, frame);
  art.update(w, player, 1); assert(!art.snapshot().destructionActive);
  w.survivalRule = 'classic-v1'; art.triggerRepair(); art.update(w, player, .1); assert.equal(art.snapshot().visible, 0);
});
