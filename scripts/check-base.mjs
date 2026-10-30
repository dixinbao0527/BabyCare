/**
 * 部署路径验收：把 dist 挂到 BASE 子路径下（模拟 GitHub Pages 项目页 /BabyCare/），
 * 用无头 Chrome 真实访问，检查：
 *   1. 所有页面无 404 资源（CSS / JS / JSON / 图标）
 *   2. 站内链接都能落到实际文件（无死链）
 *   3. 客户端搜索能真正取到 search-index.json 并渲染结果
 *   4. 任意页面都不出现"根路径裸链接"（说明漏了 withBase）
 *
 * 用法：BASE_PATH=/BabyCare node scripts/check-base.mjs
 */
import puppeteer from 'puppeteer-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const DIST = path.join(process.cwd(), 'dist');
const BASE = (process.env.BASE_PATH || '/').replace(/\/$/, '');
const CHROME =
  process.env.CHROME_PATH ||
  ['C:/Program Files/Google/Chrome/Application/chrome.exe',
   'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

const failures = [];
const fail = (m) => failures.push(m);

function resolveFile(urlPath) {
  let p = decodeURIComponent(urlPath.split('#')[0].split('?')[0]);
  if (!p.startsWith(BASE + '/') && p !== BASE) return null; // 不在 base 下
  p = p.slice(BASE.length) || '/';
  let file = path.join(DIST, p);
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file) && fs.existsSync(file + '.html')) file += '.html';
  if (!fs.existsSync(file)) file = path.join(DIST, p, 'index.html');
  return fs.existsSync(file) ? file : null;
}

// 静态扫描：找出没有带上 base 的站内绝对链接
function scanBareAbsoluteLinks() {
  const bad = new Map();
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (/\.(html|js)$/.test(name)) {
        const s = fs.readFileSync(p, 'utf8');
        for (const m of s.matchAll(/(?:href|src)="(\/[^"]*)"/g)) {
          const url = m[1];
          if (url.startsWith('//')) continue;
          if (BASE && !url.startsWith(BASE + '/') && url !== BASE) {
            const key = `${url}`;
            if (!bad.has(key)) bad.set(key, path.relative(DIST, p));
          }
        }
        // JS 里的 fetch('/xxx.json')
        for (const m of s.matchAll(/fetch\(["'](\/[^"']*)["']/g)) {
          const url = m[1];
          if (BASE && !url.startsWith(BASE + '/')) {
            const key = `fetch:${url}`;
            if (!bad.has(key)) bad.set(key, path.relative(DIST, p));
          }
        }
      }
    }
  };
  walk(DIST);
  return bad;
}

const bad = scanBareAbsoluteLinks();
if (bad.size) {
  for (const [url, where] of bad) fail(`漏了 base 前缀：${url}（${where}）`);
} else {
  console.log(`✓ 静态扫描：${BASE} 下无裸根路径链接`);
}

// 启动按 BASE 前缀提供服务的静态服务器
const server = http.createServer((req, res) => {
  const file = resolveFile(req.url || '/');
  if (!file) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('not found');
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
const port = await new Promise((r) => server.listen(0, '127.0.0.1', () => r(server.address().port)));
const origin = `http://127.0.0.1:${port}`;

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const pages = [
  '/',
  '/quick',
  '/milestones',
  '/sources',
  '/quick/acute-laryngitis',
  '/quick/febrile-seizure',
  '/age/0-1m',
  '/age/4-6m',
  '/age/13-24m',
  '/age/25-36m',
];

const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });

const missing = [];
page.on('response', (r) => {
  if (r.status() >= 400) missing.push(`${r.status()} ${r.url()}`);
});
page.on('requestfailed', (r) => missing.push(`FAILED ${r.url()}`));

for (const route of pages) {
  missing.length = 0;
  const url = `${origin}${BASE}${route}`;
  await page.goto(url, { waitUntil: 'networkidle0' });
  if (missing.length) fail(`${route}: 资源 ${missing.join(' | ')}`);
}

// 站内链接可达性（在同一页面上下文里解析所有内链）
await page.goto(`${origin}${BASE}/`, { waitUntil: 'networkidle0' });
const internal = await page.evaluate((base) => {
  const out = new Set();
  for (const a of document.querySelectorAll('a[href]')) {
    const raw = a.getAttribute('href');
    if (!raw || raw.startsWith('#') || /^(https?:|mailto:|tel:)/.test(raw)) continue;
    out.add(raw.split('#')[0]);
  }
  return [...out].filter((h) => h.startsWith('/'));
}, BASE);

const deadLinks = [];
for (const href of internal) {
  if (!resolveFile(href.split('#')[0])) deadLinks.push(href);
}
if (deadLinks.length) fail(`首页死链：${deadLinks.join(', ')}`);

// 搜索功能：确认能真正拿到索引并出结果
await page.goto(`${origin}${BASE}/quick`, { waitUntil: 'networkidle0' });
const searchOk = await page.evaluate(async () => {
  const input = document.querySelector('#q');
  if (!input) return { ok: false, why: 'no input' };
  input.value = '抽搐';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 900));
  const items = document.querySelectorAll('.qitem');
  return { ok: items.length > 0, count: items.length };
});
if (!searchOk.ok) fail(`/quick 搜索无结果（${searchOk.why ?? searchOk.count}）`);

await browser.close();
server.close();

if (failures.length) {
  console.error(`\n✗ 部署路径验收失败（base=${BASE || '/'}）`);
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log(`✓ 部署路径验收通过（base=${BASE}）：${pages.length} 个页面无 404，${internal.length} 条内链可达，搜索正常`);
