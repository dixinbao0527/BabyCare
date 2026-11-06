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

  const initialDefault = await page.evaluate(() => {
    const panel = document.querySelector('[data-stage-panel="0-1m"]');
    return {
      visible: !!panel && !panel.hidden,
      stage: document.querySelector('#stage-name')?.textContent?.trim() ?? '',
      pills: document.querySelectorAll('.stage-strip a').length,
    };
  });
  ok(initialDefault.visible, '首页初始状态应显示 0～1 个月内容');
  ok(initialDefault.stage === '0～1 个月', `首页初始阶段标题错误：${initialDefault.stage}`);
  ok(initialDefault.pills === 7, `成长轴阶段入口应为 7 个，实际 ${initialDefault.pills}`);

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
    stageName: document.querySelector('#stage-name')?.textContent?.trim() ?? '',
  }));

  ok(/5 个月/.test(state.text), `5 月龄文案未出现：${state.text.slice(0, 60)}`);
  ok(/4～6 个月阶段/.test(state.text), `未显示 4～6 个月阶段：${state.text.slice(0, 60)}`);
  ok(state.visiblePanel.length === 1 && state.visiblePanel[0] === '4-6m', `可见阶段面板错误：${state.visiblePanel}`);
  ok(!!state.storage, '未写入 localStorage');
  ok(state.currentPill === '4-6m', `阶段胶囊未高亮：${state.currentPill}`);
  ok(state.stageName === '4～6 个月', `阶段标题未更新：${state.stageName}`);

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
  const afterClear = await page.evaluate(() => {
    const panel = document.querySelector('[data-stage-panel="0-1m"]');
    return {
      panel0: !!panel && !panel.hidden,
      storage: localStorage.getItem('ich.birth.v1'),
      text: document.querySelector('#age-result')?.textContent?.trim() ?? '',
      input: document.querySelector('#birth-date')?.value ?? '',
      resultHidden: document.querySelector('#age-result')?.hidden,
      markerHidden: document.querySelector('#axis-marker')?.hidden,
    };
  });
  ok(afterClear.panel0, '清除后未回到默认 0～1 个月内容');
  ok(afterClear.storage === null, '清除后 localStorage 仍有值');
  ok(afterClear.input === '', '清除后输入框仍有值');
  ok(afterClear.resultHidden === true, '清除后月龄结果区仍显示');
  ok(afterClear.markerHidden === true, '清除后成长轴标记仍显示');

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

  logs.push('首页：默认阶段 → 5 月龄定位 → 刷新恢复 → 清除 → 未来日期拦截，均正常');
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

/* ---------------- 全局搜索（页头 ⌘K） ---------------- */
{
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(`${origin}/`, { waitUntil: 'networkidle0' });

  await page.click('#search-open');
  await new Promise((r) => setTimeout(r, 250));
  const opened = await page.$eval('#global-search', (el) => el.open);
  ok(opened, '页头搜索未打开弹层');

  await page.type('#gs-input', '抽搐', { delay: 30 });
  await new Promise((r) => setTimeout(r, 700));
  const gs = await page.evaluate(() => ({
    count: document.querySelectorAll('.gs-item').length,
    text: document.querySelector('#gs-results')?.textContent ?? '',
    countText: document.querySelector('#gs-count')?.textContent ?? '',
  }));
  ok(gs.count > 0, '全局搜索无结果');
  ok(/热性惊厥/.test(gs.text), `全局搜索「抽搐」未命中热性惊厥：${gs.text.slice(0, 60)}`);
  ok(/共 \d+ 条内容/.test(gs.countText), `全局搜索索引计数异常：${gs.countText}`);

  await page.keyboard.press('Escape');
  await new Promise((r) => setTimeout(r, 200));
  const closed = await page.$eval('#global-search', (el) => el.open);
  ok(!closed, 'Esc 未关闭全局搜索');

  logs.push('全局搜索：页头打开 → 命中急症 → Esc 关闭，均正常');
  await page.close();
}

/* ---------------- 里程碑窗口图 ---------------- */
{
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(`${origin}/milestones`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.removeItem('ich.birth.v1'));
  await page.reload({ waitUntil: 'networkidle0' });

  const initial = await page.evaluate(() => ({
    rows: document.querySelectorAll('.mw-name').length,
    bars: document.querySelectorAll('.mw-bar').length,
    ticks: document.querySelectorAll('.mw-ticks span').length,
    nowHidden: document.querySelector('#mw-now')?.hidden,
    textHidden: document.querySelector('#mw-now-text')?.hidden,
    hintHidden: document.querySelector('#mw-now-hint')?.hidden,
    labels: Array.from(document.querySelectorAll('.mw-name b')).map((el) => el.textContent),
  }));
  ok(initial.rows === 6, `窗口图行数 = ${initial.rows}，应为 6`);
  ok(initial.bars === 6, `窗口图条数 = ${initial.bars}，应为 6`);
  ok(initial.ticks === 7, `窗口图横轴刻度 = ${initial.ticks}，应为 7`);
  ok(initial.nowHidden === true, '未填生日时当前月龄竖线应隐藏');
  ok(initial.textHidden === true, '未填生日时当前位置标签应隐藏');
  ok(initial.hintHidden === false, '未填生日时应显示「填生日后显示当前位置」提示');
  ok(
    initial.labels.includes('独坐（无支撑）') && initial.labels.includes('独走'),
    `窗口图标签异常：${initial.labels.join(' / ')}`
  );

  await page.evaluate((birth) => {
    localStorage.setItem('ich.birth.v1', JSON.stringify({ birth, ga: 40 }));
  }, monthsAgo(8));
  await page.reload({ waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 250));
  const withBirth = await page.evaluate(() => ({
    hidden: document.querySelector('#mw-now')?.hidden,
    left: document.querySelector('#mw-now')?.style.left,
    text: document.querySelector('#mw-now-text')?.textContent ?? '',
    hint: document.querySelector('#node-hint')?.textContent ?? '',
    hintHidden: document.querySelector('#mw-now-hint')?.hidden,
  }));
  ok(withBirth.hidden === false, '填生日后当前月龄竖线未显示');
  ok(parseFloat(withBirth.left) > 40 && parseFloat(withBirth.left) < 50, `8 月龄竖线位置异常：${withBirth.left}`);
  ok(/8 个月/.test(withBirth.text), `当前位置标签异常：${withBirth.text}`);
  ok(withBirth.hintHidden === true, '填生日后「填生日后显示当前位置」提示未隐藏');
  ok(!/，$/.test(withBirth.hint), `节点提示文案有悬空逗号：${withBirth.hint}`);

  logs.push('里程碑窗口图：6 项窗口 / 横轴刻度 / 当前月龄竖线 / 节点提示，均正常');
  await page.close();
}

/* ---------------- 首页「本月 3 件事」 ---------------- */
{
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(`${origin}/`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => {
    localStorage.removeItem('ich.birth.v1');
    localStorage.removeItem('ich.tasks.v1');
  });
  await page.reload({ waitUntil: 'networkidle0' });

  const initial = await page.evaluate(() => {
    const panel = document.querySelector('[data-todo-panel="0-1m"]');
    return {
      visible: !!panel && !panel.hidden,
      tasks: panel?.querySelectorAll('input[type="checkbox"]').length,
      count: panel?.querySelector('[data-todo-count]')?.textContent?.trim(),
      stage: document.querySelector('#todo-stage-label')?.textContent?.trim(),
    };
  });
  ok(initial.visible, '默认应显示 0～1 个月的本月清单');
  ok(initial.tasks === 3, `0～1 个月清单应为 3 条，实际 ${initial.tasks}`);
  ok(initial.count === '已勾选 0 / 3', `初始勾选计数错误：${initial.count}`);
  ok(initial.stage === '0～1 个月', `清单阶段标签错误：${initial.stage}`);

  await page.click('[data-todo-panel="0-1m"] .todo-check input');
  await new Promise((r) => setTimeout(r, 150));
  const afterCheck = await page.evaluate(() => ({
    count: document.querySelector('[data-todo-panel="0-1m"] [data-todo-count]')?.textContent?.trim(),
    storage: localStorage.getItem('ich.tasks.v1'),
  }));
  ok(afterCheck.count === '已勾选 1 / 3', `勾选后计数错误：${afterCheck.count}`);
  ok(!!afterCheck.storage, '勾选后未写入 localStorage');

  await page.reload({ waitUntil: 'networkidle0' });
  const afterReload = await page.evaluate(() => ({
    checked: document.querySelector('[data-todo-panel="0-1m"] input[type="checkbox"]')?.checked,
    count: document.querySelector('[data-todo-panel="0-1m"] [data-todo-count]')?.textContent?.trim(),
  }));
  ok(afterReload.checked === true, '刷新后勾选状态未恢复');
  ok(afterReload.count === '已勾选 1 / 3', `刷新后计数错误：${afterReload.count}`);

  // 输入生日后清单应切到 7～9 月
  await page.$eval('#birth-date', (el, v) => {
    el.value = v;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, monthsAgo(8));
  await new Promise((r) => setTimeout(r, 250));
  const switched = await page.evaluate(() => ({
    visible: Array.from(document.querySelectorAll('[data-todo-panel]'))
      .filter((p) => !p.hidden)
      .map((p) => p.dataset.todoPanel),
    stage: document.querySelector('#todo-stage-label')?.textContent?.trim(),
    tasks: document.querySelectorAll('[data-todo-panel="7-9m"] input[type="checkbox"]').length,
  }));
  ok(switched.visible.length === 1 && switched.visible[0] === '7-9m', `清单未随月龄切换：${switched.visible}`);
  ok(switched.stage === '7～9 个月', `切换后清单阶段标签错误：${switched.stage}`);
  ok(switched.tasks === 3, `7～9 个月清单应为 3 条，实际 ${switched.tasks}`);

  // 清除本机记录应同时清掉清单勾选
  await page.click('#clear-storage');
  await new Promise((r) => setTimeout(r, 200));
  const afterClear = await page.evaluate(() => ({
    storage: localStorage.getItem('ich.tasks.v1'),
    checked: document.querySelectorAll('[data-todo-panel] input[type="checkbox"]:checked').length,
    count: document.querySelector('[data-todo-panel="0-1m"] [data-todo-count]')?.textContent?.trim(),
  }));
  ok(afterClear.storage === null, '清除本机记录后任务存储仍在');
  ok(afterClear.checked === 0, '清除本机记录后仍有勾选');
  ok(afterClear.count === '已勾选 0 / 3', `清除后计数错误：${afterClear.count}`);

  logs.push('首页本月清单：3 条 / 勾选持久化 / 随月龄切换 / 清除记录，均正常');
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
