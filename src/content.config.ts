import { defineCollection, z } from 'astro:content';
import { glob, file } from 'astro/loaders';

export const AGE_RANGES = [
  '0-1m',
  '1-3m',
  '4-6m',
  '7-9m',
  '10-12m',
  '13-24m',
  '25-36m',
] as const;

export const CATEGORIES = [
  'feeding',
  'sleep',
  'development',
  'safety',
  'daily_care',
] as const;

export const TIERS = ['NHC', 'AAP', 'WHO'] as const;
export const SEVERITY_ORDER = ['observe', 'urgent', 'emergency'] as const;

/** 来源对象：section 与 url 至少一项非空（由 validate-content 兜底） */
const source = z.object({
  name: z.string().min(4),
  section: z.string().default(''),
  url: z.string().url().or(z.literal('')).default(''),
  year: z.number().int().min(1990),
  tier: z.enum(TIERS),
});

const developmental = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/developmental' }),
  schema: z.object({
    title: z.string().min(4).max(20),
    // 禁止 'all'：age_range 是月龄主轴，急症不参与
    age_range: z.enum(AGE_RANGES),
    category: z.enum(CATEGORIES),
    scenario_tags: z.array(z.string().min(2)).min(1).max(6),
    summary: z.string().min(20).max(80),
    source,
    order: z.number().int().min(0).default(0),
    last_reviewed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    reviewer: z.string().min(2),
    related: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

const acute = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/acute' }),
  schema: z
    .object({
      title: z.string().min(2).max(20),
      content_type: z.literal('acute'),
      age_range: z.literal('all'),
      peak_age_note: z.string().min(6),
      scenario_tags: z.array(z.string().min(2)).min(2).max(8),
      summary: z.string().min(20).max(100),
      severity_levels: z
        .array(
          z.object({
            level: z.enum(SEVERITY_ORDER),
            label: z.string().min(2),
            criteria: z.string().min(10),
            action: z.string().min(6),
          })
        )
        .length(3),
      red_flags: z.array(z.string().min(6)).min(1),
      home_care: z.array(z.string().min(4)).min(3).max(6),
      source,
      last_reviewed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      reviewer: z.string().min(2),
    })
    // 业务规则：三级必须齐全且顺序固定，缺一级即构建失败（A-6）
    .refine(
      (d) => d.severity_levels.map((s) => s.level).join(',') === SEVERITY_ORDER.join(','),
      { message: 'severity_levels 必须且只能按 observe→urgent→emergency 顺序各一条' }
    ),
});

// file() loader 每个数组元素生成一条记录，因此 schema 是单条对象而非数组
const milestones = defineCollection({
  loader: file('./src/content/data/milestones.yaml'),
  schema: z.object({
    age_month: z.number().int().min(0).max(36),
    domain: z.enum(['motor', 'language', 'cognitive', 'social']),
    description: z.string().min(4),
    source: z.string().min(4),
  }),
});

export const collections = { developmental, acute, milestones };
