import type { MusicTheme } from './musicScore';
import { MusicCursor } from './MusicCursor';
/** Sampled original arrangements; victory is a short non-looping cue. Decoding is cached; stop invalidates pending fetches. */
export class MusicTransport {
    private source?: AudioBufferSourceNode;
    private generation = 0;
    private buffers = new Map<MusicTheme, Promise<AudioBuffer>>();
    private error = false;
    private cursor=new MusicCursor();
    private theme?:MusicTheme;
    private suspended=false;
    constructor(private ctx: AudioContext, private bus: AudioNode) { }
    start(theme: MusicTheme): void {
        if(this.theme!==theme||!this.suspended){this.stop();this.theme=theme;}
        this.suspended=false;
        const generation = this.generation;
        this.error = false;
        let pending = this.buffers.get(theme);
        if (!pending) {
            pending = fetch(`${import.meta.env.BASE_URL}assets/audio/${theme}.ogg`).then(r => { if (!r.ok)
                throw new Error('Music HTTP ' + r.status); return r.arrayBuffer(); }).then(bytes => this.ctx.decodeAudioData(bytes));
            this.buffers.set(theme, pending);
        }
        void pending.then(buffer => {
            if (generation !== this.generation)
                return;
            const source = this.ctx.createBufferSource(), gain = this.ctx.createGain();
            source.buffer = buffer;
            source.loop = theme!=='victory';
            source.loopStart = 0;
            source.loopEnd = buffer.duration;
            gain.gain.setValueAtTime(0, this.ctx.currentTime);
            gain.gain.linearRampToValueAtTime(.72, this.ctx.currentTime + .12);
            source.connect(gain);
            gain.connect(this.bus);
            this.source = source;
            source.onended = () => { if(this.source===source)this.source=undefined;source.disconnect(); gain.disconnect(); };
            source.start(0,this.cursor.start(this.ctx.currentTime,buffer.duration));
        }).catch(() => { if (generation === this.generation)
            this.error = true; this.buffers.delete(theme); });
    }
    pause():void {if(this.suspended||!this.theme)return;this.cursor.pause(this.ctx.currentTime);this.suspended=true;this.halt();}
    resume():void {if(this.suspended&&this.theme)this.start(this.theme);}
    get position():number{return this.cursor.position(this.ctx.currentTime);}
    get paused():boolean{return this.suspended;}
    stop():void{this.halt();this.cursor.reset();this.theme=undefined;this.suspended=false;}
    private halt(): void { this.generation++; if (this.source) {
        try {
            this.source.stop();
        }
        catch { }
        this.source = undefined;
    } }
    get activeVoices(): number { return this.source ? 1 : 0; }
    get loadFailed(): boolean { return this.error; }
}
