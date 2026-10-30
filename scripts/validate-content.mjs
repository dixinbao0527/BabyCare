#!/usr/bin/env node
/**
 * 构建期业务校验（schema 管不到的部分）
 * 对应 PRD 5.4，任一硬性规则失败即退出码 1，CI 中止构建。
 */
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const ROOT = process.cwd();
const DEV_DIR = path.join(ROOT, 'src/content/developmental');
const ACUTE_DIR = path.join(ROOT, 'src/content/acute');
const MILESTONE_FILE = path.join(ROOT, 'src/content/data/milestones.yaml');
const WARN_FILE = path.join(ROOT, 'src/lib/warningSigns.ts');

const AGE_RANGES = ['0-1m', '1-3m', '4-6m', '7-9m', '10-12m', '13-24m', '25-36m'];
const SEVERITY_ORDER = ['observe', 'urgent', 'emergency'];
const NODES = [3, 6, 8, 12, 18, 24, 30, 36];

const errors = [];
const warnings = [];
const fail = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (name.endsWith('.md')) acc.push(p);
  }
  return acc;
}

function parse(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!m) return { data: null, body: raw };
  let data;
  try {
    data = yaml.load(m[1]);
  } catch (e) {
    fail(`YAML 解析失败：${path.relative(ROOT, file)} → ${e.message}`);
    return { data: null, body: m[2] };
  }
  return { data, body: m[2] };
}

const today = new Date();
today.setHours(0, 0, 0, 0);
const daysAgo = (s) => {
  const d = new Date(`${s}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return Math.round((today - d) / 86400000);
};

/* ---------- developmental ---------- */
const dev = [];
for (const file of walk(DEV_DIR)) {
  const rel = path.relative(ROOT, file);
  const { data, body } = parse(file);
  if (!data) {
    fail(`缺少 frontmatter：${rel}`);
    continue;
  }
  dev.push({ file: rel, data, body });

  // 1. 禁止 age_range = all
  if (data.age_range === 'all') fail(`[R1] ${rel}: developmental 不允许 age_range=all`);
  if (!AGE_RANGES.includes(data.age_range)) fail(`[R1] ${rel}: age_range 非法 → ${data.age_range}`);

  // 2. source.section 与 source.url 至少一项非空
  const src = data.source ?? {};
  if (!src.section && !src.url) fail(`[R2] ${rel}: source.section 与 source.url 均为空，无法溯源`);

  // 4. last_reviewed 时效
  const d = daysAgo(data.last_reviewed);
  if (d === null) fail(`[R4] ${rel}: last_reviewed 格式非法 → ${data.last_reviewed}`);
  else if (d < 0) fail(`[R4] ${rel}: last_reviewed 在未来 → ${data.last_reviewed}`);
  else if (d > 365) warn(`[R4] ${rel}: 已 ${d} 天未复核（>365）`);

  // 正文长度
  const paras = body.split(/\n{2,}/).filter((p) => p.trim() && !p.trim().startsWith('>'));
  if (paras.length < 3) warn(`[正文] ${rel}: 正文仅 ${paras.length} 段（建议 3～5 段）`);
  if (data.draft !== true && data.title.length > 20) fail(`[title] ${rel}: 标题超 20 字`);
}

// 3. 同 age_range + category 内 order 唯一
const orderMap = new Map();
for (const { file, data } of dev) {
  const key = `${data.age_range}|${data.category}`;
  const prev = orderMap.get(key);
  if (prev && prev.order === data.order) {
    fail(`[R3] order 冲突：${key} 中 ${prev.file} 与 ${file} 同为 ${data.order}`);
  }
  orderMap.set(key, { order: data.order, file });
}

// 5. 每个 age_range 至少 3 条非 draft
for (const r of AGE_RANGES) {
  const n = dev.filter((x) => x.data.age_range === r && x.data.draft !== true).length;
  if (n < 3) fail(`[R5] ${r}: 仅 ${n} 条非 draft 条目（要求 ≥3）`);
}

/* ---------- acute ---------- */
const acute = [];
for (const file of walk(ACUTE_DIR)) {
  const rel = path.relative(ROOT, file);
  const { data } = parse(file);
  if (!data) {
    fail(`缺少 frontmatter：${rel}`);
    continue;
  }
  acute.push({ file: rel, data });

  if (data.content_type !== 'acute') fail(`[A] ${rel}: content_type 必须为 acute`);
  if (data.age_range !== 'all') fail(`[A-1] ${rel}: acute 的 age_range 必须为 all`);

  // 6. 三级齐全且顺序固定
  const levels = (data.severity_levels ?? []).map((s) => s.level);
  if (levels.length !== 3) fail(`[A-6] ${rel}: severity_levels 必须 3 条，实际 ${levels.length}`);
  else if (levels.join(',') !== SEVERITY_ORDER.join(','))
    fail(`[A-6] ${rel}: 顺序错误 → ${levels.join(',')}（应为 observe,urgent,emergency）`);

  // A-7 不得出现药品名与剂量
  const text = JSON.stringify(data);
  const drugPattern = /(布洛芬|对乙酰氨基酚|扑热息痛|阿莫西林|头孢|mg\/kg|毫克\/公斤|ml\/kg)/;
  if (drugPattern.test(text)) fail(`[A-7] ${rel}: 出现药品名或剂量，急症页不得给出用药建议`);

  if ((data.home_care ?? []).length < 3) fail(`[home_care] ${rel}: 至少 3 条`);
  if (!(data.red_flags ?? []).length) fail(`[red_flags] ${rel}: 至少 1 条`);
}

/* ---------- related 引用必须存在 ---------- */
const acuteSlugs = new Set(acute.map((a) => path.basename(a.file, '.md')));
for (const { file, data } of dev) {
  for (const r of data.related ?? []) {
    if (!acuteSlugs.has(r)) fail(`[R7] ${file}: related 引用了不存在的急症 → ${r}`);
  }
}

/* ---------- 7. 预警征象：8 节点 × 4 条 ---------- */
if (fs.existsSync(WARN_FILE)) {
  const src = fs.readFileSync(WARN_FILE, 'utf8');
  const items = [...src.matchAll(/age_month:\s*(\d+),\s*seq:\s*(\d+),\s*sign:\s*'([^']+)'/g)];
  if (items.length !== 32) fail(`[R6] 预警征象应为 32 条，实际解析到 ${items.length}`);
  for (const node of NODES) {
    const n = items.filter((m) => Number(m[1]) === node).length;
    if (n !== 4) fail(`[R6] ${node} 月龄预警征象应为 4 条，实际 ${n}`);
  }
  const extra = items.filter((m) => !NODES.includes(Number(m[1])));
  if (extra.length) fail(`[R6] 出现非标准节点：${extra.map((m) => m[1]).join(',')}`);
}

/* ---------- 里程碑 ---------- */
if (fs.existsSync(MILESTONE_FILE)) {
  const ms = yaml.load(fs.readFileSync(MILESTONE_FILE, 'utf8')) ?? [];
  for (const node of NODES) {
    const domains = new Set(ms.filter((m) => m.age_month === node).map((m) => m.domain));
    if (domains.size !== 4) fail(`[M] ${node} 月龄里程碑缺少维度，实际 ${[...domains].join(',')}`);
  }
}

/* ---------- 8. 标签统计 ---------- */
const tagCount = new Map();
for (const { data } of [...dev, ...acute]) {
  for (const t of data.scenario_tags ?? []) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
}

/* ---------- 输出 ---------- */
const rel = (p) => path.relative(ROOT, p);
console.log(`\n内容校验：developmental ${dev.length} 条 · acute ${acute.length} 条 · 标签 ${tagCount.size} 个\n`);

if (warnings.length) {
  console.log(`⚠ 警告 ${warnings.length} 条`);
  warnings.forEach((w) => console.log(`  · ${w}`));
  console.log('');
}

if (errors.length) {
  console.error(`✗ 失败 ${errors.length} 条`);
  errors.forEach((e) => console.error(`  · ${e}`));
  console.error('\n构建中止。请修正上述问题后重试。\n');
  process.exit(1);
}

console.log('✓ 全部业务规则通过\n');
