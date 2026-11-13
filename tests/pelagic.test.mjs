import {readFileSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {PELAGIC_COAST,visibleCoast,waterCorridor,touchesCoast,prepareSurface,moveSurface,surfaceMount} from '../src/game/arcade/PelagicEnvironment.ts';
import {waterScrollOffset,WATER_SCALE,WATER_TILE_SIZE} from '../src/game/arcade/PelagicWater.ts';
import {coastBoundary,coastAtScroll,COAST_PERIOD,COAST_WIDTH} from '../src/game/arcade/PelagicCoastAtlas.ts';
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

// Etapa 1: protect against reintroducing the inverted coastal panorama or cyan fog.
test('stage 1 draws a single crisp unfiltered ocean base until coastline approval',()=>{
 const source=readFileSync(new URL('../src/game/arcade/ArcadeBackdrop.ts',import.meta.url),'utf8');
 assert.match(source,/tileSprite\(384,216,STAGE1_WIDTH,432,'pelagic-water'\)/);
 assert.match(source,/waterScrollOffset\(w\.scroll,time\*2\.2\)/);
 assert.doesNotMatch(source,/installPelagicPanorama|this\.panorama|\.setAlpha\(\.09\)|setBlendMode\(/);
});

test('coast is a continuous, periodic shoreline, without pasted island sprites',()=>{
 const backdrop=readFileSync(new URL('../src/game/arcade/ArcadeBackdrop.ts',import.meta.url),'utf8');
 const terrain=readFileSync(new URL('../src/game/arcade/PelagicCoastAtlas.ts',import.meta.url),'utf8');
 assert(!backdrop.includes('shoreSprites'), 'no overlapping independent coast modules');
 assert(!backdrop.includes('visibleShore'), 'old random placement removed');
 assert(backdrop.includes("installCoastTexture(scene)"));
 assert(backdrop.includes('this.coast.tilePositionY='));
 assert(terrain.includes('ctx.clip()'), 'coastal atlas artwork must stay inside land');
 assert(!terrain.includes('globalCompositeOperation'), 'no fog/painted sea masks');
 for(const side of [-1,1]){
  assert(Math.abs(coastBoundary(0,side)-coastBoundary(COAST_PERIOD,side))<.00001);
  for(let y=-12000;y<432;y+=71){
   const edge=coastBoundary(y,side);
   assert(edge>0&&edge<COAST_WIDTH);
   assert(Math.abs(coastAtScroll(379,y,side)-coastAtScroll(0,y-379,side))<.0001);
  }
 }
 for(let y=0;y<COAST_PERIOD;y+=7)assert(coastBoundary(y,1)-coastBoundary(y,-1)>175,'keep a clear combat corridor');
});
