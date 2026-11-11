import test from 'node:test';
import assert from 'node:assert/strict';
import { stepRivetBank, rivetBankPose, rivetShotPresentation } from '../src/game/render/rivetPresentation.ts';
import { PILOT_WEAPON_SPECS, createPlayerWeapons } from '../src/game/systems/weaponSystem.ts';

test('left/right roll reaches and leaves its pose at the same rate across refresh rates', () => {
  for (const fps of [30, 60, 120]) {
    let left=0,right=0;
    for(let t=0;t<fps;t++) {left=stepRivetBank(left,-1,1000/fps);right=stepRivetBank(right,1,1000/fps);}
    assert.equal(rivetBankPose(left),-1);assert.equal(rivetBankPose(right),1);
    assert.ok(Math.abs(left+right)<1e-12);
    assert.ok(Math.abs(right-(1-Math.exp(-1000/65)))<1e-10);
    for(let t=0;t<fps;t++)right=stepRivetBank(right,0,1000/fps);
    assert.equal(rivetBankPose(right),0);
  }
});

test('red RIVET lances grow in body and length at each level without becoming the continuous laser kit', () => {
  let previous={width:0,height:0,radius:0};
  for (const level of [1,2,3,4,5]) {
    const current=rivetShotPresentation(level);
    assert.ok(current.width>previous.width&&current.height>previous.height);
    assert.ok(current.radius>=previous.radius);
    // Solid art occupies roughly 31% of each transparent atlas cell's width.
    assert.ok(current.radius<current.width*.31/2);
    previous=current;
  }
  assert.equal(PILOT_WEAPON_SPECS.nolan.displayName,'RAJADA ESCARLATE');
  assert.equal(createPlayerWeapons('nolan').weaponFamily,'ion');
  assert.equal(createPlayerWeapons('harlan').weaponFamily,'red');
});
