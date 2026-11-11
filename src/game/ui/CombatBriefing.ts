import Phaser from 'phaser';
import { connectedPad, GamepadReader, padLabels } from '../systems/gamepadInput';
import '../../combat-briefing.css';

/** One compact translucent pause card; the gameplay remains visible and frozen. */
export class CombatBriefing {
  private root=document.createElement('div');
  private reader=new GamepadReader();
  private raf=0;
  private closed=false;
  private page:'pause'|'controls'|'exit'='pause';
  private selection=0;
  private device='';
  private hud=document.querySelector<HTMLElement>('#bw-combat-hud');
  constructor(private scene:Phaser.Scene,_preflight:boolean,private resume:()=>void,_restart:()=>void,private leave:()=>void){
    this.root.className='bw-briefing bw-pause';this.root.setAttribute('role','dialog');this.root.setAttribute('aria-modal','true');
    this.root.setAttribute('aria-label','Operação pausada');document.body.append(this.root);
    if(this.hud)this.hud.inert=true;scene.input.keyboard?.resetKeys();scene.scene.pause();
    this.reader.sample(connectedPad());this.render();document.addEventListener('keydown',this.onKey,true);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN,this.destroy);scene.events.once(Phaser.Scenes.Events.DESTROY,this.destroy);this.tick();
  }
  private buttons(){return Array.from(this.root.querySelectorAll<HTMLButtonElement>('button'));}
  private focus(){const b=this.buttons();this.selection=(this.selection+b.length)%b.length;b[this.selection]?.focus({preventScroll:true});}
  private tick=()=>{
    if(this.closed)return;const pad=connectedPad(),device=pad?.id??'keyboard';
    if(device!==this.device){this.device=device;this.render();}
    const p=this.reader.sample(pad);if(p.up||p.left){this.selection--;this.focus();}if(p.down||p.right){this.selection++;this.focus();}
    if(p.confirm)this.buttons()[this.selection]?.click();if(p.back||p.menuOrBack)this.back();
    if(!this.closed)this.raf=requestAnimationFrame(this.tick);
  };
  private onKey=(e:KeyboardEvent)=>{
    if(!['Escape','Enter',' ','Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;
    e.preventDefault();e.stopImmediatePropagation();if(e.repeat)return;
    if(e.key==='Escape'){this.back();return;}if(e.key==='Enter'||e.key===' '){this.buttons()[this.selection]?.click();return;}
    this.selection+=['ArrowUp','ArrowLeft'].includes(e.key)||(e.key==='Tab'&&e.shiftKey)?-1:1;this.focus();
  };
  private back(){if(this.page==='pause')this.finish(this.resume);else this.show('pause');}
  private show(page:'pause'|'controls'|'exit'){this.page=page;this.selection=0;this.render();}
  private render(){
    if(this.closed)return;const pad=connectedPad(),labels=padLabels(pad?.id);
    let title='PAUSADO',body='',actions:Array<[string,()=>void]>;
    if(this.page==='pause')actions=[['CONTINUAR',()=>this.finish(this.resume)],['CONTROLES',()=>this.show('controls')],['VOLTAR AO MENU',()=>this.show('exit')]];
    else if(this.page==='controls'){
      title='CONTROLES';const rows=[['Movimentar',pad?'ANALÓGICO / DIRECIONAL':'WASD / SETAS'],['Disparar',pad?labels.shoot:'ESPAÇO'],['Especial',pad?labels.special:'X'],['Pausar',pad?labels.pause:'ESC']];
      body=`<div class="bw-brief-controls">${rows.map(([name,key])=>`<div><span>${name}</span><kbd>${key}</kbd></div>`).join('')}</div><p class="bw-brief-note">Segure o disparo. Colete P para evoluir a arma da sua nave.</p>`;
      actions=[['VOLTAR',()=>this.show('pause')]];
    }else{
      title='VOLTAR AO MENU?';body='<p class="bw-brief-note">Ao sair, você perde o progresso da fase atual. Deseja continuar?</p>';
      actions=[['CANCELAR',()=>this.show('pause')],['CONFIRMAR SAÍDA',()=>this.finish(this.leave)]];
    }
    this.root.innerHTML=`<section class="bw-brief-panel"><p class="bw-brief-eyebrow">BULLET WAKE</p><h1>${title}</h1>${body}<nav>${actions.map(([label],i)=>`<button data-brief-action="${i}">${label}</button>`).join('')}</nav></section>`;
    this.buttons().forEach((b,i)=>{b.addEventListener('focus',()=>this.selection=i);b.addEventListener('click',actions[i][1]);});this.focus();
  }
  private finish(action:()=>void){this.destroy();this.scene.input.keyboard?.resetKeys();this.scene.scene.resume();action();}
  destroy=()=>{
    if(this.closed)return;this.closed=true;cancelAnimationFrame(this.raf);document.removeEventListener('keydown',this.onKey,true);
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN,this.destroy);this.scene.events.off(Phaser.Scenes.Events.DESTROY,this.destroy);
    this.root.remove();if(this.hud)this.hud.inert=false;
  };
}
