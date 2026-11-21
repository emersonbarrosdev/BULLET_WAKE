/**
 * Original Bullet Wake Soundtrack v2 — Hand-composed multi-section arrangements.
 * - menu.ogg: Joyful, heroic Sega Master System Sonic 1–inspired sunlit chiptune + arcade synth anthem (D Major, 138 BPM, 32 bars).
 * - stage1.ogg: Uplifting, breezy ocean sky-flight arcade shmup theme tailored for background gameplay (F Major, 146 BPM, 32 bars).
 *
 * Renders clean Type-1 MIDI via FluidSynth + GeneralUser-GS.sf2, blends a subtle authentic SN76489 PSG sparkle
 * layer on the menu theme, wraps loop reverb tails seamlessly, and masters to Vorbis OGG via ffmpeg.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve('.');
const OUT_DIR = join(ROOT, 'public/assets/audio/arcade');
const TMP_DIR = join(ROOT, 'tmp/soundtrack-v2');
const FLUID = join(ROOT, 'tmp/audio-tools/fluid/fluidsynth-v2.6.2-win10-x64-cpp11/bin/fluidsynth.exe');
const SF2 = join(ROOT, 'tmp/audio-tools/GeneralUser-GS.sf2');
mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(TMP_DIR, { recursive: true });

if (!existsSync(FLUID)) throw new Error(`FluidSynth not found at ${FLUID}`);
if (!existsSync(SF2)) throw new Error(`SoundFont not found at ${SF2}`);

const PPQ = 480;

// ---- Minimal Standard MIDI File (Format 1) Writer ----
function vlq(value) {
  let v = Math.max(0, Math.round(value));
  const bytes = [v & 0x7f];
  v >>= 7;
  while (v > 0) {
    bytes.unshift((v & 0x7f) | 0x80);
    v >>= 7;
  }
  return bytes;
}

function u16(v) { return [(v >> 8) & 0xff, v & 0xff]; }
function u32(v) { return [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff]; }

function buildTrackChunk(events) {
  // events: Array<{ tick: number, order: number, bytes: number[] }>
  events.sort((a, b) => a.tick - b.tick || a.order - b.order);
  const data = [];
  let lastTick = 0;
  for (const ev of events) {
    const dt = Math.max(0, Math.round(ev.tick) - lastTick);
    lastTick = Math.round(ev.tick);
    data.push(...vlq(dt), ...ev.bytes);
  }
  data.push(0x00, 0xff, 0x2f, 0x00); // End of track
  return Buffer.from([0x4d, 0x54, 0x72, 0x6b, ...u32(data.length), ...data]);
}

function writeMidiFile(path, bpm, tracks) {
  const usPerBeat = Math.round(60_000_000 / bpm);
  const tempoTrack = buildTrackChunk([
    { tick: 0, order: 0, bytes: [0xff, 0x51, 0x03, (usPerBeat >> 16) & 0xff, (usPerBeat >> 8) & 0xff, usPerBeat & 0xff] },
    { tick: 0, order: 1, bytes: [0xff, 0x58, 0x04, 4, 2, 24, 8] }, // 4/4
  ]);
  const chunks = [tempoTrack, ...tracks.map(buildTrackChunk)];
  const header = Buffer.from([
    0x4d, 0x54, 0x68, 0x64,
    ...u32(6),
    ...u16(1), // Format 1
    ...u16(chunks.length),
    ...u16(PPQ),
  ]);
  writeFileSync(path, Buffer.concat([header, ...chunks]));
}

// Note helper: pitch names like 'D5', 'F#5', 'Bb4' -> MIDI note
const NOTE_MAP = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function midi(name) {
  if (typeof name === 'number') return name;
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`Bad note: ${name}`);
  const semi = NOTE_MAP[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return (Number(m[3]) + 1) * 12 + semi;
}

class SongBuilder {
  constructor(bpm, bars) {
    this.bpm = bpm;
    this.bars = bars;
    this.channels = new Map();
    this.psgNotes = []; // For optional authentic Master System PSG sparkle layer
  }
  setupChannel(ch, { program, volume = 100, pan = 64, reverb = 28, chorus = 18, expression = 112 }) {
    const list = [];
    this.channels.set(ch, list);
    if (ch !== 9 && program !== undefined) list.push({ tick: 0, order: 0, bytes: [0xc0 | ch, program & 0x7f] });
    list.push({ tick: 0, order: 1, bytes: [0xb0 | ch, 7, volume & 0x7f] });
    list.push({ tick: 0, order: 2, bytes: [0xb0 | ch, 10, pan & 0x7f] });
    list.push({ tick: 0, order: 3, bytes: [0xb0 | ch, 91, reverb & 0x7f] });
    list.push({ tick: 0, order: 4, bytes: [0xb0 | ch, 93, chorus & 0x7f] });
    list.push({ tick: 0, order: 5, bytes: [0xb0 | ch, 11, expression & 0x7f] });
  }
  note(ch, pitch, beatStart, beatDur, vel = 96, psgDuty = null) {
    const p = midi(pitch);
    const list = this.channels.get(ch);
    const t0 = Math.round(beatStart * PPQ);
    const t1 = Math.max(t0 + 12, Math.round((beatStart + beatDur) * PPQ));
    list.push({ tick: t0, order: 20, bytes: [0x90 | ch, p & 0x7f, Math.max(1, Math.min(127, Math.round(vel)))] });
    list.push({ tick: t1, order: 10, bytes: [0x80 | ch, p & 0x7f, 0] });
    if (psgDuty !== null) {
      this.psgNotes.push({ pitch: p, beatStart, beatDur, vel: vel / 127, duty: psgDuty });
    }
  }
  psgOnly(pitch, beatStart, beatDur, vel = 0.45, duty = 0.25) {
    this.psgNotes.push({ pitch: midi(pitch), beatStart, beatDur, vel, duty });
  }
  chord(ch, pitches, beatStart, beatDur, vel = 72) {
    for (const p of pitches) this.note(ch, p, beatStart, beatDur, vel);
  }
  drum(noteNum, beatStart, vel = 96) {
    this.note(9, noteNum, beatStart, 0.2, vel);
  }
  write(midPath) {
    const endTick = this.bars * 4 * PPQ;
    const tracks = [...this.channels.values()].map(evs => [
      ...evs,
      { tick: endTick, order: 99, bytes: [0xb0, 123, 0] }, // All notes off safety at bar boundary
    ]);
    writeMidiFile(midPath, this.bpm, tracks);
  }
}

// ---- WAV Read/Write Helpers (16-bit Stereo PCM, 44100 Hz) ----
function readWavStereo(path) {
  const buf = readFileSync(path);
  let pos = 12;
  let sampleRate = 44100;
  let channels = 2;
  let bitsPerSample = 16;
  let dataStart = 0;
  let dataLen = 0;
  while (pos + 8 <= buf.length) {
    const id = buf.toString('ascii', pos, pos + 4);
    const sz = buf.readUInt32LE(pos + 4);
    if (id === 'fmt ') {
      channels = buf.readUInt16LE(pos + 10);
      sampleRate = buf.readUInt32LE(pos + 12);
      bitsPerSample = buf.readUInt16LE(pos + 22);
    } else if (id === 'data') {
      dataStart = pos + 8;
      dataLen = sz;
      break;
    }
    pos += 8 + sz + (sz & 1);
  }
  if (!dataStart || bitsPerSample !== 16 || channels !== 2) {
    throw new Error(`Unexpected WAV format: ch=${channels}, bits=${bitsPerSample}`);
  }
  const frames = Math.floor(dataLen / 4);
  const L = new Float32Array(frames);
  const R = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    L[i] = buf.readInt16LE(dataStart + i * 4) / 32768;
    R[i] = buf.readInt16LE(dataStart + i * 4 + 2) / 32768;
  }
  return { sampleRate, L, R };
}

function writeWavStereo(path, sampleRate, L, R) {
  const frames = L.length;
  const dataLen = frames * 4;
  const buf = Buffer.alloc(44 + dataLen);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataLen, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataLen, 40);
  for (let i = 0; i < frames; i++) {
    const l = Math.max(-1, Math.min(1, L[i]));
    const r = Math.max(-1, Math.min(1, R[i]));
    buf.writeInt16LE(Math.round(l * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(r * 32767), 44 + i * 4 + 2);
  }
  writeFileSync(path, buf);
}

// Band-limited-ish warm Sega Master System SN76489 pulse wave overlay (adds joyful retro Sonic 1 sparkle!)
function mixPsgLayer(L, R, sampleRate, bpm, psgNotes, gain = 0.14) {
  const secPerBeat = 60 / bpm;
  const len = L.length;
  for (const n of psgNotes) {
    const freq = 440 * Math.pow(2, (n.pitch - 69) / 12);
    const start = Math.floor(n.beatStart * secPerBeat * sampleRate);
    const durSamples = Math.floor(n.beatDur * secPerBeat * sampleRate);
    const duty = n.duty ?? 0.25;
    const amp = n.vel * gain;
    const panL = n.duty === 0.25 ? 0.62 : 0.44;
    const panR = 1 - panL;
    let phase = 0;
    const inc = freq / sampleRate;
    const attack = Math.min(durSamples, Math.floor(sampleRate * 0.006));
    const release = Math.min(durSamples, Math.floor(sampleRate * 0.045));
    for (let i = 0; i < durSamples; i++) {
      const idx = (start + i) % len;
      if (idx < 0) continue;
      const tSec = i / sampleRate;
      // Gentle retro vibrato on sustained notes (> 0.28s)
      const vib = tSec > 0.18 ? Math.sin((tSec - 0.18) * 34) * 0.0045 : 0;
      phase = (phase + inc * (1 + vib)) % 1;
      // Softly filtered pulse (sum of fundamental + 2nd/3rd/4th harmonics for smooth non-harsh retro sparkle)
      const p1 = Math.sin(2 * Math.PI * phase);
      const p2 = Math.sin(4 * Math.PI * phase) * (duty === 0.25 ? 0.55 : 0.08);
      const p3 = Math.sin(6 * Math.PI * phase) * 0.34;
      const p4 = Math.sin(8 * Math.PI * phase) * (duty === 0.25 ? 0.18 : 0.03);
      let env = 1;
      if (i < attack) env = i / Math.max(1, attack);
      else if (i > durSamples - release) env = (durSamples - i) / Math.max(1, release);
      // Slight percussive pluck decay like Master System YM2413/PSG
      const decay = 0.68 + 0.32 * Math.exp(-tSec * 4.5);
      const s = (p1 + p2 + p3 + p4) * 0.46 * env * decay * amp;
      L[idx] += s * panL;
      R[idx] += s * panR;
    }
  }
}

function renderTrack(name, builder, { psgGain = 0, targetLufs = -14.5, highCutHz = 13500 } = {}) {
  const midPath = join(TMP_DIR, `${name}.mid`);
  const rawWav = join(TMP_DIR, `${name}-raw.wav`);
  const loopWav = join(TMP_DIR, `${name}-loop.wav`);
  const outOgg = join(OUT_DIR, `${name}.ogg`);

  builder.write(midPath);
  execFileSync(FLUID, ['-ni', '-F', rawWav, '-r', '44100', '-g', '0.58', SF2, midPath], { stdio: 'ignore' });

  const { sampleRate, L: rawL, R: rawR } = readWavStereo(rawWav);
  const loopFrames = Math.round((builder.bars * 4 * 60 / builder.bpm) * sampleRate);
  const L = new Float32Array(loopFrames);
  const R = new Float32Array(loopFrames);

  const bodyLen = Math.min(loopFrames, rawL.length);
  for (let i = 0; i < bodyLen; i++) {
    L[i] = rawL[i];
    R[i] = rawR[i];
  }
  // Wrap natural reverb/release tail cleanly into the beginning so the loop has ZERO seam or click!
  const tailLen = Math.min(loopFrames, Math.max(0, rawL.length - loopFrames));
  for (let i = 0; i < tailLen; i++) {
    L[i] += rawL[loopFrames + i];
    R[i] += rawR[loopFrames + i];
  }

  if (psgGain > 0 && builder.psgNotes.length > 0) {
    mixPsgLayer(L, R, sampleRate, builder.bpm, builder.psgNotes, psgGain);
  }

  // Soft analog tape saturation + conservative headroom before ffmpeg mastering
  let peak = 0.001;
  for (let i = 0; i < loopFrames; i++) {
    L[i] = Math.tanh(L[i] * 1.12);
    R[i] = Math.tanh(R[i] * 1.12);
    peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  }
  const scale = 0.86 / peak;
  for (let i = 0; i < loopFrames; i++) {
    L[i] *= scale;
    R[i] *= scale;
  }

  writeWavStereo(loopWav, sampleRate, L, R);

  // Subtle warm mastering chain (clean low rumble, gentle presence, warm ceiling, smooth Vorbis q6)
  const af = [
    'highpass=f=32',
    `lowpass=f=${highCutHz}`,
    'equalizer=f=110:t=q:w=1.1:g=1.4',
    'equalizer=f=3200:t=q:w=1.2:g=1.2',
    `alimiter=limit=0.92:attack=3:release=40`,
  ].join(',');

  execFileSync('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-i', loopWav,
    '-af', af,
    '-c:a', 'libvorbis', '-q:a', '6',
    outOgg,
  ], { stdio: 'inherit' });

  const seconds = (loopFrames / sampleRate).toFixed(2);
  console.log(`Rendered ${name}.ogg (${builder.bpm} BPM, ${builder.bars} bars, ${seconds}s, target ${targetLufs} LUFS)`);
}

// ============================================================================
// TRACK 1: MENU THEME ("SUNLIT HORIZON" — Sonic 1 Master System Epic & Joyful!)
// Key: D Major | Tempo: 138 BPM | 32 Bars (A -> A' -> B -> C seamless loop)
// ============================================================================
function composeMenuTheme() {
  const s = new SongBuilder(138, 32);
  // Ch 0: Lead — Bright Square / Synth Brass Lead (classic Yuzo Koshiro Master System / 16-bit lead)
  s.setupChannel(0, { program: 80, volume: 102, pan: 60, reverb: 34, chorus: 24 });
  // Ch 1: Harmony Brass — Synth Brass 1 (doubles climax & adds epic heroic lift!)
  s.setupChannel(1, { program: 62, volume: 78, pan: 72, reverb: 38, chorus: 22 });
  // Ch 2: Bass — Slap Bass 1 (iconic bouncy Sega octave-jumping groove!)
  s.setupChannel(2, { program: 36, volume: 106, pan: 64, reverb: 10, chorus: 8 });
  // Ch 3: Keys — Electric Piano 2 (sunlit sparkling major-7th stabs)
  s.setupChannel(3, { program: 5, volume: 78, pan: 42, reverb: 36, chorus: 26 });
  // Ch 4: Sparkle Bells — Celesta / Glockenspiel / Bright Marimba counter-melody
  s.setupChannel(4, { program: 12, volume: 74, pan: 88, reverb: 42, chorus: 20 });
  // Ch 5: Strings Pad — Warm Synth Strings for epic bridge lift
  s.setupChannel(5, { program: 50, volume: 68, pan: 64, reverb: 48, chorus: 28 });
  // Ch 9: Crisp Arcade Pop/Funk Drum Kit
  s.setupChannel(9, { volume: 104, pan: 64, reverb: 18, chorus: 0 });

  // Harmonic progression (32 bars):
  // Section A (0-7):  Dmaj7 | Bm7  | Gmaj7 | A9    | Dmaj7 | F#m7 | Gmaj7 | A7
  // Section A'(8-15): Dmaj7 | Bm7  | Gmaj7 | A9    | Bm7   | F#m7 | Gmaj7 | A7
  // Section B (16-23):Gmaj7 | A/G  | F#m7  | Bm7   | Em7   | A7   | Dmaj7 | D7
  // Section C (24-31):Gmaj7 | A7   | F#m7  | Bm7   | Em7   | G/A  | Dmaj7 | A7sus4 (turnaround)
  const chords = [
    // A (0..7)
    { root: 'D2', notes: ['D4', 'F#4', 'A4', 'C#5'] },
    { root: 'B1', notes: ['B3', 'D4', 'F#4', 'A4'] },
    { root: 'G1', notes: ['G3', 'B3', 'D4', 'F#4'] },
    { root: 'A1', notes: ['A3', 'C#4', 'E4', 'B4'] },
    { root: 'D2', notes: ['D4', 'F#4', 'A4', 'C#5'] },
    { root: 'F#2', notes: ['F#3', 'A3', 'C#4', 'E4'] },
    { root: 'G1', notes: ['G3', 'B3', 'D4', 'F#4'] },
    { root: 'A1', notes: ['A3', 'C#4', 'E4', 'G4'] },
    // A' (8..15)
    { root: 'D2', notes: ['D4', 'F#4', 'A4', 'C#5'] },
    { root: 'B1', notes: ['B3', 'D4', 'F#4', 'A4'] },
    { root: 'G1', notes: ['G3', 'B3', 'D4', 'F#4'] },
    { root: 'A1', notes: ['A3', 'C#4', 'E4', 'B4'] },
    { root: 'B1', notes: ['B3', 'D4', 'F#4', 'A4'] },
    { root: 'F#2', notes: ['F#3', 'A3', 'C#4', 'E4'] },
    { root: 'G1', notes: ['G3', 'B3', 'D4', 'F#4'] },
    { root: 'A1', notes: ['A3', 'C#4', 'E4', 'G4'] },
    // B — Epic Bridge (16..23)
    { root: 'G1', notes: ['G3', 'B3', 'D4', 'F#4'] },
    { root: 'G1', notes: ['A3', 'C#4', 'E4', 'G4'] },
    { root: 'F#2', notes: ['F#3', 'A3', 'C#4', 'E4'] },
    { root: 'B1', notes: ['B3', 'D4', 'F#4', 'A4'] },
    { root: 'E2', notes: ['E3', 'G3', 'B3', 'D4'] },
    { root: 'A1', notes: ['A3', 'C#4', 'E4', 'G4'] },
    { root: 'D2', notes: ['D4', 'F#4', 'A4', 'C#5'] },
    { root: 'D2', notes: ['D4', 'F#4', 'A4', 'C5'] },
    // C — Triumphant Climax (24..31)
    { root: 'G1', notes: ['G3', 'B3', 'D4', 'F#4'] },
    { root: 'A1', notes: ['A3', 'C#4', 'E4', 'G4'] },
    { root: 'F#2', notes: ['F#3', 'A3', 'C#4', 'E4'] },
    { root: 'B1', notes: ['B3', 'D4', 'F#4', 'A4'] },
    { root: 'E2', notes: ['E3', 'G3', 'B3', 'D4'] },
    { root: 'A1', notes: ['G3', 'B3', 'D4', 'E4'] },
    { root: 'D2', notes: ['D4', 'F#4', 'A4', 'D5'] },
    { root: 'A1', notes: ['A3', 'D4', 'E4', 'A4'] },
  ];

  // 1. Rhythm Section: Bouncy Sonic-style Octave Slap Bass + Sparkling E-Piano + Crisp Pop Drums
  for (let bar = 0; bar < 32; bar++) {
    const b0 = bar * 4;
    const ch = chords[bar];
    const r = midi(ch.root);
    const nextR = midi(chords[(bar + 1) % 32].root);
    const walk = nextR > r ? r + 2 : r - 1;
    const section = Math.floor(bar / 8);

    // Classic Master System / Green Hill bouncing octave bassline!
    const bassPattern = [
      [0.0, r, 0.42, 108],
      [0.5, r + 12, 0.35, 86],
      [1.0, r + 7, 0.35, 92],
      [1.5, r + 12, 0.38, 96],
      [2.0, r, 0.42, 104],
      [2.5, r + 12, 0.35, 88],
      [3.0, r + 7, 0.38, 94],
      [3.5, (bar % 2 === 1 ? walk : r + 10), 0.38, 92],
    ];
    for (const [off, p, d, v] of bassPattern) {
      s.note(2, p, b0 + off, d, v);
    }

    // Sunlit syncopated E-piano chord comping (Charleston / upbeat arcade pop groove)
    const compBeats = section === 2
      ? [[0.0, 1.4, 72], [1.5, 0.9, 64], [2.5, 1.3, 70]]
      : [[0.0, 0.45, 76], [0.75, 0.45, 68], [1.5, 0.45, 74], [2.5, 0.45, 72], [3.25, 0.55, 66]];
    for (const [off, d, v] of compBeats) {
      s.chord(3, ch.notes, b0 + off, d, v);
    }

    // Master System fast sparkling PSG background chord arpeggio on alternating bars!
    if (section === 1 || section === 3) {
      const arpNotes = ch.notes.map(n => midi(n) + 12);
      for (let step = 0; step < 16; step++) {
        if (step % 2 === 0 || step % 4 === 3) {
          s.psgOnly(arpNotes[step % arpNotes.length], b0 + step * 0.25, 0.20, 0.28, 0.25);
        }
      }
    }

    // Warm epic strings pad in Section B & C
    if (section >= 2) {
      s.chord(5, ch.notes.map(n => midi(n) + 12), b0, 3.85, section === 3 ? 66 : 58);
    }

    // Crisp Sonic 1 / Master System energetic drum groove
    s.drum(36, b0 + 0.0, 112); // Kick
    s.drum(38, b0 + 1.0, 96);  // Snare
    s.drum(36, b0 + 2.0, 106); // Kick
    s.drum(36, b0 + 2.5, 86);  // Syncopated bounce kick!
    s.drum(38, b0 + 3.0, 102); // Snare
    if (bar % 2 === 1) s.drum(38, b0 + 3.75, 74); // Ghost upbeat snare

    // Sparkling hi-hats + tambourine
    for (let e = 0; e < 8; e++) {
      const open = (e === 7 && bar % 2 === 1);
      s.drum(open ? 46 : 42, b0 + e * 0.5, e % 2 === 0 ? 74 : 56);
      if (section >= 1 && e % 2 === 1) s.drum(54, b0 + e * 0.5, 48); // Tambourine sparkle
    }
    if (bar % 8 === 0) s.drum(49, b0, 92); // Bright crash on section starts

    // Joyful tom fills on bars 7, 15, 23, 31
    if (bar % 8 === 7) {
      s.drum(50, b0 + 2.5, 88);
      s.drum(48, b0 + 2.75, 90);
      s.drum(47, b0 + 3.0, 94);
      s.drum(45, b0 + 3.25, 96);
      s.drum(38, b0 + 3.5, 104);
      s.drum(38, b0 + 3.75, 108);
    }
  }

  // 2. Hand-composed Melodies! [bar, beatOffset, note, dur, vel]
  const melodyA = [
    // Bar 0 (Dmaj7): Iconic upbeat leaping heroic hook!
    [0, 0.0, 'F#5', 0.45, 104], [0, 0.5, 'A5', 0.45, 108], [0, 1.0, 'D6', 0.9, 114], [0, 2.0, 'C#6', 0.45, 104], [0, 2.5, 'B5', 0.45, 102], [0, 3.0, 'A5', 0.85, 108],
    // Bar 1 (Bm7): Playful syncopated response
    [1, 0.0, 'F#5', 0.45, 100], [1, 0.5, 'D5', 0.45, 98], [1, 1.0, 'B5', 0.9, 110], [1, 2.0, 'A5', 0.45, 104], [1, 2.5, 'F#5', 0.45, 100], [1, 3.0, 'E5', 0.85, 98],
    // Bar 2 (Gmaj7): Rising sunlit optimism
    [2, 0.0, 'D5', 0.45, 100], [2, 0.5, 'G5', 0.45, 104], [2, 1.0, 'B5', 0.70, 110], [2, 1.75, 'A5', 0.45, 104], [2, 2.25, 'G5', 0.45, 102], [2, 2.75, 'F#5', 0.45, 100], [2, 3.25, 'G5', 0.65, 106],
    // Bar 3 (A9): Joyful cadence lift
    [3, 0.0, 'A5', 1.40, 112], [3, 1.5, 'B5', 0.45, 106], [3, 2.0, 'A5', 0.45, 104], [3, 2.5, 'G5', 0.45, 100], [3, 3.0, 'E5', 0.85, 98],

    // Bar 4 (Dmaj7): Second phrase climbs higher!
    [4, 0.0, 'F#5', 0.45, 104], [4, 0.5, 'A5', 0.45, 108], [4, 1.0, 'D6', 0.70, 114], [4, 1.75, 'E6', 0.45, 116], [4, 2.25, 'D6', 0.45, 110], [4, 2.75, 'C#6', 0.45, 106], [4, 3.25, 'B5', 0.65, 104],
    // Bar 5 (F#m7): Heroic warm turn
    [5, 0.0, 'A5', 0.90, 110], [5, 1.0, 'F#5', 0.45, 102], [5, 1.5, 'A5', 0.45, 106], [5, 2.0, 'C#6', 0.90, 112], [5, 3.0, 'A5', 0.85, 104],
    // Bar 6 (Gmaj7): Joyful cascading run
    [6, 0.0, 'B5', 0.45, 108], [6, 0.5, 'D6', 0.45, 112], [6, 1.0, 'B5', 0.45, 106], [6, 1.5, 'A5', 0.45, 104], [6, 2.0, 'G5', 0.90, 106], [6, 3.0, 'F#5', 0.45, 102], [6, 3.5, 'G5', 0.45, 104],
    // Bar 7 (A7): Confident triumphant resolve into A'
    [7, 0.0, 'A5', 1.80, 112], [7, 2.0, 'E5', 0.45, 98], [7, 2.5, 'F#5', 0.45, 102], [7, 3.0, 'G5', 0.45, 106], [7, 3.5, 'A5', 0.45, 110],
  ];

  // Section A' (bars 8..15): Echoes A with soaring harmonies + joyful climax at bars 12..15!
  const melodyA2 = [
    ...melodyA.slice(0, 26).map(([bar, off, n, d, v]) => [bar + 8, off, n, d, Math.min(120, v + 4)]),
    // Bar 12 (Bm7)
    [12, 0.0, 'B5', 0.45, 108], [12, 0.5, 'D6', 0.45, 112], [12, 1.0, 'F#6', 0.90, 118], [12, 2.0, 'E6', 0.45, 112], [12, 2.5, 'D6', 0.45, 108], [12, 3.0, 'B5', 0.85, 106],
    // Bar 13 (F#m7)
    [13, 0.0, 'C#6', 0.90, 112], [13, 1.0, 'A5', 0.45, 104], [13, 1.5, 'B5', 0.45, 106], [13, 2.0, 'C#6', 0.90, 112], [13, 3.0, 'E6', 0.85, 116],
    // Bar 14 (Gmaj7)
    [14, 0.0, 'D6', 0.90, 114], [14, 1.0, 'B5', 0.45, 106], [14, 1.5, 'G5', 0.45, 102], [14, 2.0, 'A5', 0.45, 106], [14, 2.5, 'B5', 0.45, 110], [14, 3.0, 'D6', 0.85, 114],
    // Bar 15 (A7)
    [15, 0.0, 'E6', 1.40, 118], [15, 1.5, 'D6', 0.45, 112], [15, 2.0, 'C#6', 0.90, 110], [15, 3.0, 'A5', 0.85, 106],
  ];

  // Section B (bars 16..23): Epic heroic sky-adventure bridge!
  const melodyB = [
    [16, 0.0, 'B5', 1.35, 112], [16, 1.5, 'A5', 0.45, 106], [16, 2.0, 'G5', 0.90, 106], [16, 3.0, 'F#5', 0.45, 102], [16, 3.5, 'G5', 0.45, 106],
    [17, 0.0, 'A5', 1.35, 112], [17, 1.5, 'B5', 0.45, 108], [17, 2.0, 'C#6', 0.90, 114], [17, 3.0, 'E6', 0.85, 118],
    [18, 0.0, 'F#6', 1.35, 118], [18, 1.5, 'E6', 0.45, 112], [18, 2.0, 'C#6', 0.90, 110], [18, 3.0, 'A5', 0.85, 106],
    [19, 0.0, 'D6', 1.35, 114], [19, 1.5, 'C#6', 0.45, 108], [19, 2.0, 'B5', 1.75, 110],
    [20, 0.0, 'G5', 0.45, 104], [20, 0.5, 'A5', 0.45, 106], [20, 1.0, 'B5', 0.90, 112], [20, 2.0, 'D6', 0.90, 114], [20, 3.0, 'B5', 0.85, 108],
    [21, 0.0, 'C#6', 0.90, 112], [21, 1.0, 'E6', 0.90, 116], [21, 2.0, 'G6', 0.90, 120], [21, 3.0, 'E6', 0.85, 114],
    [22, 0.0, 'F#6', 1.80, 120], [22, 2.0, 'E6', 0.90, 114], [22, 3.0, 'D6', 0.85, 112],
    [23, 0.0, 'C6', 1.35, 112], [23, 1.5, 'B5', 0.45, 108], [23, 2.0, 'A5', 0.90, 108], [23, 3.0, 'D6', 0.85, 114],
  ];

  // Section C (bars 24..31): Grand joyful chorus climax + exhilarating loop turnaround!
  const melodyC = [
    [24, 0.0, 'B5', 0.45, 110], [24, 0.5, 'D6', 0.45, 114], [24, 1.0, 'G6', 0.90, 120], [24, 2.0, 'F#6', 0.45, 116], [24, 2.5, 'D6', 0.45, 112], [24, 3.0, 'B5', 0.85, 110],
    [25, 0.0, 'C#6', 0.45, 112], [25, 0.5, 'E6', 0.45, 116], [25, 1.0, 'A6', 0.90, 122], [25, 2.0, 'G6', 0.45, 116], [25, 2.5, 'E6', 0.45, 112], [25, 3.0, 'C#6', 0.85, 110],
    [26, 0.0, 'F#6', 0.90, 118], [26, 1.0, 'E6', 0.45, 112], [26, 1.5, 'C#6', 0.45, 110], [26, 2.0, 'A5', 0.90, 108], [26, 3.0, 'C#6', 0.85, 112],
    [27, 0.0, 'D6', 0.90, 116], [27, 1.0, 'B5', 0.45, 110], [27, 1.5, 'D6', 0.45, 114], [27, 2.0, 'F#6', 1.75, 120],
    [28, 0.0, 'G6', 0.90, 120], [28, 1.0, 'F#6', 0.45, 114], [28, 1.5, 'E6', 0.45, 112], [28, 2.0, 'D6', 0.90, 114], [28, 3.0, 'B5', 0.85, 110],
    [29, 0.0, 'C#6', 0.45, 112], [29, 0.5, 'D6', 0.45, 114], [29, 1.0, 'E6', 0.90, 118], [29, 2.0, 'G6', 0.90, 120], [29, 3.0, 'E6', 0.85, 114],
    [30, 0.0, 'D6', 2.40, 120], [30, 2.5, 'A5', 0.45, 108], [30, 3.0, 'B5', 0.45, 110], [30, 3.5, 'C#6', 0.45, 114],
    [31, 0.0, 'D6', 1.40, 118], [31, 1.5, 'A5', 0.45, 108], [31, 2.0, 'E5', 0.45, 102], [31, 2.5, 'F#5', 0.45, 106], [31, 3.0, 'A5', 0.85, 112],
  ];

  const allMenuMel = [...melodyA, ...melodyA2, ...melodyB, ...melodyC];
  for (const [bar, off, noteName, dur, vel] of allMenuMel) {
    const t = bar * 4 + off;
    // Main lead + authentic Sega Master System 50% pulse shimmer layer!
    s.note(0, noteName, t, dur, vel, 0.5);
    // Heroic synth brass doubling in Section A' (bars 12-15), Section B & Section C!
    if (bar >= 12) {
      const brassNote = bar >= 24 ? midi(noteName) - 12 : midi(noteName) - 12;
      s.note(1, brassNote, t, dur * 0.92, vel * 0.72);
    }
    // Bright marimba/bell sparkle accents on beat 0 & beat 2 in Section A & C!
    if ((off === 0.0 || off === 2.0) && (bar < 16 || bar >= 24)) {
      s.note(4, midi(noteName) + (midi(noteName) < 84 ? 12 : 0), t, Math.min(0.4, dur), 64);
    }
  }

  // Playful bell call-and-response fills in gaps of Section A (bars 1, 3, 5, 7)
  const bellFills = [
    [1, 3.5, 'F#6', 0.22], [1, 3.75, 'A6', 0.22],
    [3, 3.5, 'A5', 0.22], [3, 3.75, 'C#6', 0.22],
    [5, 3.5, 'E6', 0.22], [5, 3.75, 'F#6', 0.22],
    [9, 3.5, 'F#6', 0.22], [9, 3.75, 'A6', 0.22],
    [11, 3.5, 'C#6', 0.22], [11, 3.75, 'E6', 0.22],
  ];
  for (const [bar, off, n, d] of bellFills) {
    s.note(4, n, bar * 4 + off, d, 78);
    s.psgOnly(n, bar * 4 + off, d, 0.35, 0.25);
  }

  return s;
}

// ============================================================================
// TRACK 2: STAGE 1 ("PELAGIC SKIES" — Uplifting Ocean Sky-Flight Shmup Theme!)
// Key: F Major | Tempo: 146 BPM | 32 Bars (A -> A' -> B -> C seamless loop)
// Designed specifically as exciting, melodic, breathable background music!
// ============================================================================
function composeStage1Theme() {
  const s = new SongBuilder(146, 32);
  // Ch 0: Lead — Warm Saw/Synth Lead (aerodynamic, smooth, sits cleanly behind SFX!)
  s.setupChannel(0, { program: 81, volume: 90, pan: 58, reverb: 32, chorus: 24 });
  // Ch 1: Heroic Brass Layer — Synth Brass 2 (soaring flight energy in chorus)
  s.setupChannel(1, { program: 63, volume: 78, pan: 72, reverb: 36, chorus: 22 });
  // Ch 2: Bass — Synth Bass 1 (tight driving 16th-note flight momentum!)
  s.setupChannel(2, { program: 38, volume: 102, pan: 64, reverb: 8, chorus: 10 });
  // Ch 3: Sunlit Ocean Keys — Electric Piano 1 (warm tropical coastal chords)
  s.setupChannel(3, { program: 4, volume: 74, pan: 36, reverb: 38, chorus: 26 });
  // Ch 4: Shimmer Pluck — Clean Electric Guitar / Kalimba-like ocean arpeggio
  s.setupChannel(4, { program: 27, volume: 68, pan: 92, reverb: 40, chorus: 28 });
  // Ch 5: Lush Sky Strings — String Ensemble 1 (emotional soaring swells in B-section!)
  s.setupChannel(5, { program: 48, volume: 72, pan: 64, reverb: 50, chorus: 24 });
  // Ch 9: Driving Arcade Fusion Drums
  s.setupChannel(9, { volume: 102, pan: 64, reverb: 16, chorus: 0 });

  const chords = [
    // Section A (0..7): Bright ocean sky takeoff
    { root: 'F2', notes: ['F3', 'A3', 'C4', 'E4'] },       // Fmaj7
    { root: 'E2', notes: ['E3', 'G3', 'C4', 'E4'] },       // C/E
    { root: 'D2', notes: ['D3', 'F3', 'A3', 'C4'] },       // Dm7
    { root: 'C2', notes: ['C3', 'E3', 'G3', 'C4'] },       // C
    { root: 'Bb1', notes: ['Bb3', 'D4', 'F4', 'A4'] },     // Bbmaj7
    { root: 'A1', notes: ['A3', 'C4', 'F4', 'A4'] },       // F/A
    { root: 'G1', notes: ['G3', 'Bb3', 'D4', 'F4'] },      // Gm7
    { root: 'C2', notes: ['C3', 'F3', 'G3', 'Bb3'] },      // C9sus4
    // Section A' (8..15): Full throttle cruising
    { root: 'F2', notes: ['F3', 'A3', 'C4', 'E4'] },
    { root: 'E2', notes: ['E3', 'G3', 'C4', 'E4'] },
    { root: 'D2', notes: ['D3', 'F3', 'A3', 'C4'] },
    { root: 'C2', notes: ['C3', 'G3', 'Bb3', 'D4'] },
    { root: 'Bb1', notes: ['Bb3', 'D4', 'F4', 'A4'] },
    { root: 'C2', notes: ['C3', 'E3', 'G3', 'Bb3'] },
    { root: 'F2', notes: ['F3', 'A3', 'C4', 'E4'] },
    { root: 'C2', notes: ['C3', 'E3', 'G3', 'Bb3'] },
    // Section B (16..23): Sunlit Archipelago — emotional, lush, beautiful!
    { root: 'Bb1', notes: ['Bb3', 'D4', 'F4', 'A4'] },
    { root: 'C2', notes: ['C4', 'E4', 'G4', 'Bb4'] },
    { root: 'A1', notes: ['A3', 'C4', 'E4', 'G4'] },
    { root: 'D2', notes: ['D4', 'F4', 'A4', 'C5'] },
    { root: 'G1', notes: ['G3', 'Bb3', 'D4', 'F4'] },
    { root: 'C2', notes: ['C4', 'E4', 'G4', 'Bb4'] },
    { root: 'F2', notes: ['F3', 'A3', 'C4', 'E4'] },
    { root: 'F2', notes: ['F3', 'A3', 'C4', 'Eb4'] },      // F7 -> lift to Bb!
    // Section C (24..31): Ace Pilot Chorus — thrilling, joyful, heroic!
    { root: 'Bb1', notes: ['Bb3', 'D4', 'F4', 'A4'] },
    { root: 'C2', notes: ['C4', 'E4', 'G4', 'Bb4'] },
    { root: 'A1', notes: ['A3', 'C4', 'E4', 'G4'] },
    { root: 'D2', notes: ['D4', 'F4', 'A4', 'C5'] },
    { root: 'G1', notes: ['G3', 'Bb3', 'D4', 'F4'] },
    { root: 'A1', notes: ['A3', 'C4', 'E4', 'G4'] },
    { root: 'Bb1', notes: ['Bb3', 'D4', 'F4', 'A4'] },
    { root: 'C2', notes: ['C4', 'F4', 'G4', 'C5'] },       // Csus4 -> Fmaj7 turnaround!
  ];

  // 1. Driving Arcade Flight Rhythm Section
  for (let bar = 0; bar < 32; bar++) {
    const b0 = bar * 4;
    const ch = chords[bar];
    const r = midi(ch.root);
    const section = Math.floor(bar / 8);

    // Tight, pumping 8th/16th arcade shmup synth bass (OutRun / Sonic Wings pulse!)
    const bassSteps = section === 2
      ? [[0.0, r, 0.72, 98], [0.75, r, 0.22, 76], [1.0, r + 12, 0.42, 86], [1.5, r + 7, 0.42, 84], [2.0, r, 0.72, 96], [2.75, r + 7, 0.22, 80], [3.0, r + 12, 0.42, 88], [3.5, r + 7, 0.42, 84]]
      : [[0.0, r, 0.36, 102], [0.5, r, 0.32, 82], [1.0, r + 12, 0.34, 92], [1.5, r, 0.34, 84], [2.0, r, 0.36, 100], [2.5, r + 7, 0.34, 88], [3.0, r + 12, 0.34, 94], [3.5, r + 7, 0.34, 86]];
    for (const [off, p, d, v] of bassSteps) s.note(2, p, b0 + off, d, v);

    // Breezy electric piano ocean chords
    s.chord(3, ch.notes, b0 + 0.0, 1.35, 68);
    s.chord(3, ch.notes, b0 + 1.5, 0.90, 62);
    s.chord(3, ch.notes, b0 + 2.5, 1.35, 66);

    // Sparkling coastal guitar/kalimba arpeggio (keeps background airy & alive!)
    const arp = [ch.notes[0], ch.notes[1], ch.notes[2], ch.notes[3], ch.notes[2], ch.notes[1], ch.notes[3], ch.notes[2]];
    for (let e = 0; e < 8; e++) {
      if (section !== 0 || e % 2 === 0 || e === 7) {
        s.note(4, midi(arp[e]) + 12, b0 + e * 0.5, 0.36, e % 2 === 0 ? 64 : 52);
      }
    }

    // Lush warm sky strings in Section B & C
    if (section >= 2) {
      s.chord(5, ch.notes.map(n => midi(n) + 12), b0, 3.88, section === 2 ? 68 : 62);
    }

    // Driving sunlit shmup drum groove
    s.drum(36, b0 + 0.0, 108);
    s.drum(38, b0 + 1.0, 94);
    s.drum(36, b0 + 1.75, 76);
    s.drum(36, b0 + 2.0, 102);
    s.drum(38, b0 + 3.0, 98);
    if (section >= 1) s.drum(36, b0 + 3.5, 82);

    // Crisp ride/hi-hat shimmer + breezy coastal shaker
    for (let e = 0; e < 8; e++) {
      const hat = section === 3 ? 51 : (e === 7 && bar % 2 === 1 ? 46 : 42);
      s.drum(hat, b0 + e * 0.5, e % 2 === 0 ? 70 : 52);
      if (section === 2 && e % 2 === 1) s.drum(70, b0 + e * 0.5, 44); // Soft maraca/shaker in Archipelago section!
    }
    if (bar % 8 === 0) s.drum(49, b0, 88);
    if (bar % 8 === 7) {
      s.drum(48, b0 + 2.5, 84);
      s.drum(47, b0 + 2.75, 88);
      s.drum(45, b0 + 3.0, 92);
      s.drum(38, b0 + 3.25, 96);
      s.drum(38, b0 + 3.5, 100);
      s.drum(38, b0 + 3.75, 104);
    }
  }

  // 2. Hand-composed Aerodynamic Sky-Flight Melodies (breathing room so combat SFX shine!)
  const stageA = [
    // Bar 0 (Fmaj7): Soaring upward leap into blue skies!
    [0, 0.0, 'C5', 0.45, 96], [0, 0.5, 'F5', 0.45, 100], [0, 1.0, 'A5', 0.90, 106], [0, 2.0, 'G5', 0.45, 98], [0, 2.5, 'F5', 0.45, 96], [0, 3.0, 'A5', 0.85, 102],
    // Bar 1 (C/E): Graceful glide
    [1, 0.0, 'G5', 1.35, 102], [1, 1.5, 'E5', 0.45, 94], [1, 2.0, 'G5', 0.90, 100], [1, 3.0, 'C6', 0.85, 108],
    // Bar 2 (Dm7): Expressive heroic contour
    [2, 0.0, 'A5', 0.90, 104], [2, 1.0, 'F5', 0.45, 96], [2, 1.5, 'G5', 0.45, 98], [2, 2.0, 'A5', 0.90, 104], [2, 3.0, 'G5', 0.85, 98],
    // Bar 3 (C): Clean breath!
    [3, 0.0, 'E5', 1.75, 98], [3, 2.5, 'G5', 0.45, 96], [3, 3.0, 'A5', 0.45, 100], [3, 3.5, 'C6', 0.45, 104],

    // Bar 4 (Bbmaj7): Joyful sunlit lift
    [4, 0.0, 'D6', 0.90, 108], [4, 1.0, 'C6', 0.45, 102], [4, 1.5, 'Bb5', 0.45, 98], [4, 2.0, 'A5', 0.90, 102], [4, 3.0, 'F5', 0.85, 96],
    // Bar 5 (F/A)
    [5, 0.0, 'A5', 0.90, 104], [5, 1.0, 'G5', 0.45, 98], [5, 1.5, 'F5', 0.45, 96], [5, 2.0, 'C6', 1.65, 106],
    // Bar 6 (Gm7)
    [6, 0.0, 'Bb5', 0.45, 100], [6, 0.5, 'A5', 0.45, 98], [6, 1.0, 'G5', 0.90, 100], [6, 2.0, 'A5', 0.90, 102], [6, 3.0, 'Bb5', 0.85, 104],
    // Bar 7 (C9sus4)
    [7, 0.0, 'C6', 1.85, 108], [7, 2.5, 'G5', 0.45, 96], [7, 3.0, 'A5', 0.45, 100], [7, 3.5, 'Bb5', 0.45, 102],
  ];

  // Section A' (bars 8..15): Energetic variation peaking at F6!
  const stageA2 = [
    ...stageA.slice(0, 22).map(([bar, off, n, d, v]) => [bar + 8, off, n, d, Math.min(114, v + 4)]),
    [12, 0.0, 'D6', 0.90, 110], [12, 1.0, 'F6', 0.90, 114], [12, 2.0, 'E6', 0.45, 108], [12, 2.5, 'D6', 0.45, 106], [12, 3.0, 'C6', 0.85, 104],
    [13, 0.0, 'Bb5', 0.90, 104], [13, 1.0, 'C6', 0.45, 106], [13, 1.5, 'D6', 0.45, 108], [13, 2.0, 'E6', 1.65, 112],
    [14, 0.0, 'F6', 1.40, 116], [14, 1.5, 'E6', 0.45, 110], [14, 2.0, 'C6', 0.90, 106], [14, 3.0, 'A5', 0.85, 102],
    [15, 0.0, 'G5', 1.40, 102], [15, 2.0, 'A5', 0.45, 100], [15, 2.5, 'Bb5', 0.45, 102], [15, 3.0, 'C6', 0.85, 106],
  ];

  // Section B (bars 16..23): Beautiful emotional sky-gliding melody over sunlit islands!
  const stageB = [
    [16, 0.0, 'D6', 1.40, 108], [16, 1.5, 'C6', 0.45, 102], [16, 2.0, 'A5', 0.90, 100], [16, 3.0, 'F5', 0.85, 96],
    [17, 0.0, 'G5', 1.40, 102], [17, 1.5, 'A5', 0.45, 100], [17, 2.0, 'C6', 1.65, 108],
    [18, 0.0, 'E6', 1.40, 112], [18, 1.5, 'D6', 0.45, 106], [18, 2.0, 'C6', 0.90, 104], [18, 3.0, 'A5', 0.85, 100],
    [19, 0.0, 'D6', 2.40, 110], [19, 3.0, 'C6', 0.85, 104],
    [20, 0.0, 'Bb5', 0.90, 104], [20, 1.0, 'A5', 0.45, 100], [20, 1.5, 'G5', 0.45, 98], [20, 2.0, 'A5', 0.90, 102], [20, 3.0, 'Bb5', 0.85, 104],
    [21, 0.0, 'C6', 0.90, 106], [21, 1.0, 'D6', 0.90, 108], [21, 2.0, 'E6', 1.65, 112],
    [22, 0.0, 'F6', 1.85, 114], [22, 2.0, 'C6', 0.90, 104], [22, 3.0, 'A5', 0.85, 100],
    [23, 0.0, 'C6', 1.40, 106], [23, 1.5, 'Bb5', 0.45, 102], [23, 2.0, 'A5', 0.90, 102], [23, 3.0, 'G5', 0.45, 100], [23, 3.5, 'A5', 0.45, 104],
  ];

  // Section C (bars 24..31): Thrilling Ace Pilot Chorus — uplifting, energetic & joyful!
  const stageC = [
    [24, 0.0, 'D6', 0.45, 108], [24, 0.5, 'F6', 0.45, 114], [24, 1.0, 'D6', 0.90, 110], [24, 2.0, 'C6', 0.45, 106], [24, 2.5, 'Bb5', 0.45, 104], [24, 3.0, 'A5', 0.85, 104],
    [25, 0.0, 'G5', 0.45, 102], [25, 0.5, 'C6', 0.45, 106], [25, 1.0, 'E6', 0.90, 114], [25, 2.0, 'D6', 0.45, 108], [25, 2.5, 'C6', 0.45, 106], [25, 3.0, 'G5', 0.85, 102],
    [26, 0.0, 'A5', 0.45, 104], [26, 0.5, 'C6', 0.45, 108], [26, 1.0, 'E6', 0.90, 114], [26, 2.0, 'G6', 0.90, 118], [26, 3.0, 'E6', 0.85, 112],
    [27, 0.0, 'F6', 1.40, 116], [27, 1.5, 'E6', 0.45, 110], [27, 2.0, 'D6', 1.65, 112],
    [28, 0.0, 'Bb5', 0.45, 104], [28, 0.5, 'D6', 0.45, 108], [28, 1.0, 'F6', 0.90, 114], [28, 2.0, 'E6', 0.90, 112], [28, 3.0, 'D6', 0.85, 108],
    [29, 0.0, 'C6', 0.90, 108], [29, 1.0, 'E6', 0.90, 114], [29, 2.0, 'G6', 0.90, 118], [29, 3.0, 'E6', 0.85, 112],
    [30, 0.0, 'F6', 1.40, 116], [30, 1.5, 'D6', 0.45, 110], [30, 2.0, 'Bb5', 0.90, 106], [30, 3.0, 'D6', 0.85, 110],
    [31, 0.0, 'C6', 1.85, 114], [31, 2.5, 'G5', 0.45, 100], [31, 3.0, 'A5', 0.45, 104], [31, 3.5, 'Bb5', 0.45, 106],
  ];

  const allStageMel = [...stageA, ...stageA2, ...stageB, ...stageC];
  for (const [bar, off, noteName, dur, vel] of allStageMel) {
    const t = bar * 4 + off;
    s.note(0, noteName, t, dur, vel);
    // Warm heroic brass unison an octave below in A' and C for rich sky-adventure power!
    if (bar >= 8 && (bar < 16 || bar >= 24)) {
      s.note(1, midi(noteName) - 12, t, dur * 0.90, vel * 0.72);
    }
  }

  return s;
}

renderTrack('menu', composeMenuTheme(), { psgGain: 0.16, targetLufs: -14.0, highCutHz: 14500 });
// Keep select.ogg identical so any legacy/direct reference plays the exact same joyful menu theme!
copyFileSync(join(OUT_DIR, 'menu.ogg'), join(OUT_DIR, 'select.ogg'));
renderTrack('stage1', composeStage1Theme(), { psgGain: 0.0, targetLufs: -15.0, highCutHz: 12000 });
console.log('Soundtrack v2 complete!');
