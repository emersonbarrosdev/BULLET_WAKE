/** Original cel-painted Bézier artwork. Chromium only rasterizes SVG paths; no downloaded art or ship replacement. */
import { existsSync, readFileSync, writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const HULL_ART_SPECS = [
  { key: 'hull-scars-up', size: 64, frames: 3 },
  { key: 'hull-scars-side', size: 64, frames: 3 },
  { key: 'hull-smoke', size: 64, frames: 8 },
  { key: 'hull-flame', size: 64, frames: 8 },
  { key: 'hull-spark', size: 64, frames: 4 },
  { key: 'hull-repair', size: 64, frames: 8 },
  { key: 'hull-destruction', size: 128, frames: 8 },
  { key: 'hull-repair-pickup', size: 64, frames: 8 },
];

const ink = '#192333';
const path = (d, fill, stroke = ink, width = 1.3, extra = '') => `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round" ${extra}/>`;
const group = (transform, body, extra = '') => `<g transform="${transform}" ${extra}>${body}</g>`;
const svg = (size, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">${body}</svg>`;

function scorch(x, y, angle, s = 1) {
  return group(`translate(${x} ${y}) rotate(${angle}) scale(${s})`,
    path('M-7 1 Q-8-4-4-5 L-1-3 2-6 5-3 8-1 5 3 0 5-4 3Z', '#37303b', '#211e2b', .65, 'opacity=".9"') +
    path('M-5 0-1-1 1-4 0 0 5 1 1 2-1 4-2 1Z', '#151b2b', 'none') +
    path('M-5-2-2-3M2 3 5 2', 'none', '#da9468', .8) +
    path('M-1-3 0-1 3 0', 'none', '#fff1c4', .6));
}

function scars(frame, side) {
  let body = side
    ? scorch(25, 28, 18, .65) + scorch(18, 36, -12, .6)
    : scorch(21, 38, -28, .65) + scorch(41, 40, 33, .5);
  if (frame >= 1) body += side
    ? scorch(34, 36, 12, 1) + scorch(12, 32, -22, .7)
    : scorch(35, 44, -12, .95) + scorch(28, 26, 35, .65);
  if (frame >= 2) {
    body += side ? scorch(43, 31, 6, .7) : scorch(45, 34, 30, .85);
    body += path(side ? 'M18 30 23 32 21 35 27 36M32 24 31 29 35 31 32 34' : 'M25 30 29 34 26 37 31 41M38 32 35 36 38 40 36 44', 'none', '#171d2d', 1.15);
    body += path(side ? 'M19 30 23 32M31 29 35 31' : 'M25 30 29 34M35 36 38 40', 'none', '#ffb37a', .6);
  }
  return body;
}

/** Billows have different lobes, not geometric discs; hard shadows retain cel-animation readability. */
function smoke(frame) {
  const t = frame / 8, sway = Math.sin(t * Math.PI * 2) * 2.2;
  return group(`translate(${sway} ${-t * 2})`,
    path('M29 59C20 58 17 54 20 49C11 49 9 43 13 38C7 33 10 24 18 23C16 16 22 11 28 13C30 5 41 5 44 13C54 10 60 20 54 27C61 33 57 41 49 42C49 48 42 51 37 48C40 54 36 60 29 59Z', '#606c80', '#27344b', 1.45) +
    path('M20 49C27 49 31 44 28 39C20 42 13 36 17 30C21 26 26 29 28 25C30 18 38 19 40 23C39 16 46 13 51 18C53 15 48 10 44 13C41 5 30 5 28 13C22 11 16 16 18 23C10 24 7 33 13 38C9 43 11 49 20 49Z', '#9aa4b2', 'none') +
    path('M28 57C35 54 33 48 30 45C39 48 43 43 42 38C48 40 54 36 53 31C58 34 54 41 49 42C49 48 42 51 37 48C40 54 36 60 29 59Z', '#39465e', 'none') +
    path('M17 25C20 22 24 23 25 26M31 13C34 10 39 11 40 14M15 37C17 39 20 40 23 39', 'none', '#c4cad1', 1.4) +
    path('M35 48C32 47 30 48 30 51', 'none', '#1e2c43', 1) +
    path('M25 61Q29 56 31 58Q30 62 27 63Z', '#738092', 'none', 0));
}

function flame(frame) {
  const k = Math.sin(frame * Math.PI / 4), sway = k * 4;
  return group(`translate(${sway * .22} 0)`,
    path(`M31 60C12 59 13 43 21 35C23 44 28 44 26 33C24 24 ${37 + sway} 19 ${31 + sway} 5C45 14 49 24 42 35C49 29 51 22 50 18C62 34 59 44 49 49C52 59 41 64 31 60Z`, '#ef5c26', '#7c2c37', 1.4) +
    path(`M31 59C21 57 20 50 25 42C29 47 32 41 32 34C32 28 ${39 + sway * .5} 24 39 19C46 31 36 39 40 44C44 45 48 40 50 36C52 48 44 50 43 54C42 59 36 61 31 59Z`, '#ffb92f', 'none') +
    path('M32 57C27 54 28 50 31 46C35 48 36 43 36 40C42 45 35 48 39 51C43 56 36 60 32 57Z', '#fff4a6', 'none') +
    path('M20 39Q17 46 19 50M46 20Q50 27 45 34', 'none', '#ff9a43', 1.1) +
    path(`M${21 + frame % 3} 20Q18 16 22 12Q25 17 ${21 + frame % 3} 20Z`, '#ffbe51', 'none') +
    path('M47 9Q44 6 47 3Q50 6 47 9Z', '#ffdc73', 'none'));
}

function spark(frame) {
  const spread = frame * 2.4, opacity = 1 - frame * .16;
  let body = '';
  for (let i = 0; i < 7; i++) {
    const angle = i * 51 + frame * 13, len = 8 + (i % 3) * 3;
    body += group(`translate(32 32) rotate(${angle}) translate(0 ${-spread})`, path(`M-1-5Q-3-${len} 0-${len + 7}Q3-${len} 1-5Z`, i % 2 ? '#ffd16c' : '#fff5cb', '#f88c3d', .7));
  }
  if (frame < 2) body += path('M32 24 34 30 41 32 34 34 32 41 30 34 24 32 30 30Z', '#ffffff', '#ffce66', .7);
  return `<g opacity="${opacity}">${body}</g>`;
}

function repair(frame) {
  const r = 10 + frame * 2.5, op = frame > 5 ? (8 - frame) / 3 : 1;
  let body = '';
  for (let i = 0; i < 5; i++) {
    body += group(`translate(32 32) rotate(${i * 72 + frame * 8})`,
      path(`M-${r * .7} -${r * .5}Q0-${r * 1.1} ${r * .7}-${r * .5}L${r * .58}-${r * .38}Q0-${r * .86}-${r * .58}-${r * .38}Z`, '#6ef6d6', '#0b897c', .7) +
      path(`M-1-${r + 3} 1-${r + 6} 3-${r + 3} 1-${r}Z`, '#d5fff0', 'none'));
  }
  body += path('M28 34 31 37 38 28', 'none', '#d4fff2', 1.6);
  body += group(`translate(${26 + frame} ${45 - frame * 3}) rotate(-18)`, path('M-3-1 0-4 3-1 0 2Z', '#a3ffdf', '#28bfa8', .7));
  return `<g opacity="${op}">${body}</g>`;
}

function destruction(frame) {
  if (frame < 2) {
    const s = frame === 0 ? .55 : .9;
    return group(`translate(32 32) scale(${s}) translate(-32 -32)`,
      path('M32 3 38 18 50 9 48 23 62 26 49 34 59 45 45 44 43 60 33 48 21 61 21 46 5 49 15 36 2 27 18 24 13 9 27 18Z', '#ff8b38', '#8b3340', 1) +
      path('M32 10 37 24 47 18 43 29 55 31 43 36 49 44 38 42 33 55 28 43 15 49 21 36 9 29 25 27 21 17 29 23Z', '#ffe7a0', 'none') +
      path('M32 19 37 29 45 31 36 36 32 45 28 36 21 31 29 28Z', '#fffefa', 'none'));
  }
  const t = (frame - 2) / 6;
  let body = group(`translate(6 3) scale(.8)`, smoke(frame));
  if (frame < 6) body += group(`translate(13 16) scale(.62)`, flame(frame));
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4 + .19, distance = 12 + t * 20;
    const x = 32 + Math.cos(a) * distance, y = 32 + Math.sin(a) * distance;
    body += group(`translate(${x} ${y}) rotate(${i * 47 + frame * 19}) scale(${.8 - t * .32})`,
      path('M-4-3 3-5 5 0 1 4-5 2Z', i % 2 ? '#de7660' : '#7892ab', '#233344', .75) +
      path('M-3-2 2-4 3-1-2 0Z', '#d8e3dc', 'none'));
  }
  return `<g opacity="${frame === 7 ? .4 : frame === 6 ? .7 : 1}">${body}</g>`;
}

function pickup(frame) {
  const bob = Math.sin(frame * Math.PI / 4) * 1.5, shine = frame % 4;
  return group(`translate(0 ${bob})`,
    path('M13 24 23 14 46 17 54 29 49 48 24 53 11 42Z', '#0b695f', '#142b3e', 1.8) +
    path('M15 24 25 17 45 20 50 30 44 46 25 49 15 40Z', '#37d9bc', '#a5ffe5', 1.2) +
    path('M15 24 25 17 45 20 42 25 25 23 20 29Z', '#a9ffe0', 'none') +
    path('M44 27 50 30 44 46 25 49 28 43 40 41Z', '#15998c', 'none') +
    path('M23 24 42 27 44 38 38 44 22 40 19 30Z', '#163c50', '#0b655f', 1) +
    // Open crescent wrench and offset handle: visibly mechanical, distinct from P, hearts and ordnance.
    path('M36 24C31 21 26 23 25 28C24 31 26 34 29 35L26 40Q25 42 28 43Q30 44 31 41L34 35C39 35 42 31 40 27L36 31 32 29Z', '#edf9dd', '#132d3d', 1.4) +
    path('M28 40 30 37', 'none', '#7caaa4', .9) +
    path('M15 32 18 33 18 39 15 38Z M45 22 47 24 45 27 43 25Z', '#f7d783', '#395b51', .6) +
    group(`translate(${17 + shine * 9} ${22 + frame * .6})`, path('M0-4 1-1 4 0 1 1 0 4-1 1-4 0-1-1Z', '#edfff5', 'none')));
}

export function hullFrameSVG(key, frame, size = 64) {
  const draw = key === 'hull-scars-up' ? scars(frame, false) : key === 'hull-scars-side' ? scars(frame, true)
    : key === 'hull-smoke' ? smoke(frame) : key === 'hull-flame' ? flame(frame) : key === 'hull-spark' ? spark(frame)
      : key === 'hull-repair' ? repair(frame) : key === 'hull-destruction' ? destruction(frame) : pickup(frame);
  return svg(size, draw);
}

export async function generateHullArt() {
  const output = resolve('public/assets/arcade/hull');
  mkdirSync(output, { recursive: true });
  const profile = mkdtempSync(join(tmpdir(), 'bw-hull-art-'));
  const chromePath = process.env.CHROME_BIN ?? (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '/usr/bin/google-chrome');
  const chrome = spawn(chromePath, ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--remote-debugging-port=0', '--no-first-run', '--user-data-dir=' + profile, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let socket;
  const pause = ms => new Promise(r => setTimeout(r, ms));
  try {
    let target;
    for (let i = 0; i < 100 && !target; i++) {
      try {
        const port = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0].trim();
        target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page');
      } catch { /* Unique Chrome profile is still starting. */ }
      if (!target) await pause(100);
    }
    if (!target) throw new Error('Chromium did not expose the isolated rasterizer');
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    let seq = 0;
    const pending = new Map();
    socket.onmessage = event => {
      const message = JSON.parse(event.data), task = pending.get(message.id);
      if (!task) return;
      pending.delete(message.id); clearTimeout(task.timer);
      message.error ? task.reject(new Error(JSON.stringify(message.error))) : task.resolve(message.result);
    };
    const evaluate = expression => new Promise((resolve, reject) => {
      const id = ++seq, timer = setTimeout(() => { pending.delete(id); reject(new Error('Rasterizer timed out')); }, 20000);
      pending.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }));
    });
    const gallery = [];
    const manifest = [];
    for (const spec of HULL_ART_SPECS) {
      const sources = Array.from({ length: spec.frames }, (_, frame) => hullFrameSVG(spec.key, frame, spec.size));
      const result = await evaluate(`(async()=>{const c=document.createElement('canvas');c.width=${spec.size * spec.frames};c.height=${spec.size};const ctx=c.getContext('2d');for(const [i,source] of ${JSON.stringify(sources)}.entries()){const img=new Image();img.src='data:image/svg+xml;base64,'+btoa(source);await img.decode();ctx.drawImage(img,i*${spec.size},0);}const px=ctx.getImageData(0,0,c.width,c.height).data;let clear=0,solid=0,partial=0;for(let i=3;i<px.length;i+=4){if(px[i]===0)clear++;else if(px[i]===255)solid++;else partial++;}return{png:c.toDataURL('image/png').split(',')[1],alpha:{clear,solid,partial}};})()`);
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      const value = result.result.value;
      if (!value.alpha.clear || !(value.alpha.solid + value.alpha.partial)) throw new Error('Missing transparent or painted pixels: ' + spec.key);
      writeFileSync(join(output, spec.key + '.png'), Buffer.from(value.png, 'base64'));
      gallery.push({ ...spec, png: value.png });
      manifest.push({ ...spec, width: spec.size * spec.frames, height: spec.size, alpha: value.alpha });
    }
    const contact = await evaluate(`(async()=>{const rows=${JSON.stringify(gallery)};const c=document.createElement('canvas');c.width=1088;c.height=rows.length*146;const x=c.getContext('2d');x.fillStyle='#0a1629';x.fillRect(0,0,c.width,c.height);for(const [r,row]of rows.entries()){x.fillStyle='#c6f8ee';x.font='13px monospace';x.fillText(row.key+'  '+row.size+'px / '+row.frames+' frames',14,r*146+18);const img=new Image();img.src='data:image/png;base64,'+row.png;await img.decode();for(let f=0;f<row.frames;f++){const dx=14+f*132,dy=r*146+27;x.fillStyle='#1b2d43';x.fillRect(dx,dy,124,112);x.drawImage(img,f*row.size,0,row.size,row.size,dx+6,dy,112,112);}}return c.toDataURL('image/png').split(',')[1];})()`);
    if (contact.exceptionDetails) throw new Error(JSON.stringify(contact.exceptionDetails));
    writeFileSync(join(output, 'contact-sheet.png'), Buffer.from(contact.result.value, 'base64'));
    writeFileSync(join(output, 'manifest.json'), JSON.stringify({ originalArt: true, style: 'Bézier cel shaded cartoon/anime overlays', sheets: manifest }, null, 2) + '\n');
    console.log(JSON.stringify({ generated: manifest, contact: join(output, 'contact-sheet.png') }, null, 2));
  } finally { socket?.close(); chrome.kill(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await generateHullArt();
