import Phaser from 'phaser';

/**
 * Author-painted stage strips are assembled exactly once into a cyclic world material.
 * The two source paintings share the same scale. Two feathered joins eliminate the
 * hard rectangular boundaries that appeared when they were used as separate images.
 * The final canvas is ~384 x 2,000 (not a 4K texture), suitable for mobile WebGL.
 */
export const PELAGIC_VIEW = {left:192,right:576,width:384} as const;
export const PELAGIC_PANORAMA_KEY='pelagic-panorama';

export function installPelagicPanorama(scene:Phaser.Scene):string {
 if(scene.textures.exists(PELAGIC_PANORAMA_KEY))return PELAGIC_PANORAMA_KEY;
 const a=scene.textures.get('pelagic-world-a').getSourceImage() as HTMLImageElement;
 const b=scene.textures.get('pelagic-world-b').getSourceImage() as HTMLImageElement;
 const width=PELAGIC_VIEW.width;
 const stripHeight=Math.round(a.height*width/a.width);
 const overlap=Math.round(stripHeight*.11);
 const stride=stripHeight-overlap;
 const period=stride*2;
 const texture=scene.textures.createCanvas(PELAGIC_PANORAMA_KEY,width,period);
 if(!texture)throw new Error('Não foi possível compor o cenário da Fenda Pelágica');
 const ctx=texture.context;
 // B is the base layer on both sides of the cyclic seam.
 ctx.drawImage(b,0,-stride-overlap/2,width,stripHeight);
 ctx.drawImage(b,0,stride-overlap/2,width,stripHeight);
 const layer=document.createElement('canvas');layer.width=width;layer.height=period;
 const maskCtx=layer.getContext('2d');
 if(!maskCtx)throw new Error('Canvas 2D indisponível para a transição costeira');
 maskCtx.drawImage(a,0,-overlap/2,width,stripHeight);
 maskCtx.drawImage(a,0,period-overlap/2,width,stripHeight);
 maskCtx.globalCompositeOperation='destination-in';
 const feather=maskCtx.createLinearGradient(0,0,0,period);
 const stops:[[number,number],[number,number],[number,number],[number,number],[number,number],[number,number]]=[
  [0,.5],[overlap/2,1],[stride-overlap/2,1],
  [stride+overlap/2,0],[period-overlap/2,0],[period,.5]
 ];
 for(const [y,alpha] of stops)feather.addColorStop(y/period,`rgba(0,0,0,${alpha})`);
 maskCtx.fillStyle=feather;maskCtx.fillRect(0,0,width,period);
 ctx.drawImage(layer,0,0);
 // Preserve the original illustrated beaches, buildings, rocks and foam.
 // Only blue/cyan low-red water pixels receive the deeper cobalt grade.
 const pixels=ctx.getImageData(0,0,width,period),d=pixels.data;
 for(let i=0;i<d.length;i+=4){
  const r=d[i],g=d[i+1],blue=d[i+2];
  if(r>=126||g<=r*1.22||blue<=r*1.35||blue<g*.84)continue;
  const strength=Math.min(1,Math.max(0,(blue-r*1.25)/95))*.58;
  d[i]=Math.round(r*(1-.30*strength));
  d[i+1]=Math.round(g*(1-.24*strength));
  d[i+2]=Math.round(blue*(1-.035*strength));
 }
 // Keep the authored coastline and port, not the cloudy blue water baked into
 // the original strips: the previously approved sharp ocean remains visible below.
 for(let y=0;y<period;y++)for(let x=0;x<width;x++){
  const edge=Math.min(x,width-1-x),t=Math.max(0,Math.min(1,(edge-65)/65));
  const opacity=1-(t*t*(3-2*t));
  d[(y*width+x)*4+3]=Math.round(d[(y*width+x)*4+3]*opacity);
 }
 ctx.putImageData(pixels,0,0);
 texture.refresh();
 return PELAGIC_PANORAMA_KEY;
}
