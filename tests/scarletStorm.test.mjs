import test from 'node:test';
import assert from 'node:assert/strict';
import { scarletBeams, scarletSegments, scarletDamageBetween } from '../src/game/systems/scarletStorm.ts';
import { createPlayerWeapons, activateSpecial } from '../src/game/systems/weaponSystem.ts';
import { rivetBankFrame } from '../src/game/render/rivetPresentation.ts';

test('positive lateral movement uses the right-wing-down row; left movement uses its opposite',()=>{
 for(let frame=0;frame<4;frame++) {
  assert.equal(rivetBankFrame(1,frame),frame);
  assert.equal(rivetBankFrame(-1,frame),4+frame);
 }
});
test('Tormenta opens a forward corridor with a stronger central beam and connected side streams',()=>{
 assert.deepEqual(scarletBeams(0,300,350),[]);
 const beams=scarletBeams(800,300,350);assert.equal(beams.length,3);
 assert.ok(beams.every(b=>b.ax===300&&b.ay===350&&b.by<350));
 assert.equal(beams[1].bx,300);assert.ok(beams[1].radius>beams[0].radius);
 assert.equal(beams[1].radius,beams[2].radius*26/11);
 const moved=scarletBeams(800,340,325);
 for(let i=0;i<3;i++){assert.equal(moved[i].ax-beams[i].ax,40);assert.equal(moved[i].ay-beams[i].ay,-25);}
 const parts=scarletSegments(beams[1]);assert.ok(parts[0].radius<parts[5].radius);
 for(let i=1;i<parts.length;i++){assert.equal(parts[i-1].bx,parts[i].ax);assert.equal(parts[i-1].by,parts[i].ay);}
 assert.deepEqual(scarletBeams(3000,300,350),[]);
});
test('exposure budget is frame-rate independent, starts after propagation, and misses are not stored',()=>{
 assert.equal(scarletDamageBetween(0,400),0);
 for(const dt of [1000/30,1000/60,1000/120,80,250]) {
  let total=0;for(let t=0;t<3000;t+=dt)total+=scarletDamageBetween(t,Math.min(3000,t+dt));
  assert.ok(Math.abs(total-120)<1e-8);
 }
 assert.equal(scarletDamageBetween(2800,3000),0);
 assert.ok(scarletDamageBetween(1600,2800)<120);
 const w=createPlayerWeapons('nolan');assert.equal(w.specialType,'scarlet');
 const active=activateSpecial(w);assert.equal(active.activated,true);assert.equal(active.state.specialCharges,1);
});
