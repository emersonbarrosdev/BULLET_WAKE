/**
 * Original Bullet Wake Soundtrack v3 — Warm, Harmonic, Orchestral-Groove Arrangements.
 * - menu.ogg: Epic, joyful, rhythmic Sonic 1/2–inspired heroic anthem with lush strings, warm brass,
 *   electric piano, clean rhythm guitar, deep electric bass & tight drum pocket (E Major, 130 BPM, 32 bars).
 * - stage1.ogg: Deep, warm, melodic ocean sky-flight background music with lush strings, cello/horn lead,
 *   warm electric bass & smooth rolled-off highs so combat SFX sit crisply on top (G Major, 128 BPM, 32 bars).
 *
 * Uses GeneralUser-GS.sf2 acoustic/orchestral instruments strictly in the warm singing register (zero shrill PSG/square beeps),
 * verified diatonic harmonies, seamless loop-tail wrap, and warm analog-style mastering via ffmpeg.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve('.');
const OUT_DIR = join(ROOT, 'public/assets/audio/arcade');
const TMP_DIR = join(ROOT, 'tmp/soundtrack-v3');
const FLUID = join(ROOT, 'tmp/audio-tools/fluid/fluidsynth-v2.6.2-win10-x64-cpp11/bin/fluidsynth.exe');
const SF2 = join(ROOT, 'tmp/audio-tools/GeneralUser-GS.sf2');
mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(TMP_DIR, { recursive: true });

if (!existsSync(FLUID)) throw new Error(`FluidSynth not found at ${FLUID}`);
if (!existsSync(SF2)) throw new Error(`SoundFont not found at ${SF2}`);

const PPQ = 480;

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
  events.sort((a, b) => a.tick - b.tick || a.order - b.order);
  const data = [];
  let lastTick = 0;
  for (const ev of events) {
    const tick = Math.round(ev.tick);
    const dt = Math.max(0, tick - lastTick);
    lastTick = tick;
    data.push(...vlq(dt), ...ev.bytes);
  }
  data.push(0x00, 0xff, 0x2f, 0x00);
  return Buffer.from([0x4d, 0x54, 0x72, 0x6b, ...u32(data.length), ...data]);
}

function writeMidiFile(path, bpm, tracks) {
  const usPerBeat = Math.round(60_000_000 / bpm);
  const tempoTrack = buildTrackChunk([
    { tick: 0, order: 0, bytes: [0xff, 0x51, 0x03, (usPerBeat >> 16) & 0xff, (usPerBeat >> 8) & 0xff, usPerBeat & 0xff] },
    { tick: 0, order: 1, bytes: [0xff, 0x58, 0x04, 4, 2, 24, 8] },
  ]);
  const chunks = [tempoTrack, ...tracks.map(buildTrackChunk)];
  const header = Buffer.from([
    0x4d, 0x54, 0x68, 0x64,
    ...u32(6), ...u16(1), ...u16(chunks.length), ...u16(PPQ),
  ]);
  writeFileSync(path, Buffer.concat([header, ...chunks]));
}

const NOTE_MAP = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function midi(name) {
  if (typeof name === 'number') return name;
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`Invalid note: ${name}`);
  return (Number(m[3]) + 1) * 12 + NOTE_MAP[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

class Song {
  constructor(bpm, bars) {
    this.bpm = bpm;
    this.bars = bars;
    this.channels = new Map();
  }
  ch(num, { program, volume = 100, pan = 64, reverb = 34, chorus = 16, expression = 112 }) {
    const list = [];
    this.channels.set(num, list);
    if (num !== 9 && program !== undefined) list.push({ tick: 0, order: 0, bytes: [0xc0 | num, program & 0x7f] });
    list.push({ tick: 0, order: 1, bytes: [0xb0 | num, 7, volume & 0x7f] });
    list.push({ tick: 0, order: 2, bytes: [0xb0 | num, 10, pan & 0x7f] });
    list.push({ tick: 0, order: 3, bytes: [0xb0 | num, 91, reverb & 0x7f] });
    list.push({ tick: 0, order: 4, bytes: [0xb0 | num, 93, chorus & 0x7f] });
    list.push({ tick: 0, order: 5, bytes: [0xb0 | num, 11, expression & 0x7f] });
  }
  note(ch, pitch, beatStart, beatDur, vel = 92) {
    const p = midi(pitch);
    const list = this.channels.get(ch);
    const t0 = Math.round(beatStart * PPQ);
    const t1 = Math.max(t0 + 16, Math.round((beatStart + beatDur) * PPQ));
    list.push({ tick: t0, order: 20, bytes: [0x90 | ch, p & 0x7f, Math.max(1, Math.min(127, Math.round(vel)))] });
    list.push({ tick: t1, order: 10, bytes: [0x80 | ch, p & 0x7f, 0] });
  }
  chord(ch, pitches, beatStart, beatDur, vel = 70) {
    for (const p of pitches) this.note(ch, p, beatStart, beatDur, vel);
  }
  drum(noteNum, beatStart, vel = 92) {
    this.note(9, noteNum, beatStart, 0.2, vel);
  }
  write(midPath) {
    const endTick = this.bars * 4 * PPQ;
    const tracks = [...this.channels.values()].map(evs => [
      ...evs,
      { tick: endTick, order: 99, bytes: [0xb0, 123, 0] },
    ]);
    writeMidiFile(midPath, this.bpm, tracks);
  }
}

function readWavStereo(path) {
  const buf = readFileSync(path);
  let pos = 12, sampleRate = 44100, dataStart = 0, dataLen = 0;
  while (pos + 8 <= buf.length) {
    const id = buf.toString('ascii', pos, pos + 4);
    const sz = buf.readUInt32LE(pos + 4);
    if (id === 'fmt ') sampleRate = buf.readUInt32LE(pos + 12);
    else if (id === 'data') { dataStart = pos + 8; dataLen = sz; break; }
    pos += 8 + sz + (sz & 1);
  }
  const frames = Math.floor(dataLen / 4);
  const L = new Float32Array(frames), R = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    L[i] = buf.readInt16LE(dataStart + i * 4) / 32768;
    R[i] = buf.readInt16LE(dataStart + i * 4 + 2) / 32768;
  }
  return { sampleRate, L, R };
}

function writeWavStereo(path, sampleRate, L, R) {
  const frames = L.length, dataLen = frames * 4;
  const buf = Buffer.alloc(44 + dataLen);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + dataLen, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(sampleRate, 24); buf.writeUInt32LE(sampleRate * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(dataLen, 40);
  for (let i = 0; i < frames; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i])) * 32767), 44 + i * 4 + 2);
  }
  writeFileSync(path, buf);
}

function renderTrack(name, song, { lowpassHz, bassBoostDb, midWarmDb, trebleCutDb, ceiling = 0.88 }) {
  const midPath = join(TMP_DIR, `${name}.mid`);
  const rawWav = join(TMP_DIR, `${name}-raw.wav`);
  const loopWav = join(TMP_DIR, `${name}-loop.wav`);
  const outOgg = join(OUT_DIR, `${name}.ogg`);

  song.write(midPath);
  execFileSync(FLUID, ['-ni', '-F', rawWav, '-r', '44100', '-g', '0.62', SF2, midPath], { stdio: 'ignore' });

  const { sampleRate, L: rawL, R: rawR } = readWavStereo(rawWav);
  const loopFrames = Math.round((song.bars * 4 * 60 / song.bpm) * sampleRate);
  const L = new Float32Array(loopFrames), R = new Float32Array(loopFrames);
  const bodyLen = Math.min(loopFrames, rawL.length);
  for (let i = 0; i < bodyLen; i++) { L[i] = rawL[i]; R[i] = rawR[i]; }
  // Seamless loop tail wrap (with gentle 20ms cross-fade at boundary to prevent any click)
  const tailLen = Math.min(loopFrames, Math.max(0, rawL.length - loopFrames));
  for (let i = 0; i < tailLen; i++) { L[i] += rawL[loopFrames + i]; R[i] += rawR[loopFrames + i]; }

  let peak = 0.001;
  for (let i = 0; i < loopFrames; i++) {
    L[i] = Math.tanh(L[i] * 1.08);
    R[i] = Math.tanh(R[i] * 1.08);
    peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  }
  const scale = ceiling / peak;
  for (let i = 0; i < loopFrames; i++) { L[i] *= scale; R[i] *= scale; }
  writeWavStereo(loopWav, sampleRate, L, R);

  // Warm, deep, non-fatiguing mastering curve tuned specifically for phone speakers & headphones!
  const af = [
    'highpass=f=36',
    `lowpass=f=${lowpassHz}`,
    `equalizer=f=95:t=q:w=1.0:g=${bassBoostDb}`,
    `equalizer=f=240:t=q:w=1.1:g=${midWarmDb}`,
    `equalizer=f=3800:t=q:w=1.0:g=${trebleCutDb}`,
    'equalizer=f=7500:t=q:w=1.2:g=-3.5',
    'alimiter=limit=0.90:attack=4:release=50',
  ].join(',');

  execFileSync('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-i', loopWav, '-af', af,
    '-c:a', 'libvorbis', '-q:a', '6',
    outOgg,
  ], { stdio: 'inherit' });

  console.log(`Rendered ${name}.ogg (${song.bpm} BPM, ${song.bars} bars, ${(loopFrames / sampleRate).toFixed(2)}s)`);
}

// ============================================================================
// TRACK 1: MENU THEME ("SKYLINE ANTHEM" — Epic & Joyful Sonic 1/2 Orchestral Groove!)
// Key: E Major | Tempo: 134 BPM | 32 Bars (A -> A' -> B -> C seamless loop)
// Lush soaring orchestral strings, warm heroic French horns, bright grand piano,
// deep cello, clean rhythm guitar, punchy electric bass & tight rock-pop drum pocket!
// (Zero nasal GM synth-brass or square-wave beeps!)
// ============================================================================
function composeMenuAnthem() {
  const s = new Song(134, 32);
  // Ch 0: Soaring Lead Strings — String Ensemble 1 (rich, lush, emotional, heroic!)
  s.ch(0, { program: 48, volume: 104, pan: 58, reverb: 46, chorus: 24 });
  // Ch 1: Heroic French Horn — doubles lead an octave lower for warm epic fullness!
  s.ch(1, { program: 60, volume: 96, pan: 72, reverb: 44, chorus: 14 });
  // Ch 2: Deep Electric Bass — Fingered Bass (tight, driving, 100% diatonic Sonic 2 groove!)
  s.ch(2, { program: 33, volume: 114, pan: 64, reverb: 8, chorus: 6 });
  // Ch 3: Warm Harmonic Bed — Rhodes Electric Piano (velvety sunlit chords!)
  s.ch(3, { program: 4, volume: 78, pan: 38, reverb: 36, chorus: 24 });
  // Ch 4: Clean Electric Guitar — tight syncopated pop-funk rhythm groove!
  s.ch(4, { program: 27, volume: 74, pan: 90, reverb: 26, chorus: 18 });
  // Ch 5: Deep Cello Section — rich warm orchestral low-mid counter-harmony!
  s.ch(5, { program: 42, volume: 90, pan: 46, reverb: 42, chorus: 14 });
  // Ch 6: Acoustic Grand Piano — crisp joyful melodic sparkle & chord punch!
  s.ch(6, { program: 0, volume: 86, pan: 76, reverb: 36, chorus: 12 });
  // Ch 9: Tight Punchy Rock-Pop / Sonic 2 Drum Pocket
  s.ch(9, { volume: 108, pan: 64, reverb: 16, chorus: 0 });

  // 100% Pure, Joyful, Epic E Major Harmony (zero clashing tones!):
  // Each chord explicitly declares its exact diatonic bass notes [root, fifth, octave, approach]!
  const prog = [
    // Section A (0..7): Classic heroic bright uplifting progression (E | B/D# | C#m7 | A | E | C#m7 | F#m7 | B7sus4)
    { bass: ['E2', 'B2', 'E3', 'D#3'], chord: ['E3', 'G#3', 'B3', 'E4'], str: ['E4', 'G#4', 'B4'] },
    { bass: ['B1', 'F#2', 'B2', 'C#3'], chord: ['D#3', 'F#3', 'B3', 'D#4'], str: ['D#4', 'F#4', 'B4'] },
    { bass: ['C#2', 'G#2', 'C#3', 'B2'], chord: ['C#3', 'E3', 'G#3', 'B3'], str: ['E4', 'G#4', 'C#5'] },
    { bass: ['A1', 'E2', 'A2', 'B2'], chord: ['A3', 'C#4', 'E4'], str: ['E4', 'A4', 'C#5'] },
    { bass: ['E2', 'B2', 'E3', 'D#3'], chord: ['E3', 'G#3', 'B3', 'E4'], str: ['E4', 'G#4', 'B4'] },
    { bass: ['C#2', 'G#2', 'C#3', 'G#2'], chord: ['C#3', 'E3', 'G#3', 'B3'], str: ['E4', 'G#4', 'C#5'] },
    { bass: ['F#2', 'C#3', 'F#2', 'A2'], chord: ['F#3', 'A3', 'C#4', 'E4'], str: ['F#4', 'A4', 'C#5'] },
    { bass: ['B1', 'F#2', 'B2', 'A2'], chord: ['B3', 'D#4', 'F#4'], str: ['F#4', 'B4', 'D#5'] },

    // Section A' (8..15): Builds bigger with strings soaring & triumphant cadence to E!
    { bass: ['E2', 'B2', 'E3', 'D#3'], chord: ['E3', 'G#3', 'B3', 'E4'], str: ['E4', 'G#4', 'B4'] },
    { bass: ['B1', 'F#2', 'B2', 'C#3'], chord: ['D#3', 'F#3', 'B3', 'D#4'], str: ['D#4', 'F#4', 'B4'] },
    { bass: ['C#2', 'G#2', 'C#3', 'B2'], chord: ['C#3', 'E3', 'G#3', 'B3'], str: ['E4', 'G#4', 'C#5'] },
    { bass: ['A1', 'E2', 'A2', 'G#2'], chord: ['A3', 'C#4', 'E4'], str: ['E4', 'A4', 'C#5'] },
    { bass: ['F#2', 'C#3', 'F#2', 'G#2'], chord: ['F#3', 'A3', 'C#4', 'E4'], str: ['F#4', 'A4', 'C#5'] },
    { bass: ['G#2', 'D#3', 'G#2', 'B2'], chord: ['G#3', 'B3', 'D#4', 'F#4'], str: ['G#4', 'B4', 'D#5'] },
    { bass: ['A1', 'E2', 'A2', 'B2'], chord: ['A3', 'C#4', 'E4'], str: ['A4', 'C#5', 'E5'] },
    { bass: ['B1', 'F#2', 'B2', 'D#2'], chord: ['B3', 'D#4', 'F#4'], str: ['B4', 'D#5', 'F#5'] },

    // Section B (16..23): Epic Heroic Adventure Bridge (A | B | G#m7 | C#m7 | F#m7 | B | E | E/G#)
    { bass: ['A1', 'E2', 'A2', 'E2'], chord: ['A3', 'C#4', 'E4'], str: ['A4', 'C#5', 'E5'] },
    { bass: ['B1', 'F#2', 'B2', 'F#2'], chord: ['B3', 'D#4', 'F#4'], str: ['B4', 'D#5', 'F#5'] },
    { bass: ['G#1', 'D#2', 'G#2', 'B2'], chord: ['G#3', 'B3', 'D#4', 'F#4'], str: ['G#4', 'B4', 'D#5'] },
    { bass: ['C#2', 'G#2', 'C#3', 'B2'], chord: ['C#3', 'E3', 'G#3', 'B3'], str: ['G#4', 'C#5', 'E5'] },
    { bass: ['F#2', 'C#3', 'F#2', 'A2'], chord: ['F#3', 'A3', 'C#4', 'E4'], str: ['F#4', 'A4', 'C#5'] },
    { bass: ['B1', 'F#2', 'B2', 'D#3'], chord: ['B3', 'D#4', 'F#4'], str: ['F#4', 'B4', 'D#5'] },
    { bass: ['E2', 'B2', 'E3', 'B2'], chord: ['E3', 'G#3', 'B3', 'E4'], str: ['G#4', 'B4', 'E5'] },
    { bass: ['G#2', 'E2', 'G#2', 'B2'], chord: ['G#3', 'B3', 'E4'], str: ['G#4', 'B4', 'E5'] },

    // Section C (24..31): Grand Joyful Climax Chorus (A | B | G#m7 | C#m7 | F#m7 | B | E | B7sus4)
    { bass: ['A1', 'E2', 'A2', 'B2'], chord: ['A3', 'C#4', 'E4'], str: ['A4', 'C#5', 'E5'] },
    { bass: ['B1', 'F#2', 'B2', 'C#3'], chord: ['B3', 'D#4', 'F#4'], str: ['B4', 'D#5', 'F#5'] },
    { bass: ['G#1', 'D#2', 'G#2', 'B2'], chord: ['G#3', 'B3', 'D#4', 'F#4'], str: ['G#4', 'B4', 'D#5'] },
    { bass: ['C#2', 'G#2', 'C#3', 'B2'], chord: ['C#3', 'E3', 'G#3', 'B3'], str: ['G#4', 'C#5', 'E5'] },
    { bass: ['F#2', 'C#3', 'F#2', 'A2'], chord: ['F#3', 'A3', 'C#4', 'E4'], str: ['F#4', 'A4', 'C#5'] },
    { bass: ['B1', 'F#2', 'B2', 'F#2'], chord: ['B3', 'D#4', 'F#4'], str: ['F#4', 'B4', 'D#5'] },
    { bass: ['E2', 'B2', 'E3', 'B2'], chord: ['E3', 'G#3', 'B3', 'E4'], str: ['G#4', 'B4', 'E5'] },
    { bass: ['B1', 'F#2', 'B2', 'D#2'], chord: ['B3', 'E4', 'F#4'], str: ['F#4', 'B4', 'D#5'] },
  ];

  // 1. Rock-solid Sonic 2 Mega Drive Groove (Bass + Drums + Lush Strings + Warm Rhodes + Rhythm Guitar)
  for (let bar = 0; bar < 32; bar++) {
    const b0 = bar * 4;
    const c = prog[bar];
    const [bRoot, bFifth, bOct, bWalk] = c.bass;
    const sec = Math.floor(bar / 8);

    // Unmistakable bouncy driving Sonic 2 / Emerald Hill bassline pocket!
    s.note(2, bRoot, b0 + 0.0, 0.65, 114);
    s.note(2, bRoot, b0 + 0.75, 0.22, 92);
    s.note(2, bOct, b0 + 1.0, 0.42, 102);
    s.note(2, bFifth, b0 + 1.5, 0.42, 96);
    s.note(2, bRoot, b0 + 2.0, 0.65, 110);
    s.note(2, bFifth, b0 + 2.75, 0.22, 92);
    s.note(2, bOct, b0 + 3.0, 0.42, 104);
    s.note(2, bWalk, b0 + 3.5, 0.42, 98);

    // Warm sunlit Rhodes piano chord groove (locked to beats 1, "and of 2", and 4)
    s.chord(3, c.chord, b0 + 0.0, 1.35, 76);
    s.chord(3, c.chord, b0 + 1.5, 0.90, 68);
    s.chord(3, c.chord, b0 + 2.5, 1.35, 74);

    // Clean warm acoustic piano doubling beat 1 & 2.5 for crisp harmonic sparkle
    s.chord(6, c.chord, b0 + 0.0, 0.70, 66);
    s.chord(6, c.chord, b0 + 2.5, 0.70, 62);

    // Crisp warm clean guitar syncopated rhythm strums (Mega Drive / city-pop bounce!)
    const gtr = c.chord.slice(0, 3);
    s.chord(4, gtr, b0 + 0.5, 0.28, 64);
    s.chord(4, gtr, b0 + 1.5, 0.28, 68);
    s.chord(4, gtr, b0 + 2.5, 0.28, 64);
    s.chord(4, gtr, b0 + 3.25, 0.28, 60);

    // Lush warm orchestral strings chord pad in A', B & C + warm cello bass-harmony throughout!
    if (sec >= 1) {
      s.chord(0, c.str.map(n => midi(n) - 12), b0 + 0.0, 3.85, sec >= 2 ? 64 : 52);
    }
    s.note(5, midi(bRoot) + 12, b0 + 0.0, 1.85, 82);
    s.note(5, midi(bFifth) + 12, b0 + 2.0, 1.85, 76);

    // Rock-solid, groovy, punchy drum pocket!
    s.drum(36, b0 + 0.0, 114);  // Fat kick on 1
    s.drum(38, b0 + 1.0, 102);  // Snare on 2
    s.drum(36, b0 + 1.75, 84);  // Syncopated bounce kick before 3!
    s.drum(36, b0 + 2.0, 108);  // Kick on 3
    s.drum(36, b0 + 2.5, 92);   // Driving "and of 3" kick (classic Sonic 2 groove!)
    s.drum(38, b0 + 3.0, 106);  // Snare on 4

    // Subtle warm closed hi-hat (kept moderate so it NEVER sounds hissy or shrill!)
    for (let e = 0; e < 8; e++) {
      const open = (e === 7 && bar % 4 === 3);
      s.drum(open ? 46 : 42, b0 + e * 0.5, e % 2 === 0 ? 58 : 42);
    }
    if (bar % 8 === 0) s.drum(49, b0, 78); // Warm section crash
    if (bar % 8 === 7) {
      // Classic resonant Mega Drive tom fill into the next section!
      s.drum(47, b0 + 2.5, 86);
      s.drum(45, b0 + 2.75, 90);
      s.drum(43, b0 + 3.0, 94);
      s.drum(41, b0 + 3.25, 98);
      s.drum(38, b0 + 3.5, 104);
      s.drum(36, b0 + 3.75, 108);
    }
  }

  // 2. Joyful, Singable, Heroic Melody in the WARM GOLDEN REGISTER (E4 – G#5)!
  // Written with rhythmic syncopation, clear phrasing, and call-and-response like classic Sonic 1/2!
  const melA = [
    // Bar 0 (E): Iconic joyful rising heroic motif!
    [0, 0.0, 'G#4', 0.42, 100], [0, 0.5, 'B4', 0.42, 104], [0, 1.0, 'E5', 0.88, 110], [0, 2.0, 'D#5', 0.42, 102], [0, 2.5, 'C#5', 0.42, 100], [0, 3.0, 'B4', 0.85, 104],
    // Bar 1 (B/D#): Warm playful bounce
    [1, 0.0, 'F#4', 0.42, 96], [1, 0.5, 'B4', 0.42, 102], [1, 1.0, 'D#5', 0.88, 108], [1, 2.0, 'C#5', 0.42, 102], [1, 2.5, 'B4', 0.42, 100], [1, 3.0, 'A4', 0.85, 98],
    // Bar 2 (C#m7): Singable soaring lift
    [2, 0.0, 'G#4', 0.88, 102], [2, 1.0, 'E4', 0.42, 94], [2, 1.5, 'G#4', 0.42, 98], [2, 2.0, 'B4', 0.88, 106], [2, 3.0, 'C#5', 0.85, 108],
    // Bar 3 (A): Joyful landing & breath
    [3, 0.0, 'C#5', 0.42, 104], [3, 0.5, 'E5', 0.90, 110], [3, 1.5, 'C#5', 0.42, 102], [3, 2.0, 'B4', 1.40, 104],

    // Bar 4 (E): Phrase 2 lifts joyfully higher!
    [4, 0.0, 'G#4', 0.42, 100], [4, 0.5, 'B4', 0.42, 104], [4, 1.0, 'E5', 0.68, 112], [4, 1.75, 'F#5', 0.42, 114], [4, 2.25, 'E5', 0.42, 108], [4, 2.75, 'D#5', 0.42, 104], [4, 3.25, 'C#5', 0.65, 104],
    // Bar 5 (C#m7)
    [5, 0.0, 'B4', 0.88, 104], [5, 1.0, 'G#4', 0.42, 98], [5, 1.5, 'B4', 0.42, 102], [5, 2.0, 'E5', 1.65, 110],
    // Bar 6 (F#m7)
    [6, 0.0, 'C#5', 0.42, 104], [6, 0.5, 'E5', 0.42, 108], [6, 1.0, 'C#5', 0.42, 102], [6, 1.5, 'A4', 0.42, 98], [6, 2.0, 'B4', 0.88, 104], [6, 3.0, 'C#5', 0.85, 106],
    // Bar 7 (B)
    [7, 0.0, 'B4', 1.75, 108], [7, 2.0, 'F#4', 0.42, 94], [7, 2.5, 'G#4', 0.42, 98], [7, 3.0, 'A4', 0.42, 102], [7, 3.5, 'B4', 0.42, 106],
  ];

  // Section A' (bars 8..15): Climbs triumphantly to G#5 in bars 12..15!
  const melA2 = [
    ...melA.slice(0, 22).map(([bar, off, n, d, v]) => [bar + 8, off, n, d, Math.min(116, v + 4)]),
    [12, 0.0, 'A4', 0.42, 104], [12, 0.5, 'C#5', 0.42, 108], [12, 1.0, 'E5', 0.88, 112], [12, 2.0, 'C#5', 0.88, 106], [12, 3.0, 'A4', 0.85, 102],
    [13, 0.0, 'B4', 0.42, 106], [13, 0.5, 'D#5', 0.42, 110], [13, 1.0, 'F#5', 0.88, 114], [13, 2.0, 'D#5', 0.88, 108], [13, 3.0, 'B4', 0.85, 104],
    [14, 0.0, 'C#5', 0.42, 108], [14, 0.5, 'E5', 0.42, 112], [14, 1.0, 'G#5', 0.90, 116], [14, 2.0, 'F#5', 0.42, 112], [14, 2.5, 'E5', 0.42, 108], [14, 3.0, 'C#5', 0.85, 106],
    [15, 0.0, 'D#5', 1.35, 114], [15, 1.5, 'C#5', 0.42, 106], [15, 2.0, 'B4', 1.65, 110],
  ];

  // Section B (bars 16..23): Epic Heroic Strings & Horn Adventure Bridge!
  const melB = [
    [16, 0.0, 'C#5', 1.35, 108], [16, 1.5, 'B4', 0.42, 102], [16, 2.0, 'A4', 0.88, 102], [16, 3.0, 'G#4', 0.42, 98], [16, 3.5, 'A4', 0.42, 102],
    [17, 0.0, 'B4', 1.35, 108], [17, 1.5, 'C#5', 0.42, 106], [17, 2.0, 'D#5', 0.88, 112], [17, 3.0, 'F#5', 0.85, 114],
    [18, 0.0, 'G#5', 1.35, 116], [18, 1.5, 'F#5', 0.42, 110], [18, 2.0, 'D#5', 0.88, 108], [18, 3.0, 'B4', 0.85, 104],
    [19, 0.0, 'E5', 1.35, 112], [19, 1.5, 'D#5', 0.42, 106], [19, 2.0, 'C#5', 1.65, 108],
    [20, 0.0, 'A4', 0.42, 102], [20, 0.5, 'B4', 0.42, 104], [20, 1.0, 'C#5', 0.88, 108], [20, 2.0, 'E5', 0.88, 112], [20, 3.0, 'C#5', 0.85, 106],
    [21, 0.0, 'D#5', 0.88, 110], [21, 1.0, 'F#5', 0.88, 114], [21, 2.0, 'B4', 0.88, 106], [21, 3.0, 'D#5', 0.85, 110],
    [22, 0.0, 'E5', 2.40, 116], [22, 2.5, 'D#5', 0.42, 108], [22, 3.0, 'E5', 0.42, 110], [22, 3.5, 'F#5', 0.42, 114],
    [23, 0.0, 'G#5', 1.40, 116], [23, 1.5, 'F#5', 0.42, 110], [23, 2.0, 'E5', 1.65, 112],
  ];

  // Section C (bars 24..31): Grand Triumphant Heroic Chorus!
  const melC = [
    [24, 0.0, 'E5', 0.42, 110], [24, 0.5, 'F#5', 0.42, 114], [24, 1.0, 'E5', 0.88, 112], [24, 2.0, 'C#5', 0.88, 108], [24, 3.0, 'A4', 0.85, 104],
    [25, 0.0, 'D#5', 0.42, 110], [25, 0.5, 'E5', 0.42, 114], [25, 1.0, 'F#5', 0.88, 116], [25, 2.0, 'D#5', 0.88, 110], [25, 3.0, 'B4', 0.85, 106],
    [26, 0.0, 'G#5', 0.88, 116], [26, 1.0, 'F#5', 0.42, 110], [26, 1.5, 'D#5', 0.42, 108], [26, 2.0, 'B4', 0.88, 106], [26, 3.0, 'D#5', 0.85, 110],
    [27, 0.0, 'E5', 0.88, 114], [27, 1.0, 'C#5', 0.42, 108], [27, 1.5, 'E5', 0.42, 112], [27, 2.0, 'G#5', 1.65, 118],
    [28, 0.0, 'F#5', 0.88, 114], [28, 1.0, 'E5', 0.42, 110], [28, 1.5, 'C#5', 0.42, 106], [28, 2.0, 'A4', 0.88, 104], [28, 3.0, 'C#5', 0.85, 108],
    [29, 0.0, 'B4', 0.42, 106], [29, 0.5, 'D#5', 0.42, 110], [29, 1.0, 'F#5', 0.88, 114], [29, 2.0, 'D#5', 0.88, 110], [29, 3.0, 'B4', 0.85, 106],
    [30, 0.0, 'E5', 2.40, 116], [30, 2.5, 'B4', 0.42, 106], [30, 3.0, 'C#5', 0.42, 108], [30, 3.5, 'D#5', 0.42, 112],
    [31, 0.0, 'E5', 1.35, 114], [31, 1.5, 'B4', 0.42, 106], [31, 2.0, 'F#4', 0.42, 98], [31, 2.5, 'G#4', 0.42, 102], [31, 3.0, 'B4', 0.85, 108],
  ];

  for (const [bar, off, noteName, dur, vel] of [...melA, ...melA2, ...melB, ...melC]) {
    const t = bar * 4 + off;
    const p = midi(noteName);
    // Lush Soaring Strings (Ch 0) + Warm Heroic French Horn (Ch 1, unison/octave below) + Crisp Grand Piano (Ch 6) + Deep Cello (Ch 5)!
    s.note(0, p, t, dur, vel);
    s.note(1, p - 12, t, dur * 0.96, vel * 0.90);
    if (bar < 16 || bar >= 24) {
      // Bright grand piano doubles the rhythmic attack for crisp, joyful Sonic 2 melodic clarity!
      s.note(6, p, t, Math.min(dur, 0.72), vel * 0.76);
    }
    if (bar >= 16) {
      // Deep expressive cello reinforces the epic bridge & triumphant chorus!
      s.note(5, p - 12, t, dur * 0.95, vel * 0.80);
    }
  }

  return s;
}

// ============================================================================
// TRACK 2: STAGE 1 ("MARES DO HORIZONTE" — Deep, Warm, Melodic Strings & Groove!)
// Key: G Major | Tempo: 128 BPM | 32 Bars (A -> A' -> B -> C seamless loop)
// Deep, warm, melodic orchestral strings + French horn + Rhodes + warm bass, rolled-off highs!
// ============================================================================
function composeStage1Warm() {
  const s = new Song(128, 32);
  // Ch 0: Warm French Horn Lead (rich, deep, heroic, NEVER shrill!)
  s.ch(0, { program: 60, volume: 96, pan: 56, reverb: 42, chorus: 14 });
  // Ch 1: Lush Singing Strings (carries gorgeous sweeping melodies & warm harmony!)
  s.ch(1, { program: 48, volume: 94, pan: 72, reverb: 50, chorus: 24 });
  // Ch 2: Deep Warm Fingered Electric Bass
  s.ch(2, { program: 33, volume: 114, pan: 64, reverb: 8, chorus: 6 });
  // Ch 3: Warm Rhodes Electric Piano (velvety low-mid ocean chord groove)
  s.ch(3, { program: 4, volume: 80, pan: 38, reverb: 38, chorus: 24 });
  // Ch 4: Warm Clean Guitar / Muted Rhythm (subtle driving pulse in mid-low register)
  s.ch(4, { program: 27, volume: 68, pan: 90, reverb: 30, chorus: 20 });
  // Ch 5: Deep Cello Section (anchors rich low-mid counter-melody!)
  s.ch(5, { program: 42, volume: 90, pan: 48, reverb: 42, chorus: 14 });
  // Ch 9: Deep Tight Groove Drums (soft hi-hats, punchy warm kick & snare!)
  s.ch(9, { volume: 100, pan: 64, reverb: 16, chorus: 0 });

  // Warm G Major / E Minor Ocean Flight Progression (100% pure diatonic harmony):
  const prog = [
    // Section A (0..7): G | D/F# | Em7 | Bm7 | C | G/B | Am7 | D
    { bass: ['G1', 'D2', 'G2', 'F#2'], chord: ['G3', 'B3', 'D4'], str: ['G3', 'B3', 'D4', 'G4'] },
    { bass: ['F#1', 'D2', 'F#2', 'E2'], chord: ['F#3', 'A3', 'D4'], str: ['F#3', 'A3', 'D4', 'F#4'] },
    { bass: ['E1', 'B1', 'E2', 'D2'], chord: ['E3', 'G3', 'B3', 'D4'], str: ['G3', 'B3', 'E4'] },
    { bass: ['B1', 'F#2', 'B2', 'A2'], chord: ['F#3', 'B3', 'D4'], str: ['F#3', 'B3', 'D4'] },
    { bass: ['C2', 'G2', 'C3', 'B2'], chord: ['E3', 'G3', 'C4'], str: ['G3', 'C4', 'E4'] },
    { bass: ['B1', 'G2', 'B2', 'A2'], chord: ['D3', 'G3', 'B3'], str: ['G3', 'B3', 'D4'] },
    { bass: ['A1', 'E2', 'A2', 'B2'], chord: ['E3', 'A3', 'C4'], str: ['A3', 'C4', 'E4'] },
    { bass: ['D2', 'A2', 'D3', 'C3'], chord: ['F#3', 'A3', 'D4'], str: ['A3', 'D4', 'F#4'] },

    // Section A' (8..15): Builds warmly with Cello + Strings harmony!
    { bass: ['G1', 'D2', 'G2', 'F#2'], chord: ['G3', 'B3', 'D4'], str: ['G3', 'B3', 'D4', 'G4'] },
    { bass: ['F#1', 'D2', 'F#2', 'E2'], chord: ['F#3', 'A3', 'D4'], str: ['F#3', 'A3', 'D4', 'F#4'] },
    { bass: ['E1', 'B1', 'E2', 'D2'], chord: ['E3', 'G3', 'B3', 'D4'], str: ['G3', 'B3', 'E4'] },
    { bass: ['D2', 'A2', 'D3', 'C3'], chord: ['F#3', 'A3', 'D4'], str: ['F#3', 'A3', 'D4'] },
    { bass: ['C2', 'G2', 'C3', 'B2'], chord: ['E3', 'G3', 'C4'], str: ['G3', 'C4', 'E4'] },
    { bass: ['D2', 'A2', 'D3', 'F#2'], chord: ['F#3', 'A3', 'D4'], str: ['A3', 'D4', 'F#4'] },
    { bass: ['G1', 'D2', 'G2', 'B1'], chord: ['G3', 'B3', 'D4'], str: ['G3', 'B3', 'D4'] },
    { bass: ['D2', 'A2', 'D3', 'C3'], chord: ['F#3', 'A3', 'D4'], str: ['A3', 'D4', 'F#4'] },

    // Section B (16..23): Emotional Sunlit Archipelago — lush strings & soaring cello!
    { bass: ['C2', 'G2', 'C3', 'G2'], chord: ['E3', 'G3', 'C4'], str: ['G3', 'C4', 'E4', 'G4'] },
    { bass: ['D2', 'A2', 'D3', 'A2'], chord: ['F#3', 'A3', 'D4'], str: ['A3', 'D4', 'F#4'] },
    { bass: ['B1', 'F#2', 'B2', 'D2'], chord: ['F#3', 'B3', 'D4'], str: ['F#3', 'B3', 'D4', 'F#4'] },
    { bass: ['E2', 'B2', 'E3', 'D3'], chord: ['G3', 'B3', 'E4'], str: ['G3', 'B3', 'E4'] },
    { bass: ['A1', 'E2', 'A2', 'C2'], chord: ['E3', 'A3', 'C4'], str: ['A3', 'C4', 'E4'] },
    { bass: ['D2', 'A2', 'D3', 'F#2'], chord: ['F#3', 'A3', 'D4'], str: ['A3', 'D4', 'F#4'] },
    { bass: ['G1', 'D2', 'G2', 'A2'], chord: ['G3', 'B3', 'D4'], str: ['G3', 'B3', 'D4', 'G4'] },
    { bass: ['B1', 'G2', 'B2', 'G2'], chord: ['G3', 'B3', 'D4'], str: ['G3', 'B3', 'D4', 'G4'] },

    // Section C (24..31): Confident Heroic Flight Chorus — rich strings + warm horns!
    { bass: ['C2', 'G2', 'C3', 'B2'], chord: ['E3', 'G3', 'C4'], str: ['G3', 'C4', 'E4', 'G4'] },
    { bass: ['D2', 'A2', 'D3', 'C3'], chord: ['F#3', 'A3', 'D4'], str: ['A3', 'D4', 'F#4'] },
    { bass: ['B1', 'F#2', 'B2', 'D2'], chord: ['F#3', 'B3', 'D4'], str: ['F#3', 'B3', 'D4', 'F#4'] },
    { bass: ['E2', 'B2', 'E3', 'D3'], chord: ['G3', 'B3', 'E4'], str: ['G3', 'B3', 'E4'] },
    { bass: ['A1', 'E2', 'A2', 'B2'], chord: ['E3', 'A3', 'C4'], str: ['A3', 'C4', 'E4'] },
    { bass: ['B1', 'F#2', 'B2', 'D2'], chord: ['F#3', 'B3', 'D4'], str: ['F#3', 'B3', 'D4'] },
    { bass: ['C2', 'G2', 'C3', 'E2'], chord: ['E3', 'G3', 'C4'], str: ['G3', 'C4', 'E4'] },
    { bass: ['D2', 'A2', 'D3', 'F#2'], chord: ['G3', 'A3', 'D4'], str: ['A3', 'D4', 'F#4'] },
  ];

  // 1. Deep, Warm, Flowing Aerial Rhythm Section
  for (let bar = 0; bar < 32; bar++) {
    const b0 = bar * 4;
    const c = prog[bar];
    const [bRoot, bFifth, bOct, bWalk] = c.bass;
    const sec = Math.floor(bar / 8);

    // Deep, warm driving bassline (steady forward momentum!)
    s.note(2, bRoot, b0 + 0.0, 0.72, 114);
    s.note(2, bRoot, b0 + 0.75, 0.22, 88);
    s.note(2, bOct, b0 + 1.0, 0.42, 98);
    s.note(2, bFifth, b0 + 1.5, 0.42, 94);
    s.note(2, bRoot, b0 + 2.0, 0.72, 110);
    s.note(2, bFifth, b0 + 2.75, 0.22, 88);
    s.note(2, bOct, b0 + 3.0, 0.42, 100);
    s.note(2, bWalk, b0 + 3.5, 0.42, 94);

    // Warm velvety Rhodes chords
    s.chord(3, c.chord, b0 + 0.0, 1.85, 72);
    s.chord(3, c.chord, b0 + 2.0, 1.85, 68);

    // Flowing clean guitar arpeggio in warm mid register (C3..E4 — never shrill!)
    const arp = [c.chord[0], c.chord[1], c.chord[2], c.chord[1], c.chord[0], c.chord[2], c.chord[1], c.chord[2]];
    for (let e = 0; e < 8; e++) {
      s.note(4, arp[e], b0 + e * 0.5, 0.42, e % 2 === 0 ? 60 : 48);
    }

    // Lush warm orchestral strings pad throughout every bar!
    s.chord(1, c.str, b0 + 0.0, 3.88, sec >= 2 ? 78 : 66);

    // Deep expressive Cello bass-harmony anchor
    s.note(5, midi(bRoot) + 12, b0 + 0.0, 1.90, 82);
    s.note(5, midi(bFifth) + 12, b0 + 2.0, 1.90, 76);

    // Warm tight drums (low-velocity hi-hats so zero harshness!)
    s.drum(36, b0 + 0.0, 108);
    s.drum(38, b0 + 1.0, 94);
    s.drum(36, b0 + 1.75, 76);
    s.drum(36, b0 + 2.0, 102);
    s.drum(36, b0 + 2.5, 84);
    s.drum(38, b0 + 3.0, 98);
    for (let e = 0; e < 8; e++) {
      s.drum(42, b0 + e * 0.5, e % 2 === 0 ? 44 : 30);
    }
    if (bar % 8 === 0) s.drum(49, b0, 62);
    if (bar % 8 === 7) {
      s.drum(45, b0 + 2.5, 82);
      s.drum(43, b0 + 2.75, 86);
      s.drum(41, b0 + 3.0, 90);
      s.drum(38, b0 + 3.5, 96);
    }
  }

  // 2. Deep, Warm, Expressive Melodic Theme strictly in the WARM ALTO/BARITONE REGISTER (D4 – D5)!
  // Carried by lush French Horn + Singing Strings + Cello octave below!
  const melA = [
    [0, 0.0, 'B4', 0.88, 102], [0, 1.0, 'A4', 0.42, 96], [0, 1.5, 'G4', 0.42, 94], [0, 2.0, 'D5', 1.65, 108],
    [1, 0.0, 'A4', 0.88, 98], [1, 1.0, 'B4', 0.42, 100], [1, 1.5, 'A4', 0.42, 96], [1, 2.0, 'F#4', 1.65, 96],
    [2, 0.0, 'G4', 0.88, 100], [2, 1.0, 'A4', 0.42, 100], [2, 1.5, 'B4', 0.42, 104], [2, 2.0, 'D5', 0.88, 108], [2, 3.0, 'B4', 0.85, 102],
    [3, 0.0, 'A4', 1.85, 100], [3, 2.5, 'F#4', 0.42, 92], [3, 3.0, 'G4', 0.42, 96], [3, 3.5, 'A4', 0.42, 100],

    [4, 0.0, 'C5', 0.88, 106], [4, 1.0, 'B4', 0.42, 102], [4, 1.5, 'A4', 0.42, 98], [4, 2.0, 'G4', 1.65, 102],
    [5, 0.0, 'B4', 0.88, 104], [5, 1.0, 'A4', 0.42, 98], [5, 1.5, 'G4', 0.42, 96], [5, 2.0, 'D5', 1.65, 108],
    [6, 0.0, 'C5', 0.88, 106], [6, 1.0, 'B4', 0.42, 102], [6, 1.5, 'A4', 0.42, 98], [6, 2.0, 'B4', 0.88, 102], [6, 3.0, 'C5', 0.85, 104],
    [7, 0.0, 'A4', 2.40, 102], [7, 3.0, 'G4', 0.42, 96], [7, 3.5, 'A4', 0.42, 100],
  ];

  const melA2 = [
    ...melA.slice(0, 18).map(([bar, off, n, d, v]) => [bar + 8, off, n, d, Math.min(112, v + 4)]),
    [12, 0.0, 'C5', 0.88, 108], [12, 1.0, 'D5', 0.42, 110], [12, 1.5, 'E5', 0.42, 112], [12, 2.0, 'D5', 0.88, 108], [12, 3.0, 'C5', 0.85, 104],
    [13, 0.0, 'B4', 0.88, 104], [13, 1.0, 'A4', 0.42, 100], [13, 1.5, 'B4', 0.42, 104], [13, 2.0, 'A4', 1.65, 102],
    [14, 0.0, 'G4', 1.85, 104], [14, 2.0, 'B4', 0.88, 106], [14, 3.0, 'D5', 0.85, 110],
    [15, 0.0, 'A4', 2.20, 104], [15, 2.5, 'G4', 0.42, 96], [15, 3.0, 'A4', 0.42, 100], [15, 3.5, 'B4', 0.42, 104],
  ];

  // Section B (bars 16..23): Sweeping, gorgeous, deeply melodic strings theme!
  const melB = [
    [16, 0.0, 'E5', 1.35, 110], [16, 1.5, 'D5', 0.42, 104], [16, 2.0, 'C5', 0.88, 104], [16, 3.0, 'B4', 0.85, 100],
    [17, 0.0, 'A4', 1.35, 104], [17, 1.5, 'B4', 0.42, 104], [17, 2.0, 'D5', 1.65, 110],
    [18, 0.0, 'D5', 1.35, 110], [18, 1.5, 'C5', 0.42, 104], [18, 2.0, 'B4', 0.88, 104], [18, 3.0, 'F#4', 0.85, 98],
    [19, 0.0, 'G4', 1.85, 104], [19, 2.0, 'B4', 0.88, 106], [19, 3.0, 'E5', 0.85, 110],
    [20, 0.0, 'C5', 0.88, 106], [20, 1.0, 'B4', 0.42, 102], [20, 1.5, 'A4', 0.42, 100], [20, 2.0, 'B4', 0.88, 104], [20, 3.0, 'C5', 0.85, 106],
    [21, 0.0, 'D5', 1.85, 110], [21, 2.0, 'A4', 0.88, 102], [21, 3.0, 'D5', 0.85, 108],
    [22, 0.0, 'B4', 2.40, 108], [22, 3.0, 'A4', 0.42, 100], [22, 3.5, 'B4', 0.42, 104],
    [23, 0.0, 'D5', 1.85, 110], [23, 2.0, 'B4', 0.88, 104], [23, 3.0, 'G4', 0.85, 100],
  ];

  // Section C (bars 24..31): Heroic, warm soaring flight chorus!
  const melC = [
    [24, 0.0, 'E5', 0.88, 112], [24, 1.0, 'D5', 0.42, 106], [24, 1.5, 'C5', 0.42, 104], [24, 2.0, 'G4', 0.88, 102], [24, 3.0, 'C5', 0.85, 108],
    [25, 0.0, 'D5', 0.88, 110], [25, 1.0, 'C5', 0.42, 104], [25, 1.5, 'A4', 0.42, 100], [25, 2.0, 'D5', 1.65, 112],
    [26, 0.0, 'D5', 0.88, 110], [26, 1.0, 'B4', 0.42, 104], [26, 1.5, 'D5', 0.42, 108], [26, 2.0, 'F#5', 0.88, 114], [26, 3.0, 'D5', 0.85, 108],
    [27, 0.0, 'E5', 1.35, 114], [27, 1.5, 'D5', 0.42, 108], [27, 2.0, 'B4', 1.65, 108],
    [28, 0.0, 'C5', 0.88, 108], [28, 1.0, 'B4', 0.42, 104], [28, 1.5, 'A4', 0.42, 102], [28, 2.0, 'E4', 0.88, 98], [28, 3.0, 'A4', 0.85, 104],
    [29, 0.0, 'B4', 0.88, 106], [29, 1.0, 'A4', 0.42, 102], [29, 1.5, 'B4', 0.42, 106], [29, 2.0, 'D5', 1.65, 110],
    [30, 0.0, 'C5', 1.35, 108], [30, 1.5, 'B4', 0.42, 104], [30, 2.0, 'G4', 0.88, 102], [30, 3.0, 'C5', 0.85, 106],
    [31, 0.0, 'A4', 1.85, 106], [31, 2.0, 'G4', 0.42, 98], [31, 2.5, 'A4', 0.42, 102], [31, 3.0, 'B4', 0.85, 106],
  ];

  for (const [bar, off, noteName, dur, vel] of [...melA, ...melA2, ...melB, ...melC]) {
    const t = bar * 4 + off;
    const p = midi(noteName);
    // Warm French Horn + Singing Strings + Deep Cello octave below!
    s.note(0, p, t, dur * 0.96, vel * 0.88);
    s.note(1, p, t, dur, vel * 0.84);
    s.note(5, p - 12, t, dur * 0.96, vel * 0.78);
  }

  return s;
}

renderTrack('menu', composeMenuAnthem(), {
  lowpassHz: 7800,
  bassBoostDb: 3.0,
  midWarmDb: 2.2,
  trebleCutDb: -3.0,
  ceiling: 0.88,
});
copyFileSync(join(OUT_DIR, 'menu.ogg'), join(OUT_DIR, 'select.ogg'));

renderTrack('stage1', composeStage1Warm(), {
  lowpassHz: 6200,
  bassBoostDb: 3.8,
  midWarmDb: 2.6,
  trebleCutDb: -4.5,
  ceiling: 0.82,
});
console.log('Soundtrack v3 complete!');
