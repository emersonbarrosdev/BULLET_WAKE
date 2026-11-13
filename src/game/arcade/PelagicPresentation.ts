import Phaser from 'phaser';

/** UP-only presentation; collision, cadence, projectile count and SIDE art stay unchanged. */
export function pelagicShotSize(level:number):{width:number;height:number}{
 const n=Math.max(1,Math.min(5,level));return{width:7+n*1.35,height:17+n*3};
}
export function installPelagicTextures(scene:Phaser.Scene):void{
 if(!scene.textures.exists('pelagic-plasma')){
  const texture=scene.textures.createCanvas('pelagic-plasma',64,128)!,ctx=texture.context;
  const halo=ctx.createRadialGradient(32,64,2,32,64,32);halo.addColorStop(0,'rgba(255,244,126,.8)');halo.addColorStop(.45,'rgba(255,164,24,.45)');halo.addColorStop(1,'rgba(255,90,12,0)');
  ctx.save();ctx.translate(0,64);ctx.scale(1,2);ctx.translate(0,-64);ctx.fillStyle=halo;ctx.fillRect(0,32,64,64);ctx.restore();
  const body=(width:number,fill:string)=>{ctx.beginPath();ctx.moveTo(32,3);ctx.bezierCurveTo(32+width,35,32+width,76,32,122);ctx.bezierCurveTo(32-width,76,32-width,35,32,3);ctx.fillStyle=fill;ctx.fill();};
  body(22,'#ff7e17');body(15,'#ffe765');body(8,'#fffdeb');texture.refresh();
 }
}
