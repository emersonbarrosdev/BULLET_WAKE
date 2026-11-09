/** Package image_gen art as equal-pivot, four-frame RGBA strips. Requires FFmpeg. */
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const [name, source] = process.argv.slice(2);
const sheets = ['rivet', 'scout', 'dart', 'lancer', 'cutter', 'bomb'];
if (!source || ![...sheets, 'ocean', 'capsule'].includes(name)) {
  throw new Error('Usage: node scripts/import-combat-art.mjs rivet|scout|dart|lancer|cutter|bomb|ocean|capsule SOURCE');
}
const out = resolve('public/assets/combat-hd');
mkdirSync(out, { recursive: true });
const meta = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'json', source]));
const { width, height } = meta.streams[0];
const args = ['-hide_banner', '-loglevel', 'error', '-y', '-i', source];
if (sheets.includes(name)) {
  const w = width / 2, h = height / 2;
  if (!Number.isInteger(w) || !Number.isInteger(h)) throw new Error('Source must have an exact 2x2 grid');
  const filters = ['[0:v]split=4[a][b][c][d]'];
  for (let i = 0; i < 4; i++) {
    filters.push(`[${'abcd'[i]}]crop=${w}:${h}:${(i % 2) * w}:${Math.floor(i / 2) * h},scale=256:256:flags=lanczos,format=rgba[f${i}]`);
  }
  filters.push('[f0][f1][f2][f3]hstack=inputs=4[out]');
  args.push('-filter_complex', filters.join(';'), '-map', '[out]');
} else {
  args.push('-vf', name === 'ocean' ? 'scale=1024:1536:flags=lanczos' : 'scale=256:256:flags=lanczos');
}
args.push('-c:v', 'libwebp', '-quality', '92', resolve(out, name + '.webp'));
execFileSync('ffmpeg', args, { stdio: 'inherit' });
console.log(`${name}: ${sheets.includes(name) ? '4 × 256×256, pivot 128/128' : 'static texture'} → assets/combat-hd/${name}.webp`);
