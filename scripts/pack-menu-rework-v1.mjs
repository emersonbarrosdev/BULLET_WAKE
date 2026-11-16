import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const uiDir = resolve('public/assets/arcade/ui');
const brandDir = resolve('public/assets/brand');
mkdirSync(uiDir, { recursive: true });
mkdirSync(brandDir, { recursive: true });

function buildLogoSvg(variant = 'main') {
  const isLightBg = variant === 'light-bg';
  const isDarkBg = variant === 'dark-bg';
  const outerStroke = isLightBg ? '#04122b' : isDarkBg ? '#5ce1ff' : '#051633';
  const outerWidth = isLightBg ? 26 : isDarkBg ? 22 : 24;
  const innerOutline = '#061836';
  const shadowColor = isDarkBg ? 'rgba(14,165,233,0.45)' : 'rgba(5,20,48,0.52)';
  const w = 960;
  const h = 420;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bwGold" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#fffbe0"/>
      <stop offset="28%" stop-color="#ffea4a"/>
      <stop offset="68%" stop-color="#ffaa08"/>
      <stop offset="100%" stop-color="#db5f00"/>
    </linearGradient>
    <linearGradient id="bwCyan" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="35%" stop-color="#ccf8ff"/>
      <stop offset="72%" stop-color="#3cd7ff"/>
      <stop offset="100%" stop-color="#0b77cc"/>
    </linearGradient>
    <linearGradient id="bwBlade" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#0284c7" stop-opacity="0.0"/>
      <stop offset="22%" stop-color="#38bdf8" stop-opacity="0.95"/>
      <stop offset="62%" stop-color="#fde047"/>
      <stop offset="100%" stop-color="#ff4d6d"/>
    </linearGradient>
    <linearGradient id="bwRibbon" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#ff4d6d"/>
      <stop offset="50%" stop-color="#ffdf5a"/>
      <stop offset="100%" stop-color="#38bdf8"/>
    </linearGradient>
    <filter id="bwShadow" x="-10%" y="-10%" width="120%" height="125%">
      <feDropShadow dx="0" dy="8" stdDeviation="5" flood-color="${shadowColor}" flood-opacity="0.9"/>
    </filter>
  </defs>

  <g filter="url(#bwShadow)">
    <!-- Integrated sleek velocity wing-blade & sonic chevron swoop behind lockup -->
    <path d="M 70 218 L 892 178 L 856 206 L 106 238 Z"
          fill="url(#bwBlade)" stroke="${innerOutline}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M 134 344 Q 512 384 858 258 Q 888 244 894 226 Q 862 256 792 280 Q 496 364 156 336 Z"
          fill="url(#bwRibbon)" stroke="${innerOutline}" stroke-width="5.5" stroke-linejoin="round"/>

    <!-- Speed lines left -->
    <path d="M 52 132 L 194 124 L 180 138 L 46 142 Z" fill="#5ce1ff" stroke="${innerOutline}" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M 38 164 L 166 158 L 154 170 L 32 174 Z" fill="#ffdf5a" stroke="${innerOutline}" stroke-width="3.5" stroke-linejoin="round"/>

    <!-- Supersonic sonic-boom chevrons right -->
    <path d="M 792 84 L 916 56 L 866 96 L 902 108 L 766 116 Z"
          fill="#ff4d6d" stroke="${innerOutline}" stroke-width="4.5" stroke-linejoin="round"/>

    <!-- BULLET -->
    <g transform="translate(476, 178) skewX(-12)">
      <text x="0" y="0" text-anchor="middle"
            font-family="'Oxanium', 'Impact', 'Arial Black', sans-serif"
            font-weight="900" font-size="146" letter-spacing="5"
            fill="none" stroke="${outerStroke}" stroke-width="${outerWidth + 10}" stroke-linejoin="round">BULLET</text>
      <text x="0" y="0" text-anchor="middle"
            font-family="'Oxanium', 'Impact', 'Arial Black', sans-serif"
            font-weight="900" font-size="146" letter-spacing="5"
            fill="none" stroke="#8ef4ff" stroke-width="11" stroke-linejoin="round">BULLET</text>
      <text x="0" y="0" text-anchor="middle"
            font-family="'Oxanium', 'Impact', 'Arial Black', sans-serif"
            font-weight="900" font-size="146" letter-spacing="5"
            fill="url(#bwGold)" stroke="${innerOutline}" stroke-width="5.5" stroke-linejoin="round">BULLET</text>
      <clipPath id="bulletTopClip"><rect x="-440" y="-128" width="880" height="60"/></clipPath>
      <text x="0" y="0" text-anchor="middle" clip-path="url(#bulletTopClip)"
            font-family="'Oxanium', 'Impact', 'Arial Black', sans-serif"
            font-weight="900" font-size="146" letter-spacing="5"
            fill="#ffffff" opacity="0.30">BULLET</text>
    </g>

    <!-- WAKE (tucked tightly under BULLET for unified emblem silhouette) -->
    <g transform="translate(492, 312) skewX(-12)">
      <text x="0" y="0" text-anchor="middle"
            font-family="'Oxanium', 'Impact', 'Arial Black', sans-serif"
            font-weight="900" font-size="132" letter-spacing="12"
            fill="none" stroke="${outerStroke}" stroke-width="${outerWidth + 8}" stroke-linejoin="round">WAKE</text>
      <text x="0" y="0" text-anchor="middle"
            font-family="'Oxanium', 'Impact', 'Arial Black', sans-serif"
            font-weight="900" font-size="132" letter-spacing="12"
            fill="none" stroke="#ffdf5a" stroke-width="9" stroke-linejoin="round">WAKE</text>
      <text x="0" y="0" text-anchor="middle"
            font-family="'Oxanium', 'Impact', 'Arial Black', sans-serif"
            font-weight="900" font-size="132" letter-spacing="12"
            fill="url(#bwCyan)" stroke="${innerOutline}" stroke-width="5" stroke-linejoin="round">WAKE</text>
    </g>

    <!-- Clean left/right star-spark gleams -->
    <polygon points="154,262 198,250 184,268 208,284 148,286" fill="#5ce1ff" stroke="${innerOutline}" stroke-width="3.5" stroke-linejoin="round"/>
    <polygon points="802,248 848,236 828,258 854,272 786,274" fill="#ffdf5a" stroke="${innerOutline}" stroke-width="3.5" stroke-linejoin="round"/>
  </g>
</svg>`;
}

writeFileSync(join(brandDir, 'bullet-wake-logo.svg'), buildLogoSvg('main'), 'utf8');

const chromePath =
  process.env.CHROME_BIN ??
  (process.platform === 'win32'
    ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    : '/usr/bin/google-chrome');
const profile = mkdtempSync(join(tmpdir(), 'bw-menu-rework-'));
const chrome = spawn(
  chromePath,
  [
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--remote-debugging-port=9226',
    '--remote-allow-origins=*',
    '--no-first-run',
    '--user-data-dir=' + profile,
    'about:blank',
  ],
  { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let socket;

try {
  let target;
  for (let i = 0; i < 160; i++) {
    try {
      target = (await (await fetch('http://127.0.0.1:9226/json')).json()).find((t) => t.type === 'page');
    } catch {}
    if (target) break;
    await sleep(100);
  }
  if (!target) throw new Error('Chrome failed to boot for asset packing');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => {
    socket.onopen = r;
    socket.onerror = j;
  });
  let seq = 0;
  const pending = new Map();
  socket.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? p.reject(msg.error) : p.resolve(msg.result);
    }
  };
  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      const id = ++seq;
      pending.set(id, { resolve: res, reject: rej });
      socket.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  await send('Runtime.enable');

  const saveDataUrl = (filePath, dataUrl) => {
    const idx = dataUrl.indexOf(',');
    assert(idx > 0);
    const buf = Buffer.from(dataUrl.slice(idx + 1), 'base64');
    writeFileSync(filePath, buf);
    return buf.length;
  };

  // 1. Rasterize all logo variants from SVG cleanly
  const svgSpecs = [
    { svg: buildLogoSvg('main'), out: join(brandDir, 'bullet-wake-logo-main.png'), mime: 'image/png', w: 960, h: 440, bg: null },
    { svg: buildLogoSvg('main'), out: join(brandDir, 'bullet-wake-logo-transparent.png'), mime: 'image/png', w: 960, h: 440, bg: null },
    { svg: buildLogoSvg('main'), out: join(brandDir, 'bullet-wake-logo-compact.png'), mime: 'image/png', w: 384, h: 176, bg: null },
    { svg: buildLogoSvg('light-bg'), out: join(brandDir, 'bullet-wake-logo-light-bg.png'), mime: 'image/png', w: 960, h: 440, bg: '#eef6ff' },
    { svg: buildLogoSvg('dark-bg'), out: join(brandDir, 'bullet-wake-logo-dark-bg.png'), mime: 'image/png', w: 960, h: 440, bg: '#040d21' },
    { svg: buildLogoSvg('main'), out: join(uiDir, 'logo-arcade.webp'), mime: 'image/webp', w: 960, h: 440, bg: null },
  ];

  for (const spec of svgSpecs) {
    const url = await evaluate(`(async () => {
      const c = document.createElement('canvas');
      c.width = ${spec.w}; c.height = ${spec.h};
      const ctx = c.getContext('2d');
      if (${JSON.stringify(spec.bg)}) {
        ctx.fillStyle = ${JSON.stringify(spec.bg)};
        ctx.fillRect(0, 0, c.width, c.height);
      }
      const img = new Image();
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(${JSON.stringify(spec.svg)});
      await img.decode();
      ctx.drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL(${JSON.stringify(spec.mime)}, 0.94);
    })()`);
    saveDataUrl(spec.out, url);
  }

  // 2. Pack animated 2.5D decorative menu aircraft spritesheet (4 cols x 3 rows @ 160x160 = 640x480)
  // Nose points RIGHT (+X). Row 0 = Prop Patrol Fighter, Row 1 = Supersonic Escort Jet, Row 2 = Recon Chopper.
  const menuAirUrl = await evaluate(`(() => {
    const CW = 160, CH = 160, COLS = 4, ROWS = 3;
    const c = document.createElement('canvas');
    c.width = CW * COLS; c.height = CH * ROWS;
    const ctx = c.getContext('2d');
    const INK = '#0a1f42';

    const drawPropPlane = (cx, cy, col) => {
      const bank = (col === 1 ? -0.10 : col === 3 ? 0.08 : 0);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1, 1 - Math.abs(bank) * 0.45);
      ctx.lineJoin = 'round';
      // Tail stabilizer
      ctx.fillStyle = '#ff5964'; ctx.strokeStyle = INK; ctx.lineWidth = 3.2;
      ctx.beginPath(); ctx.moveTo(-48, 0); ctx.lineTo(-64, -20); ctx.lineTo(-42, -16); ctx.closePath(); ctx.fill(); ctx.stroke();
      // Main swept cartoon wings
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath(); ctx.moveTo(10, -4); ctx.lineTo(-14, -50); ctx.lineTo(-30, -46); ctx.lineTo(-16, -4); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(10, 4); ctx.lineTo(-14, 46); ctx.lineTo(-30, 42); ctx.lineTo(-16, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
      // Fuselage
      const fg = ctx.createLinearGradient(0, -14, 0, 14);
      fg.addColorStop(0, '#f8fbff'); fg.addColorStop(0.55, '#bae6fd'); fg.addColorStop(1, '#1d6ec2');
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.moveTo(46, 0); ctx.quadraticCurveTo(22, -14, -14, -12);
      ctx.lineTo(-52, -5); ctx.lineTo(-52, 5);
      ctx.lineTo(-14, 12); ctx.quadraticCurveTo(22, 14, 46, 0);
      ctx.fill(); ctx.stroke();
      // Racing stripe
      ctx.fillStyle = '#ffdf5a';
      ctx.fillRect(-38, -2.5, 68, 5);
      // Canopy
      ctx.fillStyle = '#ffe066';
      ctx.beginPath(); ctx.ellipse(4, -2, 15, 7, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      // Nose spinner
      ctx.fillStyle = '#ef4444';
      ctx.beginPath(); ctx.arc(46, 0, 6.5, -Math.PI/2, Math.PI/2); ctx.closePath(); ctx.fill(); ctx.stroke();
      // 4-frame spinning propeller aligned strictly at nose x=51
      const bladeLen = [32, 16, 29, 9][col];
      ctx.strokeStyle = 'rgba(224,248,255,0.45)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(51, 0, 26, -1.35, 1.35); ctx.stroke();
      ctx.fillStyle = '#1e293b'; ctx.strokeStyle = '#e2f6ff'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.ellipse(51, -bladeLen * 0.52, 3.2, bladeLen * 0.52, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(51, bladeLen * 0.52, 3.2, bladeLen * 0.52, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.restore();
    };

    const drawEscortJet = (cx, cy, col) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.lineJoin = 'round';
      // Animated plasma exhaust plume (no propeller!)
      const flLen = [24, 34, 28, 38][col];
      const fg = ctx.createLinearGradient(-46, 0, -46 - flLen, 0);
      fg.addColorStop(0, '#ffffff'); fg.addColorStop(0.35, '#ffdf5a'); fg.addColorStop(1, 'rgba(255,90,50,0)');
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.moveTo(-44, -6); ctx.lineTo(-44 - flLen, 0); ctx.lineTo(-44, 6); ctx.closePath(); ctx.fill();
      // Delta wings
      ctx.fillStyle = '#ef4444'; ctx.strokeStyle = INK; ctx.lineWidth = 3.2;
      ctx.beginPath(); ctx.moveTo(14, -5); ctx.lineTo(-32, -42); ctx.lineTo(-40, -34); ctx.lineTo(-28, -5); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(14, 5); ctx.lineTo(-32, 42); ctx.lineTo(-40, 34); ctx.lineTo(-28, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
      // Sleek body
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath(); ctx.moveTo(56, 0); ctx.lineTo(14, -12); ctx.lineTo(-44, -9); ctx.lineTo(-44, 9); ctx.lineTo(14, 12); ctx.closePath(); ctx.fill(); ctx.stroke();
      // Canopy
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath(); ctx.ellipse(16, 0, 17, 6.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      // Subtle gold chevron
      ctx.fillStyle = '#ffdf5a';
      ctx.beginPath(); ctx.moveTo(2, -4); ctx.lineTo(-18, -4); ctx.lineTo(-24, 0); ctx.lineTo(-18, 4); ctx.lineTo(2, 4); ctx.closePath(); ctx.fill();
      ctx.restore();
    };

    const drawMenuHeli = (cx, cy, col) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.lineJoin = 'round';
      // Tail boom
      ctx.fillStyle = '#f59e0b'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
      ctx.fillRect(-52, -4, 42, 8); ctx.strokeRect(-52, -4, 42, 8);
      // Spinning tail rotor
      const tailH = col % 2 === 0 ? 18 : 7;
      ctx.fillStyle = '#e0f2fe';
      ctx.beginPath(); ctx.ellipse(-52, 0, 3, tailH, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      // Cabin pod
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath(); ctx.ellipse(6, 2, 28, 16, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      // Cockpit glass
      ctx.fillStyle = '#67e8f9';
      ctx.beginPath(); ctx.ellipse(18, -1, 13, 9.5, 0.12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      // Landing skids
      ctx.strokeStyle = INK; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-14, 22); ctx.lineTo(26, 22); ctx.moveTo(-6, 16); ctx.lineTo(-8, 22); ctx.moveTo(16, 16); ctx.lineTo(18, 22); ctx.stroke();
      // Top rotor mast + 4-frame spinning main blades
      ctx.strokeStyle = 'rgba(224,242,254,0.42)'; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.ellipse(4, -18, 48, 8, 0, 0, Math.PI * 2); ctx.stroke();
      const span = [48, 22, 44, 10][col];
      ctx.fillStyle = '#334155'; ctx.strokeStyle = INK; ctx.lineWidth = 2.2;
      ctx.fillRect(4 - span, -20.5, span * 2, 5); ctx.strokeRect(4 - span, -20.5, span * 2, 5);
      ctx.fillStyle = '#ef4444';
      ctx.beginPath(); ctx.arc(4, -18, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.restore();
    };

    for (let col = 0; col < COLS; col++) {
      drawPropPlane(col * CW + 80, 0 * CH + 80, col);
      drawEscortJet(col * CW + 80, 1 * CH + 80, col);
      drawMenuHeli(col * CW + 80, 2 * CH + 80, col);
    }
    return c.toDataURL('image/webp', 0.94);
  })()`);
  saveDataUrl(join(uiDir, 'menu-aircraft.webp'), menuAirUrl);

  // 3. Stylized PlayStation 5 DualSense & Xbox/Generic & Android Landscape Illustrations for Controls Tab
  const dualSenseUrl = await evaluate(`(() => {
    const c = document.createElement('canvas'); c.width = 440; c.height = 270;
    const ctx = c.getContext('2d');
    const INK = '#081b3b';
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';

    // Grips & dual-tone DualSense body
    ctx.fillStyle = '#0f274c'; ctx.strokeStyle = INK; ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(118, 72); ctx.lineTo(322, 72);
    ctx.bezierCurveTo(372, 72, 404, 152, 392, 224);
    ctx.bezierCurveTo(384, 248, 354, 250, 336, 224);
    ctx.lineTo(304, 174); ctx.lineTo(136, 174); ctx.lineTo(104, 224);
    ctx.bezierCurveTo(86, 250, 56, 248, 48, 224);
    ctx.bezierCurveTo(36, 152, 68, 72, 118, 72);
    ctx.closePath(); ctx.fill(); ctx.stroke();

    // Pearl white DualSense shell wings
    const wg = ctx.createLinearGradient(0, 66, 0, 210);
    wg.addColorStop(0, '#ffffff'); wg.addColorStop(1, '#dbeafe');
    ctx.fillStyle = wg;
    ctx.beginPath();
    ctx.moveTo(112, 72); ctx.lineTo(156, 72); ctx.lineTo(146, 174); ctx.lineTo(104, 224);
    ctx.bezierCurveTo(86, 250, 56, 248, 48, 224); ctx.bezierCurveTo(36, 152, 68, 72, 112, 72); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(328, 72); ctx.lineTo(284, 72); ctx.lineTo(294, 174); ctx.lineTo(336, 224);
    ctx.bezierCurveTo(354, 250, 384, 248, 392, 224); ctx.bezierCurveTo(404, 152, 372, 72, 328, 72); ctx.closePath(); ctx.fill(); ctx.stroke();

    // Central touchpad with cyan edge glow
    ctx.fillStyle = '#1e3a6d';
    ctx.beginPath(); ctx.roundRect(156, 70, 128, 54, 8); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(160, 74, 120, 46, 6); ctx.stroke();

    // Left D-Pad (ACTIVE -> Cyan highlight)
    ctx.fillStyle = '#0e2954'; ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.circle?.(108, 118, 28);
    ctx.arc(108, 118, 27, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#f8fafc'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.fillRect(101, 98, 14, 40); ctx.strokeRect(101, 98, 14, 40);
    ctx.fillRect(88, 111, 40, 14); ctx.strokeRect(88, 111, 40, 14);

    // Left Stick (ACTIVE -> Cyan highlight)
    ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.arc(166, 154, 23, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#1e293b'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(166, 154, 17, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // Right Stick (dimmed unused)
    ctx.fillStyle = '#1e293b'; ctx.strokeStyle = '#475569'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(274, 154, 17, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // OPTIONS button (ACTIVE -> Gold/White pill)
    ctx.fillStyle = '#ffdf5a'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(290, 79, 10, 19, 4); ctx.fill(); ctx.stroke();

    // PlayStation Face Buttons: Triangle (dim), Circle (active back), Cross (active shoot), Square (active special)
    const face = (x, y, sym, col, active) => {
      ctx.save();
      ctx.fillStyle = active ? '#0b1e3f' : '#1b2b48';
      ctx.strokeStyle = active ? col : '#475569';
      ctx.lineWidth = active ? 3.5 : 2;
      ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = active ? col : '#64748b';
      ctx.font = 'bold 17px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(sym, x, y + 1);
      ctx.restore();
    };
    face(334, 96, '△', '#4ade80', false);
    face(360, 120, '○', '#fb7185', true);
    face(334, 144, '✕', '#38bdf8', true);
    face(308, 120, '□', '#ffdf5a', true);

    return c.toDataURL('image/webp', 0.94);
  })()`);
  saveDataUrl(join(uiDir, 'pad-dualsense.webp'), dualSenseUrl);

  const xboxUrl = await evaluate(`(() => {
    const c = document.createElement('canvas'); c.width = 440; c.height = 270;
    const ctx = c.getContext('2d');
    const INK = '#081b3b';
    ctx.fillStyle = '#1e293b'; ctx.strokeStyle = INK; ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(114, 68); ctx.lineTo(326, 68);
    ctx.bezierCurveTo(380, 74, 408, 152, 392, 224);
    ctx.bezierCurveTo(380, 248, 348, 246, 330, 214);
    ctx.lineTo(298, 174); ctx.lineTo(142, 174); ctx.lineTo(110, 214);
    ctx.bezierCurveTo(92, 246, 60, 248, 48, 224);
    ctx.bezierCurveTo(32, 152, 60, 74, 114, 68);
    ctx.closePath(); ctx.fill(); ctx.stroke();

    // Left stick active
    ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.arc(112, 118, 24, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#0f172a'; ctx.beginPath(); ctx.arc(112, 118, 18, 0, Math.PI * 2); ctx.fill();
    // D-pad active
    ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(166, 156, 20, 0, Math.PI * 2); ctx.stroke();
    // Menu button
    ctx.fillStyle = '#ffdf5a'; ctx.beginPath(); ctx.arc(248, 118, 9, 0, Math.PI * 2); ctx.fill();
    // Face buttons A/X/B/Y
    const face = (x, y, sym, col, active) => {
      ctx.fillStyle = '#0f172a'; ctx.strokeStyle = active ? col : '#475569'; ctx.lineWidth = active ? 3.5 : 2;
      ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = active ? col : '#64748b'; ctx.font = 'bold 16px Oxanium, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(sym, x, y + 1);
    };
    face(328, 94, 'Y', '#facc15', false);
    face(354, 118, 'B', '#fb7185', true);
    face(328, 142, 'A', '#4ade80', true);
    face(302, 118, 'X', '#38bdf8', true);
    return c.toDataURL('image/webp', 0.94);
  })()`);
  saveDataUrl(join(uiDir, 'pad-xbox.webp'), xboxUrl);

  const mobileUrl = await evaluate(`(() => {
    const c = document.createElement('canvas'); c.width = 440; c.height = 270;
    const ctx = c.getContext('2d');
    const INK = '#061938';
    // Horizontal Android smartphone silhouette
    ctx.fillStyle = '#0f172a'; ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.roundRect(24, 34, 392, 202, 26); ctx.fill(); ctx.stroke();
    // Screen inner area
    const bg = ctx.createLinearGradient(0, 48, 0, 222);
    bg.addColorStop(0, '#0c3b7a'); bg.addColorStop(1, '#105aa8');
    ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(42, 48, 356, 174, 12); ctx.fill();
    // Mini cockpit borders
    ctx.fillStyle = 'rgba(7,26,56,0.75)';
    ctx.fillRect(42, 48, 72, 174); ctx.fillRect(326, 48, 72, 174);
    ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(114, 48); ctx.lineTo(114, 222); ctx.moveTo(326, 48); ctx.lineTo(326, 222); ctx.stroke();
    // Mini player RIVET icon
    ctx.fillStyle = '#f8fafc'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(220, 165); ctx.lineTo(205, 192); ctx.lineTo(235, 192); ctx.closePath(); ctx.fill(); ctx.stroke();
    // Left Virtual Joystick
    ctx.fillStyle = 'rgba(14,165,233,0.28)'; ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(88, 174, 30, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#7dd3fc'; ctx.beginPath(); ctx.arc(88, 174, 13, 0, Math.PI * 2); ctx.fill();
    // Right FIRE button
    ctx.fillStyle = 'rgba(250,204,21,0.34)'; ctx.strokeStyle = '#ffdf5a';
    ctx.beginPath(); ctx.arc(352, 182, 26, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fffbeb'; ctx.font = 'bold 12px Oxanium, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('TIRO', 352, 182);
    // Right ESP button
    ctx.fillStyle = 'rgba(244,63,94,0.34)'; ctx.strokeStyle = '#fb7185';
    ctx.beginPath(); ctx.arc(318, 140, 20, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff1f2'; ctx.font = 'bold 11px Oxanium, sans-serif';
    ctx.fillText('ESP', 318, 140);
    // PAUSE HUD button top-right
    ctx.fillStyle = '#07214a'; ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(352, 58, 36, 20, 5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fde047'; ctx.fillRect(365, 63, 3.5, 10); ctx.fillRect(372, 63, 3.5, 10);
    return c.toDataURL('image/webp', 0.94);
  })()`);
  saveDataUrl(join(uiDir, 'mobile-landscape.webp'), mobileUrl);

  // 4. Optimize generated static sunlit sky panorama to WebP (1536x864 covers 16:9 & ultra/narrow ratios cleanly)
  const rawSkyPath = resolve('C:/Users/emers/.gemini/antigravity/brain/b3596df5-9f75-4a8d-802e-f10c1650a77d/sky_panorama_raw_1794794441304.jpg');
  const rawSkyB64 = readFileSync(rawSkyPath).toString('base64');
  const skyWebpUrl = await evaluate(`(async () => {
    const img = new Image();
    img.src = 'data:image/jpeg;base64,' + ${JSON.stringify(rawSkyB64)};
    await img.decode();
    const c = document.createElement('canvas');
    c.width = 1536; c.height = 864;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/webp', 0.90);
  })()`);
  const skyBytes = saveDataUrl(join(uiDir, 'sky-panorama.webp'), skyWebpUrl);

  console.log('Packed Menu Rework v1 assets successfully (logo variants, menu-aircraft, DualSense/Xbox/Android, sky-panorama.webp=' + skyBytes + 'B).');
} finally {
  socket?.close();
  chrome.kill();
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
