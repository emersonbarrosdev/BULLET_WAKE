import Phaser from 'phaser';
import { makeAlphaMask, sweepAlpha, type AlphaMask } from '../systems/alphaCollision';

const cache=new WeakMap<Phaser.Textures.Frame,AlphaMask>();
/** One CPU read per animation frame, cached; no GPU reads in the combat loop. */
function maskFor(frame:Phaser.Textures.Frame):AlphaMask {
  const previous=cache.get(frame);if(previous)return previous;
  const ratio=Math.min(1,96/Math.max(frame.cutWidth,frame.cutHeight));
  const canvas=document.createElement('canvas');canvas.width=Math.ceil(frame.cutWidth*ratio);canvas.height=Math.ceil(frame.cutHeight*ratio);
  const ctx=canvas.getContext('2d',{willReadFrequently:true})!;
  ctx.drawImage(frame.source.image as CanvasImageSource,frame.cutX,frame.cutY,frame.cutWidth,frame.cutHeight,0,0,canvas.width,canvas.height);
  const rgba=ctx.getImageData(0,0,canvas.width,canvas.height).data;
  const alpha=Uint8Array.from({length:canvas.width*canvas.height},(_,i)=>rgba[i*4+3]);
  const mask=makeAlphaMask(canvas.width,canvas.height,alpha);cache.set(frame,mask);return mask;
}
export function spriteContact(sprite:Phaser.GameObjects.Sprite,ax:number,ay:number,bx:number,by:number,radius=0):number|null {
  if(!sprite.active||!sprite.visible)return null;
  const mask=maskFor(sprite.frame),matrix=sprite.getWorldTransformMatrix();
  const a=matrix.applyInverse(ax,ay),b=matrix.applyInverse(bx,by);
  const sx=mask.width/sprite.frame.cutWidth,sy=mask.height/sprite.frame.cutHeight;
  const px=sprite.displayOriginX,py=sprite.displayOriginY;
  const scaleX=Math.hypot(matrix.a,matrix.b),scaleY=Math.hypot(matrix.c,matrix.d);
  return sweepAlpha(mask,(a.x+px)*sx,(a.y+py)*sy,(b.x+px)*sx,(b.y+py)*sy,radius*sx/scaleX,radius*sy/scaleY);
}
