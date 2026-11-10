import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayerWeapons,collectPowerItem,collectWeaponCapsule,evolutionCargo} from '../src/game/systems/weaponSystem.ts';
import {GamepadReader,padLabels} from '../src/game/systems/gamepadInput.ts';
import {processInputFrame} from '../src/game/systems/inputSystem.ts';
import {computeLaserBeams} from '../src/game/systems/crimsonLaserSystem.ts';
import {SUPPLY_EVENTS,SCROLL_SPEED,StageDirector} from '../src/game/systems/stageDirector.ts';

test('all 12 weapon states require P; gates cannot skip or regress colors',()=>{
  let w=createPlayerWeapons();
  for(const family of ['ion','green','red']){
    for(let level=1;level<=4;level++){
      assert.equal(w.weaponFamily,family);assert.equal(w.weaponLevel,level);
      if(level<4)for(let i=0;i<3;i++){
        for(const blocked of ['ion','green','red'].filter(f=>f!==family))assert.deepEqual(collectWeaponCapsule(w,blocked).state,w);
        w=collectPowerItem(w).state;
      }
    }
    if(family!=='red')w=collectWeaponCapsule(w,family==='ion'?'green':'red').state;
  }
  assert.deepEqual(collectWeaponCapsule(w,'ion').state,w);
});
test('rare supply script earns green only after nine P and late final carrier; missed P cannot skip',()=>{
  let w=createPlayerWeapons(), powers=0;
  assert.equal(SUPPLY_EVENTS.length,14);
  for(const e of SUPPLY_EVENTS){
    if(e.drop==='power'){w=collectPowerItem(w).state;powers++;}
    if(e.drop==='weapon_green'){
      assert.equal(powers,9);assert.ok(e.distance/SCROLL_SPEED>110);
      assert.equal(evolutionCargo(w),'weapon_green');
      assert.equal(evolutionCargo({...w,weaponLevel:3}),'power');
      w=collectWeaponCapsule(w,'green').state;
    }
  }
  assert.equal(w.weaponFamily,'green');assert.equal(w.weaponLevel,1);
});
test('keyboard special is X only; V/B and accidental R no longer trigger actions',()=>{
  assert.equal(processInputFrame({keyXJustDown:true}).special,true);
  for(const key of ['keyVJustDown','keyBJustDown','keyRJustDown']){
    const result=processInputFrame({[key]:true});assert.equal(result.special,false);assert.equal(result.bomb,false);assert.equal(result.restart,false);
  }
});
test('gamepad deadzone, normalized diagonal, held fire and action edges',()=>{
  const r=new GamepadReader();const pad={id:'Xbox',mapping:'standard',axes:[.1,.1],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
  assert.equal(r.sample(pad).moveX,0);pad.axes=[1,1];pad.buttons[0].pressed=true;pad.buttons[2].pressed=true;
  const first=r.sample(pad);assert.ok(Math.abs(Math.hypot(first.moveX,first.moveY)-1)<1e-9);assert.equal(first.special,true);assert.equal(first.firePrimaryTap,true);
  const held=r.sample(pad);assert.equal(held.special,false);assert.equal(held.firePrimary,true);assert.equal(held.firePrimaryTap,false);
  assert.equal(r.sample(undefined).firePrimary,false);
  assert.equal(r.sample({...pad,mapping:''}).special,false);
  assert.equal(padLabels('DualSense 054c').special,'□');assert.equal(padLabels('Xbox').special,'X');
});
test('red frontal beams reach arena ceiling from bottom at every level; maximum wings cover flanks',()=>{
  for(let level=1;level<=4;level++)for(const phase of [0,500,1700]){
    const beams=computeLaserBeams(384,410,level,phase);
    assert.ok(beams.filter(b=>b.role==='central').every(b=>b.points.at(-1).y===0));
    assert.ok(beams.every(b=>b.points.every(p=>p.x>=168&&p.x<=600&&p.y>=0&&p.y<=432)));
  }
  const beams=computeLaserBeams(384,350,4,Math.PI/8*1000);
  const xs=beams.flatMap(b=>b.points.map(p=>p.x));assert.ok(Math.max(...xs)-Math.min(...xs)>390);
});
test('normal enemy fire crosses 250 world pixels in under 1.5 seconds after warning',()=>{
  const d=new StageDirector();const shots=[];
  for(let t=0;t<60000;t+=25)shots.push(...d.update(25,384,350).shots);
  const combat=shots.filter(s=>Math.hypot(s.velocityX,s.velocityY)>=168);
  assert.ok(combat.length>10);assert.ok(combat.every(s=>250/Math.hypot(s.velocityX,s.velocityY)<1.5));
});
