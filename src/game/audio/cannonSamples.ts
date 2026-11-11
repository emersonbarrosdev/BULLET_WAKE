/** Four original physically inspired cannon transients, rendered once rather than overlapping oscillators per pellet. */
export function cannonSamples(ctx:AudioContext):AudioBuffer[] {
  return Array.from({length:4},(_,variant)=>{
    const buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.115),ctx.sampleRate),data=buffer.getChannelData(0);
    let seed=1867+variant*997,low=0,air=0;
    for(let i=0;i<data.length;i++){
      const t=i/ctx.sampleRate;seed=(Math.imul(seed,1664525)+1013904223)|0;
      const noise=(seed>>>0)/2147483648-1;low+=.18*(noise-low);air+=.035*(noise-air);
      const crack=(low-air)*Math.exp(-t*92)*1.8;
      const pressure=Math.sin(2*Math.PI*(112*t-210*t*t))*Math.exp(-t*45)*.48;
      const latch=t>.027?(noise-low)*Math.exp(-(t-.027)*210)*.13:0;
      data[i]=Math.tanh((crack+pressure+latch)*1.25)*Math.min(1,t/.0007)*.65;
    }
    return buffer;
  });
}
