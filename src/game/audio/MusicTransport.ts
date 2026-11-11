import type { MusicTheme } from './musicScore';
/** Sampled original 32-bar rock arrangements. Decoding is cached; stop invalidates pending fetches. */
export class MusicTransport {
    private source?: AudioBufferSourceNode;
    private generation = 0;
    private buffers = new Map<MusicTheme, Promise<AudioBuffer>>();
    private error = false;
    constructor(private ctx: AudioContext, private bus: AudioNode) { }
    start(theme: MusicTheme): void {
        this.stop();
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
            source.loop = true;
            source.loopStart = 0;
            source.loopEnd = buffer.duration;
            gain.gain.setValueAtTime(0, this.ctx.currentTime);
            gain.gain.linearRampToValueAtTime(.72, this.ctx.currentTime + .12);
            source.connect(gain);
            gain.connect(this.bus);
            this.source = source;
            source.onended = () => { source.disconnect(); gain.disconnect(); };
            source.start();
        }).catch(() => { if (generation === this.generation)
            this.error = true; this.buffers.delete(theme); });
    }
    stop(): void { this.generation++; if (this.source) {
        try {
            this.source.stop();
        }
        catch { }
        this.source = undefined;
    } }
    get activeVoices(): number { return this.source ? 1 : 0; }
    get loadFailed(): boolean { return this.error; }
}
