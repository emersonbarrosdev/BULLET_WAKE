import { PILOT_RADIO, ENCOUNTER_RADIO, type RadioEvent } from '../data/pilotRadio.ts';
import type { PilotId } from '../data/pilots.ts';
export interface RadioContext {
    enemies: number;
    bullets: number;
    lives: number;
    specials: number;
}
export interface RadioSnapshot {
    pilot:PilotId; message:string; remaining:number; deaths:number; now:number; next:number; nextIdle:number;
    kills:number; comeback:boolean; bags:Array<[RadioEvent,number[]]>; last:Array<[RadioEvent,number]>;
}
/** Contextual text, not narration: no voice, no modal, no repeated line until its bag is exhausted. */
export class PilotRadio {
    message = 'Canal aberto.';
    remaining = 0;
    deaths = 0;
    private now = 0;
    private next = 12000;
    private nextIdle = 65000;
    private kills = 0;
    private comeback = false;
    private bags = new Map<RadioEvent, number[]>();
    private last = new Map<RadioEvent, number>();
    private pilot: PilotId;
    private random: () => number;
    constructor(pilot: PilotId, random: () => number = Math.random) { this.pilot = pilot; this.random = random; }
    snapshot():RadioSnapshot {return {pilot:this.pilot,message:this.message,remaining:this.remaining,deaths:this.deaths,now:this.now,next:this.next,nextIdle:this.nextIdle,kills:this.kills,comeback:this.comeback,bags:[...this.bags].map(([k,v])=>[k,[...v]]),last:[...this.last]};}
    restore(s:RadioSnapshot):void {if(s.pilot!==this.pilot)return;this.message=s.message;this.remaining=s.remaining;this.deaths=s.deaths;this.now=s.now;this.next=s.next;this.nextIdle=s.nextIdle;this.kills=s.kills;this.comeback=s.comeback;this.bags=new Map(s.bags.map(([k,v])=>[k,[...v]]));this.last=new Map(s.last);}
    offer(event: RadioEvent, urgent = false): boolean {
        if(urgent&&this.now-(this.last.get(event)??-60000)<12000)return false;
        if (!urgent && (this.now < this.next || this.now - (this.last.get(event) ?? -60000) < 45000))
            return false;
        let bag = this.bags.get(event);
        const pool = event==='escape'||event==='return'?ENCOUNTER_RADIO[event]:PILOT_RADIO[this.pilot][event];
        if (!bag?.length) {
            bag = pool.map((_, i) => i);
            for (let i = bag.length - 1; i > 0; i--) {
                const j = Math.floor(this.random() * (i + 1));
                [bag[i], bag[j]] = [bag[j], bag[i]];
            }
            this.bags.set(event, bag);
        }
        this.message = pool[bag.pop()!];
        this.remaining = 6000;
        this.next = this.now + 26000 + this.random() * 8000;
        this.last.set(event, this.now);
        return true;
    }
    death(): void { this.deaths++; this.kills = 0; this.comeback = false; this.offer(this.deaths === 1 ? 'death1' : this.deaths === 2 ? 'death2' : 'deathlater'); }
    kill(): void { if (this.deaths >= 2 && !this.comeback && ++this.kills >= 8) {
        this.comeback = true;
        this.offer('comeback');
    } }
    update(dt: number, context: RadioContext): void {
        this.now += Math.max(0, dt);
        this.remaining = Math.max(0, this.remaining - dt);
        if (context.enemies >= 5 && context.bullets >= 7 && context.specials > 0)
            this.offer('crowd');
        else if (context.lives === 1 && context.bullets >= 8)
            this.offer('fear');
        if (this.now >= this.nextIdle) {
            this.nextIdle = this.now + 60000 + this.random() * 20000;
            this.offer('idle');
        }
    }
}
