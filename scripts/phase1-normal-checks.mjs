import assert from 'node:assert/strict';

export async function runPhase1Review({send,evaluate,waitFor,key,click,shot,report,errors}) {
  const pause=ms=>new Promise(r=>setTimeout(r,ms));
  const run=code=>evaluate(`(()=>{const s=window.__GAME__.scene.getScene('PrototypeScene');${code}})()`);
  for(const [width,height]of [[1366,768],[1920,1080]]){
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    await click('[data-pilot-index="0"]');await click('[data-action="start"]:not([hidden])');
    await waitFor("window.__GAME__.scene.isActive('PrototypeScene')&&!!document.querySelector('#bw-combat-hud')");
    await run('s.scene.pause();');await pause(100);
    const ttks=await run(`
      const effect=s.playEffect;s.playEffect=()=>{};s.director.enemies.length=0;s.syncEnemyVisuals();
      s.director.boss=null;s.director.minibossSpawned=false;s.director.scrollPx=1800;s.director.update(0,384,350);
      const Mini=s.director.boss.constructor;
      s.director.boss=null;s.director.minibossSpawned=true;s.director.minibossActive=false;s.director.scrollPx=4250;s.director.eventIndex=999;s.director.update(0,384,350);
      const Tal=s.director.boss.constructor;
      window.qaBossTypes={Mini,Tal};const results=[];
      for(const [name,family,level]of [['raia','ion',2],['talassarca','ion',2],['talassarca','ion',3],['talassarca','ion',4],['talassarca','green',1]]){
        s.clearPlayerShots();s.director.boss=new (name==='raia'?Mini:Tal)();s.ship.setPosition(384,370);s.setTestWeapon(family,level);
        let cooldown=0,elapsed=0;const phases={};
        for(;elapsed<180000;elapsed+=20){
          const boss=s.director.boss;boss.update(20,384,370);cooldown-=20;
          if(cooldown<=0){s.firePrimary();cooldown=family==='green'?180:160;}
          s.advancePlayerShots(20);
          phases[boss.phase]??=elapsed;
          if(boss.phase==='defeated')break;
        }
        results.push({name,family,level,seconds:elapsed/1000,phases,defeated:s.director.boss.phase==='defeated'});
      }
      s.clearPlayerShots();s.playEffect=effect;return results;
    `);
    console.log(JSON.stringify({width,ttks}));
    assert.ok(ttks.every(x=>x.defeated),'Every reachable loadout can defeat both layers without specials');
    assert.ok(ttks[4].seconds<=ttks[3].seconds*1.2,'Green unlock must not become a DPS downgrade against the colossal boss');
    assert.ok(ttks[1].seconds<=75,'Late Continue must remain viable without specials');
    assert.ok(ttks[0].seconds>=8&&ttks[0].seconds<=40,'Miniboss must survive beyond its opening pattern');
    // Inspect real animated frames and shot rendering in ordinary combat, not frozen atlas thumbnails.
    await run(`s.director.boss=null;s.hud.hideBossBar();s.director.enemies.length=0;s.syncEnemyVisuals();s.director.seekCheckpoint(1250);s.health.invulnerableMs=999999;s.completed=false;s.setTestWeapon('ion',2);s.ship.setPosition(384,370);s.scene.resume();`);
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32});
    await pause(3500);await shot('normal-action-'+width+'x'+height);
    const frames=await run('return [...s.enemyVisuals].map(([id,v])=>[id,v.body.frame.name]);');
    await pause(200);
    assert.ok(await run(`return ${JSON.stringify(frames)}.some(([id,f])=>s.enemyVisuals.has(id)&&s.enemyVisuals.get(id).body.frame.name!==f);`));
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});
    await run(`s.scene.pause();s.clearPlayerShots();s.clearEnemyShots();s.director.enemies.length=0;s.syncEnemyVisuals();s.director.boss=new window.qaBossTypes.Tal();s.director.boss.update(1800,384,370);s.director.boss.damage(600);s.director.boss.update(2400,384,370);for(let i=0;i<70;i++){const tick=s.director.boss.update(20,384,370);for(const event of tick.shots)s.spawnEnemyShot({...event,kind:'talassarca'});}s.syncBossVisual(s.director.boss);s.hud.showBossBar('TALASSARCA · FORMA INTERNA',360,360);s.backdrop.update(4250,800);`);
    await shot('inner-curtain-'+width+'x'+height);
    await run(`s.weapons.specialCharges=2;s.weapons.specialActiveMs=0;s.triggerSpecial();s.weapons.specialActiveMs-=850;s.updatePrismSpecial(850);`);
    assert.equal(await run('return s.director.boss.hp;'),240);
    await shot('special-'+width+'x'+height);
    await run('s.weapons.specialActiveMs=0;s.updatePrismSpecial(0);');
    assert.equal(await run('return !!s.specialVisual;'),false);
    const fit=await evaluate('document.documentElement.scrollHeight<=innerHeight&&document.documentElement.scrollWidth<=innerWidth');assert.ok(fit);
    report.viewports.push({width,height,ttks,animatedFrames:true,specialDamage:120,noOverflow:fit});
    await run("s.scene.start('PilotSelectScene');");await waitFor("!!document.querySelector('.bw-pilot-card')");
  }
  // Advance the actual Phaser scene (timers, animation and collision), with a simple
  // pilot that never dodges. This is a pressure check, not a human difficulty verdict.
  await click('[data-pilot-index="0"]');await click('[data-action="start"]:not([hidden])');
  await waitFor("window.__GAME__.scene.isActive('PrototypeScene')&&!!document.querySelector('#bw-combat-hud')");
  await run('s.scene.pause();');await pause(80);
  const camping=await run(`const sample=s.inputManager.sample;const commands=sample.call(s.inputManager,s.ship.x,s.ship.y);s.inputManager.sample=()=>({...commands,moveX:0,moveY:0,firePrimary:true,firePrimaryTap:false,dashTrigger:false,special:false,missile:false,chargeHeld:false,chargeReleased:false,menuOrBack:false});let elapsed=0,peakShots=0,peakEnemies=0;const costs=[];for(;elapsed<90000&&!s.health.gameOver;elapsed+=20){const start=performance.now();s.sys.step(s.time.now+20,20);costs.push(performance.now()-start);peakShots=Math.max(peakShots,s.enemyShots.length);peakEnemies=Math.max(peakEnemies,s.director.enemies.length);}s.inputManager.sample=sample;costs.sort((a,b)=>a-b);return {seconds:elapsed/1000,hp:s.health.hp,gameOver:s.health.gameOver,peakShots,peakEnemies,updateP95Ms:costs[Math.floor(costs.length*.95)]};`);
  console.log(JSON.stringify({camping}));
  assert.ok(camping.hp<100,'A stationary held-fire player must be threatened');
  assert.ok(camping.peakShots<=84);
  report.regression.stationaryPilot=camping;
  assert.deepEqual(errors,[]);
  console.log('PASS: Normal damage calibration, reachable loadouts without special, animated combat and inner curtain; both viewports.');
}
