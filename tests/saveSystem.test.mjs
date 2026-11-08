import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SaveSystem,
  defaultSaveData,
  CURRENT_SCHEMA_VERSION,
} from '../src/game/systems/saveSystem.ts';

test('SaveSystem initializes with default state and stage 1 unlocked', () => {
  const save = new SaveSystem();
  const data = save.getData();
  assert.equal(data.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.deepEqual(data.unlockedStages, [1]);
  assert.equal(data.lastPilotId, 'nolan');
  assert.equal(data.settings.difficulty, 'normal');
});

test('SaveSystem unlocks next stages upon completing a stage', () => {
  const save = new SaveSystem();
  save.resetProgress();

  save.recordStageClear(1, 'nolan', 45000);
  assert.deepEqual(save.getData().unlockedStages, [1, 2]);
  assert.equal(save.getData().bestScores[1].score, 45000);

  save.recordStageClear(2, 'cora', 62000);
  assert.deepEqual(save.getData().unlockedStages, [1, 2, 3]);

  // Higher score updates bestScore
  save.recordStageClear(1, 'harlan', 51000);
  assert.equal(save.getData().bestScores[1].score, 51000);
  assert.equal(save.getData().bestScores[1].pilotId, 'harlan');

  // Lower score does not overwrite bestScore
  save.recordStageClear(1, 'cora', 30000);
  assert.equal(save.getData().bestScores[1].score, 51000);
});

test('SaveSystem records campaign completion and epilogue pilot', () => {
  const save = new SaveSystem();
  save.resetProgress();

  save.recordStageClear(5, 'nolan', 120000);
  assert.deepEqual(save.getData().completedCampaignPilots, ['nolan']);

  save.recordStageClear(5, 'cora', 135000);
  assert.deepEqual(save.getData().completedCampaignPilots, ['nolan', 'cora']);
});

test('SaveSystem updates and persists settings', () => {
  const save = new SaveSystem();
  save.updateSettings({ sfxVolume: 0.5, isMuted: true, difficulty: 'hard' });

  assert.equal(save.getData().settings.sfxVolume, 0.5);
  assert.equal(save.getData().settings.isMuted, true);
  assert.equal(save.getData().settings.difficulty, 'hard');
});
