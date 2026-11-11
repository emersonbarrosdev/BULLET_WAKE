import Phaser from 'phaser';
import { GAME_HEIGHT, PLAYFIELD_WIDTH, PLAYFIELD_X } from '../constants';
import { scarletBeams, SCARLET_DURATION_MS, type ScarletBeam } from '../systems/scarletStorm';

/** A connected forward plasma torrent, not a screen-wide bombardment. */
export class ScarletStorm {
  private nodes:Phaser.GameObjects.Sprite[];
  private fragments:Phaser.GameObjects.Sprite[];
  private mask:Phaser.Display.Masks.GeometryMask;
  private maskShape:Phaser.GameObjects.Graphics;
  constructor(private scene:Phaser.Scene) {
    this.nodes=Array.from({length:3},()=>scene.add.sprite(0,0,'polish-scarlet-storm',0).setOrigin(.5,.96).setDepth(12).setVisible(false));
    this.fragments=Array.from({length:12},()=>scene.add.sprite(0,0,'polish-rivet-red',0).setDisplaySize(8,17).setDepth(13).setVisible(false));
    this.maskShape=scene.make.graphics({x:0,y:0});this.maskShape.fillRect(PLAYFIELD_X,0,PLAYFIELD_WIDTH,GAME_HEIGHT);
    this.mask=this.maskShape.createGeometryMask();[...this.nodes,...this.fragments].forEach(n=>n.setMask(this.mask));
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN,this.destroy);
  }
  update(elapsed:number,x:number,y:number):ScarletBeam[] {
    const beams=scarletBeams(elapsed,x,y),fade=Math.min(1,Math.max(0,(elapsed-120)/150),Math.max(0,(SCARLET_DURATION_MS-elapsed)/200));
    this.nodes.forEach((node,i)=>{
      const b=beams[i];if(!b){node.setVisible(false);return;}
      node.setVisible(true).setPosition(x,y).setFrame((Math.floor(elapsed/50)+i*2)%8)
        .setDisplaySize(b.radius*2/.6,Math.hypot(b.bx-x,b.by-y)/.92)
        .setRotation(Math.atan2(b.by-y,b.bx-x)+Math.PI/2).setAlpha(fade*(i===1?1:.85));
    });
    this.fragments.forEach((node,i)=>{
      const b=beams[i%3];if(!b){node.setVisible(false);return;}
      const t=((elapsed+i*71)%650)/650,offset=Math.sin(i*2.3+elapsed/120)*(b.radius+8);
      node.setVisible(true).setPosition(x+(b.bx-x)*t+offset,y+(b.by-y)*t)
        .setFrame(Math.floor(elapsed/50)%8).setAlpha(fade*Math.sin(t*Math.PI)*.9).setRotation(i%2?.15:-.15);
    });
    return beams;
  }
  destroy=():void=>{
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN,this.destroy);
    [...this.nodes,...this.fragments].forEach(n=>{n.clearMask();n.destroy();});this.nodes=[];this.fragments=[];
    this.mask.destroy();this.maskShape.destroy();
  };
}
