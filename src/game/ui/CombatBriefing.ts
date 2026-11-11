import { globalAudio } from '../audio/audioSystem';
import { saveSystem } from '../systems/saveSystem';
import Phaser from 'phaser';
import { CombatLoading } from './CombatLoading';
import { connectedPad, GamepadReader, padLabels } from '../systems/gamepadInput';
import { NORMAL_GUIDE_ITEMS, PICKUP_GUIDE } from '../data/pickupGuide';
import '../../combat-briefing.css';

/** One device-aware guide for preflight, pause and options. Simulation is frozen. */
export class CombatBriefing {
  private root = document.createElement('div');
  private reader = new GamepadReader();
  private raf = 0;
  private closed = false;
  private loading?: CombatLoading;
  private page: 'flight' | 'pause' | 'options' | 'controls' | 'items';
  private device = '';
  private selection = 0;
  private hud = document.querySelector<HTMLElement>('#bw-combat-hud');
  constructor(private scene: Phaser.Scene, preflight: boolean, private resume: () => void, private restart: () => void, private leave: () => void) {
    this.page = preflight ? 'flight' : 'pause';
    this.root.className = 'bw-briefing'; this.root.setAttribute('role','dialog');
    this.root.setAttribute('aria-modal','true'); this.root.setAttribute('aria-label', preflight ? 'Preparação da Fase 1' : 'Operação pausada');
    document.body.append(this.root); if(this.hud)this.hud.inert = true;
    scene.input.keyboard?.resetKeys(); scene.scene.pause();
    this.reader.sample(connectedPad());
    this.render(); document.addEventListener('keydown', this.onKey, true);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy);
    scene.events.once(Phaser.Scenes.Events.DESTROY, this.destroy);
    this.tick();
  }
  private buttons() { return Array.from(this.root.querySelectorAll<HTMLButtonElement>('button')); }
  private focus() { const b=this.buttons(); if(!b.length)return;this.selection=(this.selection+b.length)%b.length; b[this.selection]?.focus({preventScroll:true}); }
  private tick = () => {
    if(this.closed)return;
    if(this.loading){this.reader.sample(connectedPad());this.raf=requestAnimationFrame(this.tick);return;}
    const pad=connectedPad(), device=pad?.id ?? 'keyboard';
    if(device!==this.device){this.device=device;this.render();}
    const p=this.reader.sample(pad);
    if(this.page==='items'&&(p.up||p.down))this.scrollItems(p.up?-1:1);
    else {
      if(p.left||p.up){this.selection--;this.focus();}
      if(p.right||p.down){this.selection++;this.focus();}
    }
    if(p.confirm)this.buttons()[this.selection]?.click();
    if(p.back||p.menuOrBack)this.back();
    if(!this.closed)this.raf=requestAnimationFrame(this.tick);
  };
  private onKey = (e: KeyboardEvent) => {
    if(this.loading){e.preventDefault();e.stopImmediatePropagation();return;}
    if(!['Escape','Enter',' ','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Tab'].includes(e.key))return;
    e.preventDefault(); e.stopImmediatePropagation(); if(e.repeat)return;
    if(e.key==='Escape'){this.back();return;}
    if(this.page==='items'&&(e.key==='ArrowUp'||e.key==='ArrowDown')){this.scrollItems(e.key==='ArrowUp'?-1:1);return;}
    if(e.key==='Enter'||e.key===' '){this.buttons()[this.selection]?.click();return;}
    this.selection += e.key==='ArrowLeft'||e.key==='ArrowUp'||(e.key==='Tab'&&e.shiftKey)?-1:1; this.focus();
  };
  private scrollItems(direction:number) { this.root.querySelector('.bw-brief-items')?.scrollBy({top:direction*110}); }
  private back() {
    if(this.loading)return;
    if(this.page==='flight')return; // Starting combat always requires explicit confirmation.
    if(this.page==='pause'){this.finish(this.resume);return;}
    this.page=this.page==='options'?'pause':'options';this.selection=0;this.render();
  }
  private controls(): string {
    const pad=connectedPad(), l=padLabels(pad?.id);
    const rows=[['Movimentar',pad?'ANALÓGICO / DIRECIONAL':'WASD / SETAS'],['Disparar',pad?l.shoot:'ESPAÇO'],
      ['Especial',pad?l.special:'X'],['Pausar',pad?l.pause:'ESC']];
    return `<p class="bw-brief-device">${pad?'CONTROLE CONECTADO':'TECLADO'} · ${pad?'CONFIRMAR '+l.shoot:'CONFIRMAR ENTER'}</p><div class="bw-brief-controls">${rows.map(([a,b])=>`<div><span>${a}</span><kbd>${b}</kbd></div>`).join('')}</div><p class="bw-brief-note">Segure o disparo para atirar na cadência rápida. RIVET: dois mísseis automáticos a partir do nível 3 de cada arma.</p><p class="bw-brief-note">Especial: ataque de emergência limitado por cargas. Destrua caixas com paraquedas para liberar itens. Ao perder uma vida, recupere seu armamento no campo.</p>`;
  }
  private render() {
    if(this.closed||this.loading)return;
    const title={flight:'PRONTO PARA DECOLAR?',pause:'OPERAÇÃO PAUSADA',options:'OPÇÕES DE COMBATE',controls:'COMANDOS',items:'COLETÁVEIS'}[this.page];
    let body='', actions: Array<[string,()=>void]>=[];
    if(this.page==='flight'||this.page==='controls'){
      body=this.controls();
      if(this.page==='flight')body+='<p class="bw-brief-rule">AZUL NV4 → VERDE NV1 · VERDE NV4 → RUBRO NV1<br>3 vidas · 3 P por nível · 2 especiais iniciais, máximo 3.</p>';
      actions=this.page==='flight'?[['ENTENDI · INICIAR OPERAÇÃO',()=>this.launch()]]:[['VOLTAR',()=>this.back()]];
    }else if(this.page==='pause'){
      body='<p class="bw-brief-note">A operação está suspensa. Retome quando estiver pronto.</p>';
      actions=[['CONTINUAR',()=>this.finish(this.resume)],['OPÇÕES',()=>this.show('options')],['REINICIAR FASE',()=>this.finish(this.restart)],['ESCOLHER PILOTO',()=>this.finish(this.leave)]];
    }else if(this.page==='options'){
      const settings=saveSystem.getSaveData().settings;
      body='<p class="bw-brief-note">Dificuldade Normal · ajustes de áudio e consulta rápida.</p>';
      actions=[['VER COMANDOS',()=>this.show('controls')],['GUIA DE COLETÁVEIS',()=>this.show('items')],
        ['MÚSICA · '+(settings.musicVolume?'LIGADA':'DESLIGADA'),()=>{saveSystem.updateSettings({musicVolume:settings.musicVolume?0:1});const mix=saveSystem.getSaveData().settings;globalAudio.setMix(mix.musicVolume,mix.sfxVolume);this.render();}],
        ['EFEITOS · '+(settings.sfxVolume?'LIGADOS':'DESLIGADOS'),()=>{saveSystem.updateSettings({sfxVolume:settings.sfxVolume?0:1});const mix=saveSystem.getSaveData().settings;globalAudio.setMix(mix.musicVolume,mix.sfxVolume);this.render();}],['VOLTAR',()=>this.back()]];
    }else{
      body=`<div class="bw-brief-items">${NORMAL_GUIDE_ITEMS.map(type=>`<article><span class="bw-brief-item-icon" style="background-image:url('${import.meta.env.BASE_URL}assets/combat-hd/review/pickups-${type}.webp')" aria-hidden="true"></span><div><strong>${PICKUP_GUIDE[type].label}</strong><p>${PICKUP_GUIDE[type].description}</p></div></article>`).join('')}</div>`;
      actions=[['VOLTAR',()=>this.back()]];
    }
    this.root.innerHTML=`<section class="bw-brief-panel"><p class="bw-brief-eyebrow">BULLET <em>WAKE</em> // FASE 01</p><h1>${title}</h1>${body}<nav>${actions.map(([label],i)=>`<button data-brief-action="${i}">${label}</button>`).join('')}</nav></section>`;
    this.buttons().forEach((b,i)=>{b.addEventListener('focus',()=>this.selection=i);b.addEventListener('click',actions[i][1]);});this.focus();
  }
  private show(page: 'options'|'controls'|'items') {this.page=page;this.selection=0;this.render();}
  private launch() {
    if(this.closed||this.loading)return;
    this.root.inert=true;
    this.loading=new CombatLoading('PREPARANDO DECOLAGEM', 'Aguarde. Sua operação começa em instantes.');
    this.loading.ready(2500,()=>this.finish(this.resume),true);
  }
  private finish(action:()=>void) { if(this.closed)return;this.destroy();this.scene.input.keyboard?.resetKeys();this.scene.scene.resume();action(); }
  destroy = () => {
    if(this.closed)return;this.closed=true;cancelAnimationFrame(this.raf);document.removeEventListener('keydown',this.onKey,true);
    this.loading?.destroy();this.loading=undefined;
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN,this.destroy);this.scene.events.off(Phaser.Scenes.Events.DESTROY,this.destroy);
    this.root.remove();if(this.hud)this.hud.inert=false;
  };
}
