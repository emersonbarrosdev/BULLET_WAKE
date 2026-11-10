/** Package generated animation grids, preserving cell proportions and alpha. */
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const [name, source] = process.argv.slice(2);
const plans = {
  air: { cols: 8, rows: 4, frames: 8, size: 256, names: ['scout', 'dart', 'lancer', 'cutter'] },
  marine: { cols: 8, rows: 2, frames: 8, size: 256, names: ['surface', 'ambush'] },
  carrier: { cols: 4, rows: 2, frames: 8, size: 256, names: ['carrier'] },
  ocean: { cols: 4, rows: 2, frames: 8, size: 256, height: 512, names: ['ocean'] },
  talassarca: { cols: 4, rows: 2, frames: 8, size: 512, names: ['talassarca'] },
  inner: { cols: 4, rows: 2, frames: 8, size: 512, names: ['inner'] },
  metamorphosis: { cols: 4, rows: 2, frames: 8, size: 512, names: ['metamorphosis'] },
  special: { cols: 4, rows: 2, frames: 8, size: 384, names: ['special'] },
  rift: { cols: 4, rows: 2, frames: 8, size: 256, height: 512, names: ['rift'] },
  turbulent: { cols: 4, rows: 2, frames: 8, size: 256, height: 512, names: ['turbulent'] },
  raia: { cols: 4, rows: 2, frames: 8, size: 384, names: ['raia'] },
  explosion: { cols: 4, rows: 4, frames: 16, size: 192, names: ['explosion'] },
  weapons: { cols: 4, rows: 6, frames: 8, size: 128, names: ['blue', 'green', 'fire'] },
};
const plan = plans[name];
if (!plan || !source) throw new Error('Specify asset plan and generated source path');
const out = resolve('public/assets/combat-hd/polish');
mkdirSync(out, { recursive: true });
const { width, height } = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'json', source])).streams[0];
const cw = Math.floor(width / plan.cols), ch = Math.floor(height / plan.rows);
for (const [index, key] of plan.names.entries()) {
  const count = plan.frames;
  const filters = [`[0:v]split=${count}${Array.from({ length: count }, (_, i) => `[s${i}]`).join('')}`];
  for (let i = 0; i < count; i++) {
    const cell = index * count + i;
    const x = cell % plan.cols, y = Math.floor(cell / plan.cols);
    const size = plan.size, h = plan.height ?? size;
    const scaling = ['ocean','rift','turbulent'].includes(name)
      ? `scale=${size}:${h}:flags=lanczos`
      : `scale=${size}:${h}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${size}:${h}:(ow-iw)/2:(oh-ih)/2:color=0x00000000`;
    const inset = ['ocean','rift','turbulent'].includes(name) ? 2 : 0;
    filters.push(`[s${i}]crop=${cw-2*inset}:${ch-2*inset}:${x * cw+inset}:${y * ch+inset},format=rgba,${scaling}[f${i}]`);
  }
  filters.push(`${Array.from({ length: count }, (_, i) => `[f${i}]`).join('')}hstack=inputs=${count}[out]`);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', source, '-filter_complex', filters.join(';'), '-map', '[out]', '-quality', '94', resolve(out, key + '.webp')]);
  console.log(`${key}: ${count} frames, ${plan.size}x${plan.height ?? plan.size}`);
}
