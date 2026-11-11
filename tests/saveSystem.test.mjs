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

  for(let i=1;i<=15;i++)save.recordStageClear(i, 'nolan', 120000);
  assert.deepEqual(save.getData().completedCampaignPilots, ['nolan']);

  for(let i=1;i<=15;i++)save.recordStageClear(i, 'cora', 135000);
  assert.deepEqual(save.getData().completedCampaignPilots, ['nolan', 'cora']);
});

test('SaveSystem updates and persists settings', () => {
  const save = new SaveSystem();
  save.updateSettings({ sfxVolume: 0.5, isMuted: true, difficulty: 'hard' });

  assert.equal(save.getData().settings.sfxVolume, 0.5);
  assert.equal(save.getData().settings.isMuted, true);
  assert.equal(save.getData().settings.difficulty, 'hard');
});


test('pilot saves isolate chapters, records and endings; Phase 1 never clears the campaign',()=>{
 const s=new SaveSystem();s.resetProgress();s.recordStageClear(1,'nolan',800);s.recordStageClear(1,'cora',400);
 assert.equal(s.getPilotProgress('nolan').bestScores[1],800);assert.equal(s.getPilotProgress('cora').bestScores[1],400);
 assert.equal(s.getPilotProgress('bento').clearedStages.length,0);assert.equal(s.getData().completedCampaignPilots.length,0);
 assert.equal(s.enterSecretCode('WAKEHIEN'),false);assert.equal(s.getData().secretStagesUnlocked,false);
 for(let i=2;i<=15;i++)s.recordStageClear(i,'nolan',1000);
 assert.equal(s.getData().secretStagesUnlocked,true);assert.ok(s.getData().unlockedStages.includes(16)&&s.getData().unlockedStages.includes(17));
 assert.equal(s.enterSecretCode('WRONG'),false);assert.equal(s.enterSecretCode('wakehien'),true);s.markEndingSeen('nolan');
 assert.equal(s.getPilotProgress('nolan').endingSeen,true);assert.equal(s.getPilotProgress('cora').endingSeen,false);
});

test('v1 save migration preserves settings and records without pretending the old five-stage prototype was a full campaign',()=>{
 const previous=globalThis.window;
 const old={schemaVersion:1,unlockedStages:[1,2],bestScores:{1:{score:4200,pilotId:'nolan',clearedAt:1}},completedCampaignPilots:['nolan'],settings:{musicVolume:.3}};
 try{globalThis.window={localStorage:{getItem:()=>JSON.stringify(old),setItem:()=>{}}};const s=new SaveSystem();assert.equal(s.getData().schemaVersion,2);assert.equal(s.getPilotProgress('nolan').bestScores[1],4200);assert.equal(s.getSettings().musicVolume,.3);assert.deepEqual(s.getData().completedCampaignPilots,[]);assert.equal(s.enterSecretCode('WAKEHIEN'),false);}
 finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}
});
