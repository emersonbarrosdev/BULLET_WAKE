import assert from 'node:assert/strict';
export async function runReformRoutes({evaluate,waitFor,shot,report}){
 const run=code=>evaluate(`(async()=>{const s=window.__GAME__.scene.getScene('PrototypeScene');${code}})()`);
 async function restart(id='nolan'){
  await evaluate(`(()=>{const g=window.__GAME__;window.__qaPreviousDirector=g.scene.getScene('PrototypeScene').director;(g.scene.getScenes(true)[0]??g.scene.getScene('PrototypeScene')).scene.start('PrototypeScene',{pilotId:'${id}',skipBriefing:true});return true;})()`);
  await waitFor(`(()=>{const s=window.__GAME__.scene.getScene('PrototypeScene');return s.scene.isActive()&&s.director!==window.__qaPreviousDirector&&s.health.lives===3&&s.pilot.id==='${id}'})()`);
  await run('s.scene.pause();s.tweens.getDelta=()=>20;return true;');
 }
 report.regression.fullRoutes=[];
 for(const [id,skipP]of (process.argv.includes('--tita-only')?[['cora',0]]:process.argv.includes('--one-route')?[['nolan',0]]:[['nolan',0],['cora',0],['lyra',0],['harlan',0],['bento',0],['nolan',3]])){
  await restart(id);
  const route=await run(`
   const original=s.inputManager.sample,base=original.call(s.inputManager,s.ship.x,s.ship.y);
   const previousEnemies=new Map();
   const skipped=new Set(),picked=new Set(),pickedTypes={};let supplies=0,peakEnemies=0,peakBullets=0,elapsed=0;const costs=[],levels=[],deaths=[],deathCauses=[];
   const originalDamage=s.damageShip.bind(s);s.damageShip=function(damage){const position={x:s.ship.x,y:s.ship.y},result=originalDamage(damage);if(result==='respawn'||result==='game-over')deathCauses.push({seconds:elapsed/1000,damage,position});return result;};
   const originalCollection=s.checkPickupCollisions.bind(s);
   s.checkPickupCollisions=function(){const before=new Map(s.pickups.pickups.filter(p=>!p.collected).map(p=>[p.id,p.type]));originalCollection();for(const p of s.pickups.pickups)if(p.collected&&before.has(p.id)&&!picked.has(p.id)){picked.add(p.id);pickedTypes[p.type]=(pickedTypes[p.type]??0)+1;supplies++;}};
   s.inputManager.sample=()=>{
    let goalX=384+Math.sin(elapsed/3700)*100,goalY=350;
    const items=s.pickups.pickups.filter(p=>!p.collected);
    for(const p of items)if(p.type==='power'&&skipped.size<${skipP}&&!picked.has(p.id))skipped.add(p.id);
    const item=items.filter(p=>!skipped.has(p.id)&&p.y>145).sort((a,b)=>Math.hypot(a.x-s.ship.x,a.y-s.ship.y)-Math.hypot(b.x-s.ship.x,b.y-s.ship.y))[0];
    const cargo=s.director.enemies.find(e=>e.carrier);
    if(item){goalX=item.x;goalY=item.y+3;}else if(cargo){goalX=cargo.x;goalY=Math.max(280,cargo.y+130);}else if(s.director.boss){const b=s.director.boss,m=b.modules?.filter(m=>!m.destroyed).sort((a,b)=>b.offsetY-a.offsetY)[0];goalX=b.x+(m?.offsetX??0);goalY=m?Math.min(385,b.y+m.offsetY+90):330;}
    const trajectories=s.director.enemies.map(e=>{const old=previousEnemies.get(e.id),vx=old?(e.x-old.x)/.02:0,vy=old?(e.y-old.y)/.02:100;previousEnemies.set(e.id,{x:e.x,y:e.y});return {e,vx:Math.max(-240,Math.min(240,vx)),vy:Math.max(-240,Math.min(240,vy))};});
    const encounter=s.director.boss;if(encounter&&['intro','escape','submerged','emerge'].includes(encounter.phase)){goalX=384;goalY=375;}
    let best=null;const speed=s.pilot.speed;
    for(let i=-1;i<16;i++){
      const x=i<0?0:Math.cos(i*Math.PI/8),y=i<0?0:Math.sin(i*Math.PI/8),vx=x*speed,vy=y*speed;
      const nx=s.ship.x+vx*.22,ny=s.ship.y+vy*.22;
      if(nx<192||nx>576||ny<38||ny>400)continue;
      let score=Math.hypot(nx-goalX,ny-goalY);
      const eclipse=s.director.boss?.eclipse;if(eclipse&&eclipse.phase!=='recover')for(const lane of eclipse.lanes)score+=Math.max(0,48-Math.abs(nx-lane))*200;
      for(const shot of s.enemyShots){const dx=shot.node.x-s.ship.x,dy=shot.node.y-s.ship.y,rx=shot.velocityX-vx,ry=shot.velocityY-vy;
       const t=Math.max(0,Math.min(.52,-(dx*rx+dy*ry)/Math.max(1,rx*rx+ry*ry))),d=Math.hypot(dx+rx*t,dy+ry*t);
       score+=Math.max(0,30-d)*130+Math.max(0,60-d)*.8;
      }
      for(const {e,vx:evx,vy:evy} of trajectories)if(!e.layer){
       const dx=e.x-s.ship.x,dy=e.y-s.ship.y,rx=evx-vx,ry=evy-vy;
       const t=Math.max(0,Math.min(.5,-(dx*rx+dy*ry)/Math.max(1,rx*rx+ry*ry))),d=Math.hypot(dx+rx*t,dy+ry*t);
       score+=Math.max(0,(e.carrier?52:40)-d)*220;
      }
      const boss=s.director.boss;if(boss?.layer==='shell'&&['intro','shell'].includes(boss.phase))score+=Math.max(0,Math.max(165,boss.y)+boss.displayWidth*.44+25-ny)*130;
      for(const p of items)if(skipped.has(p.id))score+=Math.max(0,40-Math.hypot(nx-p.x,ny-p.y))*220;
      if(!best||score<best.score)best={x,y,score};
    }
    const close=s.enemyShots.filter(p=>Math.hypot(p.node.x-s.ship.x,p.node.y-s.ship.y)<85).length;
    const special=s.weapons.specialCharges>0&&s.weapons.specialActiveMs===0&&(close>=4||(s.director.boss&&s.director.boss.phase!=='intro'&&elapsed%14000<30));
    return {...base,moveX:best?.x??0,moveY:best?.y??0,firePrimary:true,firePrimaryTap:false,special:!!special,menuOrBack:false};
   };
   let life=s.health.lives,level=s.weapons.weaponLevel;
   for(;elapsed<420000&&!s.health.gameOver&&!s.completed;elapsed+=20){
    const start=performance.now();s.sys.step(s.time.now+20,20);costs.push(performance.now()-start);
    peakEnemies=Math.max(peakEnemies,s.director.enemies.length);peakBullets=Math.max(peakBullets,s.enemyShots.length);
    if(s.health.lives<life)deaths.push(elapsed/1000);life=s.health.lives;
    if(s.weapons.weaponLevel!==level){level=s.weapons.weaponLevel;levels.push({seconds:elapsed/1000,level});}
    if(elapsed%10000===0)await new Promise(r=>setTimeout(r,0));
   }
   s.inputManager.sample=original;s.checkPickupCollisions=originalCollection;costs.sort((a,b)=>a-b);
   return {pilot:s.pilot.name,skipPolicy:${skipP},actuallySkipped:[...skipped].filter(id=>!picked.has(id)).length,seconds:elapsed/1000,completed:s.completed,gameOver:s.health.gameOver,lives:s.health.lives,level:s.weapons.weaponLevel,powerMeter:s.weapons.powerMeter,collected:supplies,pickedTypes,kills:s.totalKills,levels,deaths,deathCauses,peakEnemies,peakBullets,updateP95Ms:costs[Math.floor(costs.length*.95)]};
  `);report.regression.fullRoutes.push(route);console.log(JSON.stringify({fullRoute:route}));await shot('route-'+id+'-skip'+skipP);
 }
 // Record outcomes honestly; an automated route is a stress test, not a human Normal-difficulty approval.
 assert.ok(report.regression.fullRoutes.every(r=>r.peakBullets<=84));
 assert.ok(report.regression.fullRoutes.every(r=>r.completed),'Every pilot must finish the complete route with conventional fire and collected specials');

}
