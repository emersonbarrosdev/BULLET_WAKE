import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {
 COAST_MAP_WIDTH,COAST_MAP_PERIOD,COAST_MAP_OFFSET,COAST_MAP_SCALE,
 COAST_PANEL_HEIGHT,COAST_PANEL_STRIDE,COAST_PANEL_OVERLAP,
 COAST_GUN_SOCKETS,paintedCoastBoundary,wrapCoast,
} from '../src/game/arcade/PelagicCoastMap.ts';

test('painted banks stay attached through both source transitions and the world loop',()=>{
 assert.equal(COAST_PANEL_HEIGHT-COAST_PANEL_STRIDE,COAST_PANEL_OVERLAP);
 assert.equal(COAST_PANEL_STRIDE*2,COAST_MAP_PERIOD);
 assert(Number.isInteger(COAST_MAP_PERIOD/COAST_MAP_SCALE));
 let leftLand=0,rightLand=0,minChannel=Infinity;
 for(let y=0;y<COAST_MAP_PERIOD;y++){
  const left=paintedCoastBoundary(y,-1),right=paintedCoastBoundary(y,1);
  assert(Number.isFinite(left)&&Number.isFinite(right),`Uncovered world row ${y}`);
  assert(left>=0&&right<=COAST_MAP_WIDTH&&left<right,`Invalid banks at ${y}`);
  if(left>0)leftLand++;
  if(right<COAST_MAP_WIDTH)rightLand++;
  minChannel=Math.min(minChannel,right-left);
 }
 assert(leftLand/COAST_MAP_PERIOD>.9,'Left shore should be predominantly continuous');
 assert(rightLand/COAST_MAP_PERIOD>.7,'Right landmarks should belong to a connected shore');
 assert(minChannel>=80,`Largest naval hull needs a usable channel, found ${minChannel}px`);
 // At the cyclic texture edge, a one-pixel advance must not reset the silhouette.
 const seam=-COAST_MAP_OFFSET;
 for(const side of[-1,1]){
  const before=paintedCoastBoundary(seam-.001,side),after=paintedCoastBoundary(seam+.001,side);
  assert(Math.abs(after-before)<.1,`Coast jumps at the world seam on side ${side}`);
 }
});

test('camera motion never changes an existing coastline point or its period',()=>{
 for(let worldY=-COAST_MAP_PERIOD*3;worldY<COAST_MAP_PERIOD*2;worldY+=13.125){
  for(const side of[-1,1]){
   const expected=paintedCoastBoundary(worldY,side);
   for(const cycle of[-2,-1,1,2]){
    assert(Math.abs(paintedCoastBoundary(worldY+cycle*COAST_MAP_PERIOD,side)-expected)<1e-8);
   }
   for(const scroll of[0,.5,431.75,2047.5,7301.125]){
    const screenY=worldY+scroll;
    assert(Math.abs(paintedCoastBoundary(screenY-scroll,side)-expected)<1e-8);
   }
  }
  assert(wrapCoast(worldY)>=0&&wrapCoast(worldY)<COAST_MAP_PERIOD);
 }
});

test('all authored gun sockets sit inland with room for a grounded emplacement',()=>{
 assert.equal(new Set(COAST_GUN_SOCKETS.map(s=>s.id)).size,COAST_GUN_SOCKETS.length);
 assert(COAST_GUN_SOCKETS.some(s=>s.side<0)&&COAST_GUN_SOCKETS.some(s=>s.side>0));
 for(const socket of COAST_GUN_SOCKETS){
  for(const dy of[-8,0,8]){
   const bank=paintedCoastBoundary(socket.y+dy,socket.side);
   const inland=socket.side<0?bank-socket.x:socket.x-bank;
   assert(inland>=8,`Socket ${socket.id} intersects water at offset ${dy}: ${inland}px inland`);
  }
 }
});

test('visual automation validates current Pelagic backdrop contract without obsolete coast fields',()=>{
 const backdropSrc=readFileSync(resolve('src/game/arcade/ArcadeBackdrop.ts'),'utf8');
 const checkSrc=readFileSync(resolve('scripts/arcade-browser-check.mjs'),'utf8');
 assert(backdropSrc.includes('pelagicState(): PelagicBackdropState'),'ArcadeBackdrop must expose pelagicState()');
 assert(checkSrc.includes('s.backdrop.pelagicState()'),'arcade-browser-check must inspect s.backdrop.pelagicState()');
 assert(checkSrc.includes(`'${"pelagic-connected-coast-v2"}'`),'arcade-browser-check must validate painted coast texture key');
 assert(checkSrc.includes(`'pelagic-water-review'`),'arcade-browser-check must validate ocean water texture key');
 assert(!checkSrc.includes('backdrop.coast.'),'arcade-browser-check must not read removed s.backdrop.coast property');
 assert(!checkSrc.includes('pelagic-continuous-shores'),'arcade-browser-check must not assert removed pelagic-continuous-shores texture');
 const paintingSrc=readFileSync(resolve('src/game/arcade/PelagicCoastPainting.ts'),'utf8');
 assert(paintingSrc.includes('pelagic-coast-shoal-v1'),'PelagicCoastPainting must provide pelagic-coast-shoal-v1');
 assert(paintingSrc.includes('pelagic-coast-surf-v1'),'PelagicCoastPainting must provide pelagic-coast-surf-v1');
 assert(!checkSrc.includes("if(process.env.BW_CAPTURE_LOG==='1'){const proof"),'Pelagic backdrop assertions must execute even when BW_CAPTURE_LOG is unset');
});
