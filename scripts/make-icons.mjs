// Renders the app icons into public/icons with headless Chromium.
// Usage: npm run icons   (needs Playwright; falls back to a global install)
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(path.join(execSync('npm root -g').toString().trim(), 'playwright')); }

const out = path.resolve('public/icons');
mkdirSync(out, { recursive: true });

// scale = how much of the tile the mark fills (maskable icons keep it inside the safe zone).
const html = (scale) => `<!doctype html><html><head>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sofia+Sans+Extra+Condensed:wght@800&display=block">
<style>
html,body{margin:0;width:1024px;height:1024px;overflow:hidden}
.t{position:relative;width:1024px;height:1024px;overflow:hidden;background:linear-gradient(180deg,oklch(0.24 0.05 230),oklch(0.12 0.03 230))}
.b{position:absolute;border-radius:50%}
.s{position:absolute;inset:0;background:repeating-linear-gradient(180deg,rgba(0,0,0,.22) 0 3px,rgba(0,0,0,0) 3px 9px)}
.m{position:absolute;left:50%;top:50%;width:${Math.round(760 * scale)}px;height:${Math.round(760 * scale)}px;transform:translate(-50%,-50%);border-radius:${Math.round(210 * scale)}px;
  background:linear-gradient(165deg,rgba(255,255,255,.26),rgba(255,255,255,.05) 45%,rgba(255,255,255,.12)),rgba(14,12,22,.22);
  box-shadow:inset 0 0 0 3px rgba(255,255,255,.22),inset 0 5px 0 rgba(255,255,255,.6),inset 6px 0 0 -1px rgba(130,220,255,.35),inset -6px 0 0 -1px rgba(255,130,210,.3),0 60px 120px -40px rgba(0,0,0,.7);
  backdrop-filter:blur(30px) saturate(190%);display:grid;place-items:center}
.m::before{content:"";position:absolute;inset:0;border-radius:inherit;background:radial-gradient(110% 80% at 22% -12%,rgba(255,255,255,.4),rgba(255,255,255,0) 58%)}
.l{position:relative;font:800 ${Math.round(560 * scale)}px/.8 'Sofia Sans Extra Condensed',sans-serif;letter-spacing:-.01em;padding-top:${Math.round(40 * scale)}px;
  background:repeating-linear-gradient(180deg,#f5f4f2 0 ${Math.max(4, Math.round(9 * scale))}px,rgba(245,244,242,.5) ${Math.max(4, Math.round(9 * scale))}px ${Math.max(6, Math.round(13 * scale))}px);-webkit-background-clip:text;background-clip:text;color:transparent}
</style></head><body><div class="t">
<div class="b" style="left:-260px;top:-240px;width:900px;height:900px;background:radial-gradient(closest-side,oklch(.55 .17 90),oklch(.55 .17 90/.6) 42%,transparent)"></div>
<div class="b" style="left:330px;top:-80px;width:760px;height:760px;background:radial-gradient(closest-side,oklch(.5 .16 225),oklch(.5 .16 225/.6) 42%,transparent)"></div>
<div class="b" style="left:120px;top:420px;width:980px;height:980px;background:radial-gradient(closest-side,oklch(.52 .16 195),oklch(.52 .16 195/.6) 42%,transparent)"></div>
<div class="b" style="left:-320px;top:620px;width:900px;height:900px;background:radial-gradient(closest-side,oklch(.5 .16 160),oklch(.5 .16 160/.6) 42%,transparent)"></div>
<div class="s"></div>
<div class="m"><span class="l">LF</span></div>
</div></body></html>`;

const browser = await pw.chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
for (const [name, scale, size] of [['icon-512', 1, 512], ['icon-192', 1, 192], ['apple-touch-icon', 1, 180], ['maskable-512', 0.78, 512]]) {
  await page.setContent(html(scale), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const buf = await page.screenshot({ type: 'png' });
  const small = await browser.newPage({ viewport: { width: size, height: size } });
  await small.setContent(`<body style="margin:0"><img src="data:image/png;base64,${buf.toString('base64')}" style="width:${size}px;height:${size}px;display:block"></body>`);
  await small.screenshot({ path: path.join(out, name + '.png'), type: 'png' });
  await small.close();
  console.log('wrote', name);
}
await browser.close();
