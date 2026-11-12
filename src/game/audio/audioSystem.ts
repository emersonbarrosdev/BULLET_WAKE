import { combatVoiceSamples, type CombatVoice } from './combatVoices';
import { MusicTransport } from './MusicTransport';
import { cannonSamples } from './cannonSamples';
import type { MusicTheme } from './musicScore';
/**
 * BULLET WAKE — Áudio autoral: trilhas amostradas, canhão pré-renderizado e efeitos por Web Audio.
 * Fontes curtas e mix limitado para preservar impactos durante o combate.
 */

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private cannonBuffers?:AudioBuffer[];
  private cannonIndex=0;
  private designedBuffers=new Map<CombatVoice,AudioBuffer>();
  private designedSources=new Set<AudioBufferSourceNode>();
  private combatSources=new Set<AudioScheduledSourceNode>();
  private readonly lastSound = new Map<string, number>();

  private isMuted = false;
  private masterVolume = 0.8;
  private sfxVolume = 0.85;
  private musicVolume = 0.55;

  private transport?:MusicTransport;
  private environment:'atmosphere'|'space'='atmosphere';
  private currentTrack: 'none' | MusicTheme = 'none';

  constructor() {
    // Inicialização sob demanda com gesto do jogador
  }

  private initCtx(): void {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();

      this.masterGain.gain.setValueAtTime(this.isMuted||this.environment==='space' ? 0 : this.masterVolume, this.ctx.currentTime);
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
      this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);

      this.sfxGain.connect(this.masterGain);
      this.musicGain.connect(this.masterGain);
      const limiter = this.ctx.createDynamicsCompressor();
      limiter.threshold.value = -9; limiter.knee.value = 6;
      limiter.ratio.value = 8; limiter.attack.value = .003; limiter.release.value = .12;
      this.masterGain.connect(limiter); limiter.connect(this.ctx.destination);
    } catch {
      // Navegadores sem suporte a Web Audio operam silenciosamente
    }
  }

  unlock(): void {
    this.initCtx();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  setMute(mute: boolean): void {
    this.isMuted = mute;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(mute||this.environment==='space' ? 0 : this.masterVolume, this.ctx.currentTime);
    }
  }

  setMix(music: number, effects: number): void {
    this.musicVolume=Math.max(0,Math.min(1,music))*.55;
    this.sfxVolume=Math.max(0,Math.min(1,effects))*.85;
    if(this.ctx){this.musicGain?.gain.setTargetAtTime(this.musicVolume,this.ctx.currentTime,.03);this.sfxGain?.gain.setTargetAtTime(this.sfxVolume,this.ctx.currentTime,.03);}
  }

  toggleMute(): boolean {
    this.setMute(!this.isMuted);
    return this.isMuted;
  }

  // --- EFEITOS SONOROS (SFX) ---

  playShot(pilotId: 'nolan' | 'cora' | 'harlan' | 'lyra' | 'bento', level = 1): void {
    this.unlock();
    if (!this.ctx || !this.sfxGain || this.isMuted||this.environment==='space') return;
    if(!this.allowSound('player-shot',.065))return;
    const voices:Partial<Record<string,CombatVoice>>={cora:'violet',lyra:'emerald',harlan:'amber',bento:'celestial'};
    const voice=voices[pilotId];if(voice){this.playDesignedVoice(voice);return;}
    const now = this.ctx.currentTime;

    if (pilotId === 'nolan'||pilotId==='lyra'||pilotId==='bento') {
      this.cannonBuffers??=cannonSamples(this.ctx);
      const source=this.trackSoundSource(this.ctx.createBufferSource()),gain=this.ctx.createGain();
      source.buffer=this.cannonBuffers[this.cannonIndex++%this.cannonBuffers.length];
      source.playbackRate.value=pilotId==='bento'?1.1:pilotId==='lyra'?1.06:1;
      gain.gain.value=.38+Math.min(level,4)*.025;
      source.connect(gain);gain.connect(this.sfxGain);source.onended=()=>{source.disconnect();gain.disconnect();};source.start(now);
    } else if (pilotId === 'cora') {
      // Laser fino agudo com harmônicos
      const osc = this.trackSoundSource(this.ctx.createOscillator());
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880 + level * 120, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.07);

      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.07);
      osc.onended=()=>{osc.disconnect();gain.disconnect();};
    } else {
      // Canhão pesado de Harlan: soco grave
      const osc = this.trackSoundSource(this.ctx.createOscillator());
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(260 + level * 40, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.12);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.12);
      osc.onended=()=>{osc.disconnect();gain.disconnect();};
    }
  }

  playMissile(): void {
    this.unlock();
    if (!this.ctx || !this.sfxGain || this.isMuted||this.environment==='space') return;
    const now = this.ctx.currentTime;
    const osc = this.trackSoundSource(this.ctx.createOscillator());
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.linearRampToValueAtTime(460, now + 0.16);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  private allowSound(key: string, interval: number): boolean {
    if (!this.ctx) return false;
    const now=this.ctx.currentTime, last=this.lastSound.get(key) ?? -Infinity;
    if(now-last<interval)return false;
    this.lastSound.set(key,now);return true;
  }

  /** A compact transient, reused by impacts and explosions; no new noise allocation per hit. */
  private noise(duration:number,volume:number,frequency:number):void {
    if(!this.ctx||!this.sfxGain)return;
    const ctx=this.ctx,now=ctx.currentTime;
    if(!this.noiseBuffer){
      this.noiseBuffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.5),ctx.sampleRate);
      const data=this.noiseBuffer.getChannelData(0);
      for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
    }
    const source=this.trackSoundSource(ctx.createBufferSource()),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
    source.buffer=this.noiseBuffer;
    filter.type='lowpass';filter.frequency.setValueAtTime(frequency,now);
    filter.frequency.exponentialRampToValueAtTime(150,now+duration);
    gain.gain.setValueAtTime(.0001,now);gain.gain.linearRampToValueAtTime(volume,now+.003);
    gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
    source.connect(filter);filter.connect(gain);gain.connect(this.sfxGain);
    source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
    source.start(now);source.stop(now+duration);
  }

  private tone(type:OscillatorType,from:number,to:number,duration:number,volume:number,delay=0):void {
    if(!this.ctx||!this.sfxGain)return;
    const now=this.ctx.currentTime+delay,osc=this.trackSoundSource(this.ctx.createOscillator()),gain=this.ctx.createGain();
    osc.type=type;osc.frequency.setValueAtTime(from,now);osc.frequency.exponentialRampToValueAtTime(to,now+duration);
    gain.gain.setValueAtTime(.0001,now);gain.gain.linearRampToValueAtTime(volume,now+.004);
    gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
    osc.connect(gain);gain.connect(this.sfxGain);
    osc.onended=()=>{osc.disconnect();gain.disconnect();};osc.start(now);osc.stop(now+duration);
  }

  playEnemyShot(kind='scout'): void {
    this.unlock();
    if (!this.ctx || !this.sfxGain || this.isMuted||this.environment==='space') return;
    // One voice per salvo, with bounded overlap across different alien species.
    if(!this.allowSound('alien-salvo',.035)||!this.allowSound('alien-'+kind,.085))return;
    const now = this.ctx.currentTime;
    const voices:Record<string,[number,number,number]>={scout:[730,265,37],dart:[1120,420,61],lancer:[470,185,29],cutter:[620,210,43],surface:[315,105,23],raia:[260,75,19],talassarca:[190,50,13]};
    const[from,to,flutter]=voices[kind]??voices.scout;
    const osc=this.trackSoundSource(this.ctx.createOscillator()),mod=this.trackSoundSource(this.ctx.createOscillator()),depth=this.ctx.createGain(),filter=this.ctx.createBiquadFilter(),gain=this.ctx.createGain();
    osc.type='sine';osc.frequency.setValueAtTime(from,now);
    osc.frequency.exponentialRampToValueAtTime(to,now+.16);
    mod.type='sine';mod.frequency.setValueAtTime(flutter,now);depth.gain.value=from*.22;
    mod.connect(depth);depth.connect(osc.frequency);
    filter.type='bandpass';filter.Q.value=1.3;filter.frequency.setValueAtTime(from*1.7,now);filter.frequency.exponentialRampToValueAtTime(to*1.3,now+.16);
    gain.gain.setValueAtTime(.0001,now);gain.gain.linearRampToValueAtTime(.105,now+.008);gain.gain.exponentialRampToValueAtTime(.0001,now+.18);
    osc.connect(filter);filter.connect(gain);gain.connect(this.sfxGain);
    osc.onended=()=>{osc.disconnect();mod.disconnect();depth.disconnect();filter.disconnect();gain.disconnect();};
    osc.start(now);mod.start(now);osc.stop(now+.18);mod.stop(now+.18);
  }

  playHit(target:'alien'|'hull'|'shield'|'metal'|'energy'='alien'): void {
    this.unlock();
    if (!this.ctx || !this.sfxGain || this.isMuted||this.environment==='space') return;
    if(!this.allowSound('hit-'+target,target==='alien'?.045:.12))return;
    if(target==='energy'){this.tone('sine',1200,490,.075,.1);this.noise(.045,.07,3300);return;}
    if(target==='metal'){this.noise(.055,.15,5100);this.tone('triangle',780,230,.06,.08);return;}
    if(target==='shield'){this.tone('sine',1450,430,.14,.19);return;}
    this.noise(target==='hull'?.12:.055,target==='hull'?.28:.12,target==='hull'?3200:1900);
    this.tone('triangle',target==='hull'?210:420,target==='hull'?55:180,target==='hull'?.16:.065,target==='hull'?.22:.08);
  }

  playExplosion(isLarge = false): void {
    this.unlock();
    if (!this.ctx || !this.sfxGain || this.isMuted||this.environment==='space') return;
    if(!this.allowSound(isLarge?'explosion-large':'explosion',isLarge?.08:.04))return;
    this.noise(isLarge?.46:.23,isLarge?.40:.26,isLarge?3600:2900);
    this.tone('triangle',isLarge?610:800,isLarge?190:270,.075,isLarge?.12:.075);
    if(isLarge)this.tone('sine',63,27,.6,.22,.035);
    this.tone('sine',isLarge?150:220,35,isLarge?.35:.16,isLarge?.38:.22);
  }

  private playDesignedVoice(name:CombatVoice):void {
    if(!this.ctx||!this.sfxGain)return;
    let buffer=this.designedBuffers.get(name);
    if(!buffer){const pcm=combatVoiceSamples(name,this.ctx.sampleRate);buffer=this.ctx.createBuffer(1,pcm.length,this.ctx.sampleRate);buffer.copyToChannel(pcm,0);this.designedBuffers.set(name,buffer);}
    if(this.designedSources.size>=14)return;
    const source=this.trackSoundSource(this.ctx.createBufferSource()),gain=this.ctx.createGain();source.buffer=buffer;
    gain.gain.value=['violet','emerald','amber','celestial'].includes(name)?.65:.8;
    source.connect(gain);gain.connect(this.sfxGain);this.designedSources.add(source);
    source.onended=()=>{this.designedSources.delete(source);source.disconnect();gain.disconnect();};source.start();
  }
  private trackSoundSource<T extends AudioScheduledSourceNode>(source:T):T {this.combatSources.add(source);source.addEventListener('ended',()=>this.combatSources.delete(source),{once:true});return source;}
  stopCombatEffects():void {for(const source of this.combatSources){try{source.stop();}catch{}}this.designedSources.clear();this.combatSources.clear();}
  playSpecial(type: 'scarlet'|'phantom'|'nova'|'orbital'|'comet'):void {
    this.unlock();if(!this.ctx||!this.sfxGain||this.isMuted||this.environment==='space')return;
    if(!this.allowSound('special',.2))return;this.playDesignedVoice(type);
  }
  playBossTransition(phase:'escape'|'submerged'|'emerge'|'eclipse'):void {
    this.unlock();if(!this.ctx||!this.sfxGain||this.isMuted||this.environment==='space')return;
    if(!this.allowSound('boss-transition',.18))return;
    if(phase==='submerged'){this.noise(1.7,.09,700);this.tone('sine',58,32,2,.13);}
    else if(phase==='escape'){this.noise(.6,.15,1600);this.tone('triangle',90,280,.7,.09);}
    else if(phase==='emerge'){this.noise(.8,.2,2100);this.tone('sine',72,28,.8,.22);}
    else {this.noise(.15,.12,1300);this.tone('triangle',140,65,.18,.08);}
  }

  playBomb(): void {
    this.playExplosion(true);
    if (!this.ctx || !this.sfxGain || this.isMuted||this.environment==='space') return;
    const now = this.ctx.currentTime;
    const osc = this.trackSoundSource(this.ctx.createOscillator());
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(25, now + 0.8);

    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.85);
  }

  playPickup(type: string): void {
    this.unlock();
    if (!this.ctx || !this.sfxGain || this.isMuted||this.environment==='space') return;
    const melodies:Record<string,number[]>={power:[659,880],upgrade:[523,659,784,1047],full_power:[523,784,1047],health:[392,523,659],special:[349,523,1047],bomb:[349,523,1047],speed:[880,1175],score:[1047,1319],weapon_ion:[587,880],weapon_green:[440,698],weapon_red:[330,659],missile:[392,784]};
    (melodies[type]??[659,987]).forEach((freq,i)=>this.tone('sine',freq,freq,.12,.16,i*.055));
  }

  playChargeWindup(ratio: number): void {
    this.unlock();
    if (!this.ctx || !this.sfxGain || this.isMuted||this.environment==='space') return;
    if(!this.allowSound('charge-windup',.10))return;
    const now = this.ctx.currentTime;
    const osc = this.trackSoundSource(this.ctx.createOscillator());
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    const baseFreq = 220 + ratio * 440;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.linearRampToValueAtTime(baseFreq + 30, now + 0.06);

    gain.gain.setValueAtTime(0.04 + ratio * 0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.06);
    osc.onended=()=>{osc.disconnect();gain.disconnect();};
  }

  playChargedShot(pilotId: string, level = 2): void {
    this.unlock();
    if (!this.ctx || !this.sfxGain || this.isMuted||this.environment==='space') return;
    const now = this.ctx.currentTime;

    if (pilotId === 'nolan') {
      // Disparo de Feixe Penetrante: impacto e zunido denso de plasma
      const osc = this.trackSoundSource(this.ctx.createOscillator());
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(680, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.32);

      gain.gain.setValueAtTime(0.35 * level, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (pilotId === 'cora') {
      // Sobrecarga de Agulhas: chiado supersônico
      for (let i = 0; i < 3; i++) {
        const osc = this.trackSoundSource(this.ctx.createOscillator());
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        const t = now + i * 0.04;
        osc.frequency.setValueAtTime(1100 + i * 220, t);
        osc.frequency.exponentialRampToValueAtTime(450, t + 0.18);

        gain.gain.setValueAtTime(0.24, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.18);
      }
    } else {
      // Mega-Canhão Cinético: estrondo profundo com ressonância de metal
      const osc = this.trackSoundSource(this.ctx.createOscillator());
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.45);

      gain.gain.setValueAtTime(0.55 * level, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.48);
    }
  }

  playOverheat(): void {
    this.unlock();
    if (!this.ctx || !this.sfxGain || this.isMuted||this.environment==='space') return;
    const now = this.ctx.currentTime;
    const osc = this.trackSoundSource(this.ctx.createOscillator());
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(440, now + 0.06);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  // --- MÚSICA PROCEDURAL RETRO SCI-FI ---

  setEnvironment(environment:'atmosphere'|'space'):void {
    this.environment=environment;if(environment==='space')this.stopMusic();
    if(this.masterGain&&this.ctx)this.masterGain.gain.setValueAtTime(environment==='space'||this.isMuted?0:this.masterVolume,this.ctx.currentTime);
  }
  private startTrack(theme:MusicTheme):void {
    if(this.environment==='space'||this.currentTrack===theme)return;
    this.stopMusic();this.unlock();if(!this.ctx||!this.musicGain)return;
    this.musicGain.gain.setTargetAtTime(this.musicVolume,this.ctx.currentTime,.1);
    this.currentTrack=theme;this.transport??=new MusicTransport(this.ctx,this.musicGain);this.transport.start(theme);
  }
  startMenuMusic():void{this.startTrack('menu');}
  startStageMusic():void{this.startTrack('stage1');}
  startBossMusic():void{this.startTrack('boss');}
  setBossSuspense(suspended:boolean):void{if(this.ctx&&this.musicGain)this.musicGain.gain.setTargetAtTime(this.musicVolume*(suspended?.35:1),this.ctx.currentTime,.25);}
  startVictoryMusic():void{this.startTrack('victory');}
  pauseMusic():void{this.transport?.pause();}
  resumeMusic():void{if(this.environment!=='space')this.transport?.resume();}
  stopMusic():void{this.transport?.stop();this.currentTrack='none';}
  getStatus(){return {environment:this.environment,track:this.currentTrack,position:this.transport?.position??0,paused:this.transport?.paused??false,sfxVoices:this.combatSources.size,voices:this.transport?.activeVoices??0,musicLoadFailed:this.transport?.loadFailed??false,master:this.masterGain?.gain.value??0,sfx:this.sfxVolume,music:this.musicVolume};}
}

export const globalAudio = new AudioSystem();
