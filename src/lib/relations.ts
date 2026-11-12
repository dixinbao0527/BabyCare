export type ContentKind = 'dev' | 'acute' | 'outdoor';

export type RelationType =
  | 'related_acute'
  | 'related_dev'
  | 'same_topic'
  | 'outdoor'
  | 'checklist';

export type RelationEdge = {
  /** 边的起点：dev:xxx / acute:xxx / outdoor:xxx */
  from: string;
  /** 边的终点 */
  to: string;
  targetKind: ContentKind;
  targetSlug: string;
  type: RelationType;
  /** 是否由反向补全生成 */
  generated: boolean;
};

type Entry = {
  id: string;
  data: {
    related?: string[];
    relations?: { type: RelationType; slug: string }[];
  };
};

export function slugOf(entry: { id: string }): string {
  return entry.id.split('/').pop() ?? entry.id;
}

function key(kind: ContentKind, slug: string): string {
  return `${kind}:${slug}`;
}

/**
 * 构建关系图：显式边 + 反向补全。
 *
 * 现有 developmental 条目用 `related: ["choking"]`（只指向急症），
 * 新条目用 `relations: [{ type, slug }]`。两种写法都读，统一成一张图，
 * 这样不用批量改 34 条已有内容，也不会出现两套字段各说各话。
 */
export function buildRelations(input: {
  dev: Entry[];
  acute: Entry[];
  outdoor: Entry[];
}): Map<string, RelationEdge[]> {
  const edges: RelationEdge[] = [];
  const seen = new Set<string>();

  const targetKindOf = (slug: string): ContentKind | null => {
    if (input.acute.some((e) => slugOf(e) === slug)) return 'acute';
    if (input.dev.some((e) => slugOf(e) === slug)) return 'dev';
    if (input.outdoor.some((e) => slugOf(e) === slug)) return 'outdoor';
    return null;
  };

  const add = (from: string, slug: string, type: RelationType) => {
    const kind = targetKindOf(slug);
    if (!kind) return;
    const id = `${from}->${kind}:${slug}:${type}`;
    if (seen.has(id)) return;
    seen.add(id);
    edges.push({
      from,
      to: key(kind, slug),
      targetKind: kind,
      targetSlug: slug,
      type,
      generated: false,
    });
  };

  for (const e of input.dev) {
    const from = key('dev', slugOf(e));
    for (const slug of e.data.related ?? []) add(from, slug, 'related_acute');
    for (const r of e.data.relations ?? []) add(from, r.slug, r.type);
  }
  for (const e of input.acute) {
    const from = key('acute', slugOf(e));
    for (const r of e.data.relations ?? []) add(from, r.slug, r.type);
  }
  for (const e of input.outdoor) {
    const from = key('outdoor', slugOf(e));
    for (const r of e.data.relations ?? []) add(from, r.slug, r.type);
  }

  // 反向补全：只在同一对节点间没有同类型反向边时添加
  const reverse: RelationEdge[] = [];
  for (const edge of edges) {
    const back = `${edge.to}->${edge.from}->${edge.type}`;
    if (edges.some((x) => `${x.from}->${x.to}->${x.type}` === back)) continue;
    if (reverse.some((x) => `${x.from}->${x.to}->${x.type}` === back)) continue;
    const [kind, slug] = edge.to.split(':') as [ContentKind, string];
    reverse.push({
      from: edge.to,
      to: edge.from,
      targetKind: kind,
      targetSlug: slug,
      type: edge.type,
      generated: true,
    });
  }

  const all = [...edges, ...reverse];
  const map = new Map<string, RelationEdge[]>();
  for (const edge of all) {
    const list = map.get(edge.from) ?? [];
    list.push(edge);
    map.set(edge.from, list);
  }
  return map;
}

export function relationsOf(
  map: Map<string, RelationEdge[]>,
  kind: ContentKind,
  slug: string
): RelationEdge[] {
  return map.get(key(kind, slug)) ?? [];
}
