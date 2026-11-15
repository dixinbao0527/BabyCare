/** 搜索结果排序：先保证「字面命中」的条目排在模糊匹配前面 */
export type RankableItem = {
  title: string;
  tags: string[];
  summary: string;
};

/** 体温、月龄这类数字查询只做字面匹配，避免被模糊匹配带偏 */
export function isLiteralQuery(q: string): boolean {
  return /^\d+(\.\d+)?$/.test(q.trim());
}

export function literalFilter<T extends RankableItem>(items: T[], q: string): T[] {
  const needle = q.trim();
  if (!needle) return items;
  return items.filter((it) => (it.title + ' ' + it.tags.join(' ') + ' ' + it.summary).includes(needle));
}

export function rankByMatch<T extends RankableItem>(items: T[], q: string): T[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return items;
  const score = (it: T): number => {
    const title = it.title.toLowerCase();
    const tags = it.tags.map((t) => t.toLowerCase());
    if (title === needle) return 0;
    if (title.startsWith(needle)) return 1;
    if (title.includes(needle)) return 2;
    if (tags.includes(needle)) return 3;
    if (tags.some((t) => t.includes(needle))) return 4;
    return 5;
  };
  return items
    .map((item, index) => ({ item, index, score: score(item) }))
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map((x) => x.item);
}
