import Phaser from 'phaser';
import { GAME_HEIGHT, PLAYFIELD_WIDTH, PLAYFIELD_X } from '../constants';

/** Three staggered bombardment salvos, with travel, impact and rapid dissipation. */
export class PrismStrike {
  private nodes: Phaser.GameObjects.Sprite[];
  private impacted = new Set<number>();
  private mask: Phaser.Display.Masks.GeometryMask;
  private maskShape: Phaser.GameObjects.Graphics;
  constructor(private scene: Phaser.Scene) {
    this.nodes = Array.from({length:15},()=>scene.add.sprite(0,0,'polish-special',0)
      .setDisplaySize(110,110).setDepth(20).setVisible(false).setBlendMode(Phaser.BlendModes.ADD));
    this.maskShape=scene.make.graphics({x:0,y:0});
    this.maskShape.fillRect(PLAYFIELD_X,0,PLAYFIELD_WIDTH,GAME_HEIGHT);
    this.mask=this.maskShape.createGeometryMask();
    this.nodes.forEach(n=>n.setMask(this.mask));
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN,this.destroy);
  }
  update(elapsed:number):Array<{x:number;y:number}> {
    const impacts:Array<{x:number;y:number}>=[];
    this.nodes.forEach((node,i)=>{
      const lane=i%5, salvo=Math.floor(i/5);
      const age=elapsed-salvo*950-lane*65;
      if(age<0||age>1000){node.setVisible(false);return;}
      const x=PLAYFIELD_X+(lane+.5)*PLAYFIELD_WIDTH/5;
      const targetY=65+((lane+salvo)%3)*70;
      const travel=Math.min(1,age/580);
      const y=GAME_HEIGHT+50-(GAME_HEIGHT+50-targetY)*travel;
      const frame=age<580?Math.min(3,Math.floor(age/145)):Math.min(7,4+Math.floor((age-580)/105));
      node.setVisible(true).setPosition(x+Math.sin(travel*Math.PI)*12*(lane%2?1:-1),y).setFrame(frame)
        .setAlpha(Math.min(1,age/65,Math.max(0,(1000-age)/150)));
      if(age>=580&&!this.impacted.has(i)){this.impacted.add(i);impacts.push({x,y:targetY});}
    });
    return impacts;
  }
  destroy=():void => {
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN,this.destroy);
    this.nodes.forEach(n=>{n.clearMask();n.destroy();});this.nodes=[];
    this.mask.destroy();this.maskShape.destroy();
  };
}
