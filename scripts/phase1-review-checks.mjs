import assert from 'node:assert/strict';
export async function runPhase1Review({
  send,
  evaluate,
  waitFor,
  key,
  click,
  shot,
  report,
  errors,
}) {
  const scene = `window.__GAME__.scene.getScene('PrototypeScene')`;
  const freeze = async () => {
    await waitFor(
      `window.__GAME__.scene.isActive('PrototypeScene')&&Boolean(document.querySelector('#bw-combat-hud'))`,
    );
    await pause(150);
    await evaluate(
      `{const s=${scene};s.health.invulnerableMs=600000;s.scene.pause();void 0;}`,
    );
  };
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));
  for (const [width, height] of [
    [1366, 768],
    [1920, 1080],
  ]) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await pause(180);
    await click('[data-pilot-index="0"]');
    const confirmation = await evaluate(
      `(()=>{const b=document.querySelector('[data-action="start"]:not([hidden])'),card=b.closest('.bw-pilot-card'),r=b.getBoundingClientRect(),c=card.getBoundingClientRect();return {index:card.dataset.cardIndex,inside:r.x>=c.x&&r.right<=c.right&&r.y>=c.y&&r.bottom<=c.bottom,count:document.querySelectorAll('[data-action="start"]:not([hidden])').length};})()`,
    );
    assert.deepEqual(confirmation, { index: '0', inside: true, count: 1 });
    await shot(`confirmation-${width}x${height}`);
    await pause(280);
    await click('[data-action="start"]:not([hidden])');
    await freeze();
    const art = await evaluate(
      `(()=>{const s=${scene};return ['raia','talassarca','surface','swimmer','special',...['power','weapon_ion','weapon_green','weapon_red','health','bomb','speed','score','missile','special'].map(t=>'pickups-'+t),...['scout','dart','lancer','cutter','surface','raia'].map(t=>'hostile-'+t),...['blue','green','fire','missile','charge','explosion'].map(t=>'effects-'+t)].map(name=>{const t=s.textures.get('review-'+name),image=t.getSourceImage(),size=image.height,c=document.createElement('canvas');c.width=c.height=size;const ctx=c.getContext('2d'),variants=new Set();for(let i=0;i<4;i++){ctx.clearRect(0,0,size,size);ctx.drawImage(image,i*size,0,size,size,0,0,size,size);variants.add(c.toDataURL());}return{name,frames:t.frameTotal,variants:variants.size};});})()`,
    );
    assert.ok(
      art.every((a) => a.frames === 5),
      'Every animation must have four real source frames',
    );
    assert.ok(
      art.every((a) => a.variants === 4),
      'Every animation must contain distinct painted frames',
    );
    const noLabels = await evaluate(
      `(()=>{const s=${scene};s.pickups.clear();for(const[i,t]of['power','weapon_ion','weapon_green','weapon_red','health','bomb','speed','score','missile','special'].entries())s.pickups.spawn(t,220+i%5*82,130+Math.floor(i/5)*85);s.syncPickupVisuals();return [...s.pickupVisuals.values()].every(c=>c.list.length===1&&c.list[0].type==='Sprite'&&c.list[0].anims.isPlaying);})()`,
    );
    assert.ok(noLabels);
    await shot(`sprites-${width}x${height}`);
    const labels = await evaluate(
      `({lifeLabels:document.querySelector('#bw-combat-hud').innerText.includes('VIDAS'),bars:document.querySelectorAll('.bw-hull-bar').length})`,
    );
    assert.deepEqual(labels, { lifeLabels: false, bars: 1 });
    // Isolate the background so screenshot changes cannot come from enemy/UI animation.
    await evaluate(
      `{const s=${scene};s.savedVisibility=s.children.list.map(o=>[o,o.visible]);for(const[o]of s.savedVisibility)o.setVisible(false);for(const p of s.backdrop.paintedPanels)p.setVisible(true);s.backdrop.update(0);void 0;}`,
    );
    const clip = {
      x: Math.ceil((width * 168) / 768),
      y: 0,
      width: Math.floor((width * 432) / 768) - 2,
      height,
      scale: 1,
    };
    const backgroundA = (
      await send('Page.captureScreenshot', { format: 'png', clip })
    ).data;
    await evaluate(`{${scene}.backdrop.update(68);void 0;}`);
    await pause(80);
    const backgroundB = (
      await send('Page.captureScreenshot', { format: 'png', clip })
    ).data;
    assert.notEqual(
      backgroundA,
      backgroundB,
      'The rendered ocean pixels must actually move',
    );
    await shot(`ocean-moving-${width}x${height}`);
    await evaluate(
      `{const s=${scene};for(const[o,v]of s.savedVisibility)o.setVisible(v);s.pickups.clear();s.syncPickupVisuals();s.director.enemies.length=0;s.syncEnemyVisuals();s.director.eventIndex=0;s.director.scrollPx=0;s.director.boss=null;for(let i=0;i<320;i++)s.update(i*50,50);s.ship.setAlpha(1);void 0;}`,
    );
    await shot(`combat-${width}x${height}`);
    const ground = await evaluate(
      `(()=>{const s=${scene},e=s.director.enemies.find(e=>e.layer==='surface');return{exists:!!e,key:e?s.enemyVisuals.get(e.id).body.texture.key:null};})()`,
    );
    assert.deepEqual(ground, { exists: true, key: 'review-surface' });
    const swimmer = await evaluate(
      `(()=>{const s=${scene},e={...s.director.enemies.find(e=>e.layer==='surface'),id:90001,swimmer:true,x:430,y:220,baseX:430};s.director.enemies.push(e);s.makeEnemyVisual(e);return s.enemyVisuals.get(e.id).body.texture.key;})()`,
    );
    assert.equal(swimmer, 'review-swimmer');
    await shot(`swimmer-${width}x${height}`);
    await evaluate(
      `{const s=${scene};s.director.enemies.length=0;s.syncEnemyVisuals();s.clearEnemyShots();void 0;}`,
    );
    const blueCounts = [];
    for (const level of [1, 2, 3, 4]) {
      const count = await evaluate(
        `(()=>{const s=${scene};s.clearPlayerShots();s.setTestWeapon('ion',${level});s.firePrimary();const count=s.shots.length;for(let i=0;i<3;i++)s.advancePlayerShots(40);return count;})()`,
      );
      blueCounts.push(count);
      await shot(`wide-shot-${level}-${width}x${height}`);
    }
    assert.deepEqual(blueCounts, [3, 5, 9, 16]);
    const auxiliary = await evaluate(
      `(()=>{const s=${scene};s.clearPlayerShots();s.fireSecondary();const missile=s.shots[0].node.texture.key;s.clearPlayerShots();s.fireChargedShot(2);return{missile,charge:s.shots[0].node.texture.key};})()`,
    );
    assert.deepEqual(auxiliary, {
      missile: 'review-effects-missile',
      charge: 'review-effects-charge',
    });
    await shot(`auxiliary-${width}x${height}`);
    await evaluate(
      `{const s=${scene};s.clearPlayerShots();s.setTestWeapon('red',4);s.updateCrimsonLaser(250,true);void 0;}`,
    );
    await shot(`red-flames-${width}x${height}`);
    await evaluate(
      `{const s=${scene};s.crimsonLaserRenderer.clear();s.setTestWeapon('green',4);s.firePrimary();s.advancePlayerShots(120);void 0;}`,
    );
    await shot(`green-spiral-${width}x${height}`);
    await evaluate(
      `{const s=${scene};s.clearPlayerShots();s.setTestWeapon('ion',4);void 0;}`,
    );
    const shots = await evaluate(
      `(()=>{const s=${scene};s.clearEnemyShots();for(const[i,kind]of['scout','dart','lancer','cutter','surface','raia','talassarca'].entries())s.spawnEnemyShot({x:200+i*58,y:240,velocityX:0,velocityY:120,kind});return s.enemyShots.map(p=>({key:p.node.texture.key,size:p.node.displayWidth,animated:p.node.anims.isPlaying}));})()`,
    );
    assert.equal(new Set(shots.map((s) => s.key)).size, 6);
    assert.ok(new Set(shots.map((s) => s.size)).size >= 4);
    assert.ok(shots.every((s) => s.animated));
    await shot(`enemy-projectiles-${width}x${height}`);
    const hull = await evaluate(
      `(()=>{const s=${scene};s.director.enemies.length=0;s.syncEnemyVisuals();s.clearEnemyShots();s.health={hp:100,lives:1,invulnerableMs:0,gameOver:false};s.spawnEnemyShot({x:s.ship.x,y:s.ship.y-20,velocityX:0,velocityY:0,kind:'scout'});s.advanceEnemyShots(0);return{hp:s.health.hp,remaining:s.enemyShots.length};})()`,
    );
    assert.deepEqual(hull, { hp: 82, remaining: 0 });
    const contact = await evaluate(
      `(()=>{const s=${scene};s.health.invulnerableMs=600000;const e={id:90000,kind:'scout',phase:'approach',x:s.ship.x,y:s.ship.y-15,baseX:s.ship.x,baseY:350,ageMs:0,phaseMs:0,hp:1,maxHp:1,secondShotFired:false};s.director.enemies.push(e);s.makeEnemyVisual(e);const before=s.children.list.length;s.checkEnemyContacts();return{removed:!s.director.enemies.includes(e),explosion:s.children.list.some(o=>o.texture?.key==='review-effects-explosion'),hp:s.health.hp};})()`,
    );
    assert.equal(contact.removed, true);
    assert.equal(contact.explosion, true);
    assert.equal(contact.hp, 82);
    const pulse = await evaluate(
      `(()=>{const s=${scene};s.clearEnemyShots();s.weapons.bombs=3;s.spawnEnemyShot({x:s.ship.x+25,y:s.ship.y-40,velocityX:0,velocityY:0,kind:'lancer'});s.spawnEnemyShot({x:200,y:40,velocityX:0,velocityY:0,kind:'dart'});s.detonateBomb();return{remaining:s.enemyShots.length,stock:s.weapons.bombs};})()`,
    );
    assert.deepEqual(pulse, { remaining: 1, stock: 2 });
    await shot(`pulse-${width}x${height}`);
    await evaluate(`{const s=${scene};for(const o of [...s.children.list])if(o.texture?.key?.startsWith('review-effects-')||o.texture?.key==='hd-bomb')o.destroy();void 0;}`);
    await evaluate(
      `{const s=${scene};s.clearEnemyShots();s.weapons.resonance=100;s.triggerSpecial();s.weapons.specialActiveMs=2100;s.updatePrismSpecial(100);void 0;}`,
    );
    assert.equal(
      await evaluate(`${scene}.specialVisual.texture.key`),
      'review-special',
    );
    await shot(`special-${width}x${height}`);
    await evaluate(`{${scene}.hud.update(3000);void 0;}`);
    await evaluate(
      `{const s=${scene};s.specialVisual.destroy();s.specialVisual=undefined;s.weapons.specialActiveMs=0;s.director.scrollPx=1801;s.director.minibossSpawned=false;s.director.boss=null;s.director.eventIndex=999;s.director.update(0,s.ship.x,s.ship.y);for(let i=0;i<30;i++)s.director.update(50,s.ship.x,s.ship.y);s.syncBossVisual(s.director.boss);s.hud.showBossBar(s.director.boss.name,s.director.boss.hp,s.director.boss.maxHp);void 0;}`,
    );
    assert.equal(
      await evaluate(`${scene}.bossVisual.main.texture.key`),
      'review-raia',
    );
    await shot(`raia-dente-${width}x${height}`);
    await evaluate(
      `{const s=${scene};s.director.boss=null;s.director.minibossSpawned=true;s.director.minibossActive=false;s.director.scrollPx=4251;s.director.enemies.length=0;s.director.update(0,s.ship.x,s.ship.y);for(let i=0;i<40;i++)s.director.update(50,s.ship.x,s.ship.y);s.director.boss.phase='tentacles';s.syncBossVisual(s.director.boss);s.hud.showBossBar(s.director.boss.name,s.director.boss.hp,s.director.boss.maxHp);void 0;}`,
    );
    assert.equal(
      await evaluate(`${scene}.bossVisual.main.texture.key`),
      'review-talassarca',
    );
    await shot(`talassarca-${width}x${height}`);
    const noShake = await evaluate(
      `${scene}.cameras.main.shakeEffect.isRunning`,
    );
    assert.equal(noShake, false);
    await evaluate(
      `{const s=${scene};s.director.boss.phase='core';s.director.boss.hp=1;s.director.boss.damage(999,s.director.boss.x,s.director.boss.y);s.update(0,16);void 0;}`,
    );
    await waitFor(`Boolean(document.querySelector('.bw-mission-result'))`);
    await shot(`victory-${width}x${height}`);
    const victory = await evaluate(
      `Array.from(document.querySelectorAll('.bw-mission-result button,.bw-mission-result p,.bw-mission-result h1')).every(e=>{const r=e.getBoundingClientRect();return r.x>=0&&r.y>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;})`,
    );
    assert.ok(victory);
    await click('[data-result-action="1"]');
    await freeze();
    await evaluate(
      `{const s=${scene};s.director.scrollPx=2300;s.weapons.powerMeter=2;s.dashState.remainingDashes=1;s.health.invulnerableMs=0;s.damageShip(100);void 0;}`,
    );
    await waitFor(`Boolean(document.querySelector('.bw-mission-result'))`);
    await shot(`continue-${width}x${height}`);
    await key('Enter', 'Enter', 13);
    await freeze();
    const continued = await evaluate(
      `(()=>{const s=${scene};return{hp:s.health.hp,lives:s.health.lives,distance:s.director.scrollPx,stage:s.stageNumber,dash:s.dashState.remainingDashes,meter:s.weapons.powerMeter};})()`,
    );
    assert.equal(continued.hp, 100);
    assert.equal(continued.lives, 1);
    assert.equal(continued.stage, 1);
    assert.ok(continued.distance >= 2100 && continued.distance < 2150);
    assert.equal(continued.dash, 1);
    assert.equal(continued.meter, 2);
    report.viewports.push({
      width,
      height,
      confirmation,
      art,
      noLabels,
      labels,
      backgroundPixelsChanged: backgroundA !== backgroundB,
      ground,
      swimmer,
      blueCounts,
      auxiliary,
      shots,
      hull,
      contact,
      pulse,
      noShake,
      victory,
      continued,
    });
    await evaluate(
      `{const s=${scene};s.scene.resume();s.scene.start('PilotSelectScene');void 0;}`,
    );
    await waitFor(`Boolean(document.querySelector('.bw-pilot-card'))`);
  }
  await evaluate(
    `{window.__GAME__.scene.getScene('PilotSelectScene').scene.start('TitleScene');void 0;}`,
  );
  await waitFor(`Boolean(document.querySelector('.bw-press-activation'))`);
  await click('.bw-press-activation');
  await click('[data-action="options"]');
  await click('[data-action="guide"]');
  const guide = await evaluate(
    `(()=>{const icons=[...document.querySelectorAll('.bw-guide-raster')];return{count:icons.length,raster:icons.every(i=>getComputedStyle(i).backgroundImage.includes('/review/pickups-')),noPageScroll:document.documentElement.scrollHeight<=innerHeight,text:document.querySelector('.bw-item-guide').innerText};})()`,
  );
  assert.equal(guide.count, 10);
  assert.equal(guide.raster, true);
  assert.equal(guide.noPageScroll, true);
  assert.ok(guide.text.includes('PULSO DEFENSIVO'));
  assert.ok(guide.text.includes('3 / 5 / 9 / 16'));
  await shot('options-guide-1920x1080');
  report.regression.guide = guide;
  assert.deepEqual(errors, [], 'Browser runtime/console errors');
}
