import raw from '../content/data/taxonomy.json';

export type Topic = {
  id: string;
  label: string;
  desc: string;
  slugs: string[];
};

export type Scene = {
  id: string;
  label: string;
  question: string;
  slugs: string[];
  aliases: string[];
};

type TaxonomyFile = {
  topics: Topic[];
  scenes: Scene[];
  synonyms: { to: string; terms: string[] }[];
};

export const TAXONOMY = raw as TaxonomyFile;
export const TOPICS = TAXONOMY.topics;
export const SCENES = TAXONOMY.scenes;

export function topicOf(slug: string): Topic | undefined {
  return TOPICS.find((t) => t.slugs.includes(slug));
}

export function sceneById(id: string): Scene | undefined {
  return SCENES.find((s) => s.id === id);
}

/** 主题下按时间线排好序的条目 slug（顺序由 taxonomy.json 决定，不按字母） */
export function topicSlugs(id: string): string[] {
  return TOPICS.find((t) => t.id === id)?.slugs ?? [];
}

/** 某个主题的口语同义词，用于搜索索引补全 */
export function synonymsOf(topicId: string): string[] {
  return TAXONOMY.synonyms.find((s) => s.to === topicId)?.terms ?? [];
}

/** 一条内容可能同时属于多个主题（例如 teething 同属皮肤与口腔） */
export function topicsOf(slug: string): Topic[] {
  return TOPICS.filter((t) => t.slugs.includes(slug));
}
