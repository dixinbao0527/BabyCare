/** 复核状态：把「谁复核、什么时候」变成页面上可见的事实，而不是藏在 frontmatter 里 */
export type ReviewState = 'fresh' | 'stale' | 'expired' | 'unknown';

export type ReviewInfo = {
  lastReviewed: string;
  reviewer: string;
  days: number | null;
  state: ReviewState;
  label: string;
};

export function reviewInfo(lastReviewed: string | undefined, reviewer: string | undefined): ReviewInfo {
  const who = reviewer?.trim() || '内容组';
  if (!lastReviewed) {
    return { lastReviewed: '', reviewer: who, days: null, state: 'unknown', label: '复核记录缺失' };
  }
  const then = new Date(`${lastReviewed}T00:00:00`);
  if (Number.isNaN(then.getTime())) {
    return { lastReviewed, reviewer: who, days: null, state: 'unknown', label: '复核日期格式异常' };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((today.getTime() - then.getTime()) / 86400000);

  // 复核人自己写着「待核验」时，日期再新也不能显示「已复核」
  if (/待|未核验|待复核/.test(who)) {
    return { lastReviewed, reviewer: who, days, state: 'stale', label: '待复核' };
  }
  if (days > 365) {
    return { lastReviewed, reviewer: who, days, state: 'expired', label: '待重新复核' };
  }
  if (days > 180) {
    return { lastReviewed, reviewer: who, days, state: 'stale', label: '待复核' };
  }
  return { lastReviewed, reviewer: who, days, state: 'fresh', label: '已复核' };
}

export function formatDate(iso: string): string {
  return iso ? iso.replace(/-/g, '.') : '—';
}
