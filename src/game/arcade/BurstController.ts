/** One press commits three pulses; holding is easier, tapping modestly faster. */
export class BurstController {
 private clock=0; private nextBurst=0; private pending:number[]=[]; private held=false;
 update(dt:number,held:boolean,accessibility=false):number{
  this.clock+=dt;
  const pressed=held&&!this.held;this.held=held;
  if(held&&this.clock>=this.nextBurst&&(pressed||!this.pending.length)){
   this.pending.push(this.clock,this.clock+65,this.clock+130);
   this.nextBurst=this.clock+(accessibility||pressed?280:380);
  }
  let shots=0;while(this.pending.length&&this.pending[0]<=this.clock){this.pending.shift();shots++;}return shots;
 }
 reset():void{this.clock=0;this.nextBurst=0;this.pending=[];this.held=false;}
}
