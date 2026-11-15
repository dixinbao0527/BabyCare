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

/**
 * 专业复核：由具备儿科 / 儿童保健背景的人员对照指南原文逐条核对。
 * 缺省即「未复核」，页面会如实显示「专业复核：待完成」。
 * 注意：last_reviewed / reviewer 记录的是「资料整理」，不能当作专业复核。
 */
const medicalReview = z
  .object({
    status: z.enum(['pending', 'done']).default('pending'),
    reviewer: z.string().default(''),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .or(z.literal(''))
      .default(''),
  })
  .default({ status: 'pending', reviewer: '', date: '' });

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
    /** 资料整理日期（编辑整理完成日，不是专业复核） */
    last_reviewed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    reviewer: z.string().min(2),
    medical_review: medicalReview,
    /** 关联的 WHO 运动窗口 key（见 milestones.yaml 的 windows.key），用于自动渲染窗口数字 */
    window: z.string().min(2).optional(),
    related: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

const acute = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/acute' }),
  schema: z
    .object({
      title: z.string().min(2).max(20),
      /** 临床名：主标题用家长会搜的说法，临床名放在副标题与标签里 */
      clinical_name: z.string().min(2).max(20),
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
      /** 资料整理日期（编辑整理完成日，不是专业复核） */
      last_reviewed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      reviewer: z.string().min(2),
      medical_review: medicalReview,
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
    /** WHO 粗大运动达成窗口（1～99 百分位）；只有运动维度需要 */
    windows: z
      .array(
        z
          .object({
            /** 稳定 key，供条目通过 window 字段引用 */
            key: z.string().min(2).optional(),
            label: z.string().min(2).max(14),
            start: z.number().min(0).max(36),
            end: z.number().min(0).max(36),
            order: z.number().int().min(0).max(99).default(0),
          })
          .refine((w) => w.end > w.start, { message: 'window.end 必须大于 window.start' })
      )
      .default([]),
  }),
});

/* ------------------------------------------------------------------
 * 户外活动（v3.0）
 * 与医学内容分舱：字段围绕「场所事实 + 设施 + 时效」，不承载任何医疗结论。
 * ---------------------------------------------------------------- */

/** 北京 16 区。不允许「近郊」「城北」等模糊值，否则筛选会失真 */
export const DISTRICTS = [
  '东城区',
  '西城区',
  '朝阳区',
  '海淀区',
  '丰台区',
  '石景山区',
  '门头沟区',
  '房山区',
  '通州区',
  '顺义区',
  '昌平区',
  '大兴区',
  '怀柔区',
  '平谷区',
  '密云区',
  '延庆区',
] as const;

export const VENUE_TYPES = [
  'city_park',
  'forest_park',
  'wetland',
  'riverside',
  'botanical',
  'zoo',
  'playground',
  'scenic',
  'heritage',
] as const;

/** 四态：宁可写 unknown，也不许猜 */
export const FACILITY_STATES = ['yes', 'partial', 'no', 'unknown'] as const;

/** 票务三态。boolean 无法表达「未核实」，会逼着作者猜 */
export const TICKET_STATES = ['free', 'paid', 'unknown'] as const;

export const SAFETY_TAGS = [
  'water',
  'sun',
  'mosquito',
  'traffic',
  'fall',
  'choking',
  'crowd',
] as const;

export const OUTDOOR_SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;

/**
 * 统一关系边。作者只写在源条目，反向边由构建期补全。
 * 取代「related 只指向 acute」的单向写法，见 src/lib/relations.ts
 */
const relation = z.object({
  type: z.enum(['related_acute', 'related_dev', 'same_topic', 'outdoor', 'checklist']),
  slug: z.string().min(2),
});

const outdoor = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/outdoor' }),
  schema: z
    .object({
      title: z.string().min(2).max(24),
      district: z.enum(DISTRICTS),
      venue_type: z.enum(VENUE_TYPES),
      summary: z.string().min(20).max(90),
      tags: z.array(z.string().min(1)).min(1).max(6),
      age_fit: z.array(z.enum([...AGE_RANGES, 'all'])).min(1),
      stroller: z.enum(FACILITY_STATES),
      shade: z.enum(FACILITY_STATES),
      nursing_room: z.enum(FACILITY_STATES),
      toilet: z.enum(FACILITY_STATES),
      playground: z.enum(FACILITY_STATES),
      water_hazard: z.boolean().default(false),
      free: z.enum(TICKET_STATES),
      ticket_note: z.string().default(''),
      open_hours: z.string().default(''),
      reservation: z.string().default(''),
      address: z.string().min(6),
      transit: z.string().default(''),
      parking: z.string().default(''),
      official_name: z.string().min(4),
      official_url: z.string().url(),
      seasons: z.array(z.enum(OUTDOOR_SEASONS)).default([]),
      safety_tags: z.array(z.enum(SAFETY_TAGS)).min(1),
      relations: z.array(relation).default([]),
      verified_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      last_reviewed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      reviewer: z.string().min(2),
      draft: z.boolean().default(false),
    })
    // 有开放水域却没有配任何急症回链，等于把最危险的一项漏掉
    .refine((d) => !d.water_hazard || d.relations.some((r) => r.type === 'related_acute'), {
      message: 'water_hazard=true 时必须至少关联一条急症条目（relations.type=related_acute）',
    }),
});

export const collections = { developmental, acute, milestones, outdoor };
