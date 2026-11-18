import Phaser from 'phaser';
import type {ArcadeWorld} from './ArcadeWorld';

export const TOWER_TEXTURE='pelagic-defense-tower';
export const EMPLACEMENT_TEXTURE='pelagic-emplacements';
export const GUN_SMOKE_TEXTURE='pelagic-gun-smoke';
type Remnant={base:Phaser.GameObjects.Image;fire:Phaser.GameObjects.Image;smoke:Phaser.GameObjects.Image;blend:Phaser.GameObjects.Image;};

/** Register native atlas cells without resampling the generated transparent artwork. */
function registerFrames(scene:Phaser.Scene,key:string,columns:number,rows:number,count:number):void{
 const texture=scene.textures.get(key),source=texture.getSourceImage() as HTMLImageElement;
 if(texture.has('0'))return;
 for(let i=0;i<count;i++){
  const col=i%columns,row=Math.floor(i/columns),x=Math.round(col*source.width/columns),y=Math.round(row*source.height/rows);
  texture.add(i,0,x,y,Math.round((col+1)*source.width/columns)-x,Math.round((row+1)*source.height/rows)-y);
 }
}

/** Wrecks are world objects, so pause, scrolling and changing render quality cannot detach their smoke. */
export class PelagicEmplacements {
 private remnants=new Map<number,Remnant>();
 constructor(private scene:Phaser.Scene){
  registerFrames(scene,TOWER_TEXTURE,2,1,2);
  registerFrames(scene,EMPLACEMENT_TEXTURE,4,4,8);
  registerFrames(scene,GUN_SMOKE_TEXTURE,4,2,8);
 }
 draw(world:ArcadeWorld,quality:number):void{
  const visible=new Set<number>();
  for(const wreck of world.wrecks){
   visible.add(wreck.id);let node=this.remnants.get(wreck.id);
   if(!node){
    node={base:this.scene.add.image(0,0,EMPLACEMENT_TEXTURE,1).setDepth(2),
     fire:this.scene.add.image(0,0,EMPLACEMENT_TEXTURE,4).setOrigin(.5,.9).setDepth(4.1),
     smoke:this.scene.add.image(0,0,GUN_SMOKE_TEXTURE,0).setOrigin(.5,.88).setDepth(4.2),
     blend:this.scene.add.image(0,0,GUN_SMOKE_TEXTURE,1).setOrigin(.5,.88).setDepth(4.21)};
    this.remnants.set(wreck.id,node);
   }
   const {x,y,size,age}=wreck;
   const tower=wreck.family==='tower',scale=tower?1.8:wreck.customAnchor?0.76:1.3;
   node.base.setTexture(tower?TOWER_TEXTURE:EMPLACEMENT_TEXTURE,1).setOrigin(.5,tower?.78:.5).setPosition(x,y).setDisplaySize(size*scale,size*scale);
   if(wreck.customAnchor)node.base.setTint(0xd6c7b2);else node.base.clearTint();
   const heat=Math.max(.16,1-age/12);
   node.fire.setPosition(x,y+size*.04).setDisplaySize(size*.7,size*.7).setFrame(4+Math.floor(age*9+ wreck.id)%4).setAlpha(heat*.8);
   const phase=age*5+wreck.id*.37,frame=Math.floor(phase)%8,mix=phase-Math.floor(phase);
   const opacity=Math.min(1,age*3)*.74;
   for(const plume of[node.smoke,node.blend])plume.setPosition(x+size*.04,y-size*.03).setDisplaySize(size*1.7,size*1.7);
   node.smoke.setFrame(frame).setAlpha(opacity*(quality===0?1:1-mix));
   node.blend.setFrame((frame+1)%8).setAlpha(opacity*mix).setVisible(quality>0);
  }
  for(const[id,node]of this.remnants)if(!visible.has(id)){for(const sprite of Object.values(node))sprite.destroy();this.remnants.delete(id);}
 }
 clear():void{for(const node of this.remnants.values())for(const sprite of Object.values(node))sprite.destroy();this.remnants.clear();}
}
