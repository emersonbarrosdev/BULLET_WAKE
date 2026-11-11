import assert from 'node:assert/strict';

/** Opening-art integration only; gameplay and audio were not changed. */
export async function runPhase1Review({send,evaluate,waitFor,key,click,shot,report,errors}) {
  report.viewports=[];
  for(const [width,height] of [[1366,768],[1920,1080],[2560,1080],[1280,1024]]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    await evaluate(`(()=>{const g=window.__GAME__;g.scene.getScenes(true)[0].scene.start('TitleScene');return true;})()`);
    await waitFor(`!!document.querySelector('.bw-attract-art')`);
    const states=[];
    for(const mode of ['attract','main']) {
      const asset=await evaluate(`(async()=>{
        await document.fonts.ready;
        const root=document.querySelector('#bw-title-screen'),frame=root.querySelector('.bw-art-frame');
        const url=getComputedStyle(frame).backgroundImage.slice(5,-2),image=new Image();image.src=url;await image.decode();
        const r=frame.getBoundingClientRect();
        return {url,naturalWidth:image.naturalWidth,naturalHeight:image.naturalHeight,
          box:{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height},
          page:{width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight},
          buttons:[...root.querySelectorAll('button')].map(e=>{const b=e.getBoundingClientRect();return {label:e.getAttribute('aria-label'),x:b.x,y:b.y,right:b.right,bottom:b.bottom}})};
      })()`);
      assert.ok(asset.url.endsWith(mode==='attract'?'title-rivet-hornet.webp':'menu-no-pointer.webp'),'Correct title asset selected');
      assert.equal(asset.naturalWidth,1672);assert.equal(asset.naturalHeight,941);
      const b=asset.box;
      assert.ok(b.x>=-.1&&b.y>=-.1&&b.right<=width+.1&&b.bottom<=height+.1,'Full artwork inside viewport');
      assert.ok(Math.abs(b.width/b.height-1672/941)<.002,'Artwork retains its aspect ratio');
      assert.ok(asset.page.width<=width&&asset.page.height<=height,'No page overflow');
      for(const button of asset.buttons)assert.ok(button.x>=-.1&&button.y>=-.1&&button.right<=width+.1&&button.bottom<=height+.1,'Clickable areas inside viewport');
      states.push({mode,...asset});await shot(mode+'-'+width+'x'+height);
      if(mode==='attract') {
        await key('Enter','Enter',13);
        await waitFor(`!!document.querySelector('.bw-main-art')`);
      }
    }
    await click('[data-action="options"]');
    await waitFor(`document.querySelector('#bw-title-screen').classList.contains('bw-mode-options')`);
    await click('[data-action="controls"]');
    await waitFor(`document.querySelector('#bw-title-screen').classList.contains('bw-mode-controls')`);
    await key('Escape','Escape',27);await key('Escape','Escape',27);
    await waitFor(`!!document.querySelector('.bw-main-art')`);
    await click('[data-action="pilots"]');
    await waitFor(`!!document.querySelector('.bw-pilot-card')`);
    assert.equal(await evaluate(`document.querySelectorAll('.bw-pilot-card').length`),5);
    report.viewports.push({width,height,states,mouseKeyboardNavigation:true});
  }
  assert.deepEqual(errors,[],'No browser runtime errors');
}
