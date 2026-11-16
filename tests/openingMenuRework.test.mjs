import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

function readPngDimensions(path) {
  const buf = readFileSync(path);
  assert.equal(buf.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${path} must have valid PNG header`);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function readWebpSignature(path) {
  const buf = readFileSync(path);
  assert.equal(buf.subarray(0, 4).toString('ascii'), 'RIFF', `${path} must start with RIFF`);
  assert.equal(buf.subarray(8, 12).toString('ascii'), 'WEBP', `${path} must have WEBP chunk`);
  return buf.length;
}

test('brand logo variants and menu rework assets exist in high resolution', () => {
  const brandFiles = [
    'public/assets/brand/bullet-wake-logo.svg',
    'public/assets/brand/bullet-wake-logo-main.png',
    'public/assets/brand/bullet-wake-logo-transparent.png',
    'public/assets/brand/bullet-wake-logo-compact.png',
    'public/assets/brand/bullet-wake-logo-light-bg.png',
    'public/assets/brand/bullet-wake-logo-dark-bg.png',
  ];
  for (const rel of brandFiles) {
    const abs = resolve(rel);
    assert.ok(existsSync(abs), `Missing brand asset: ${rel}`);
    assert.ok(statSync(abs).size > 1000, `Unexpected tiny brand asset: ${rel}`);
    if (rel.endsWith('.png')) {
      const dims = readPngDimensions(abs);
      const minW = rel.includes('compact') ? 360 : 600;
      const minH = rel.includes('compact') ? 160 : 250;
      assert.ok(dims.width >= minW && dims.height >= minH, `Low resolution logo variant ${rel}: ${dims.width}x${dims.height}`);
    }
  }

  for (const rel of [
    'public/assets/arcade/ui/logo-arcade.webp',
    'public/assets/arcade/ui/sky-panorama.webp',
    'public/assets/arcade/ui/rivet-cruise.webp',
    'public/assets/arcade/ui/wingmen-anim.webp',
    'public/assets/arcade/ui/menu-heli-side.webp',
    'public/assets/arcade/ui/menu-heli-patrol-side.webp',
    'public/assets/arcade/ui/pad-dualsense.webp',
    'public/assets/arcade/ui/pad-xbox.webp',
    'public/assets/arcade/ui/mobile-landscape.webp',
  ]) {
    const abs = resolve(rel);
    assert.ok(existsSync(abs), `Missing menu UI asset: ${rel}`);
    const bytes = readWebpSignature(abs);
    assert.ok(bytes > 2000, `Unexpected tiny WebP menu asset: ${rel} (${bytes}B)`);
  }
});

test('boot HTML/CSS enforces full-viewport dark loading overlay, fixed bar frame, and coarse-pointer portrait guard', () => {
  const html = readFileSync(resolve('index.html'), 'utf8');
  const css = readFileSync(resolve('src/style.css'), 'utf8');
  assert.ok(html.includes('id="bw-boot-loading"'), 'index.html must include #bw-boot-loading full-viewport overlay');
  assert.ok(html.includes('id="bw-boot-fill"'), 'index.html must include fixed-frame progress fill #bw-boot-fill');
  assert.ok(html.includes('id="rotate-hint"'), 'index.html must include custom #rotate-hint portrait prompt');
  assert.ok(html.includes('#040d21') && css.includes('#040d21'), 'boot surfaces must use #040d21 obsidian background');
  assert.ok(!css.includes('#ffffff'), 'main container styles must never introduce a white background');
  assert.match(css, /@media\s*\(orientation:\s*portrait\)\s*and\s*\(pointer:\s*coarse\)/, '#rotate-hint must only match touch/coarse portrait mobile devices');
  assert.match(html, /\.bw-boot-frame[\s\S]*width:\s*min\(360px,\s*78vw\)/, 'loading bar frame width must remain strictly fixed');
  assert.match(html, /\.bw-boot-frame[\s\S]*height:\s*18px/, 'loading bar frame height must remain strictly fixed');
});

test('ArcadeBackdrop keeps menu sky strictly static and hidden before MAIN_MENU', () => {
  const backdropSrc = readFileSync(resolve('src/game/arcade/ArcadeBackdrop.ts'), 'utf8');
  assert.ok(backdropSrc.includes('showMenuBackdrop = true'), 'ArcadeBackdrop.draw must gate menu sky behind showMenuBackdrop');
  assert.ok(!backdropSrc.includes('menuSky.tilePosition'), 'menuSky must never scroll or pan');
});

test('ArcadeScene implements LOADING -> STUDIO_SPLASH -> MAIN_MENU sequence, atomic POST_RENDER splash handoff, 3-button menu, and tabbed controls', () => {
  const sceneSrc = readFileSync(resolve('src/game/arcade/ArcadeScene.ts'), 'utf8');
  const html = readFileSync(resolve('index.html'), 'utf8');
  assert.ok(sceneSrc.includes("openingState: OpeningState = 'LOADING'"));
  assert.match(sceneSrc, /screen === 'intro'[\s\S]*openingState = 'STUDIO_SPLASH'/);
  assert.match(sceneSrc, /screen === 'title'[\s\S]*openingState = 'MAIN_MENU'/);
  assert.ok(sceneSrc.includes("'LOADING_COMPLETE'") && sceneSrc.includes("'STUDIO_EXIT'") && sceneSrc.includes("'TITLE_READY'") && sceneSrc.includes("'TITLE_VISIBLE'"), 'Explicit guarded OpeningPhase machine must exist');
  assert.ok(sceneSrc.includes('Phaser.Core.Events.POST_RENDER'), 'Boot loading overlay must wait for WebGL POST_RENDER of STUDIO_SPLASH before dismissing');
  assert.ok(!sceneSrc.includes('drawLoadBar(') && !sceneSrc.includes('this.loadBg'), 'Must have a single unified loading overlay without duplicate canvas bar');
  assert.ok(html.includes('100dvh') && html.includes('tabular-nums'), 'Boot loading screen must cover full 100dvh viewport with non-shifting metrics');
  assert.ok(sceneSrc.includes('this.hero.setVisible(false);'), 'Title screen must never place giant hero plane over buttons');
  assert.ok(sceneSrc.includes("this.button(384, 264, 'INICIAR JORNADA'"), 'Centered INICIAR JORNADA button must exist');
  assert.ok(sceneSrc.includes("this.button(384, 306, 'CONTROLES'"), 'Centered CONTROLES button must exist');
  assert.ok(sceneSrc.includes("this.button(384, 348, 'OPÇÕES'"), 'Centered OPÇÕES button must exist');
  assert.ok(!sceneSrc.includes('Segure o disparo para rajada contínua'), 'Legacy false autofire description must be removed');
  assert.ok(sceneSrc.includes("'PS5 DUALSENSE'") || sceneSrc.includes('PS5 DUALSENSE'));
  assert.ok(sceneSrc.includes("id: 'pc'") && sceneSrc.includes("id: 'gamepad'") && sceneSrc.includes("id: 'android'"));
  assert.ok(sceneSrc.includes('renderMenuAircraft(time)'), 'Decorative animated aircraft corridors must run in MAIN_MENU');
});
