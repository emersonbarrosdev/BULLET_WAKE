import assert from 'node:assert/strict';

export async function runPhase1Review({send,evaluate,waitFor,key,click,shot,report,errors}) {
  const scene="window.__GAME__.scene.getScene('PrototypeScene')";
  const pause=ms=>new Promise(r=>setTimeout(r,ms));
  const run=code=>evaluate(`(()=>{const s=${scene};${code}})()`);
  const freeze=async()=>{
    await waitFor("window.__GAME__.scene.isActive('PrototypeScene')&&!!document.querySelector('#bw-combat-hud')");
    await run('s.health.invulnerableMs=600000;s.scene.pause();');
  };
  for(const[width,height]of [[1366,768],[1920,1080]]){
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    await click('[data-pilot-index="0"]');
    const confirmation=await evaluate(`(()=>{const b=document.querySelector('[data-action="start"]:not([hidden])'),r=b.getBoundingClientRect(),c=b.closest('.bw-pilot-card').getBoundingClientRect();return {inside:r.x>=c.x&&r.right<=c.right&&r.y>=c.y&&r.bottom<=c.bottom,count:document.querySelectorAll('[data-action="start"]:not([hidden])').length};})()`);
    assert.deepEqual(confirmation,{inside:true,count:1});
    await click('[data-action="start"]:not([hidden])');await freeze();
    const names=['scout','dart','lancer','cutter','carrier','surface','ambush','raia','talassarca','inner','metamorphosis','special','blue','green','fire','explosion','ocean','turbulent','rift'];
    const art=await run(`return ${JSON.stringify(names)}.map(name=>{const t=s.textures.get('polish-'+name),im=t.getSourceImage(),f=t.get(0),c=document.createElement('canvas');c.width=f.width;c.height=f.height;const x=c.getContext('2d'),variants=new Set();let cornerMax=0;for(let i=0;i<t.frameTotal-1;i++){x.clearRect(0,0,c.width,c.height);x.drawImage(im,i*f.width,0,f.width,f.height,0,0,c.width,c.height);variants.add(c.toDataURL());if(!['ocean','turbulent','rift'].includes(name))for(const[a,b]of [[1,1],[c.width-2,1],[1,c.height-2],[c.width-2,c.height-2]])cornerMax=Math.max(cornerMax,x.getImageData(a,b,1,1).data[3]);}return{name,frames:t.frameTotal-1,variants:variants.size,cornerMax};});`);
    assert.ok(art.every(a=>a.frames===(a.name==='explosion'?16:8)&&a.variants===a.frames),JSON.stringify(art));
    assert.ok(art.every(a=>a.cornerMax<30),'Opaque sprite background: '+JSON.stringify(art.filter(a=>a.cornerMax>=30)));
    const hull=await run(`s.health.hp=70;s.hud.setHealth(s.health);s.hud.setSpecialStock(s.weapons.specialCharges);return {bars:document.querySelectorAll('.bw-hull-bar').length,fill:document.querySelector('[data-field="health"]').style.width,value:document.querySelector('[data-field="integrity"]').textContent,stock:document.querySelector('[data-field="special-stock"]').textContent,resonance:document.querySelector('#bw-combat-hud').innerText.includes('RESSON'),bombs:document.querySelector('#bw-combat-hud').innerText.includes('BOMBAS')};`);
    assert.deepEqual(hull,{bars:1,fill:'70%',value:'70 / 100',stock:'2 / 3',resonance:false,bombs:false});
    // Hide every unrelated object: prove water animation with the scroll held fixed.
    await run('s.savedVisibility=s.children.list.map(o=>[o,o.visible]);for(const[o]of s.savedVisibility)o.setVisible(false);s.backdrop.water.surface.setVisible(true);s.backdrop.update(0,0);');
    await pause(100);
    const clip={x:Math.ceil(width*168/768),y:0,width:Math.floor(width*432/768)-2,height,scale:1};
    const a=(await send('Page.captureScreenshot',{format:'png',clip})).data;
    await run('s.backdrop.update(0,350);');await pause(100);
    assert.notEqual(a,(await send('Page.captureScreenshot',{format:'png',clip})).data,'Water froze without scroll');
    await run('for(const[o,v]of s.savedVisibility)o.setVisible(v);s.backdrop.update(0,0);');
    await shot(`calm-${width}x${height}`);
    await run('s.backdrop.update(2500,150);');await shot(`invasion-${width}x${height}`);
    await run("s.backdrop.update(4250,150);s.hud.setSector('aproximacao');");await shot(`rift-${width}x${height}`);
    const weapons=[];
    for(const family of ['ion','green','red'])for(const level of [1,2,3,4]){
      const state=await run(`s.director.enemies.length=0;s.syncEnemyVisuals();s.clearPlayerShots();s.weapons.weaponFamily='${family}';s.weapons.weaponLevel=${level};s.updateCrimsonLaser(500,false);for(let i=0;i<20;i++){if(i%6===0&&'${family}'!=='red')s.firePrimary();s.advancePlayerShots(1000/60);s.updateCrimsonLaser(1000/60,'${family}'==='red');}s.hud.setWeapon('${family}',${level});return {family:'${family}',level:${level},beams:s.crimsonLaserState.beams.length,ribbons:s.shots.filter(p=>p.trail.length>8).length};`);
      if(family==='green')assert.ok(state.ribbons>0,'Green must leave connected helical trails');
      if(family==='red')assert.equal(state.beams,[1,2,4,4][level-1]);
      weapons.push(state);await shot(`weapon-${family}-${level}-${width}x${height}`);
    }
    await run("s.clearPlayerShots();s.weapons.weaponFamily='ion';s.weapons.weaponLevel=1;s.updateCrimsonLaser(500,false);s.hud.setWeapon('ion',1);");
    const pickups=await run(`s.pickups.clear();for(const[i,t]of ['power','weapon_ion','weapon_green','weapon_red','health','speed','special'].entries())s.pickups.spawn(t,220+i%4*100,120+Math.floor(i/4)*95);s.syncPickupVisuals();return [...s.pickupVisuals.values()].every(c=>c.list.length===1&&c.list[0].type==='Sprite'&&c.list[0].anims.isPlaying);`);
    assert.ok(pickups);await shot(`items-${width}x${height}`);
    const collected=await run(`s.setTestWeapon('ion',4);s.pickups.clear();s.pickups.spawn('weapon_green',s.ship.x,s.ship.y-20);s.checkPickupCollisions();return s.weapons.weaponFamily;`);
    assert.equal(collected,'green','Visible nose must collect capsule');
    await run(`s.director.enemies.length=0;s.pickups.clear();s.syncPickupVisuals();s.director.seekCheckpoint(700);s.director.boss=null;for(let i=0;i<180;i++)s.update(i*50,50);s.ship.setAlpha(1);`);
    await shot(`combat-${width}x${height}`);
    // Isolate every alien species and surface phase at the same scale as the live game.
    await run(`s.director.enemies.length=0;s.syncEnemyVisuals();for(const[i,kind]of ['scout','dart','lancer','cutter'].entries()){const e={id:800+i,kind,phase:'approach',x:230+i*95,y:130,baseX:230+i*95,baseY:130,ageMs:0,phaseMs:0,hp:3,maxHp:3,secondShotFired:false};s.director.enemies.push(e);s.makeEnemyVisual(e);}for(const[i,variant]of ['turret','ambush'].entries()){const e={id:820+i,kind:'lancer',phase:'attack',layer:'surface',surfaceVariant:variant,animationFrame:4,x:275+i*180,y:250,baseX:275+i*180,baseY:250,ageMs:0,phaseMs:0,hp:3,maxHp:3,secondShotFired:false};s.director.enemies.push(e);s.makeEnemyVisual(e);}s.syncEnemyVisuals();`);
    await shot(`alien-species-${width}x${height}`);
    await run(`const e={id:850,kind:'cutter',carrier:true,drop:'special',phase:'approach',x:225,y:315,baseX:225,baseY:315,ageMs:0,phaseMs:0,hp:4,maxHp:4,secondShotFired:false};s.director.enemies.push(e);s.makeEnemyVisual(e);`);
    await shot(`biological-carrier-${width}x${height}`);
    const beforeFrames=await run('return [800,801,802,803,850].map(id=>s.enemyVisuals.get(id).body.frame.name);');
    await run('s.scene.resume();');await pause(260);await run('s.scene.pause();');
    const afterFrames=await run('return [800,801,802,803,850].map(id=>s.enemyVisuals.get(id).body.frame.name);');
    assert.ok(beforeFrames.every((v,i)=>v!==afterFrames[i]),'Creature frames must advance in actual live gameplay');
    await run(`s.director.enemies.length=0;s.syncEnemyVisuals();s.director.scrollPx=4250;s.director.eventIndex=999;s.director.minibossSpawned=true;s.director.minibossActive=false;s.director.boss=null;s.director.update(0,384,360);s.director.boss.update(1800,384,360);s.syncBossVisual(s.director.boss);s.hud.showBossBar('TALASSARCA · CASCA 1/2',600,600);s.backdrop.update(4250,0);`);
    assert.equal(await run('return s.bossVisual.main.displayWidth;'),432*.8);
    await shot(`boss-shell-${width}x${height}`);
    const special=await run(`s.weapons.specialCharges=2;s.weapons.specialActiveMs=0;s.triggerSpecial();s.weapons.specialActiveMs-=620;s.updatePrismSpecial(620);return {charges:s.weapons.specialCharges,hp:s.director.boss.hp,key:s.specialVisual.nodes[0].texture.key};`);
    assert.deepEqual(special,{charges:1,hp:480,key:'polish-special'});
    assert.equal(await run('s.health.invulnerableMs=0;const before=s.health.hp;s.damageShip(25);return s.health.hp===before;'),true);
    await shot(`special-${width}x${height}`);
    await run(`s.weapons.specialActiveMs=0;s.updatePrismSpecial(0);s.hud.setSpecialStock(s.weapons.specialCharges);s.director.boss.damage(480);s.director.boss.update(1200,384,360);s.syncBossVisual(s.director.boss);s.hud.showBossBar('TALASSARCA · METAMORFOSE',0,600);`);
    assert.ok(Math.abs(await run('return s.bossVisual.main.displayWidth;')-432*.9)<.01,'Metamorphosis must unfold smoothly between the two widths');
    assert.equal(await run('return s.director.boss.phase;'),'metamorphosis');
    await shot(`metamorphosis-${width}x${height}`);
    await run(`s.director.boss.update(1200,384,360);s.syncBossVisual(s.director.boss);s.hud.showBossBar('TALASSARCA · FORMA INTERNA 2/2',360,360);`);
    assert.equal(await run('return s.bossVisual.main.displayWidth;'),432);
    await shot(`boss-inner-${width}x${height}`);
    const particles=await run(`s.playEffect('explosion',384,250);s.particles.update(150);return s.particles.activeCount;`);
    assert.ok(particles>=14);await shot(`explosion-${width}x${height}`);
    await run(`s.director.boss.damage(360);s.update(10000,16);`);
    await waitFor("!!document.querySelector('.bw-mission-result')");
    const resultGeometry=()=>evaluate(`(()=>{const e=document.querySelector('.bw-mission-result'),r=e.querySelector('.bw-result-panel').getBoundingClientRect();return {inside:r.x>=0&&r.y>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,noScroll:e.scrollHeight===e.clientHeight,warm:getComputedStyle(e.querySelector('h1')).color};})()`);
    const victory=await resultGeometry();assert.ok(victory.inside&&victory.noScroll);assert.equal(victory.warm,'rgb(255, 154, 66)');
    await shot(`victory-${width}x${height}`);await key('r','KeyR',82);await freeze();
    await run(`s.health.invulnerableMs=0;s.damageShip(100);`);await waitFor("!!document.querySelector('.bw-result-defeat')");
    const defeat=await resultGeometry();assert.ok(defeat.inside&&defeat.noScroll);await shot(`defeat-${width}x${height}`);
    await key('Escape','Escape',27);await waitFor("!!document.querySelector('.bw-pilot-card')");
    report.viewports.push({width,height,art,hull,confirmation,weapons,liveAnimation:{beforeFrames,afterFrames},waterAnimatesWithFixedScroll:true,special,particles,victory,defeat});
  }
  assert.deepEqual(errors,[]);
  // Parent harness persists its report for the standard confirmation path only.
  const {writeFileSync}=await import('node:fs');
  writeFileSync('docs/screenshots/phase1-polish/validation.json',JSON.stringify(report,null,2)+'\n');
  console.log('PASS: organic animation atlases, independent water motion, staged invasion/rift, one health bar, physical collection, special stock, two boss layers, warm result dialogs; both resolutions; zero browser errors.');
}
