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
  assert.ok(uiSrc.includes('makeMenuHintBar('), 'ArcadeMenuUI must expose contextual gamepad/keyboard hint bar');
  assert.ok(uiSrc.includes('makeStatusPill('), 'ArcadeMenuUI must expose difficulty/status pill badge');
  assert.ok(uiSrc.includes('playMenuScreenEntrance('), 'ArcadeMenuUI must expose screen entrance transition');
  assert.ok(uiSrc.includes('scaleTween') && uiSrc.includes('entranceTween'), 'Scale and entrance tweens must stay isolated so focus never cancels fade-in');
});

test('ArcadeScene uses ArcadeMenuUI exclusively for pre-gameplay screens and fixes difficulty left/right stepping', () => {
  const sceneSrc = readFileSync(resolve('src/game/arcade/ArcadeScene.ts'), 'utf8');
  assert.ok(sceneSrc.includes('private isPreGameplayMenu(): boolean'), 'Pre-gameplay menu gate must exist');
  assert.ok(sceneSrc.includes('private menuActionLocked = false;'), 'Navigation lock must prevent duplicate confirmation');
  assert.ok(sceneSrc.includes('stepGameDifficulty(globalSave.getSettings().difficulty, dir < 0 ? -1 : 1)'), 'Settings difficulty must respect left/right step direction');
  assert.ok(sceneSrc.includes("variant: avail ? 'primary' : 'secondary'") && sceneSrc.includes('disabled: !avail'), 'Locked mission button must use disabled state');
});
