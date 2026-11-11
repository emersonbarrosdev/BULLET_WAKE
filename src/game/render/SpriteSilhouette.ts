import Phaser from 'phaser';
import { makeAlphaMask, sweepAlpha, type AlphaMask } from '../systems/alphaCollision';
import type { AnatomicalRegion } from '../systems/bosses/talassarcaRig';

const cache=new WeakMap<Phaser.Textures.Frame,Map<string,AlphaMask>>();
/** One CPU read per animation frame, cached; no GPU reads in the combat loop. */
function maskFor(frame:Phaser.Textures.Frame,bottom=1,region?:AnatomicalRegion):AlphaMask {
  const variants=cache.get(frame)??new Map<string,AlphaMask>();cache.set(frame,variants);
  const key=JSON.stringify([bottom,region]);
  const previous=variants.get(key);if(previous)return previous;
  const ratio=Math.min(1,(region?256:96)/Math.max(frame.cutWidth,frame.cutHeight));
  const canvas=document.createElement('canvas');canvas.width=Math.ceil(frame.cutWidth*ratio);canvas.height=Math.ceil(frame.cutHeight*ratio);
  const ctx=canvas.getContext('2d',{willReadFrequently:true})!;
  ctx.drawImage(frame.source.image as CanvasImageSource,frame.cutX,frame.cutY,frame.cutWidth,frame.cutHeight,0,0,canvas.width,canvas.height);
  const rgba=ctx.getImageData(0,0,canvas.width,canvas.height).data;
  const alpha=Uint8Array.from({length:canvas.width*canvas.height},(_,i)=>{
    const x=(i%canvas.width+.5)/ratio,y=(Math.floor(i/canvas.width)+.5)/ratio;
    return y>=frame.cutHeight*bottom||region&&((x-region.x)/(region.width/2))**2+((y-region.y)/(region.height/2))**2>1?0:rgba[i*4+3];
  });
  const mask=makeAlphaMask(canvas.width,canvas.height,alpha);variants.set(key,mask);return mask;
}
export function spriteContact(sprite:Phaser.GameObjects.Sprite,ax:number,ay:number,bx:number,by:number,radius=0,region?:AnatomicalRegion):number|null {
  if(!sprite.active||!sprite.visible)return null;
  const mask=maskFor(sprite.frame,sprite.getData('hullBottom')??1,region),matrix=sprite.getWorldTransformMatrix();
  const a=matrix.applyInverse(ax,ay),b=matrix.applyInverse(bx,by);
  const sx=mask.width/sprite.frame.cutWidth,sy=mask.height/sprite.frame.cutHeight;
  const px=sprite.displayOriginX,py=sprite.displayOriginY;
  const scaleX=Math.hypot(matrix.a,matrix.b),scaleY=Math.hypot(matrix.c,matrix.d);
  return sweepAlpha(mask,(a.x+px)*sx,(a.y+py)*sy,(b.x+px)*sx,(b.y+py)*sy,radius*sx/scaleX,radius*sy/scaleY);
}

/** Sample the small aircraft's solid pixels, after broad phase. Holes and curved wings remain empty. */
export function spritesOverlap(hull:Phaser.GameObjects.Sprite,other:Phaser.GameObjects.Sprite):boolean {
  if(!hull.active||!other.active||!hull.visible||!other.visible||!Phaser.Geom.Intersects.RectangleToRectangle(hull.getBounds(),other.getBounds()))return false;
  const mask=maskFor(hull.frame,hull.getData('hullBottom')??1),matrix=hull.getWorldTransformMatrix();
  const sx=hull.frame.cutWidth/mask.width,sy=hull.frame.cutHeight/mask.height;
  for(let y=mask.top;y<mask.bottom;y++)for(let i=0;i<mask.rows[y].length;i+=2){
    for(let x=mask.rows[y][i];x<mask.rows[y][i+1];x++){
      const p=matrix.transformPoint((x+.5)*sx-hull.displayOriginX,(y+.5)*sy-hull.displayOriginY);
      if(spriteContact(other,p.x,p.y,p.x,p.y,.22)!==null)return true;
    }
  }
  return false;
}
