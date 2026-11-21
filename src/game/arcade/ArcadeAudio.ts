import {globalAudio} from '../audio/audioSystem';
export type ArcadeTrack='intro'|'menu'|'select'|'stage1'|'mini1'|'boss1'|'stage2'|'mini2'|'boss2'|'victory'|'defeat'|'results';
/** One music voice with short crossfade transitions; HTML transport keeps its exact cursor on pause. Approved SFX remain on Web Audio. */
export class ArcadeAudio {
 private music?:HTMLAudioElement;private fadingOut?:HTMLAudioElement;private fadeTimer?:number;private track?:ArcadeTrack;private volume=.18;private muted=false;failed=false;private suspended=false;
 private foreground=true;
 private targetVol():number{return this.muted?0:Math.min(1,this.volume*.85);}
 private clearFade():void{
  if(this.fadeTimer!==undefined){window.clearInterval(this.fadeTimer);this.fadeTimer=undefined;}
  if(this.fadingOut){this.fadingOut.pause();this.fadingOut.removeAttribute('src');this.fadingOut.load();this.fadingOut=undefined;}
 }
 setForeground(active:boolean):void{
  this.foreground=active;
  if(!active){this.clearFade();this.music?.pause();}
  else if(!this.suspended&&!this.muted&&this.music){this.music.volume=this.targetVol();void this.music.play().catch(()=>{});}
 }
 setMix(music:number,effects:number,muted=false):void{
  this.volume=Math.max(0,Math.min(1,music));this.muted=muted;globalAudio.setMix(music,effects);globalAudio.setMute(muted);
  if(muted)this.clearFade();
  if(this.music)this.music.volume=this.targetVol();
 }
 unlock():void{globalAudio.unlock();if(this.foreground&&this.music?.paused&&!this.muted&&!this.suspended){this.music.volume=this.targetVol();void this.music.play().catch(()=>{});}}
 play(track:ArcadeTrack):void{
  if(this.track===track)return;
  const prev=this.music;
  this.clearFade();
  this.track=track;this.failed=false;this.suspended=false;
  const file=track==='intro'?'menu':track==='mini1'?'boss1':track==='mini2'?'boss2':track==='results'?'select':track;
  const audio=new Audio(`${import.meta.env.BASE_URL}assets/audio/arcade/${file}.ogg`);
  this.music=audio;
  audio.loop=!['victory','defeat'].includes(track);
  const goal=this.targetVol();
  audio.addEventListener('error',()=>this.failed=true,{once:true});
  const canFade=typeof window!=='undefined'&&prev&&!prev.paused&&this.foreground&&!this.muted&&goal>0.005;
  if(canFade){
   this.fadingOut=prev;
   const startPrev=prev.volume;
   audio.volume=Math.min(goal,0.02);
   void audio.play().catch(()=>{});
   let step=0;const steps=8;
   this.fadeTimer=window.setInterval(()=>{
    step++;
    const u=Math.min(1,step/steps);
    if(this.fadingOut)this.fadingOut.volume=Math.max(0,startPrev*(1-u));
    if(this.music===audio)audio.volume=this.muted?0:this.targetVol()*u;
    if(step>=steps)this.clearFade();
   },30);
  } else {
   if(prev){prev.pause();prev.removeAttribute('src');prev.load();}
   audio.volume=goal;
   if(this.foreground&&!this.muted)void audio.play().catch(()=>{});
  }
 }
 pause():void{this.suspended=true;this.clearFade();this.music?.pause();globalAudio.stopCombatEffects();}
 resume():void{this.suspended=false;if(this.foreground&&!this.muted&&this.music){this.music.volume=this.targetVol();void this.music.play().catch(()=>{});}}
 stop():void{this.clearFade();if(this.music){this.music.pause();this.music.removeAttribute('src');this.music.load();this.music=undefined;}this.track=undefined;}
 status(){return{track:this.track,position:this.music?.currentTime??0,volume:this.music?.volume??0,paused:this.music?.paused??true,failed:this.failed};}
}
