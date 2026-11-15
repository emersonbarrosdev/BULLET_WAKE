import test from 'node:test';
import assert from 'node:assert/strict';
import {ArcadeWorld} from '../src/game/arcade/ArcadeWorld.ts';
import {MISSIONS,FAMILY} from '../src/game/arcade/content.ts';

function fixture(){
 const world=new ArcadeWorld(MISSIONS[0]);world.state='play';world.scroll=800;
 world.spawnEncounter({family:'tower',formation:'solo',motion:'stationary',lane:.2});
 const gun=world.enemies[0];gun.y=180;gun.cooldown=0;
 return{world,gun};
}

test('guns enter with their terrain and never stack onto an occupied socket',()=>{
 const world=new ArcadeWorld(MISSIONS[0]);world.state='play';world.scroll=717;
 world.spawnEncounter({family:'tank',formation:'pair',motion:'stationary',lane:.25});
 world.spawnEncounter({family:'tower',formation:'solo',motion:'stationary',lane:.8});
 assert.equal(new Set(world.enemies.map(e=>e.navigation.anchor)).size,3);
 assert(world.enemies.every(e=>e.y<-50));
 const positions=world.enemies.map(e=>({id:e.id,y:e.y}));world.updateEnemies(.1);
 assert.equal(world.enemies.length,3,'offscreen grounded actors wait for their terrain');
 for(const e of world.enemies)assert.equal(e.y,positions.find(p=>p.id===e.id).y);
});

test('coastal gun destruction leaves one inert wreck and awards its score only once',()=>{
 const{world,gun}=fixture();assert.notEqual(gun.navigation.anchor,undefined);
 world.damage(gun,gun.hp,gun.x,gun.y);
 assert.equal(world.wrecks.length,1);assert.equal(world.wrecks[0].id,gun.id);
 assert.equal(world.wrecks[0].x,gun.x);assert.equal(world.wrecks[0].y,gun.y);
 world.damage(gun,50,gun.x,gun.y);world.updateEnemies(.01);
 assert.equal(world.wrecks.length,1);assert.equal(world.score,FAMILY.tower.score);assert.equal(world.kills,1);
 assert.equal(world.enemies.length,0);assert.equal(world.bullets.filter(b=>b.active).length,0);
});

test('wreck remains at its world coordinate through stopped and accelerated scrolling and is culled only offscreen',()=>{
 const{world,gun}=fixture();world.damage(gun,gun.hp,gun.x,gun.y);
 const wreck=world.wrecks[0],worldY=wreck.worldY;
 world.updateWrecks(45);assert.equal(wreck.y,180);assert.equal(world.wrecks.length,1);
 world.scroll+=117;world.updateWrecks(.05);assert.equal(wreck.y,297);assert.equal(wreck.worldY,worldY);
 world.scroll+=140;world.updateWrecks(.05);assert.equal(wreck.y,437);assert.equal(world.wrecks.length,1,'smoke is still visible above the bottom');
 world.scroll+=100;world.updateWrecks(.05);assert.equal(world.wrecks.length,0);
});

test('naval enemies do not leave land wrecks; exit scrolling preserves coast wreck registration',()=>{
 const{world,gun}=fixture();world.damage(gun,gun.hp,gun.x,gun.y);
 world.spawnEncounter({family:'boat',formation:'solo',motion:'stationary',lane:.5});
 const boat=world.enemies.at(-1);world.damage(boat,boat.hp,boat.x,boat.y);assert.equal(world.wrecks.length,1);
 const before=world.wrecks[0].y;world.state='exit';world.step(.05);
 assert.equal(world.wrecks[0].y,before+1.5);
});
