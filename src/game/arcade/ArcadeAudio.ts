import {globalAudio} from '../audio/audioSystem';
export type ArcadeTrack='intro'|'menu'|'select'|'stage1'|'mini1'|'boss1'|'stage2'|'mini2'|'boss2'|'victory'|'defeat'|'results';
/** One music voice, HTML transport keeps its exact cursor on pause. Approved SFX remain on Web Audio. */
export class ArcadeAudio {
 private music?:HTMLAudioElement;private track?:ArcadeTrack;private volume=.18;private muted=false;failed=false;private suspended=false;
 setMix(music:number,effects:number,muted=false):void{this.volume=Math.max(0,Math.min(1,music));this.muted=muted;globalAudio.setMix(music,effects);globalAudio.setMute(muted);if(this.music)this.music.volume=muted?0:this.volume*.52;}
 unlock():void{globalAudio.unlock();if(this.music?.paused&&!this.muted&&!this.suspended)void this.music.play().catch(()=>{});}
 play(track:ArcadeTrack):void{
  if(this.track===track)return;this.stop();this.track=track;this.failed=false;this.suspended=false;
  const file=track==='intro'?'menu':track==='mini1'?'boss1':track==='mini2'?'boss2':track==='results'?'select':track;
  const audio=new Audio(`${import.meta.env.BASE_URL}assets/audio/arcade/${file}.ogg`);this.music=audio;audio.loop=!['victory','defeat'].includes(track);audio.volume=this.muted?0:this.volume*.52;audio.addEventListener('error',()=>this.failed=true,{once:true});void audio.play().catch(()=>{});
 }
 pause():void{this.suspended=true;this.music?.pause();globalAudio.stopCombatEffects();}
 resume():void{this.suspended=false;if(this.music)void this.music.play().catch(()=>{});}
 stop():void{if(this.music){this.music.pause();this.music.removeAttribute('src');this.music.load();this.music=undefined;}this.track=undefined;}
 status(){return{track:this.track,position:this.music?.currentTime??0,volume:this.music?.volume??0,paused:this.music?.paused??true,failed:this.failed};}
}
