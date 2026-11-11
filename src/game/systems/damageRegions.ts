/** Damage heat map in body-local coordinates: destruction follows the area that absorbed most fire. */
export class DamageRegions {
  private cells=new Map<string,{x:number;y:number;damage:number}>();
  add(x:number,y:number,damage:number):void {
    if(!Number.isFinite(x+y+damage)||damage<=0)return;
    const key=Math.floor(x/20)+':'+Math.floor(y/20),cell=this.cells.get(key);
    if(cell){const total=cell.damage+damage;cell.x=(cell.x*cell.damage+x*damage)/total;cell.y=(cell.y*cell.damage+y*damage)/total;cell.damage=total;}
    else this.cells.set(key,{x,y,damage});
  }
  strongest():{x:number;y:number}|null {let best:{x:number;y:number;damage:number}|undefined;for(const c of this.cells.values())if(!best||c.damage>best.damage)best=c;return best?{x:best.x,y:best.y}:null;}
}
