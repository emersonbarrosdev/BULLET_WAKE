import {returnFromOcean} from './bossFlightHelper.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeAlphaMask,sweepAlpha,maskTouches} from '../src/game/systems/alphaCollision.ts';
import {processInputFrame} from '../src/game/systems/inputSystem.ts';
import {getSecondaryProjectiles} from '../src/game/systems/weaponSystem.ts';
import {PickupSystem} from '../src/game/systems/pickupSystem.ts';
import {BossTalassarca} from '../src/game/systems/bosses/bossTalassarca.ts';

test('concave silhouette accepts off-centre limbs but preserves transparent gaps and corners',()=>{
  const alpha=new Uint8Array(256);
  for(let y=3;y<13;y++)for(let x=3;x<13;x++)if(x<5||x>=11||y>=11)alpha[y*16+x]=255;
  const m=makeAlphaMask(16,16,alpha);
  assert.equal(maskTouches(m,8,6),false);assert.equal(maskTouches(m,1,1),false);
  assert.equal(maskTouches(m,12,6),true);
  assert.equal(sweepAlpha(m,8,-20,8,9),null);
  const t=sweepAlpha(m,12,-20,12,30,.1);assert.ok(t>.45&&t<.47);
  assert.equal(sweepAlpha(m,0,0,0,15,.2),null);
  assert.ok(sweepAlpha(m,10.9,0,10.9,16,.3)!==null);
});
test('C and M no longer create gameplay actions, while holding space fires',()=>{
  const c=processInputFrame({keyC:true,keyCJustUp:true,keyMJustDown:true,keySpace:true});
  assert.equal(c.chargeHeld,false);assert.equal(c.chargeReleased,false);assert.equal(c.missile,false);assert.equal(c.firePrimary,true);
  const missiles=getSecondaryProjectiles('nolan',384,350);assert.equal(missiles.length,2);assert.ok(missiles[0].x<384&&missiles[1].x>384);
});
test('released supplies bounce on all four boundaries and remain physical',()=>{
  const p=new PickupSystem(),a=p.spawn('power',17,19);a.x=17;a.y=19;a.velocityX=-34;a.velocityY=-24;p.update(100,700,400);
  assert.ok(a.velocityX>0&&a.velocityY>0);assert.ok(a.x>=16&&a.y>=18);
  a.x=599;a.y=413;a.velocityX=34;a.velocityY=24;p.update(100,10,10);assert.ok(a.velocityX<0&&a.velocityY<0);
  assert.equal(p.checkCollection(100,100).length,0);
});
test('Talassarca organs absorb a fixed budget and destroyed organs stop firing',()=>{
  const b=new BossTalassarca();b.update(1800,384,350);const organ=b.modules[0];
  b.damage(200,b.x+organ.offsetX,b.y+organ.offsetY);assert.equal(organ.destroyed,true);assert.equal(b.hp,500);
  for(let i=0;i<160;i++){const tick=b.update(25,384,380);assert.ok(tick.shots.every(s=>Math.abs(s.x-(b.x+organ.offsetX))>1));}
  b.damageArea(500);returnFromOcean(b);assert.equal(b.modules.filter(m=>m.destroyed).length,0);assert.equal(b.hp,360);
});
