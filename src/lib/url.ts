/** 拼接 base 路径：GitHub Pages 项目页部署在 /<repo>/ 下，所有站内链接都要带前缀 */
export function withBase(path: string): string {
  if (!path.startsWith('/')) return path;
  const base = import.meta.env.BASE_URL || '/';
  const b = base.endsWith('/') ? base.slice(0, -1) : base;
  return `${b}${path}`;
}

export const SITE_NAME = '婴幼儿健康养育手册';

export const NAV = [
  { href: '/', label: '首页', key: 'home' },
  { href: '/quick', label: '快速查询', key: 'quick' },
  { href: '/milestones', label: '发育里程碑', key: 'milestones' },
  { href: '/sources', label: '来源与声明', key: 'sources' },
] as const;
