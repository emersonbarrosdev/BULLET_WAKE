import assert from 'node:assert/strict';

export async function runPhase1Review({send,evaluate,waitFor,key,click,shot,report,errors}) {
  const pause=ms=>new Promise(r=>setTimeout(r,ms));
  const run=code=>evaluate(`(()=>{const s=window.__GAME__.scene.getScene('PrototypeScene');${code}})()`);
  for(const[width,height]of [[1366,768],[1920,1080]]){
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    await click('[data-pilot-index="0"]');await click('[data-action="start"]:not([hidden])');
    await waitFor("!!document.querySelector('.bw-briefing')");
    const before=await run('return s.director.scrollPx;');await pause(350);
    assert.equal(await run('return s.director.scrollPx;'),before,'Preflight must freeze simulation');
    const fit=await evaluate(`(()=>{const r=document.querySelector('.bw-brief-panel').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.right<=innerWidth&&document.documentElement.scrollHeight<=innerHeight;})()`);
    assert.ok(fit);await shot(`briefing-keyboard-${width}x${height}`);
    await key('Enter','Enter',13);await waitFor("window.__GAME__.scene.isActive('PrototypeScene')");
    await pause(250);assert.ok(await run('return s.director.scrollPx;')>before);
    assert.equal(await evaluate("document.querySelectorAll('#bw-combat-hud kbd').length"),0);
    await key('Escape','Escape',27);await waitFor("document.querySelector('.bw-brief-panel h1')?.textContent==='OPERAÇÃO PAUSADA'");
    const frozen=await run('return s.director.scrollPx;');await pause(300);assert.equal(await run('return s.director.scrollPx;'),frozen);
    await click('[data-brief-action="1"]');await click('[data-brief-action="0"]');
    assert.ok(await evaluate("document.querySelector('.bw-brief-panel').textContent.includes('Míssil secundário')"));
    await shot(`pause-controls-${width}x${height}`);
    await key('Escape','Escape',27);await click('[data-brief-action="1"]');
    assert.ok(await evaluate("document.querySelector('.bw-brief-items').textContent.includes('Exige azul NV4')"));
    await key('Escape','Escape',27);await key('Escape','Escape',27);await key('Escape','Escape',27);
    await waitFor("window.__GAME__.scene.isActive('PrototypeScene')");
    await run('s.health.invulnerableMs=999999;');
    const stock=await run('return s.weapons.specialCharges;');
    await key('b','KeyB',66);await key('v','KeyV',86);assert.equal(await run('return s.weapons.specialCharges;'),stock);
    await key('x','KeyX',88);assert.equal(await run('return s.weapons.specialCharges;'),stock-1);
    await pause(440);await shot(`special-travel-${width}x${height}`);
    await pause(200);await shot(`special-impact-${width}x${height}`);
    await pause(3300);assert.equal(await run('return !!s.specialVisual;'),false);
    // Inject the standard browser API, then exercise the actual InputManager and menus.
    await evaluate(`window.qaPad={id:'Xbox Standard Test',connected:true,mapping:'standard',axes:[0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};window.originalGetPads=navigator.getGamepads.bind(navigator);Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[window.qaPad]});`);
    const press=async(i)=>{await evaluate(`window.qaPad.buttons[${i}].pressed=true`);await pause(100);await evaluate(`window.qaPad.buttons[${i}].pressed=false`);await pause(100);};
    const pos=await run('return s.ship.x;');await evaluate('window.qaPad.axes=[.7,0]');await pause(200);await evaluate('window.qaPad.axes=[0,0]');assert.ok(await run('return s.ship.x;')>pos+8);
    await press(9);await waitFor("!!document.querySelector('.bw-briefing')");await press(13);await press(0);await press(0);
    assert.ok(await evaluate("document.querySelector('.bw-brief-device')?.textContent.includes('CONTROLE CONECTADO')"));
    assert.ok(await evaluate("[...document.querySelectorAll('.bw-brief-controls kbd')].some(n=>n.textContent==='RB')"));
    await shot(`controller-guide-${width}x${height}`);
    await press(1);await press(1);await press(0);await waitFor("window.__GAME__.scene.isActive('PrototypeScene')");
    await run('s.weapons.specialActiveMs=0;s.updatePrismSpecial(0);');const padStock=await run('return s.weapons.specialCharges;');await press(2);assert.equal(await run('return s.weapons.specialCharges;'),padStock-1);
    await evaluate('Object.defineProperty(navigator,"getGamepads",{configurable:true,value:window.originalGetPads})');
    await waitFor("!!document.querySelector('.bw-briefing')");
    await key('Escape','Escape',27);await waitFor("window.__GAME__.scene.isActive('PrototypeScene')");
    await run('s.weapons.specialActiveMs=0;s.updatePrismSpecial(0);s.scene.pause();s.director.enemies.length=0;s.syncEnemyVisuals();s.clearEnemyShots();s.clearPlayerShots();s.pickups.clear();s.syncPickupVisuals();');
    // Physical collection cannot bypass the cascade; each tier begins at level one.
    const cascade=await run(`s.setTestWeapon('ion',1);const out=[];for(const [family,level,item] of [['ion',1,'weapon_green'],['ion',4,'weapon_red'],['ion',4,'weapon_green'],['green',4,'weapon_red']]){s.setTestWeapon(family,level);s.pickups.spawn(item,s.ship.x,s.ship.y-20);s.checkPickupCollisions();out.push([s.weapons.weaponFamily,s.weapons.weaponLevel]);}return out;`);
    assert.deepEqual(cascade,[['ion',1],['ion',4],['green',1],['red',1]]);
    await run('s.pickups.clear();s.syncPickupVisuals();s.hud.setSpecialStock(s.weapons.specialCharges,false);for(const n of [...s.children.list])if(n.type==="Image"&&n.texture?.key.startsWith("review-pickups-"))n.destroy();');
    for(const level of [1,2,3,4]){await run(`s.ship.x=384;s.ship.y=390;s.setTestWeapon('red',${level});s.updateCrimsonLaser(60,true);`);await shot(`red-level-${level}-${width}x${height}`);}
    await run("s.setTestWeapon('ion',1);s.updateCrimsonLaser(200,false);");
    for(const [name,distance]of [['calm',0],['invasion',2400],['rift',4100]]){
      for(let frame=0;frame<4;frame++){await run(`s.backdrop.update(${distance},350);`);await shot(`water-${name}-${frame}-${width}x${height}`);}
    }
    await run('s.scene.resume();s.health.invulnerableMs=0;s.damageShip(100);');await waitFor("!!document.querySelector('.bw-result-defeat')");
    await shot(`result-${width}x${height}`);await key('Escape','Escape',27);await waitFor("!!document.querySelector('.bw-pilot-card')");
    report.viewports.push({width,height,briefingFits:fit,simulationPauses:true,keyboardSpecial:'X only',standardGamepad:true,cascade,specialCleanup:true});
  }
  assert.deepEqual(errors,[]);console.log('PASS: preflight, pause/options, keyboard and standard gamepad, cascade gates, special lifetime, all red levels and animated ocean; both viewports.');
}
