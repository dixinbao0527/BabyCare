#!/usr/bin/env node
/**
 * 构建后生成两个静态文件：
 *   dist/search-index.json  —— 客户端搜索索引（不含正文）
 *   dist/sitemap.xml        —— 全站地图
 *
 * 不放在 src/pages 下用端点实现，是因为 Astro 会把 *.json.ts / *.xml.ts
 * 按扩展名当成静态资源解析，导致 TS 语法报错；构建后生成更可控。
 */
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const BASE = (process.env.BASE_PATH || '/').replace(/\/$/, '');
const SITE = (process.env.SITE_URL || 'https://example.github.io').replace(/\/$/, '');

const AGE_RANGES = ['0-1m', '1-3m', '4-6m', '7-9m', '10-12m', '13-24m', '25-36m'];

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, acc);
    else if (name.endsWith('.md')) acc.push(p);
  }
  return acc;
}

function frontmatter(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
  return m ? yaml.load(m[1]) : null;
}

if (!fs.existsSync(DIST)) {
  console.error('dist 不存在，请先执行 astro build');
  process.exit(1);
}

/* ---------- 搜索索引 ---------- */
const acute = walk(path.join(ROOT, 'src/content/acute')).map((f) => ({
  file: f,
  data: frontmatter(f),
}));
const dev = walk(path.join(ROOT, 'src/content/developmental')).map((f) => ({
  file: f,
  data: frontmatter(f),
}));

const items = [
  ...acute
    .filter((x) => x.data)
    .map((x) => ({
      slug: path.basename(x.file, '.md'),
      title: x.data.title,
      tags: x.data.scenario_tags ?? [],
      summary: x.data.summary,
      type: 'acute',
      category: '',
      age_range: 'all',
    })),
  ...dev
    .filter((x) => x.data && x.data.draft !== true)
    .map((x) => ({
      slug: path.basename(x.file, '.md'),
      title: x.data.title,
      tags: x.data.scenario_tags ?? [],
      summary: x.data.summary,
      type: 'developmental',
      category: x.data.category,
      age_range: x.data.age_range,
    })),
];

const json = JSON.stringify(items);
fs.writeFileSync(path.join(DIST, 'search-index.json'), json, 'utf8');

/* ---------- sitemap ---------- */
const abs = (p) => `${SITE}${BASE}${p}`;
const urls = [
  { loc: abs('/'), priority: '1.0', freq: 'weekly' },
  { loc: abs('/quick'), priority: '0.9', freq: 'weekly' },
  { loc: abs('/milestones'), priority: '0.9', freq: 'monthly' },
  { loc: abs('/sources'), priority: '0.5', freq: 'yearly' },
  ...AGE_RANGES.map((r) => ({ loc: abs(`/age/${r}`), priority: '0.8', freq: 'monthly' })),
  ...acute
    .filter((x) => x.data)
    .map((x) => ({
      loc: abs(`/quick/${path.basename(x.file, '.md')}`),
      priority: '0.9',
      freq: 'monthly',
    })),
];

const today = new Date().toISOString().slice(0, 10);
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.freq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>
`;
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), xml, 'utf8');

/* ---------- robots ---------- */
fs.writeFileSync(
  path.join(DIST, 'robots.txt'),
  `User-agent: *\nAllow: /\n\nSitemap: ${abs('/sitemap.xml')}\n`,
  'utf8'
);

const kb = (json.length / 1024).toFixed(1);
console.log(`✓ search-index.json ${items.length} 条 / ${kb} KB`);
console.log(`✓ sitemap.xml ${urls.length} 个 URL`);
