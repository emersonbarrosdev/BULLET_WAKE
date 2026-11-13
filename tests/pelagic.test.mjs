import test from 'node:test';
import assert from 'node:assert/strict';
import {PELAGIC_COAST,visibleCoast,waterCorridor,touchesCoast,prepareSurface,moveSurface,surfaceMount} from '../src/game/arcade/PelagicEnvironment.ts';
import {waterScrollOffset,WATER_SCALE,WATER_TILE_SIZE} from '../src/game/arcade/PelagicWater.ts';
import {coastBoundary,coastAtScroll,isOpenSeaAt,ARCHIPELAGO_SPECS,COAST_PERIOD,COAST_WIDTH,visibleFormations,formationRow} from '../src/game/arcade/PelagicCoastGeometry.ts';
import {ArcadeWorld} from '../src/game/arcade/ArcadeWorld.ts';
import {MISSIONS} from '../src/game/arcade/content.ts';

test('water UV moves down at world speed and wraps by exactly one tile, independent of region',()=>{
 for(let scroll=0;scroll<14000;scroll+=13){assert.equal((waterScrollOffset(scroll+10,0)-waterScrollOffset(scroll,0))*WATER_SCALE,-10);assert.equal(waterScrollOffset(scroll+WATER_TILE_SIZE*WATER_SCALE,0)-waterScrollOffset(scroll,0),-WATER_TILE_SIZE);}
});
test('coast moves down without replacing or flipping a visible landmark',()=>{
 for(let scroll=0;scroll<13000;scroll+=43){const before=visibleCoast(scroll),after=visibleCoast(scroll+3);for(const p of before){if(!after.includes(p))continue;assert.equal(p.y+scroll+3-(p.y+scroll),3);assert(p.frame!==4||p.side===-1);assert(p.frame!==5||p.side===1);}}
});
test('conservative corridors remain open for a complete rotating ship',()=>{
 for(let y=400;y>-14000;y-=7){const c=waterCorridor(y,33,75);assert(c.right-c.left>20);assert(!touchesCoast((c.left+c.right)/2,y,33));}
});
test('surface routes never cross rendered terrain across the entire phase and all approach directions',()=>{
 const entries=new Set(),phases=new Set();let checks=0;
 for(let scroll=0;scroll<13000;scroll+=211)for(const size of[41,63])for(let id=1;id<=3;id++){
  const e={id,x:300,y:-30,size,age:0,speed:24,family:size===41?'boat':'ship'};prepareSurface(e,scroll);entries.add(e.navigation.entry);
  for(let i=0;i<14*60;i++){const before=e.x;e.age+=1/60;moveSurface(e,scroll+i*38/60,1/60);phases.add(e.navigation.phase);assert(Math.abs(e.x-before)<=.80001,'route correction must not teleport the hull');assert(!touchesCoast(e.x,e.navigation.worldY,e.size*.51),JSON.stringify({scroll,i,e}));checks++;}
 }
 assert.deepEqual([...entries].sort(),[-1,0,1]);assert(phases.has('hold')&&phases.has('turn')&&phases.has('exit'));assert(checks>250000);
});
test('land units stay registered to their actual island and the muzzle follows a turning hull',()=>{
 for(const family of['tank','tower'])for(let scroll=0;scroll<12000;scroll+=337){const e={id:2,x:0,y:0,size:34,age:0,speed:24,family};prepareSurface(e,scroll);const p=PELAGIC_COAST[e.navigation.anchor];moveSurface(e,scroll+123,1/60);assert.equal(e.y,p.y+scroll+123+e.navigation.anchorY);assert(touchesCoast(e.x,e.y-scroll-123,1));}
 const e={id:1,x:400,y:100,size:40,age:0,speed:24,family:'boat',navigation:{worldY:0,entry:0,phase:'turn',heading:Math.PI/2}};const m=surfaceMount(e);assert(Math.abs(m.x-404.8)<1e-8);assert.equal(m.y,100);
});
test('Phase 2 does not install maritime routes and phase-one encounter timings are unchanged',()=>{
 const side=new ArcadeWorld(MISSIONS[1]);side.spawnEncounter({family:'tank',formation:'pair',motion:'stationary',lane:.8});assert(side.enemies.every(e=>!e.navigation));
 const w=new ArcadeWorld(MISSIONS[0]);w.state='play';w.player.invulnerable=1000;for(let i=0;i<120*47;i++){w.step(1/120);w.events=[];}assert(w.enemies.filter(e=>e.family==='boat').length===2);assert(w.enemies.filter(e=>e.family==='boat').every(e=>e.navigation));assert(Math.abs(w.route-47)<1e-7);
});
test('the authored Fenda encounters actually use left, right and top approaches',()=>{
 const w=new ArcadeWorld(MISSIONS[0]);w.state='play';w.player.invulnerable=1000;const entries=new Set();
 for(let i=0;i<120*230;i++){w.step(1/120);w.events=[];for(const e of w.enemies)if(e.navigation&&e.navigation.anchor===undefined)entries.add(e.navigation.entry);if(w.boss?.mini)w.boss.parts.forEach(p=>p.hp=0);}
 assert.deepEqual([...entries].sort(),[-1,0,1]);
});

test('authored formations leave extensive open ocean, preserve aspect and keep >=150px separation',()=>{
 for(const side of[-1,1]){
  let open=0;for(let y=0;y<COAST_PERIOD;y+=2){if(isOpenSeaAt(y,side))open++;assert.equal(coastAtScroll(379,y,side),coastBoundary(y-379,side));}
  assert(open/(COAST_PERIOD/2)>.48);
  const pieces=ARCHIPELAGO_SPECS.filter(s=>s.side===side).sort((a,b)=>a.yStart-b.yStart);
  for(let i=0;i<pieces.length;i++){
   const a=pieces[i],b=pieces[(i+1)%pieces.length];
   assert.equal(a.width,a.yEnd-a.yStart,'never stretch the art');
   assert(b.yStart+(i===pieces.length-1?COAST_PERIOD:0)-a.yEnd>=150);
  }
 }
 // Opposite shores also retain >=150px of open water, using actual silhouette rows.
 for(let y=0;y<COAST_PERIOD;y++)assert(coastBoundary(y,1)-coastBoundary(y,-1)>=150);
 for(let scroll=0;scroll<14000;scroll+=13){
  const visible=visibleFormations(scroll);assert(visible.length<=8);assert.equal(new Set(visible.map(x=>x.key)).size,visible.length);
  for(const {spec,y}of visible){assert.equal(y,(spec.yStart+spec.yEnd)/2+scroll-Number(visible.find(x=>x.spec===spec&&x.y===y).key.split(':')[0])*COAST_PERIOD);}
 }
});

test('rendered alpha shoreline fits the navigation envelope; open-sea stretch contains no terrain',()=>{
 for(const spec of ARCHIPELAGO_SPECS)for(let y=spec.yStart;y<spec.yEnd;y+=2){
  const row=formationRow(spec,y);if(!row)continue;
  const p=PELAGIC_COAST.find(p=>Math.abs(p.y-(spec.yStart+spec.yEnd)/2)<.01&&p.side===spec.side);
  assert(p);assert(row[0]+192>=p.x-p.width/2-.01);assert(row[1]+192<=p.x+p.width/2+.01);
 }
 for(let y=3300;y<3900;y++){assert(isOpenSeaAt(y,-1));assert(isOpenSeaAt(y,1));}
});

test('paired boats retain separate lanes instead of converging on one center point',()=>{
 for(let scroll=0;scroll<13000;scroll+=277){
  const pair=[-1,1].map((side,i)=>{const e={id:i+1,x:384,y:-55,size:41,age:0,speed:24,family:'boat'};prepareSurface(e,scroll,side);return e;});
  for(let i=0;i<600;i++){for(const e of pair){e.age+=1/60;moveSurface(e,scroll+i*38/60,1/60);}assert(Math.hypot(pair[0].x-pair[1].x,pair[0].y-pair[1].y)>41);}
 }
});
