import assert from 'node:assert/strict';
/** Traverse every mandatory state; a single large tick must not skip the absence. */
export function returnFromOcean(boss){
  assert.equal(boss.phase,'escape');boss.update(1000,384,350);
  assert.equal(boss.phase,'submerged');boss.update(4999,384,350);
  assert.equal(boss.phase,'submerged');boss.update(1,384,350);
  assert.equal(boss.phase,'emerge');boss.update(1800,384,350);
  assert.equal(boss.phase,'inner');
}
