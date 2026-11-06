#!/usr/bin/env node
/**
 * 375px 响应式与急症页结构验收（PRD 第 10 章 / A-1～A-8）
 * 用本机 Chrome 无头模式跑真实布局，不靠人眼。
 *
 * 用法：node scripts/check-responsive.mjs [--shots]
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const SHOTS = process.argv.includes('--shots');
const SHOT_DIR = path.join(ROOT, 'output/screens');
// 与 astro.config.mjs 保持一致：BASE_PATH=/BabyCare 时产物引用带前缀
const BASE = (process.env.BASE_PATH || '').replace(/\/$/, '');

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];
const executablePath = CHROME_CANDIDATES.find((p) => fs.existsSync(p));
if (!executablePath) {
  console.error('未找到 Chrome/Edge，无法执行布局验收');
  process.exit(1);
}

const ROUTES = [
  '/',
  '/age/0-1m',
  '/age/4-6m',
  '/age/13-24m',
  '/age/25-36m',
  '/quick',
  '/quick/acute-laryngitis',
  '/quick/choking',
  '/milestones',
  '/sources',
  '/404.html',
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

const server = http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  // 产物可能是带 base（如 /BabyCare）构建的：剥掉前缀再映射到 dist，
  // 否则页面里的 /BabyCare/_astro/*.css 会 404，样式失效会让 A-8 等断言假失败。
  if (BASE && (p === BASE || p.startsWith(BASE + '/'))) p = p.slice(BASE.length) || '/';
  if (p.endsWith('/')) p += 'index.html';
  let file = path.join(DIST, p);
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    file = path.join(file, 'index.html');
  }
  if (!fs.existsSync(file) && fs.existsSync(path.join(file, 'index.html'))) {
    file = path.join(file, 'index.html');
  }
  if (!fs.existsSync(file)) {
    res.writeHead(404, { 'Content-Type': MIME['.html'] });
    res.end(fs.readFileSync(path.join(DIST, '404.html')));
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

const port = await new Promise((resolve) => {
  server.listen(0, '127.0.0.1', () => resolve(server.address().port));
});
const origin = `http://127.0.0.1:${port}`;

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ['--no-sandbox', '--hide-scrollbars', '--font-render-hinting=none'],
});

const failures = [];
const notes = [];

if (SHOTS && !fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });

for (const route of ROUTES) {
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 667, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(origin + BASE + route, { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 250));

  const report = await page.evaluate(() => {
    const vw = window.innerWidth;
    const docW = document.documentElement.scrollWidth;
    const bodyW = document.body.scrollWidth;

    // 横向溢出元素：右边界超出视口，且自身宽度有实质内容
    const overflow = [];
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.right > vw + 1.5 || r.left < -1.5) {
        const style = getComputedStyle(el);
        // 横向滚动容器（stage-strip）内部元素允许越界
        let p = el.parentElement;
        let inScroller = false;
        while (p && p !== document.body) {
          const ps = getComputedStyle(p);
          if (ps.overflowX === 'auto' || ps.overflowX === 'scroll') {
            inScroller = true;
            break;
          }
          p = p.parentElement;
        }
        if (inScroller) continue;
        if (style.position === 'fixed') continue;
        // 刻意移出视口的无障碍元素（skip-link / sr-only）不算溢出
        if (r.right < 0 || r.left < -1000) continue;
        if (el.closest('.skip-link')) continue;
        overflow.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.className || '').toString().slice(0, 40),
          right: Math.round(r.right),
          width: Math.round(r.width),
        });
      }
    }

    // 触控目标：只检查独立控件与卡片（正文内联链接按 WCAG 允许小于 44px）
    const STRICT = [
      'button',
      'select',
      'input[type="date"]',
      'input[type="search"]',
      '.nav a',
      '.stage-strip a',
      '.stage-list a',
      '.qitem',
      '.entry-card',
      '.kcard > summary',
      '.cat-toggle button',
      'details.source-fold > summary',
      '.acute-entry',
      '.age-result a',
    ].join(',');
    const small = [];
    for (const el of Array.from(document.querySelectorAll(STRICT))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      if (r.height < 44 || r.width < 44) {
        small.push({
          tag: el.tagName.toLowerCase(),
          text: (el.textContent || '').trim().slice(0, 16),
          w: Math.round(r.width),
          h: Math.round(r.height),
        });
      }
    }
    // 复选框：以其 label 的整行热区为准
    const checkSmall = [];
    for (const cb of Array.from(document.querySelectorAll('.checklist input[type="checkbox"]'))) {
      const label = cb.closest('label');
      const r = (label ?? cb).getBoundingClientRect();
      if (r.height > 0 && r.height < 44) checkSmall.push(Math.round(r.height));
    }

    return {
      vw,
      docW,
      bodyW,
      overflow: overflow.slice(0, 8),
      overflowCount: overflow.length,
      smallCount: small.length + checkSmall.length,
      small: small.slice(0, 6).concat(checkSmall.slice(0,2).map(h => ({tag:'checkbox-row',text:'',w:0,h}))),
      hasStageStrip: !!document.querySelector('.stage-strip'),
      hasNodePicker: !!document.querySelector('#node'),
      hasAgeResult: !!document.querySelector('#age-result'),
      sevCount: document.querySelectorAll('.sev').length,
      sevOrder: Array.from(document.querySelectorAll('.sev .lv span:last-child')).map((e) =>
        (e.textContent || '').trim()
      ),
      sevLevelTags: Array.from(document.querySelectorAll('.sev .lbl')).map((e) =>
        (e.textContent || '').trim()
      ),
      alertBarTop: (() => {
        const el = document.querySelector('.alert-bar');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { top: Math.round(r.top), h: Math.round(r.height) };
      })(),
      h1: document.querySelector('h1')?.textContent?.trim() ?? '',
    };
  });

  if (report.docW > report.vw + 1) {
    failures.push(`${route}: 出现横向滚动 scrollWidth=${report.docW} > ${report.vw}`);
  }
  if (report.overflowCount > 0) {
    failures.push(
      `${route}: ${report.overflowCount} 个元素超出视口 → ${report.overflow
        .map((o) => `${o.tag}.${o.cls}(右${o.right})`)
        .join(', ')}`
    );
  }

  if (route.startsWith('/quick/') && route !== '/quick') {
    if (report.hasStageStrip) failures.push(`${route}: [A-4] 急症页出现月龄导航条`);
    if (report.hasNodePicker) failures.push(`${route}: [A-4] 急症页出现月龄选择器`);
    if (report.sevCount !== 3) failures.push(`${route}: 三级分诊卡数量 = ${report.sevCount}，应为 3`);
    const want = ['可以密切观察', '立即就医', '立即拨打 120'];
    if (report.sevOrder.join('|') !== want.join('|')) {
      failures.push(`${route}: 分级顺序错误 → ${report.sevOrder.join(' / ')}`);
    }
    if (report.sevLevelTags.join('|') !== '第 1 级|第 2 级|第 3 级') {
      failures.push(`${route}: 级别序号缺失 → ${report.sevLevelTags.join(' / ')}`);
    }
    if (!report.alertBarTop || report.alertBarTop.top > 160) {
      failures.push(`${route}: [A-8] 红色警示条不在首屏（top=${report.alertBarTop?.top}）`);
    }
    // 滚动后应贴顶且不被页头遮挡
    await page.evaluate(() => window.scrollTo(0, 420));
    await new Promise((r) => setTimeout(r, 120));
    const sticky = await page.evaluate(() => {
      const el = document.querySelector('.alert-bar');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const header = document.querySelector('.site-header');
      const hr = header ? header.getBoundingClientRect() : null;
      return { top: Math.round(r.top), headerBottom: hr ? Math.round(hr.bottom) : 0, scrollY: Math.round(window.scrollY) };
    });
    if (!sticky || Math.abs(sticky.top) > 1) {
      failures.push(`${route}: [A-8] 滚动后警示条未贴顶（top=${sticky?.top}）`);
    }
    if (sticky && sticky.headerBottom > sticky.top) {
      failures.push(`${route}: [A-8] 警示条被页头遮挡`);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
  }

  if (route === '/') {
    if (!report.hasAgeResult) failures.push('/: 缺少月龄结果区');
    // 首屏完整性：急症入口与日期输入在 667 高度内
    const firstScreen = await page.evaluate(() => {
      const pick = document.querySelector('#birth-date');
      const acute = document.querySelector('.acute-entry');
      const rect = (el) => (el ? el.getBoundingClientRect() : null);
      const a = rect(acute);
      const p = rect(pick);
      return {
        acuteBottom: a ? Math.round(a.bottom) : null,
        pickerTop: p ? Math.round(p.top) : null,
        vh: window.innerHeight,
      };
    });
    if (firstScreen.acuteBottom === null || firstScreen.acuteBottom > firstScreen.vh) {
      failures.push(
        `/: 急症入口未在首屏内（bottom=${firstScreen.acuteBottom} > vh=${firstScreen.vh}）`
      );
    }
    notes.push(
      `/ 首屏：日期输入 top=${firstScreen.pickerTop}，急症入口 bottom=${firstScreen.acuteBottom}，视口高=${firstScreen.vh}`
    );
  }

  notes.push(
    `${route}  scrollWidth=${report.docW}  触控<44px=${report.smallCount}${
      report.smallCount ? '（' + report.small.map((s) => s.tag + ':' + s.w + '×' + s.h).join(',') + '）' : ''
    }`
  );

  if (SHOTS) {
    const name = route === '/' ? 'home' : route.replace(/^\//, '').replace(/[/.]/g, '-');
    await page.screenshot({ path: path.join(SHOT_DIR, `m-${name}.png`), fullPage: false });
    await page.screenshot({ path: path.join(SHOT_DIR, `m-${name}-full.png`), fullPage: true });
  }

  await page.close();
}

// 桌面视口抽查（三级卡片应三列并排）
const desk = await browser.newPage();
await desk.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });
for (const route of ['/', '/quick/acute-laryngitis', '/milestones']) {
  await desk.goto(origin + route, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 200));
  if (route === '/quick/acute-laryngitis') {
    const cols = await desk.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.sev'));
      if (cards.length < 3) return -1;
      const tops = cards.map((c) => Math.round(c.getBoundingClientRect().top));
      return new Set(tops).size === 1 ? 3 : 1;
    });
    if (cols !== 3) failures.push(`/quick/acute-laryngitis: 桌面端三级卡片未三列并排（检测=${cols}）`);
  }
  if (SHOTS) {
    const name = route === '/' ? 'home' : route.replace(/^\//, '').replace(/[/.]/g, '-');
    await desk.screenshot({ path: path.join(SHOT_DIR, `d-${name}.png`), fullPage: false });
    await desk.screenshot({ path: path.join(SHOT_DIR, `d-${name}-full.png`), fullPage: true });
  }
}
await desk.close();

await browser.close();
server.close();

console.log('\n=== 375px 验收 ===');
notes.forEach((n) => console.log('  ' + n));

if (failures.length) {
  console.error(`\n✗ ${failures.length} 项未通过：`);
  failures.forEach((f) => console.error('  · ' + f));
  process.exit(1);
}
console.log('\n✓ 全部通过（无横向滚动 / 急症页结构正确 / 首屏完整）\n');
