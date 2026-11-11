import Phaser from 'phaser';
import '../../mission-result.css';
import { connectedPad, GamepadReader, padLabels } from '../systems/gamepadInput';

interface ResultAction { label: string; key: string; run: () => void; }

/** A viewport-level dialog must outrank the native combat HUD. */
export class MissionResultOverlay extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, title: string, caption: string, score: number, message: string, actions: ResultAction[], defeated = false) {
    super(scene, 0, 0);
    scene.add.existing(this);
    const root = document.createElement('div');
    root.className = 'bw-mission-result' + (defeated ? ' bw-result-defeat' : '');
    root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'bw-result-title');
    root.innerHTML = `<section class="bw-result-panel"><p class="bw-result-eyebrow">BULLET WAKE // RELATÓRIO DE OPERAÇÃO</p><h1 id="bw-result-title">${title}</h1><p class="bw-result-caption">${caption}</p><p class="bw-result-score"><span>PONTUAÇÃO TOTAL</span><strong>${String(score).padStart(7, '0')}</strong></p><p class="bw-result-message">${message}</p><nav aria-label="Próxima ação">${actions.map((a, i) => `<button type="button" data-result-action="${i}">${a.label} <kbd>[${a.key.toUpperCase().replace('ESCAPE', 'ESC')}]</kbd></button>`).join('')}</nav></section>`;
    document.body.append(root);
    const hud = document.querySelector<HTMLElement>('#bw-combat-hud');
    if (hud) hud.inert = true;
    let handled = false;
    let raf = 0, selected = 0, device = '';
    const reader = new GamepadReader();reader.sample(connectedPad());
    const cleanup = (): void => {
      root.remove(); document.removeEventListener('keydown', onKey, true);
      cancelAnimationFrame(raf);
      if (hud) hud.inert = false;
      scene.events.off(Phaser.Scenes.Events.SHUTDOWN, cleanup);
      this.off(Phaser.GameObjects.Events.DESTROY, cleanup);
    };
    const activate = (index: number): void => {
      if (handled) return;
      handled = true; cleanup(); scene.input.keyboard?.resetKeys(); actions[index].run();
    };
    const onKey = (event: KeyboardEvent): void => {
      const key = event.key.toLowerCase();
      if(['arrowleft','arrowright','arrowup','arrowdown','tab'].includes(key)){
        event.preventDefault();event.stopImmediatePropagation();
        selected=(selected+(['arrowleft','arrowup'].includes(key)||(key==='tab'&&event.shiftKey)?actions.length-1:1))%actions.length;
        root.querySelectorAll<HTMLButtonElement>('button')[selected]?.focus();return;
      }
      if(key==='enter'||key===' '){event.preventDefault();event.stopImmediatePropagation();if(!event.repeat)activate(selected);return;}

      const index = actions.findIndex(a => a.key.toLowerCase() === key);
      if (index < 0 && key !== ' ') return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (!event.repeat) activate(index < 0 ? 0 : index);
    };
    root.querySelectorAll<HTMLButtonElement>('button').forEach((button, i) => {button.addEventListener('focus',()=>selected=i);button.addEventListener('click', () => activate(i));});
    const poll = ():void => {
      if(handled)return;
      const pad=connectedPad(),p=reader.sample(pad);
      if(device!==(pad?.id??'keyboard')){
        device=pad?.id??'keyboard';
        root.querySelectorAll('kbd').forEach((node,i)=>node.textContent=pad?'['+padLabels(pad.id).shoot+']':'['+actions[i].key.toUpperCase().replace('ESCAPE','ESC')+']');
      }
      if(p.left||p.up)selected=(selected+actions.length-1)%actions.length;
      if(p.right||p.down)selected=(selected+1)%actions.length;
      if(p.left||p.right||p.up||p.down)root.querySelectorAll<HTMLButtonElement>('button')[selected]?.focus();
      if(p.confirm){activate(selected);return;}
      if(p.back){activate(actions.length-1);return;}
      raf=requestAnimationFrame(poll);
    };poll();
    document.addEventListener('keydown', onKey, true);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    this.once(Phaser.GameObjects.Events.DESTROY, cleanup);
    root.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
  }
}
