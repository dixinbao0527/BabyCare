export type Stage = {
  range: string;
  /** 闭区间下界（含） */
  min: number;
  /** 闭区间上界（含） */
  max: number;
  /** 展示名 */
  name: string;
  /** 阶段一句话 */
  tagline: string;
  /** 阶段导航用的极短名 */
  short: string;
};

/** 7 个阶段：闭区间、互不重叠，因此每月龄的映射结果唯一 */
export const STAGES: Stage[] = [
  { range: '0-1m', min: 0, max: 1, name: '0～1 个月', short: '0-1月', tagline: '吃睡循环，建立最初的安全感' },
  { range: '1-3m', min: 2, max: 3, name: '1～3 个月', short: '1-3月', tagline: '开始对视、微笑，昼夜节律萌芽' },
  { range: '4-6m', min: 4, max: 6, name: '4～6 个月', short: '4-6月', tagline: '翻身、靠坐，准备第一口辅食' },
  { range: '7-9m', min: 7, max: 9, name: '7～9 个月', short: '7-9月', tagline: '独坐、爬行，分离焦虑出现' },
  { range: '10-12m', min: 10, max: 12, name: '10～12 个月', short: '10-12月', tagline: '扶站扶走，开始听懂「不」' },
  { range: '13-24m', min: 13, max: 24, name: '1～2 岁', short: '1-2岁', tagline: '独走、说词，自主意识爆发' },
  { range: '25-36m', min: 25, max: 36, name: '2～3 岁', short: '2-3岁', tagline: '短句表达、假想游戏、如厕准备' },
];

export const MAX_MONTH = 36;

/** 月龄 → 阶段。超过 36 月龄停在最后阶段（需在 UI 上说明超出范围） */
export function stageOf(months: number): { stage: Stage; outOfRange: boolean } {
  if (months > MAX_MONTH) {
    return { stage: STAGES[STAGES.length - 1], outOfRange: true };
  }
  const m = Math.max(0, months);
  return {
    stage: STAGES.find((s) => m >= s.min && m <= s.max) ?? STAGES[0],
    outOfRange: false,
  };
}

export function stageByRange(range: string): Stage | undefined {
  return STAGES.find((s) => s.range === range);
}

export function prevStage(range: string): Stage | undefined {
  const i = STAGES.findIndex((s) => s.range === range);
  return i > 0 ? STAGES[i - 1] : undefined;
}

export function nextStage(range: string): Stage | undefined {
  const i = STAGES.findIndex((s) => s.range === range);
  return i >= 0 && i < STAGES.length - 1 ? STAGES[i + 1] : undefined;
}

export const CATEGORY_LABEL: Record<string, string> = {
  feeding: '喂养',
  sleep: '睡眠',
  development: '发育',
  safety: '安全',
  daily_care: '日常照护',
};

/** 分类的视觉标识：单字徽章 + CSS tone（见 global.css 的 .cat-*） */
export const CATEGORY_META: Record<
  string,
  { label: string; badge: string; tone: string; hint: string }
> = {
  feeding: { label: '喂养', badge: '喂', tone: 'cat-feeding', hint: '奶量与辅食' },
  sleep: { label: '睡眠', badge: '睡', tone: 'cat-sleep', hint: '作息与夜醒' },
  development: { label: '发育', badge: '育', tone: 'cat-development', hint: '动作与互动' },
  safety: { label: '安全', badge: '安', tone: 'cat-safety', hint: '居家与出行' },
  daily_care: { label: '日常照护', badge: '护', tone: 'cat-daily', hint: '洗澡与护理' },
};

/** 分组顺序固定：喂养 → 睡眠 → 发育 → 安全 → 日常照护 */
export const CATEGORY_ORDER = ['feeding', 'sleep', 'development', 'safety', 'daily_care'] as const;

export const SEVERITY_META: Record<
  string,
  { label: string; icon: string; color: string; bg: string; border: string }
> = {
  observe: { label: '可以密切观察', icon: '○', color: '#8a6100', bg: '#fff8e6', border: '#e8c56a' },
  urgent: { label: '立即就医', icon: '!', color: '#a84000', bg: '#fff3e8', border: '#e79b5c' },
  emergency: { label: '立即拨打 120', icon: '⚠', color: '#9b1c1c', bg: '#fdecec', border: '#d97b7b' },
};

/** 筛查节点：预警征象表在 0～3 岁的 8 个月龄节点 */
export const SCREEN_NODES = [3, 6, 8, 12, 18, 24, 30, 36] as const;

/** 取不晚于 months 的最近筛查节点；小于 3 时取 3 并标注 */
export function screenNodeFor(months: number): number {
  let node = SCREEN_NODES[0] as number;
  for (const n of SCREEN_NODES) {
    if (months >= n) node = n;
  }
  return node;
}
