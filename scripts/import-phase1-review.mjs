/** Package original generated sprite grids without repainting their artwork. */
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const [name, source] = process.argv.slice(2);
const configs = {
  raia: [2, 2, 512],
  talassarca: [2, 2, 512],
  surface: [2, 2, 256],
  swimmer: [2, 2, 256],
  special: [2, 2, 256],
  pickups: [8, 5, 64],
  hostile: [4, 6, 64],
  effects: [4, 6, 128],
};
const out = resolve('public/assets/combat-hd/review');
mkdirSync(out, { recursive: true });
if (name === 'ocean') {
  execFileSync('ffmpeg', [
    '-v',
    'error',
    '-y',
    '-i',
    source,
    '-vf',
    'scale=1024:3072:flags=lanczos',
    '-quality',
    '92',
    resolve(out, 'ocean.webp'),
  ]);
} else {
  const config = configs[name];
  if (!config || !source)
    throw Error(
      'Usage: import-phase1-review.mjs raia|talassarca|surface|special|pickups|hostile|effects|ocean SOURCE',
    );
  const { width, height } = JSON.parse(
    execFileSync('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'stream=width,height',
      '-of',
      'json',
      source,
    ]),
  ).streams[0];
  const [cols, rows, size] = config,
    cellW = Math.floor(width / cols),
    cellH = Math.floor(height / rows);
  const keys =
    name === 'pickups'
      ? [
          'power',
          'weapon_ion',
          'weapon_green',
          'weapon_red',
          'health',
          'bomb',
          'speed',
          'score',
          'missile',
          'special',
        ]
      : name === 'hostile'
        ? ['scout', 'dart', 'lancer', 'cutter', 'surface', 'raia']
        : name === 'effects'
          ? ['blue', 'green', 'fire', 'missile', 'charge', 'explosion']
          : [name];
  for (const [key, index] of keys.map((k, i) => [k, i])) {
    const frames = Array.from({ length: 4 }, (_, f) =>
      name === 'pickups'
        ? { x: (index % 2) * 4 + f, y: Math.floor(index / 2) }
        : name === 'hostile' || name === 'effects'
          ? { x: f, y: index }
          : { x: f % 2, y: Math.floor(f / 2) },
    );
    const filters = ['[0:v]split=4[a][b][c][d]'];
    for (const [pos, i] of frames.map((p, i) => [p, i]))
      filters.push(
        `[${'abcd'[i]}]crop=${cellW}:${cellH}:${pos.x * cellW}:${pos.y * cellH},scale=${size}:${size}:flags=lanczos,format=rgba[f${i}]`,
      );
    filters.push('[f0][f1][f2][f3]hstack=inputs=4[out]');
    const filename = keys.length > 1 ? `${name}-${key}` : name;
    execFileSync('ffmpeg', [
      '-v',
      'error',
      '-y',
      '-i',
      source,
      '-filter_complex',
      filters.join(';'),
      '-map',
      '[out]',
      '-quality',
      '94',
      resolve(out, filename + '.webp'),
    ]);
    console.log(filename, 4 * size, size);
  }
}
