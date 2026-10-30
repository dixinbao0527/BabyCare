#!/usr/bin/env node
/**
 * 交互行为验收：出生日期定位 / 本地记忆 / 早产矫正 / 搜索 / 预警征象提示条
 * 用真实浏览器跑，避免"看起来对但点了没反应"。
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const DIST = path.join(process.cwd(), 'dist');
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => fs.existsSync(p));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  let file = path.join(DIST, p);
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) {
    res.writeHead(404, { 'Content-Type': MIME['.html'] });
    res.end(fs.readFileSync(path.join(DIST, '404.html')));
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'text/plain' });
  fs.createReadStream(file).pipe(res);
});

const port = await new Promise((r) => server.listen(0, '127.0.0.1', () => r(server.address().port)));
const origin = `http://127.0.0.1:${port}`;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
const fails = [];
const logs = [];
const ok = (cond, msg) => {
  if (!cond) fails.push(msg);
};

const monthsAgo = (m) => {
  const d = new Date();
  d.setMonth(d.getMonth() - m);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/* ---------------- 首页：日期输入 → 阶段定位 ---------------- */
{
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(`${origin}/`, { waitUntil: 'networkidle0' });

  const initialEmpty = await page.$eval('#stage-empty', (el) => !el.hidden);
  ok(initialEmpty, '首页初始状态应显示 7 个阶段入口列表');

  // 5 个月前出生 → 应落在 4-6m
  await page.$eval('#birth-date', (el, v) => {
    el.value = v;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, monthsAgo(5));

  await new Promise((r) => setTimeout(r, 200));

  const state = await page.evaluate(() => ({
    text: document.querySelector('#age-result')?.textContent?.trim() ?? '',
    visiblePanel: Array.from(document.querySelectorAll('[data-stage-panel]'))
      .filter((p) => !p.hidden)
      .map((p) => p.dataset.stagePanel),
    storage: localStorage.getItem('ich.birth.v1'),
    currentPill: document.querySelector('.stage-strip a[aria-current="true"]')?.dataset.range ?? null,
    emptyHidden: document.querySelector('#stage-empty')?.hidden,
  }));

  ok(/5 个月/.test(state.text), `5 月龄文案未出现：${state.text.slice(0, 60)}`);
  ok(/4～6 个月阶段/.test(state.text), `未显示 4～6 个月阶段：${state.text.slice(0, 60)}`);
  ok(state.visiblePanel.length === 1 && state.visiblePanel[0] === '4-6m', `可见阶段面板错误：${state.visiblePanel}`);
  ok(!!state.storage, '未写入 localStorage');
  ok(state.currentPill === '4-6m', `阶段胶囊未高亮：${state.currentPill}`);
  ok(state.emptyHidden === true, '定位后 7 阶段列表未隐藏');

  // 阶段卡片数量应为 4（首页取 order 最小 4 条）
  const cardCount = await page.$$eval('[data-stage-panel="4-6m"] .entry-card', (els) => els.length);
  ok(cardCount === 4, `首页 4-6m 卡片数 = ${cardCount}，应为 4`);

  // 刷新后应恢复
  await page.reload({ waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 200));
  const afterReload = await page.evaluate(() => ({
    text: document.querySelector('#age-result')?.textContent?.trim() ?? '',
    input: document.querySelector('#birth-date')?.value,
  }));
  ok(/5 个月/.test(afterReload.text), '刷新后未恢复月龄');
  ok(!!afterReload.input, '刷新后输入框未回填');

  // 清除本机记录
  await page.click('#clear-storage');
  await new Promise((r) => setTimeout(r, 150));
  const afterClear = await page.evaluate(() => ({
    empty: !document.querySelector('#stage-empty')?.hidden,
    storage: localStorage.getItem('ich.birth.v1'),
    text: document.querySelector('#age-result')?.textContent?.trim() ?? '',
  }));
  ok(afterClear.empty, '清除后未回到未输入状态');
  ok(afterClear.storage === null, '清除后 localStorage 仍有值');

  // 未来日期应被拒绝
  await page.$eval('#birth-date', (el) => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    const p = (n) => String(n).padStart(2, '0');
    el.value = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 150));
  const future = await page.$eval('#age-result', (el) => el.textContent ?? '');
  ok(/不能晚于今天/.test(future), `未来日期未提示：${future.slice(0, 40)}`);

  logs.push('首页：初始列表 → 5 月龄定位 → 刷新恢复 → 清除 → 未来日期拦截，均正常');
  await page.close();
}

/* ---------------- 早产矫正 ---------------- */
{
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(`${origin}/`, { waitUntil: 'networkidle0' });
  await page.$eval('#birth-date', (el, v) => {
    el.value = v;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, monthsAgo(5));
  await page.select('#ga-select', '34');
  await new Promise((r) => setTimeout(r, 200));
  const text = await page.$eval('#age-result', (el) => el.textContent ?? '');
  ok(/矫正/.test(text), `早产未显示矫正说明：${text.slice(0, 80)}`);
  ok(/实际月龄 5 个月/.test(text), `早产未显示实际月龄：${text.slice(0, 80)}`);
  ok(/个月 \d+ 天/.test(text), `早产未给出矫正月龄的"X 个月 N 天"表达：${text.slice(0, 90)}`);
  logs.push(`早产矫正：${text.replace(/\s+/g, ' ').slice(0, 80)}`);
  await page.close();
}

/* ---------------- 里程碑：勾选 → 就医提示条 ---------------- */
{
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(`${origin}/milestones`, { waitUntil: 'networkidle0' });

  const beforeHidden = await page.$eval('#referral', (el) => el.hidden);
  ok(beforeHidden, '未勾选时提示条应隐藏');

  await page.click('.checklist input[type="checkbox"]');
  await new Promise((r) => setTimeout(r, 150));
  const afterShow = await page.evaluate(() => {
    const el = document.querySelector('#referral');
    return { hidden: el.hidden, text: el.textContent?.trim() ?? '', pos: getComputedStyle(el).position };
  });
  ok(!afterShow.hidden, '勾选后提示条未出现');
  ok(/建议尽快咨询儿科医生/.test(afterShow.text), '提示条文案错误');
  ok(afterShow.pos === 'sticky', `提示条定位应为 sticky，实际 ${afterShow.pos}`);

  await page.click('.checklist input[type="checkbox"]');
  await new Promise((r) => setTimeout(r, 150));
  const afterHide = await page.$eval('#referral', (el) => el.hidden);
  ok(afterHide, '取消勾选后提示条未隐藏');

  // 切换月龄节点
  await page.select('#node', '12');
  await new Promise((r) => setTimeout(r, 150));
  const sections = await page.evaluate(() => {
    const visible = Array.from(document.querySelectorAll('section[data-node]'))
      .filter((s) => !s.hidden)
      .map((s) => s.dataset.node);
    return visible;
  });
  ok(sections.length === 1 && sections[0] === '12', `切换节点后可见区块错误：${sections}`);

  logs.push('里程碑：勾选出现提示条（sticky）→ 取消隐藏 → 切换节点正常');
  await page.close();
}

/* ---------------- 搜索 ---------------- */
{
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(`${origin}/quick`, { waitUntil: 'networkidle0' });

  await page.type('#q', '抽搐', { delay: 30 });
  await new Promise((r) => setTimeout(r, 600));
  const r1 = await page.evaluate(() => ({
    text: document.querySelector('#search-results')?.textContent ?? '',
    hidden: document.querySelector('#search-results')?.hidden,
    defaultHidden: document.querySelector('#default-view')?.hidden,
    marks: document.querySelectorAll('#search-results mark').length,
  }));
  ok(!r1.hidden, '搜索结果区未显示');
  ok(r1.defaultHidden, '搜索时默认视图未隐藏');
  ok(/热性惊厥/.test(r1.text), `搜索「抽搐」未命中热性惊厥：${r1.text.slice(0, 60)}`);
  ok(r1.marks > 0, '搜索结果未高亮命中词');

  await page.$eval('#q', (el) => {
    el.value = '';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.type('#q', 'zzzz没有这个词', { delay: 10 });
  await new Promise((r) => setTimeout(r, 600));
  const r2 = await page.evaluate(() => document.querySelector('#search-results')?.textContent ?? '');
  ok(/没找到/.test(r2), `空结果未显示兜底：${r2.slice(0, 60)}`);
  ok(/急性喉炎/.test(r2), '空结果未给出急症快捷入口');

  // 分类筛选
  await page.$eval('#q', (el) => {
    el.value = '';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 300));
  await page.click('[data-cat="sleep"]');
  await new Promise((r) => setTimeout(r, 150));
  const cats = await page.evaluate(() => ({
    visible: Array.from(document.querySelectorAll('[data-cat-group]'))
      .filter((g) => !g.hidden)
      .map((g) => g.dataset.catGroup),
    pressed: document.querySelector('[data-cat="sleep"]')?.getAttribute('aria-pressed'),
  }));
  ok(cats.visible.length === 1 && cats.visible[0] === 'sleep', `分类筛选错误：${cats.visible}`);
  ok(cats.pressed === 'true', '分类按钮未标记选中');

  logs.push('搜索：命中并高亮 / 空结果兜底 / 分类筛选，均正常');
  await page.close();
}

/* ---------------- 索引体积 ---------------- */
{
  const stat = fs.statSync(path.join(DIST, 'search-index.json'));
  ok(stat.size <= 60 * 1024, `search-index.json 体积 ${(stat.size / 1024).toFixed(1)}KB 超过 60KB 预算`);
  logs.push(`索引体积：${(stat.size / 1024).toFixed(1)}KB（预算 60KB）`);
}

await browser.close();
server.close();

console.log('\n=== 交互验收 ===');
logs.forEach((l) => console.log('  · ' + l));
if (fails.length) {
  console.error(`\n✗ ${fails.length} 项未通过：`);
  fails.forEach((f) => console.error('  · ' + f));
  process.exit(1);
}
console.log('\n✓ 全部交互断言通过\n');
