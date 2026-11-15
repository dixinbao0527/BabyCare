/** 拼接 base 路径：GitHub Pages 项目页部署在 /<repo>/ 下，所有站内链接都要带前缀 */
export function withBase(path: string): string {
  if (!path.startsWith('/')) return path;
  const base = import.meta.env.BASE_URL || '/';
  const b = base.endsWith('/') ? base.slice(0, -1) : base;
  return `${b}${path}`;
}

export const SITE_NAME = '婴幼儿健康养育手册';

/** short：窄屏（<480px）用的两字标签，保证 375px 下 6 项全部可见、不被裁切 */
export const NAV = [
  { href: '/', label: '首页', short: '首页', key: 'home' },
  { href: '/health', label: '健康查询', short: '健康', key: 'health' },
  { href: '/milestones', label: '发育里程碑', short: '发育', key: 'milestones' },
  { href: '/feeding', label: '婴幼儿辅食', short: '辅食', key: 'feeding' },
  { href: '/outdoor', label: '户外活动', short: '户外', key: 'outdoor' },
  { href: '/about', label: '关于', short: '关于', key: 'about' },
] as const;
