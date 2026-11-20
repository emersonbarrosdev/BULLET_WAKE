/** Optional authorship step. Runtime/build use the versioned local font files offline. */
import { mkdirSync, writeFileSync } from 'node:fs';
const destination = 'public/assets/fonts';
mkdirSync(destination, { recursive: true });
const get = async url => { const response = await fetch(url); if (!response.ok) throw new Error(`${response.status}: ${url}`); return response; };
const source = 'https://fonts.googleapis.com/css2?family=Oxanium:wght@600;700;800&family=Rajdhani:wght@500;600;700&display=swap';
const css = await (await get(source)).text();
const blocks = [];
for (const match of css.matchAll(/@font-face\s*\{[^}]+\}/g)) {
  let block = match[0];
  const family = /font-family:\s*'([^']+)'/.exec(block)?.[1];
  const weight = /font-weight:\s*(\d+)/.exec(block)?.[1];
  const url = /url\((https:[^)]+)\)/.exec(block)?.[1];
  if (!family || !weight || !url) throw new Error('Unexpected font CSS.');
  const filename = `${family}-${weight}.${url.endsWith('.ttf') ? 'ttf' : 'woff2'}`;
  writeFileSync(`${destination}/${filename}`, Buffer.from(await (await get(url)).arrayBuffer()));
  blocks.push(block.replace(url, `./${filename}`));
}
writeFileSync(`${destination}/fonts.css`, blocks.join('\n\n') + '\n');
for (const family of ['oxanium', 'rajdhani']) {
  const url = `https://raw.githubusercontent.com/google/fonts/main/ofl/${family}/OFL.txt`;
  writeFileSync(`${destination}/${family}-OFL.txt`, await (await get(url)).text());
}
console.log(`Bundled ${blocks.length} font faces and both OFL licenses.`);
