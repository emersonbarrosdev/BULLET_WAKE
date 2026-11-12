import type { CampaignFlight } from '../systems/campaignFlight';
import Phaser from 'phaser';
import { getPilot } from '../data/pilots';
import { PILOT_STORIES } from '../data/pilotStories';
import { globalAudio } from '../audio/audioSystem';
import { saveSystem } from '../systems/saveSystem';
import { connectedPad, GamepadReader } from '../systems/gamepadInput';
import '../../combat-briefing.css';
/** A personal Phase 1 aftermath; campaign endings require all 15 main chapters. */
export class EndingScene extends Phaser.Scene {
    private root?: HTMLDivElement;
    private pilotId = 'nolan';
    private score = 0;
    private carry?:CampaignFlight;
    private stage = 1;
    private selection = 0;
    private pad = new GamepadReader();
    constructor() { super({ key: 'EndingScene' }); }
    init(data: {
        pilotId?: string;
        score?: number;
        stageNumber?: number;
        carry?:CampaignFlight;
    } = {}) { this.pilotId = data.pilotId ?? 'nolan'; this.score = data.score ?? 0; this.stage = data.stageNumber ?? 1;this.carry=data.carry; }
    private back = () => this.scene.start('TitleScene');
    private missions = () => this.scene.start('StageSelectScene', { pilotId: this.pilotId,carry:this.carry });
    private buttons() { return [...this.root!.querySelectorAll<HTMLButtonElement>('button')]; }
    private move(d: number) { this.selection = (this.selection + d + 2) % 2; this.buttons()[this.selection].focus(); }
    private key = (e: KeyboardEvent) => { if (e.repeat)
        return; if (e.key === 'Escape')
        this.back(); if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.buttons()[this.selection].click();
    } if (e.key === 'ArrowDown' || e.key === 'ArrowRight')
        this.move(1); if (e.key === 'ArrowUp' || e.key === 'ArrowLeft')
        this.move(-1); };
    create() {
        const pilot = getPilot(this.pilotId), story = PILOT_STORIES[pilot.id];
        const fullEnding = this.stage >= 15 && saveSystem.getSaveData().completedCampaignPilots.includes(pilot.id);
        if (fullEnding)
            saveSystem.markEndingSeen(pilot.id);
        globalAudio.startMenuMusic();
        this.pad.sample(connectedPad());
        this.selection = 0;
        this.root = document.createElement('div');
        this.root.className = 'bw-briefing bw-ending';
        this.root.innerHTML = `<section class="bw-brief-panel"><p class="bw-brief-eyebrow">BULLET WAKE // ${pilot.name.toUpperCase()}</p><h1>${fullEnding ? 'UM CAMINHO PARA CASA' : 'A BUSCA CONTINUA'}</h1><section class="bw-mission-story"><img src="${import.meta.env.BASE_URL}assets/pilot-selection/portrait-${pilot.id}.webp" alt="${pilot.name}"/><div><small>${pilot.shipName.toUpperCase()} · ${fullEnding ? 'DESFECHO PESSOAL' : 'APÓS A FENDA PELÁGICA'}</small><p>${story.desire}</p></div></section><p class="bw-ending-copy">${fullEnding ? story.ending : story.afterMission1}</p><p class="bw-brief-note">PONTUAÇÃO ${String(this.score).padStart(6, '0')} · PROGRESSO SALVO PARA ${pilot.name.toUpperCase()}</p><nav><button data-ending="menu">MENU PRINCIPAL</button><button data-ending="missions">MISSÕES</button></nav></section>`;
        document.body.append(this.root);
        this.buttons().forEach((b, i) => b.addEventListener('focus', () => this.selection = i));
        this.buttons()[0].onclick = this.back;
        this.buttons()[1].onclick = this.missions;
        document.addEventListener('keydown', this.key);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { document.removeEventListener('keydown', this.key); this.root?.remove(); this.root = undefined; });
    }
    update() { const p = this.pad.sample(connectedPad()); if (p.up || p.left)
        this.move(-1); if (p.down || p.right)
        this.move(1); if (p.confirm)
        this.buttons()[this.selection].click(); if (p.back)
        this.back(); }
}
