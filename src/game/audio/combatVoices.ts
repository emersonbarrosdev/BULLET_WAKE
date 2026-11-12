/** Original deterministic PCM designs. RIVET's approved cannon does not use these buffers. */
export type CombatVoice='violet'|'emerald'|'amber'|'celestial'|'scarlet'|'phantom'|'orbital'|'nova'|'comet';
const designs:Record<CombatVoice,{seconds:number;pitch:number;end:number;fm:number;noise:number;pulses:number}>={
  violet:{seconds:.13,pitch:980,end:370,fm:3.4,noise:.06,pulses:2},
  emerald:{seconds:.09,pitch:1550,end:620,fm:.5,noise:.18,pulses:1},
  amber:{seconds:.19,pitch:180,end:42,fm:1.8,noise:.35,pulses:1},
  celestial:{seconds:.11,pitch:1180,end:760,fm:1.1,noise:.08,pulses:3},
  scarlet:{seconds:3,pitch:98,end:46,fm:4,noise:.55,pulses:18},
  phantom:{seconds:1.05,pitch:260,end:1050,fm:6,noise:.1,pulses:4},
  orbital:{seconds:2.1,pitch:440,end:880,fm:1.4,noise:.04,pulses:6},
  nova:{seconds:1.8,pitch:120,end:28,fm:2.6,noise:.7,pulses:3},
  comet:{seconds:2.3,pitch:1350,end:180,fm:1.8,noise:.24,pulses:8},
};
export function combatVoiceSamples(name:CombatVoice,sampleRate:number):Float32Array<ArrayBuffer> {
  const d=designs[name],data=new Float32Array(Math.ceil(sampleRate*d.seconds));
  let phase=0,low=0,seed=1297+name.length*163;
  for(let i=0;i<data.length;i++){
    const t=i/sampleRate,p=t/d.seconds;
    seed=(Math.imul(seed,1664525)+1013904223)|0;
    const random=(seed>>>0)/2147483648-1;
    const frequency=d.pitch*Math.pow(d.end/d.pitch,p);
    phase+=2*Math.PI*frequency/sampleRate;
    const pulse=Math.pow(Math.max(0,Math.sin(p*d.pulses*Math.PI)),2);
    const attack=Math.min(1,t/.004),release=Math.pow(1-p,name==='scarlet'?.7:1.6);
    const body=Math.sin(phase+d.fm*Math.sin(phase*.503)*(1-p));
    low+=.19*(random-low);
    const ignition=Math.exp(-t*60)*(random-low)*.35;
    const envelope=attack*release*(.4+.6*pulse);
    const wave=body*(1-d.noise)+low*d.noise+ignition;
    data[i]=Math.tanh(wave*1.9)*envelope*.42;
  }
  return data;
}
