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

const DISTRICTS = [
  '东城区', '西城区', '朝阳区', '海淀区', '丰台区', '石景山区',
  '门头沟区', '房山区', '通州区', '顺义区', '昌平区', '大兴区',
  '怀柔区', '平谷区', '密云区', '延庆区',
];
const FACILITY_STATES = ['yes', 'partial', 'no', 'unknown'];
const TICKET_STATES = ['free', 'paid', 'unknown'];
const SAFETY_TAGS = ['water', 'sun', 'mosquito', 'traffic', 'fall', 'choking', 'crowd'];
const OUTDOOR_DIR = path.join(ROOT, 'src/content/outdoor');
const MONTHLY_TASKS = path.join(ROOT, 'src/lib/monthlyTasks.ts');

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
  else if (d > 365) warn(`[R4] ${rel}: 资料整理已 ${d} 天（>365），建议重新核对原文`);

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

/* ---------- 专业复核声明（R8） ---------- */
// 允许「未复核」，但不允许含糊：声明 done 就必须写清谁核对、哪天核对
for (const { file, data } of [...dev, ...acute]) {
  const mr = data.medical_review;
  if (!mr) continue;
  if (!['pending', 'done'].includes(mr.status)) {
    fail(`[R8] ${file}: medical_review.status 只能是 pending / done → ${mr.status}`);
  }
  if (mr.status === 'done') {
    if (!mr.reviewer) fail(`[R8] ${file}: 声明已完成专业复核，但缺少 reviewer`);
    if (!mr.date) fail(`[R8] ${file}: 声明已完成专业复核，但缺少 date`);
    else if (daysAgo(mr.date) === null) fail(`[R8] ${file}: medical_review.date 格式非法 → ${mr.date}`);
  }
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

/* ---------- 户外活动（v3.0，O 组规则） ---------- */
const outdoor = [];
if (fs.existsSync(OUTDOOR_DIR)) {
  for (const file of walk(OUTDOOR_DIR)) {
    const relPath = path.relative(ROOT, file);
    const { data, body } = parse(file);
    if (!data) {
      fail(`缺少 frontmatter：${relPath}`);
      continue;
    }
    outdoor.push({ file: relPath, data, body });
  }
}

const devSlugs = new Set(dev.map((x) => path.basename(x.file, '.md')));
const acuteSlugSet = new Set(acute.map((x) => path.basename(x.file, '.md')));
const outdoorSlugs = new Set(outdoor.map((x) => path.basename(x.file, '.md')));
const knownSlugs = new Set([...devSlugs, ...acuteSlugSet, ...outdoorSlugs]);

const DRUG_PATTERN = /(布洛芬|对乙酰氨基酚|扑热息痛|阿莫西林|头孢|mg\/kg|毫克\/公斤|ml\/kg)/;
const MEDICAL_CLAIM = /(促进发育|有助于长高|最适合\s*\d+\s*月龄|治疗效果|包治|治愈率)/;

const outdoorSeen = new Set();
for (const { file, data, body } of outdoor) {
  const slug = path.basename(file, '.md');

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    fail(`[O-01] ${file}: slug 必须是小写连字符 → ${slug}`);
  }
  if (outdoorSeen.has(slug)) fail(`[O-01] ${file}: slug 重复 → ${slug}`);
  outdoorSeen.add(slug);

  if (!DISTRICTS.includes(data.district)) {
    fail(`[O-02] ${file}: district 非法 → ${data.district}`);
  }
  if (!/^https:\/\//.test(data.official_url ?? '')) {
    fail(`[O-03] ${file}: official_url 必须是 https 链接`);
  }

  const days = daysAgo(data.verified_on);
  if (days === null) fail(`[O-04] ${file}: verified_on 格式非法 → ${data.verified_on}`);
  else if (days < 0) fail(`[O-04] ${file}: verified_on 在未来 → ${data.verified_on}`);
  else if (days > 365) fail(`[O-04] ${file}: 已 ${days} 天未核验（>365），必须重新核验或下线`);
  else if (days > 180) warn(`[O-04] ${file}: 已 ${days} 天未核验（>180），建议重新核验`);

  for (const key of ['stroller', 'shade', 'nursing_room', 'toilet', 'playground']) {
    if (!FACILITY_STATES.includes(data[key])) {
      fail(`[O-11] ${file}: ${key} 必须是 yes/partial/no/unknown，未核实请显式写 unknown`);
    }
  }
  if (!TICKET_STATES.includes(data.free)) {
    fail(`[O-11] ${file}: free 必须是 free/paid/unknown → ${data.free}`);
  }
  for (const t of data.safety_tags ?? []) {
    if (!SAFETY_TAGS.includes(t)) fail(`[O-11] ${file}: safety_tags 非法 → ${t}`);
  }

  if (data.water_hazard && !(data.relations ?? []).some((r) => r.type === 'related_acute')) {
    fail(`[O-06] ${file}: water_hazard=true 但没有关联任何急症条目`);
  }

  const text = JSON.stringify(data) + body;
  if (DRUG_PATTERN.test(text)) fail(`[O-07] ${file}: 出现药品名或剂量`);
  if (MEDICAL_CLAIM.test(text)) fail(`[O-08] ${file}: 出现医学化断言，户外条目只写设施适配`);

  for (const r of data.relations ?? []) {
    if (!knownSlugs.has(r.slug)) fail(`[O-09] ${file}: relations 引用了不存在的条目 → ${r.slug}`);
  }
}

// O-12：户外条目不得混进首页「本月 3 件事」
if (fs.existsSync(MONTHLY_TASKS)) {
  const src = fs.readFileSync(MONTHLY_TASKS, 'utf8');
  for (const slug of outdoorSlugs) {
    if (src.includes(`'${slug}'`)) fail(`[O-12] monthlyTasks.ts: 户外条目不得进入月龄待办 → ${slug}`);
  }
}

/* ---------- 辅食菜单（数据文件，9 组规则） ---------- */
const RECIPES_FILE = path.join(ROOT, 'src/content/data/recipes.json');
if (fs.existsSync(RECIPES_FILE)) {
  let data = null;
  try {
    data = JSON.parse(fs.readFileSync(RECIPES_FILE, 'utf8'));
  } catch (e) {
    fail(`[FD] recipes.json 解析失败：${e.message}`);
  }
  const seen = new Set();
  for (const x of data?.items ?? []) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(x.id ?? '')) fail(`[FD-01] recipes.json: id 必须小写连字符 → ${x.id}`);
    if (seen.has(x.id)) fail(`[FD-01] recipes.json: id 重复 → ${x.id}`);
    seen.add(x.id);
    if (!(Number(x.monthFrom) >= 6 && Number(x.monthFrom) <= 24)) {
      fail(`[FD-02] recipes.json: ${x.id} 的 monthFrom 必须在 6～24，实际 ${x.monthFrom}`);
    }
    if (!x.name || !x.monthLabel || !x.texture) fail(`[FD-03] recipes.json: ${x.id} 缺少 name / monthLabel / texture`);
    if ((x.ingredients ?? []).length < 2) fail(`[FD-04] recipes.json: ${x.id} 至少写 2 种材料`);
    if ((x.steps ?? []).length < 2) fail(`[FD-05] recipes.json: ${x.id} 至少写 2 步做法`);
    if (!x.tip) fail(`[FD-06] recipes.json: ${x.id} 缺少安全提示（tip）`);
  }
}

/* ---------- 9. taxonomy 引用完整性 ---------- */
const TAXONOMY_FILE = path.join(ROOT, 'src/content/data/taxonomy.json');
if (fs.existsSync(TAXONOMY_FILE)) {
  let tax = null;
  try {
    tax = JSON.parse(fs.readFileSync(TAXONOMY_FILE, 'utf8'));
  } catch (e) {
    fail(`[R9] taxonomy.json 解析失败：${e.message}`);
  }
  if (tax) {
    for (const t of tax.topics ?? []) {
      for (const slug of t.slugs ?? []) {
        if (!knownSlugs.has(slug)) fail(`[R9] 主题 ${t.id} 引用了不存在的条目 → ${slug}`);
      }
    }
    for (const sc of tax.scenes ?? []) {
      for (const slug of sc.slugs ?? []) {
        if (!knownSlugs.has(slug)) fail(`[R9] 场景 ${sc.id} 引用了不存在的条目 → ${slug}`);
      }
    }
    const inTax = new Set([
      ...(tax.topics ?? []).flatMap((t) => t.slugs ?? []),
      ...(tax.scenes ?? []).flatMap((s) => s.slugs ?? []),
    ]);
    const orphans = [...devSlugs].filter((s) => !inTax.has(s));
    if (orphans.length) {
      warn(`[R9] ${orphans.length} 条知识不在任何主题或场景中：${orphans.join('、')}`);
    }
  }
}

/* ---------- 10. 条目引用的 WHO 窗口 key ---------- */
if (fs.existsSync(MILESTONE_FILE)) {
  const ms = yaml.load(fs.readFileSync(MILESTONE_FILE, 'utf8')) ?? [];
  const keys = new Set(ms.flatMap((m) => m.windows ?? []).map((w) => w.key).filter(Boolean));
  for (const { file, data } of dev) {
    if (data.window && !keys.has(data.window)) {
      fail(`[R10] ${file}: window="${data.window}" 不在 milestones.yaml 的 windows.key 中`);
    }
  }
}

/* ---------- 输出 ---------- */
const rel = (p) => path.relative(ROOT, p);
console.log(
  `\n内容校验：developmental ${dev.length} 条 · acute ${acute.length} 条 · outdoor ${outdoor.length} 条 · 标签 ${tagCount.size} 个\n`
);

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
