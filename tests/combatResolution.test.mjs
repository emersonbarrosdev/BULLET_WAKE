import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

test('loading screen adopts full combat resolution before updating loading overlay', () => {
  const arcadeSceneSrc = readFileSync(resolve('src/game/arcade/ArcadeScene.ts'), 'utf8');
  const mainSrc = readFileSync(resolve('src/main.ts'), 'utf8');
  const preloadStart = arcadeSceneSrc.indexOf('preload(): void');
  const createStart = arcadeSceneSrc.indexOf('create(): void');
  assert.ok(preloadStart >= 0 && createStart > preloadStart, 'preload and create methods must exist');

  const preloadBody = arcadeSceneSrc.slice(preloadStart, createStart);
  const enableIdx = preloadBody.indexOf('enableCombatResolution(this)');
  const bootIdx = preloadBody.indexOf('updateBootLoadingOverlay(0, true)');
  assert.ok(enableIdx >= 0, 'preload() must invoke enableCombatResolution(this)');
  assert.ok(bootIdx > enableIdx, 'enableCombatResolution(this) must run before updating boot loading overlay');
  assert.ok(!arcadeSceneSrc.includes('this.loadBg ='), 'duplicate canvas loadBg must not compete with single DOM boot loader');
  assert.ok(mainSrc.includes('host.clientWidth') && mainSrc.includes('host.clientHeight'), 'main.ts must boot Phaser at host viewport size to prevent startup canvas resize');
});

test('enableCombatResolution is idempotent across preload and create calls', () => {
  const resolutionSrc = readFileSync(resolve('src/game/render/combatResolution.ts'), 'utf8');
  assert.match(resolutionSrc, /WeakMap<Phaser\.Scene,\s*\(\)\s*=>\s*void>/);
  assert.ok(resolutionSrc.includes('if (existing)'), 'reuses existing resize handler when already attached');
  assert.ok(resolutionSrc.includes('resizeHandlers.delete(scene)'), 'cleans handler entry on shutdown');
});
