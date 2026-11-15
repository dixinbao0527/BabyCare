#!/usr/bin/env node
/**
 * 构建后生成：
 *   dist/search-index.json  客户端搜索索引（含同义词补全）
 *   dist/sitemap.xml        全站地图
 *   dist/robots.txt
 *   dist/derived/*.json     派生层：关系图 / 复核状态 / 词表 / 站点导览
 *
 * 派生层只在构建期计算，运行时零开销，符合静态站约束。
 */
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const BASE = (process.env.BASE_PATH || '/').replace(/\/$/, '');
const SITE = (process.env.SITE_URL || 'https://example.github.io').replace(/\/$/, '');

const AGE_RANGES = ['0-1m', '1-3m', '4-6m', '7-9m', '10-12m', '13-24m', '25-36m'];
const TAXONOMY = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src/content/data/taxonomy.json'), 'utf8')
);
const HANDBOOK = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src/content/data/handbook.json'), 'utf8')
);
const FEEDING = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src/content/data/feeding.json'), 'utf8')
);
const RECIPES = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src/content/data/recipes.json'), 'utf8')
);

const VENUE_LABEL = {
  city_park: '城市公园',
  forest_park: '森林公园',
  wetland: '湿地',
  riverside: '滨水步道',
  botanical: '植物园',
  zoo: '动物园',
  playground: '儿童乐园',
  scenic: '风景区',
  heritage: '历史名园',
};

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

const slugOf = (file) => path.basename(file, '.md');

function aliasesFor(slug) {
  const topic = TAXONOMY.topics.find((t) => t.slugs.includes(slug));
  if (!topic) return [];
  return TAXONOMY.synonyms.find((s) => s.to === topic.id)?.terms ?? [];
}

if (!fs.existsSync(DIST)) {
  console.error('dist 不存在，请先执行 astro build');
  process.exit(1);
}

/* ---------- 读取内容 ---------- */
const acute = walk(path.join(ROOT, 'src/content/acute'))
  .map((f) => ({ file: f, data: frontmatter(f) }))
  .filter((x) => x.data);

const dev = walk(path.join(ROOT, 'src/content/developmental'))
  .map((f) => ({ file: f, data: frontmatter(f) }))
  .filter((x) => x.data && x.data.draft !== true);

const outdoor = walk(path.join(ROOT, 'src/content/outdoor'))
  .map((f) => ({ file: f, data: frontmatter(f) }))
  .filter((x) => x.data && x.data.draft !== true);

/* ---------- 搜索索引 ---------- */
const items = [
  ...acute.map((x) => ({
    slug: slugOf(x.file),
    title: x.data.title,
    tags: [...new Set([...(x.data.scenario_tags ?? []), ...aliasesFor(slugOf(x.file))])],
    summary: x.data.summary,
    type: 'acute',
    category: '',
    age_range: 'all',
  })),
  ...dev.map((x) => ({
    slug: slugOf(x.file),
    title: x.data.title,
    tags: [...new Set([...(x.data.scenario_tags ?? []), ...aliasesFor(slugOf(x.file))])],
    summary: x.data.summary,
    type: 'developmental',
    category: x.data.category,
    age_range: x.data.age_range,
  })),
  ...outdoor.map((x) => ({
    slug: slugOf(x.file),
    // 站内没有场所详情页，搜索结果落到列表页对应卡片
    path: `/outdoor#venue-${slugOf(x.file)}`,
    title: x.data.title,
    tags: [
      ...new Set([
        x.data.district,
        VENUE_LABEL[x.data.venue_type] ?? x.data.venue_type,
        ...(x.data.tags ?? []),
      ]),
    ],
    summary: x.data.summary,
    type: 'outdoor',
    category: x.data.district,
    age_range: 'all',
  })),
  // 高危疾病识别手册：逐条直达手册内锚点，与症状速查共用一套搜索
  ...HANDBOOK.items.map((x) => ({
    slug: `hb-${x.id}`,
    path: `/health/handbook#${x.id}`,
    title: x.name,
    tags: [...new Set([...x.tags, '高危', '红线', x.window])],
    summary: `${x.tagline} 红线：${x.redline}`,
    type: 'handbook',
    category: 'high-risk',
    age_range: 'all',
  })),
  ...HANDBOOK.tools.map((x) => ({
    slug: `hb-tool-${x.id}`,
    path: `/health/handbook#${x.id}`,
    title: x.name,
    tags: [...new Set([...x.tags, '高危手册', '工具'])],
    summary: x.desc,
    type: 'handbook',
    category: 'tool',
    age_range: 'all',
  })),
  // 婴幼儿辅食：按锚点索引，避免搜「辅食」只跳到零散月龄条目
  ...FEEDING.stages.map((x) => ({
    slug: `fd-${x.id}`,
    path: `/feeding#${x.id}`,
    title: `辅食 · ${x.age} ${x.label}`,
    tags: ['辅食', x.age, x.label, x.texture, '喂养'],
    summary: `${x.freq}；${x.texture}。${x.examples}`,
    type: 'feeding',
    category: 'stage',
    age_range: 'all',
  })),
  ...FEEDING.principles.map((x) => ({
    slug: `fd-${x.id}`,
    path: `/feeding#${x.id}`,
    title: `辅食原则 · ${x.title}`,
    tags: ['辅食', '原则', '喂养'],
    summary: x.desc,
    type: 'feeding',
    category: 'principle',
    age_range: 'all',
  })),
  ...FEEDING.hazards.map((x) => ({
    slug: `fd-${x.id}`,
    path: `/feeding#${x.id}`,
    title: `辅食安全 · ${x.title}`,
    tags: [...new Set(['辅食', '安全', '呛咳', '窒息', '蜂蜜'])],
    summary: x.desc,
    type: 'feeding',
    category: 'safety',
    age_range: 'all',
  })),
  // 辅食菜单：搜「疙瘩汤」「牛肉条」这类具体做法也要能落到锚点
  ...RECIPES.items.map((x) => ({
    slug: `fd-recipe-${x.id}`,
    path: `/feeding#recipe-${x.id}`,
    title: `辅食菜单 · ${x.name}`,
    tags: [...new Set(['辅食', '菜单', '做法', x.monthLabel, ...x.tags])],
    summary: `${x.monthLabel} · ${x.texture} · ${x.time}。材料：${x.ingredients.slice(0, 3).join('、')}。`,
    type: 'feeding',
    category: 'recipe',
    age_range: 'all',
  })),
];

const json = JSON.stringify(items);
fs.writeFileSync(path.join(DIST, 'search-index.json'), json, 'utf8');

/* ---------- 关系图（派生层） ---------- */
const devSlugs = new Set(dev.map((x) => slugOf(x.file)));
const acuteSlugs = new Set(acute.map((x) => slugOf(x.file)));
const outdoorSlugs = new Set(outdoor.map((x) => slugOf(x.file)));

const relations = [];
const seen = new Set();
const kindOf = (slug) =>
  acuteSlugs.has(slug) ? 'acute' : devSlugs.has(slug) ? 'dev' : outdoorSlugs.has(slug) ? 'outdoor' : null;
const addEdge = (from, slug, type) => {
  const kind = kindOf(slug);
  if (!kind) return;
  const id = `${from}->${kind}:${slug}:${type}`;
  if (seen.has(id)) return;
  seen.add(id);
  relations.push({ from, to: `${kind}:${slug}`, type, generated: false });
};

for (const x of dev) {
  const from = `dev:${slugOf(x.file)}`;
  for (const slug of x.data.related ?? []) addEdge(from, slug, 'related_acute');
  for (const r of x.data.relations ?? []) addEdge(from, r.slug, r.type);
}
for (const x of acute) {
  for (const r of x.data.relations ?? []) addEdge(`acute:${slugOf(x.file)}`, r.slug, r.type);
}
for (const x of outdoor) {
  for (const r of x.data.relations ?? []) addEdge(`outdoor:${slugOf(x.file)}`, r.slug, r.type);
}

for (const edge of [...relations]) {
  const back = { from: edge.to, to: edge.from, type: edge.type, generated: true };
  if (!relations.some((x) => x.from === back.from && x.to === back.to && x.type === back.type)) {
    relations.push(back);
  }
}

/* ---------- 复核状态（派生层） ---------- */
const today = new Date();
today.setHours(0, 0, 0, 0);
const daysSince = (iso) => {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : Math.round((today - d) / 86400000);
};
const reviewStatus = [...dev, ...acute, ...outdoor].map((x) => {
  const kind = x.file.includes('/acute/') ? 'acute' : x.file.includes('/outdoor/') ? 'outdoor' : 'dev';
  const mr = x.data.medical_review;
  const clinical = mr?.status === 'done' ? 'done' : 'pending';
  return {
    slug: slugOf(x.file),
    kind,
    // 资料整理：编辑把公开指南拆成条目并标注来源的日期
    compiledOn: x.data.last_reviewed ?? '',
    compiledBy: x.data.reviewer ?? '',
    daysSinceCompiled: daysSince(x.data.last_reviewed ?? ''),
    // 专业复核：缺省即未复核；户外条目不属于医学内容，记 n/a
    clinicalReview: kind === 'outdoor' ? 'n/a' : clinical,
    clinicalReviewer: clinical === 'done' ? mr?.reviewer ?? '' : '',
    clinicalDate: clinical === 'done' ? mr?.date ?? '' : '',
  };
});

/* ---------- 站点导览（派生层） ---------- */
const nav = [
  { href: '/', title: '首页' },
  { href: '/health', title: '健康查询' },
  { href: '/health#acute-h', title: '急症速查' },
  { href: '/health/handbook', title: '高危疾病识别手册' },
  { href: '/milestones', title: '发育里程碑' },
  { href: '/feeding', title: '婴幼儿辅食' },
  { href: '/outdoor', title: '北京亲子户外' },
  { href: '/sources', title: '来源与声明' },
  { href: '/about', title: '关于本站' },
];

const derived = path.join(DIST, 'derived');
fs.mkdirSync(derived, { recursive: true });
fs.writeFileSync(path.join(derived, 'relations.json'), JSON.stringify(relations, null, 2));
fs.writeFileSync(path.join(derived, 'review-status.json'), JSON.stringify(reviewStatus, null, 2));
fs.writeFileSync(path.join(derived, 'taxonomy.json'), JSON.stringify(TAXONOMY, null, 2));
fs.writeFileSync(path.join(derived, 'nav.json'), JSON.stringify(nav, null, 2));

/* ---------- sitemap ---------- */
const abs = (p) => `${SITE}${BASE}${p}`;
const urls = [
  { loc: abs('/'), priority: '1.0', freq: 'weekly' },
  { loc: abs('/health'), priority: '0.9', freq: 'weekly' },
  { loc: abs('/health/handbook'), priority: '0.9', freq: 'monthly' },
  { loc: abs('/quick/card'), priority: '0.4', freq: 'monthly' },
  { loc: abs('/milestones'), priority: '0.9', freq: 'monthly' },
  { loc: abs('/feeding'), priority: '0.9', freq: 'monthly' },
  { loc: abs('/outdoor'), priority: '0.9', freq: 'weekly' },
  { loc: abs('/about'), priority: '0.5', freq: 'monthly' },
  { loc: abs('/sources'), priority: '0.5', freq: 'yearly' },
  ...AGE_RANGES.map((r) => ({ loc: abs(`/age/${r}`), priority: '0.8', freq: 'monthly' })),
  ...TAXONOMY.scenes.map((s) => ({ loc: abs(`/scene/${s.id}`), priority: '0.6', freq: 'monthly' })),
  ...acute.map((x) => ({
    loc: abs(`/quick/${slugOf(x.file)}`),
    priority: '0.9',
    freq: 'monthly',
  })),
];

const date = new Date().toISOString().slice(0, 10);
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${date}</lastmod>
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
console.log(`✓ derived/*.json：关系 ${relations.length} 条 · 内容状态 ${reviewStatus.length} 条`);
