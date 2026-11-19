import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

test('ArcadeMenuUI defines reusable cartoon/anime button variants and all required interactive states', () => {
  const uiSrc = readFileSync(resolve('src/game/arcade/ArcadeMenuUI.ts'), 'utf8');
  for (const variant of ["'primary'", "'secondary'", "'back'", "'tab'", "'optionRow'"]) {
    assert.ok(uiSrc.includes(variant), `Missing button variant ${variant}`);
  }
  assert.ok(uiSrc.includes('setFocused('), 'ArcadeMenuButton must expose unified hover/focus state');
  assert.ok(uiSrc.includes('playConfirmAndRun('), 'ArcadeMenuButton must expose pressed/confirm transition');
  assert.ok(uiSrc.includes('playLockedFeedback('), 'ArcadeMenuButton must expose disabled locked feedback');
  assert.ok(uiSrc.includes('animateEntrance('), 'ArcadeMenuButton must expose staggered entrance animation');
  assert.ok(uiSrc.includes('makeMenuHintBar'), 'ArcadeMenuUI must expose contextual gamepad/keyboard hint bar');
  assert.ok(uiSrc.includes('makeStatusPill('), 'ArcadeMenuUI must expose difficulty/status pill badge');
  assert.ok(uiSrc.includes('playMenuScreenEntrance('), 'ArcadeMenuUI must expose screen entrance transition');
  assert.ok(uiSrc.includes('scaleTween') && uiSrc.includes('entranceTween'), 'Scale and entrance tweens must stay isolated so focus never cancels fade-in');
});

test('ArcadeMenuVector provides pure procedural vector chrome (panels, winged banners, gauges, toggles, keycaps, icons)', () => {
  const vecSrc = readFileSync(resolve('src/game/arcade/ArcadeMenuVector.ts'), 'utf8');
  for (const fn of ['makeVectorPanel', 'makeVectorBanner', 'makeVectorGauge', 'makeVectorTogglePill', 'makeVectorKeycap', 'makeVectorHintBar', 'drawVectorIcon']) {
    assert.ok(vecSrc.includes(fn), `Missing procedural vector helper ${fn}`);
  }
});

test('ArcadeScene uses ArcadeMenuUI exclusively for pre-gameplay screens, includes Credits without AI references, and fixes difficulty stepping', () => {
  const sceneSrc = readFileSync(resolve('src/game/arcade/ArcadeScene.ts'), 'utf8');
  assert.ok(sceneSrc.includes('private isPreGameplayMenu(): boolean'), 'Pre-gameplay menu gate must exist');
  assert.ok(sceneSrc.includes('private menuActionLocked = false;'), 'Navigation lock must prevent duplicate confirmation');
  assert.ok(sceneSrc.includes('stepGameDifficulty(globalSave.getSettings().difficulty, dir < 0 ? -1 : 1)'), 'Settings difficulty must respect left/right step direction');
  assert.ok(sceneSrc.includes("variant: avail ? 'primary' : 'secondary'") && sceneSrc.includes('disabled: !avail'), 'Locked mission button must use disabled state');
  assert.ok(sceneSrc.includes("screen === 'credits'"), 'Dedicated Credits screen must exist');
  const creditsBlock = sceneSrc.slice(sceneSrc.indexOf("screen === 'credits'"), sceneSrc.indexOf("screen === 'pilot'"));
  assert.ok(creditsBlock.includes('BOTAN STUDIO') && creditsBlock.includes('Emerson Barros'), 'Credits screen must present real project credits');
  assert.ok(!/\b(IA|AI|LLM|GPT|Claude|Gemini|Antigravity|Copilot)\b/i.test(creditsBlock), 'Credits screen must not contain AI tool references');
});
