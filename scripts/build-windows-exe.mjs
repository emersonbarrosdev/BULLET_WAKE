/**
 * Packages the production web bundle (`dist/`) into a standalone offline Windows Electron app (`Bullet Wake.exe`),
 * using the locally cached Electron win32-x64 runtime (zero extra npm bloat).
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve('.');
const distDir = join(root, 'dist');
if (!existsSync(join(distDir, 'index.html'))) {
  throw new Error('dist/index.html not found. Run `npm run build` first.');
}

const cacheRoot = join(process.env.LOCALAPPDATA ?? join(homedir(), 'AppData/Local'), 'electron', 'Cache');
function findElectronZip(dir) {
  const found = [];
  if (!existsSync(dir)) return found;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...findElectronZip(full));
    else if (/^electron-v[\d.]+-win32-x64\.zip$/i.test(entry.name)) found.push(full);
  }
  return found;
}

const zips = findElectronZip(cacheRoot).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
if (!zips.length) {
  throw new Error(`No cached win32-x64 Electron runtime found in ${cacheRoot}.`);
}
const electronZip = zips[0];
console.log('Using cached Electron runtime:', electronZip);

const outDir = join(root, 'output', 'windows', 'Bullet Wake');
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

// Extract Electron runtime using PowerShell Expand-Archive (built into Windows)
execFileSync('powershell.exe', [
  '-NoProfile', '-Command',
  `Expand-Archive -LiteralPath '${electronZip.replace(/'/g, "''")}' -DestinationPath '${outDir.replace(/'/g, "''")}' -Force`,
], { stdio: 'inherit' });

const origExe = join(outDir, 'electron.exe');
const targetExe = join(outDir, 'Bullet Wake.exe');
if (existsSync(origExe)) renameSync(origExe, targetExe);

// Remove default_app.asar if present so Electron boots our app directory
const defaultAsar = join(outDir, 'resources', 'default_app.asar');
if (existsSync(defaultAsar)) rmSync(defaultAsar, { force: true });

const appDir = join(outDir, 'resources', 'app');
mkdirSync(appDir, { recursive: true });
cpSync(distDir, join(appDir, 'dist'), { recursive: true });

// Copy PNG icon and generate Windows .ico via ffmpeg (for taskbar & shortcuts)
const srcIconPng = join(root, 'public', 'assets', 'brand', 'bullet-wake-logo-compact.png');
const appIconPng = join(appDir, 'icon.png');
const appIconIco = join(appDir, 'icon.ico');
if (existsSync(srcIconPng)) {
  cpSync(srcIconPng, appIconPng);
  try {
    execFileSync('ffmpeg', [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-i', srcIconPng,
      '-vf', 'scale=256:256:force_original_aspect_ratio=decrease,pad=256:256:(ow-iw)/2:(oh-ih)/2:color=0x00000000',
      appIconIco,
    ], { stdio: 'ignore' });
  } catch { /* PNG icon still works in BrowserWindow */ }
}

writeFileSync(join(appDir, 'package.json'), JSON.stringify({
  name: 'bullet-wake-desktop',
  productName: 'Bullet Wake',
  version: '0.1.0',
  main: 'main.js',
}, null, 2));

writeFileSync(join(appDir, 'main.js'), `const { app, BrowserWindow, protocol, Menu } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const DIST_ROOT = path.join(__dirname, 'dist');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
};

// Fixed privileged origin keeps localStorage saves permanent across restarts with full WebGL/Audio/CORS support.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'bulletwake',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

app.setName('Bullet Wake');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

function createWindow() {
  Menu.setApplicationMenu(null);
  const win = new BrowserWindow({
    title: 'BULLET WAKE',
    width: 1280,
    height: 752,
    minWidth: 960,
    minHeight: 560,
    backgroundColor: '#040d21',
    icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true,
    useContentSize: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    }
  });

  win.on('minimize', () => {
    win.webContents.executeJavaScript("window.dispatchEvent(new Event('blur'))").catch(() => {});
  });
  win.on('restore', () => {
    win.webContents.executeJavaScript("window.dispatchEvent(new Event('focus'))").catch(() => {});
  });

  win.loadURL('bulletwake://app/index.html');
}

app.whenReady().then(() => {
  protocol.handle('bulletwake', async (request) => {
    const url = new URL(request.url);
    let relPath = decodeURIComponent(url.pathname);
    if (relPath === '/' || !relPath) relPath = '/index.html';
    const safePath = path.normalize(relPath).replace(/^(\\.\\.[\\/\\\\])+/, '');
    const filePath = path.join(DIST_ROOT, safePath);
    if (!filePath.startsWith(DIST_ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      return new Response('Not Found', { status: 404 });
    }
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    const stat = fs.statSync(filePath);
    const range = request.headers.get('range');
    if (range) {
      const m = /^bytes=(\\d*)-(\\d*)$/.exec(range);
      if (m) {
        const start = m[1] ? Number(m[1]) : 0;
        const end = m[2] ? Math.min(Number(m[2]), stat.size - 1) : stat.size - 1;
        const chunkSize = Math.max(0, end - start + 1);
        const buf = Buffer.alloc(chunkSize);
        const fd = fs.openSync(filePath, 'r');
        fs.readSync(fd, buf, 0, chunkSize, start);
        fs.closeSync(fd);
        return new Response(buf, {
          status: 206,
          headers: {
            'Content-Type': mime,
            'Accept-Ranges': 'bytes',
            'Content-Range': \`bytes \${start}-\${end}/\${stat.size}\`,
            'Content-Length': String(chunkSize),
          },
        });
      }
    }
    const data = fs.readFileSync(filePath);
    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': mime,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(stat.size),
        'Cache-Control': 'no-store',
      },
    });
  });

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
`);

console.log('Windows standalone app ready at:', targetExe, `(${Math.round(statSync(targetExe).size / 1024)} KB launcher)`);
