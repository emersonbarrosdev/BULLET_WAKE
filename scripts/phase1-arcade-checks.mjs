import assert from 'node:assert/strict';
export async function runPhase1Review({send,evaluate,waitFor,key,click,shot,report,errors}){
  const pause=ms=>new Promise(r=>setTimeout(r,ms));
  const run=code=>evaluate(`(()=>{const s=window.__GAME__.scene.getScene('PrototypeScene');${code}})()`);
  for(const [width,height]of [[1366,768],[1920,1080]]){
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    await waitFor(`document.querySelectorAll('.bw-pilot-card').length===4&&[...document.querySelectorAll('#bw-pilot-select img')].every(e=>e.complete&&e.naturalWidth)`);
    const geometry=await evaluate(`(()=>{const root=document.querySelector('#bw-pilot-select'),cards=[...root.querySelectorAll('.bw-pilot-card')];return {count:cards.length,scroll:root.scrollHeight>innerHeight,overflow:cards.map(e=>e.scrollWidth>e.clientWidth+1),bounds:cards.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom}})}})()`);
    assert.equal(geometry.count,4);assert.equal(geometry.scroll,false);assert.ok(geometry.overflow.every(e=>!e));assert.ok(geometry.bounds.every(b=>b.x>=0&&b.right<=width&&b.bottom<=height));
    await shot('four-pilots-'+width+'x'+height);
    for(let i=0;i<4;i++){
      await click(`[data-profile-index="${i}"]`);
      assert.equal(await evaluate(`document.querySelector('#bw-pilot-select').scrollHeight>innerHeight`),false);
      await shot('profile-'+i+'-'+width+'x'+height);await key('Escape','Escape',27);
    }
    await key('4','Digit4',52);await key('Enter','Enter',13);
    assert.equal(await evaluate(`document.querySelectorAll('[data-confirm-index]:not([hidden])').length`),1);
    assert.equal(await evaluate(`document.querySelector('[data-confirm-index="3"]').hidden`),false);
    await key('Escape','Escape',27);
    await click('[data-pilot-index="0"]');await click('[data-action="start"]:not([hidden])');
    await waitFor(`window.__GAME__.scene.isActive('PrototypeScene')&&!!document.querySelector('#bw-combat-hud')&&!document.querySelector('.bw-loading')&&!document.querySelector('.bw-briefing')`);
    const hud=await evaluate(`({sidebars:document.querySelectorAll('.bw-combat-side').length,text:document.querySelector('#bw-combat-hud').innerText,guide:document.body.innerText,canvas:window.__GAME__.canvas.width})`);
    assert.equal(hud.sidebars,2);assert.ok(!hud.text.includes('INTEGRIDADE'));assert.ok(!hud.text.includes('DASH'));assert.ok(hud.text.includes('VIDAS'));assert.ok(!hud.guide.includes('Míssil secundário'));assert.ok(!hud.guide.includes('Carregar / soltar'));
    await run(`s.scene.pause();s.health.invulnerableMs=999999;s.director.enemies.length=0;s.syncEnemyVisuals();s.clearPlayerShots();`);
    const contact=await run(`
      const e={id:9001,kind:'scout',phase:'approach',x:350,y:200,baseX:350,baseY:200,ageMs:0,phaseMs:1000,hp:100,maxHp:100,secondShotFired:false};
      s.director.enemies.push(e);s.makeEnemyVisual(e);const body=s.enemyVisuals.get(e.id).body;body.stop().setFrame(0).setDisplaySize(128,128);
      const f=body.frame,c=document.createElement('canvas');c.width=f.cutWidth;c.height=f.cutHeight;const ctx=c.getContext('2d');ctx.drawImage(f.source.image,f.cutX,f.cutY,f.cutWidth,f.cutHeight,0,0,c.width,c.height);const data=ctx.getImageData(0,0,c.width,c.height).data;
      const opaque=(x,y)=>x>=0&&x<c.width&&y>=0&&y<c.height&&data[(Math.floor(y)*c.width+Math.floor(x))*4+3]>=180;
      let solid=null,gap=null;
      for(let y=25;y<c.height-25;y+=3)for(let x=25;x<c.width-25;x+=3){
        if(!solid&&Math.abs(x-c.width/2)>45&&opaque(x,y)&&opaque(x-4,y)&&opaque(x+4,y)&&opaque(x,y-4)&&opaque(x,y+4))solid={x,y};
        if(!gap){let empty=true;for(let yy=y-9;yy<=y+9;yy++)for(let xx=x-9;xx<=x+9;xx++)if(data[(yy*c.width+xx)*4+3]>8)empty=false;if(empty)gap={x,y};}
      }
      if(!solid||!gap)throw Error('No solid extremity/clear gap for real-alpha test');
      const fire=p=>{const x=e.x+(p.x/c.width-.5)*128,y=e.y+(p.y/c.height-.5)*128;s.createPlayerProjectile({x,y,velocityX:0,velocityY:0,damage:1,hitRadius:.1,texture:'shot-rivet',animation:'',scale:1});s.advancePlayerShots(0);s.clearPlayerShots();return {x,y,hp:e.hp};};
      const missed=fire(gap),hit=fire(solid);s.director.enemies.length=0;s.syncEnemyVisuals();
      return {missed,hit,gap,solid,frame:{width:f.cutWidth,height:f.cutHeight,originX:body.displayOriginX,originY:body.displayOriginY}};
    `);
    console.log('alpha',JSON.stringify(contact));assert.equal(contact.missed.hp,100);assert.ok(contact.hit.hp<100);
    await run(`s.scene.resume();s.weapons.weaponLevel=3;s.weapons.weaponFamily='ion';s.weapons.missileCooldownMs=0;s.health.invulnerableMs=999999;s.__fired=0;const make=s.createPlayerProjectile.bind(s);s.createPlayerProjectile=(...args)=>{s.__fired++;return make(...args)};`);
    await pause(180);
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32});
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'d',code:'KeyD',windowsVirtualKeyCode:68});
    await pause(900);
    const moving=await run(`return {status:s.sys.settings.status,input:s.input.enabled,keyboard:s.input.keyboard.enabled,keys:{space:s.inputManager.keys.SPACE.isDown,d:s.inputManager.keys.D.isDown},brief:!!s.briefing,paused:s.scene.isPaused(),frameCount:s.game.loop.frame,rotation:s.ship.rotation,frame:s.ship.list.find(n=>n.texture?.key==='hd-rivet')?.frame.name,shots:s.shots.length,fired:s.__fired,missileCooldown:s.weapons.missileCooldownMs,x:s.ship.x};`);
    assert.equal(moving.rotation,0);assert.ok(moving.fired>=20,JSON.stringify(moving));assert.ok(moving.missileCooldown>0);assert.ok([0,1].includes(Number(moving.frame)));
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'d',code:'KeyD',windowsVirtualKeyCode:68});
    await shot('moving-fire-'+width+'x'+height);
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});
    await run(`s.scene.pause();s.clearPlayerShots();s.clearEnemyShots();s.director.enemies.length=0;s.syncEnemyVisuals();s.director.boss=null;s.director.minibossSpawned=true;s.director.scrollPx=4250;s.director.eventIndex=999;s.director.update(0,384,350);s.director.boss.update(1800,384,350);s.syncBossVisual(s.director.boss);s.hud.showBossBar(s.director.boss.name,s.director.boss.hp,s.director.boss.maxHp);s.hud.flash('', '#fff',0);s.hud.update(0);s.ship.setPosition(384,350);`);
    await shot('colossal-shell-'+width+'x'+height);
    const boss=await run(`const b=s.director.boss;b.damage(600);b.update(2400,384,350);s.syncBossVisual(b);s.hud.showBossBar(b.name+' · FORMA INTERNA',b.hp,b.maxHp);return {width:b.displayWidth,modules:b.modules.length,layer:b.layer};`);
    assert.equal(boss.layer,'inner');assert.equal(boss.modules,3);assert.ok(boss.width>=432);
    await shot('colossal-inner-'+width+'x'+height);
    if(width===1366){
      const ttks=await run(`
        const Tal=s.director.boss.constructor,previous=s.director.boss,weapon={...s.weapons},effect=s.playEffect;
        s.playEffect=()=>{};const results=[];
        for(const [family,level]of [['ion',2],['ion',3],['ion',4],['green',1]]){
          s.clearPlayerShots();s.director.boss=new Tal();s.ship.setPosition(384,370);s.weapons={...weapon,weaponFamily:family,weaponLevel:level};
          let cooldown=0,missile=0,elapsed=0;const phases={};
          for(;elapsed<180000;elapsed+=20){
            const b=s.director.boss;b.update(20,384,370);s.syncBossVisual(b);cooldown-=20;missile-=20;
            if(cooldown<=0){s.firePrimary();cooldown=family==='green'?180:160;}
            if(level>=3&&missile<=0){s.fireSecondary();missile=3200;}
            s.advancePlayerShots(20);phases[b.phase]??=elapsed;
            if(b.phase==='defeated')break;
          }
          results.push({family,level,seconds:elapsed/1000,phases,defeated:s.director.boss.phase==='defeated'});
        }
        s.clearPlayerShots();s.director.boss=previous;s.weapons=weapon;s.playEffect=effect;return results;
      `);
      report.regression.realContourTTK=ttks;console.log('contourTTK',JSON.stringify(ttks));
      assert.ok(ttks.every(t=>t.defeated),'Earned loadouts must defeat both forms without special');
      assert.ok(ttks[3].seconds<=ttks[2].seconds*1.25,'Green unlock cannot be a major damage downgrade');
    }
    const pickup=await run(`s.pickups.clear();const p=s.pickups.spawn('power',590,410);p.x=599;p.velocityX=34;p.velocityY=24;s.pickups.update(200,384,350);return {x:p.x,y:p.y,vx:p.velocityX,vy:p.velocityY};`);
    assert.ok(pickup.vx<0&&pickup.vy<0);
    await run(`s.director.boss=null;s.bossVisual?.container.destroy();s.bossVisual=undefined;s.hud.hideBossBar();const e={id:9002,kind:'cutter',carrier:true,drop:'power',phase:'approach',x:384,y:160,baseX:384,baseY:160,ageMs:0,phaseMs:0,hp:4,maxHp:4,secondShotFired:false};s.director.enemies.push(e);s.makeEnemyVisual(e);s.syncPickupVisuals();`);
    const survival=await run(`
      s.pickups.clear();s.clearEnemyShots();s.weapons.weaponFamily='green';s.weapons.weaponLevel=3;s.weapons.powerMeter=2;
      s.weapons.hasShield=false;s.weapons.specialActiveMs=0;s.health={hp:100,lives:3,invulnerableMs:0,gameOver:false};
      const event=s.damageShip(1);const lives=s.health.lives,drops=s.pickups.pickups.length;
      for(const p of s.pickups.pickups){p.x=s.ship.x;p.y=s.ship.y;}s.checkPickupCollisions();
      const recovered={family:s.weapons.weaponFamily,level:s.weapons.weaponLevel,meter:s.weapons.powerMeter};
      const protectedEvent=s.damageShip(1);s.hud.setHealth(s.health);s.hud.setWeapon(s.weapons.weaponFamily,s.weapons.weaponLevel,s.weapons.powerMeter);
      return {event,lives,drops,recovered,protectedEvent};
    `);
    assert.equal(survival.event,'respawn');assert.equal(survival.lives,2);assert.ok(survival.drops>=2);
    assert.deepEqual(survival.recovered,{family:'green',level:3,meter:2});assert.equal(survival.protectedEvent,'ignored');
    await run(`s.pickups.update(0,s.ship.x,s.ship.y);s.syncPickupVisuals();s.particles.update(5000);`);
    await shot('parachute-'+width+'x'+height);
    await run(`s.scene.resume();s.openBriefing(false);`);await waitFor(`!!document.querySelector('.bw-briefing')`);
    await shot('pause-'+width+'x'+height);
    await click('[data-brief-action="1"]');await click('[data-brief-action="0"]');
    assert.ok(!(await evaluate(`document.querySelector('.bw-briefing').innerText`)).includes('Dash'));
    await shot('controls-'+width+'x'+height);await click('[data-brief-action="0"]');await click('[data-brief-action="1"]');
    assert.ok(await evaluate(`[...document.querySelectorAll('.bw-brief-items article>div')].every(e=>e.scrollWidth<=e.clientWidth+1)`));
    await shot('items-'+width+'x'+height);
    await key('ArrowDown','ArrowDown',40);assert.ok(await evaluate(`document.querySelector('.bw-brief-items').scrollTop>0`));

    await run(`s.briefing?.destroy();s.briefing=undefined;s.scene.resume();`);
    report.viewports.push({width,height,geometry,hud,contact,moving,boss,pickup,survival});
    await run(`s.scene.start('PilotSelectScene',{stageNumber:1});`);await waitFor(`!!document.querySelector('.bw-pilot-card')`);
    await click('[data-pilot-index="3"]');await click('[data-action="start"]:not([hidden])');
    await waitFor(`window.__GAME__.scene.isActive('PrototypeScene')&&!!document.querySelector('#bw-combat-hud')&&!document.querySelector('.bw-loading')&&!document.querySelector('.bw-briefing')`);
    const lyra=await run(`s.scene.pause();s.health.invulnerableMs=999999;s.triggerSpecial();return {id:s.pilot.id,special:s.weapons.specialType,charges:s.weapons.specialCharges};`);
    assert.equal(lyra.id,'lyra');assert.equal(lyra.special,'orbital');assert.equal(lyra.charges,1);
    await shot('lyra-orbital-'+width+'x'+height);
    const pad=await run(`
      s.weapons.specialActiveMs=0;s.weapons.specialCharges=2;
      window.__qaPad={id:'Xbox QA',mapping:'standard',connected:true,axes:[.8,0],buttons:Array.from({length:16},()=>({pressed:false,value:0}))};
      Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[window.__qaPad]});
      s.inputManager.resetPad();window.__qaPad.buttons[0]={pressed:true,value:1};window.__qaPad.buttons[2]={pressed:true,value:1};
      window.__qaPad.buttons[5]={pressed:true,value:1};window.__qaPad.buttons[6]={pressed:true,value:1};window.__qaPad.buttons[3]={pressed:true,value:1};
      const cmd=s.inputManager.sample(s.ship.x,s.ship.y);
      Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[]});s.inputManager.resetPad();return cmd;
    `);
    assert.equal(pad.firePrimary,true);assert.equal(pad.special,true);assert.ok(pad.moveX>.5);
    assert.equal(pad.dashTrigger,false);assert.equal(pad.chargeHeld,false);assert.equal(pad.missile,false);
    report.viewports[report.viewports.length-1].gamepad=pad;
    await run(`
      s.director.boss=null;s.director.enemies.length=0;s.syncEnemyVisuals();s.health.gameOver=false;s.health.invulnerableMs=999999;s.completed=false;
      const update=s.director.update.bind(s.director);s.director.update=(...args)=>({...update(...args),completed:true});s.update(0,16);
    `);
    await waitFor(`!!document.querySelector('.bw-mission-result')`);await shot('mission-complete-'+width+'x'+height);
    assert.ok(await evaluate(`(()=>{const r=document.querySelector('.bw-result-panel').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth})()`));
    await click('[data-result-action="1"]');
    await waitFor(`window.__GAME__.scene.isActive('PrototypeScene')&&!document.querySelector('.bw-mission-result')&&!!document.querySelector('#bw-combat-hud')`);
    await pause(100);await run(`s.scene.pause();`);
    await run(`s.weapons.specialActiveMs=0;s.weapons.hasShield=false;s.health={hp:100,lives:1,invulnerableMs:0,gameOver:false};s.damageShip(1);`);
    await waitFor(`!!document.querySelector('.bw-mission-result')`);await shot('game-over-'+width+'x'+height);
    const resultFit=await evaluate(`(()=>{const p=document.querySelector('.bw-result-panel'),r=p.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight})()`);assert.ok(resultFit);
    await key('ArrowRight','ArrowRight',39);await key('Enter','Enter',13);await waitFor(`!!document.querySelector('.bw-pilot-card')`);
    await evaluate(`window.__GAME__.scene.getScene('PilotSelectScene').scene.start('TitleScene');void 0;`);await waitFor(`!!document.querySelector('.bw-press-activation')`);
    await click('.bw-press-activation');await click('[data-action="options"]');await shot('title-options-'+width+'x'+height);
    await click('[data-action="controls"]');await shot('title-controls-'+width+'x'+height);
    assert.ok(!(await evaluate(`document.querySelector('#bw-title-screen').innerText`)).includes('DASH'));
    await click('[data-action="back"]');await click('[data-action="guide"]');await shot('title-guide-'+width+'x'+height);
    await click('[data-action="back"]');await click('[data-action="back"]');await click('[data-action="pilots"]');
    await waitFor(`!!document.querySelector('.bw-mission-select')`);await shot('mission-select-'+width+'x'+height);
    await click('[data-mission-action="launch"]');await waitFor(`!!document.querySelector('.bw-pilot-card')`);
    await run(`s.scene.start('PilotSelectScene',{stageNumber:1});`);await waitFor(`!!document.querySelector('.bw-pilot-card')`);
  }
  assert.equal(errors.length,0,JSON.stringify(errors));console.log('PASS: four pilots/profiles, mission flow, carbon sidebars, real alpha contact, moving rapid fire, automatic missiles, colossal layers, parachute and bouncing supplies; both viewports.');
}
