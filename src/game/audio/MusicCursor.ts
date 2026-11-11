/** Loop position independent of transport/decode; advancing a paused clock never advances music. */
export class MusicCursor {
  private offset=0;private startedAt=0;private duration=0;private running=false;
  get active():boolean{return this.running;}
  position(now:number):number {const p=this.offset+(this.running?Math.max(0,now-this.startedAt):0);return this.duration?p%this.duration:p;}
  start(now:number,duration:number):number {this.duration=duration;this.offset=this.position(now);this.startedAt=now;this.running=true;return this.offset;}
  pause(now:number):void {this.offset=this.position(now);this.running=false;}
  reset():void {this.offset=0;this.startedAt=0;this.duration=0;this.running=false;}
}
