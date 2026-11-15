#!/usr/bin/env node
/**
 * 内容数字一致性校验（C5）
 * 目的：同一个数字只维护一处；正文里出现旧值时构建失败。
 * 数据源：src/content/data/facts.json、feeding.json、milestones.yaml
 */
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const ROOT = process.cwd();
const DEV_DIR = path.join(ROOT, 'src/content/developmental');
const FACTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/content/data/facts.json'), 'utf8'));
const FEEDING = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/content/data/feeding.json'), 'utf8'));
const MILESTONES = yaml.load(fs.readFileSync(path.join(ROOT, 'src/content/data/milestones.yaml'), 'utf8')) ?? [];

const errors = [];
const warnings = [];
const fail = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, acc);
    else if (name.endsWith('.md')) acc.push(p);
  }
  return acc;
}

const windowPairs = new Set(
  MILESTONES.flatMap((m) => m.windows ?? []).map((w) => `${w.start}-${w.end}`)
);
const windowKeys = MILESTONES.flatMap((m) => m.windows ?? []).map((w) => w.key).filter(Boolean);

/* F1a：YAML 的 description 里不应再写窗口数字（窗口只在 windows 字段） */
for (const m of MILESTONES) {
  if (/\d+\.\d+\s*[～~-]\s*\d+\.\d+/.test(m.description ?? '')) {
    fail(`[F1] milestones.yaml ${m.id}: description 里仍有窗口数字，请移到 windows 字段`);
  }
}

/* F1b：窗口的 key 必须唯一 */
const keySeen = new Set();
for (const key of windowKeys) {
  if (keySeen.has(key)) fail(`[F1] milestones.yaml: window key 重复 → ${key}`);
  keySeen.add(key);
}

const sleepByRange = new Map((FACTS.sleep ?? []).map((s) => [s.range, s.total]));
const startMonth = FACTS.feeding.startMonth;

/* 喂养起点：feeding.json 的第一阶段必须写着同一个起点月龄 */
const firstStage = FEEDING.stages?.[0];
if (firstStage && !String(firstStage.age).includes(String(startMonth))) {
  fail(`[F2] feeding.json: 第一阶段「${firstStage.age}」与 facts.feeding.startMonth=${startMonth} 不一致`);
}

for (const file of walk(DEV_DIR)) {
  const rel = path.relative(ROOT, file);
  const raw = fs.readFileSync(file, 'utf8');
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!m) continue;
  const front = yaml.load(m[1]) ?? {};
  // 摘要与正文都算「正文」，避免窗口数字藏在 summary 里
  const body = (front.summary ?? '') + '\n' + m[2];
  const stage = front.age_range ?? '';

  /* F1：小数月龄区间必须等于某个 WHO 窗口（防止窗口数字在正文里漂移） */
  for (const hit of body.matchAll(/(\d+\.\d+)\s*[～~-]\s*(\d+\.\d+)\s*个月/g)) {
    if (!windowPairs.has(`${hit[1]}-${hit[2]}`)) {
      fail(`[F1] ${rel}: 出现未登记的窗口 ${hit[1]}～${hit[2]} 个月（以 milestones.yaml 为准）`);
    }
  }

  /* F2：加辅食的起点月份 */
  if (/加辅食|辅食添加/.test(body)) {
    for (const hit of body.matchAll(/满\s*(\d+)\s*月龄/g)) {
      if (Number(hit[1]) !== startMonth) {
        fail(`[F2] ${rel}: 「满 ${hit[1]} 月龄」与 feeding.startMonth=${startMonth} 不一致`);
      }
    }
  }

  /* F3：果汁上限 */
  if (/果汁/.test(body)) {
    for (const hit of body.matchAll(/(\d+)\s*毫升/g)) {
      if (Number(hit[1]) !== FACTS.feeding.juiceMaxMl) {
        fail(`[F3] ${rel}: 果汁「${hit[1]} 毫升」与 facts.feeding.juiceMaxMl=${FACTS.feeding.juiceMaxMl} 不一致`);
      }
    }
  }

  /* F4：盐 / 糖 / 蜂蜜的 1 岁界线 */
  for (const hit of body.matchAll(/(\d+)\s*岁前[^。]{0,8}(不加盐|不加糖|不吃蜂蜜|不喂蜂蜜|蜂蜜)/g)) {
    if (Number(hit[1]) !== 1) {
      fail(`[F4] ${rel}: 「${hit[1]} 岁前…${hit[2]}」与 facts 的 12 月龄口径不一致`);
    }
  }

  /* F5：睡眠总时长必须与登记值一致；未登记的阶段给警告 */
  for (const hit of body.matchAll(/(?:总计|总睡眠|一天睡|睡眠总量|每天睡)[^。]{0,8}?(?<!\d)(\d+)\s*[～~-]\s*(\d+)(?!\d)\s*小时/g)) {
    const want = sleepByRange.get(stage);
    const got = `${hit[1]}～${hit[2]} 小时`;
    if (!want) warn(`[F5] ${rel}: 写了睡眠总时长「${got}」，但 facts.sleep 未登记 ${stage}，暂时无法校验`);
    else if (want !== got) fail(`[F5] ${rel}: 睡眠「${got}」与 facts.sleep[${stage}]=${want} 不一致`);
  }
}

if (warnings.length) {
  console.log(`⚠ 数字一致性警告 ${warnings.length} 条`);
  for (const w of warnings) console.log('  · ' + w);
}
if (errors.length) {
  console.error(`✗ 数字一致性校验失败 ${errors.length} 条`);
  for (const e of errors) console.error('  · ' + e);
  process.exit(1);
}
console.log('✓ 数字一致性通过（窗口 / 喂养 / 果汁 / 盐糖蜂蜜 / 睡眠）');
