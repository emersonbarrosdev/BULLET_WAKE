import { PILOT_RADIO, type RadioEvent } from '../data/pilotRadio.ts';
import type { PilotId } from '../data/pilots.ts';
export interface RadioContext {
    enemies: number;
    bullets: number;
    lives: number;
    specials: number;
}
/** Contextual text, not narration: no voice, no modal, no repeated line until its bag is exhausted. */
export class PilotRadio {
    message = 'Canal aberto.';
    remaining = 0;
    deaths = 0;
    private now = 0;
    private next = 12000;
    private nextIdle = 45000;
    private kills = 0;
    private comeback = false;
    private bags = new Map<RadioEvent, number[]>();
    private last = new Map<RadioEvent, number>();
    private pilot: PilotId;
    private random: () => number;
    constructor(pilot: PilotId, random: () => number = Math.random) { this.pilot = pilot; this.random = random; }
    offer(event: RadioEvent, urgent = false): boolean {
        if (!urgent && (this.now < this.next || this.now - (this.last.get(event) ?? -60000) < 45000))
            return false;
        let bag = this.bags.get(event);
        const pool = PILOT_RADIO[this.pilot][event];
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
    death(): void { this.deaths++; this.kills = 0; this.comeback = false; this.offer(this.deaths === 1 ? 'death1' : this.deaths === 2 ? 'death2' : 'deathlater', true); }
    kill(): void { if (this.deaths >= 2 && !this.comeback && ++this.kills >= 8) {
        this.comeback = true;
        this.offer('comeback', true);
    } }
    update(dt: number, context: RadioContext): void {
        this.now += Math.max(0, dt);
        this.remaining = Math.max(0, this.remaining - dt);
        if (context.enemies >= 7 && context.bullets >= 10 && context.specials > 0)
            this.offer('crowd');
        else if (context.lives === 1 && context.bullets >= 12)
            this.offer('fear');
        if (this.now >= this.nextIdle) {
            this.nextIdle = this.now + 45000 + this.random() * 20000;
            this.offer('idle');
        }
    }
}
