# 婴幼儿健康养育手册 · 产品需求文档（PRD）

**版本**：v2.0  
**文档状态**：可开发（Ready for Dev）  
**项目性质**：公益、非商业、个人维护  
**目标用户**：0～3 岁婴幼儿家长（主要照护人）  
**产品形态**：Astro 静态站点，内容以 Markdown/MDX 维护  
**响应式基线**：开发以 PC 视口为主，移动端 375px 可用性为强制验收项  
**编制日期**：2026-10-29

---

## 0. 本版修订说明（v1.0 → v2.0）

v1.0 的架构判断（静态站点、内容集合、急症独立于月龄主轴）是正确的，可以直接进入开发。v2.0 不推翻架构，只补齐 v1.0 缺失的、会导致返工或医疗风险的部分。

### 0.1 关键变更

| 编号   | 变更                                                                                           | 类型   | 为什么必须改                                                                                    |
| ---- | -------------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------- |
| C-01 | 新增第 6 章「月龄计算与阶段映射」，定义月龄算法、**早产儿矫正月龄**、`age_range` 数值边界                                       | 架构补全 | v1.0 的 7 个阶段边界互相重叠（`0-1m` 与 `1-3m` 都含 1 月龄），且未处理早产儿。这两点会让"当前阶段"判断在真实用户身上直接算错，属于功能错误而非体验问题 |
| C-02 | 数据模型升级为 Astro 5 Content Layer（`src/content.config.ts` + `glob()` loader + zod），并给出可执行 schema | 技术校正 | Astro 5 已弃用 v1.0 隐含的 `src/content/config.ts` 写法；不锁定版本会在 M1 第一天卡住                          |
| C-03 | `source_*` 扁平字段改为嵌套 `source` 对象，新增 `guideline_year`、`last_reviewed`、`reviewer`               | 数据模型 | 溯源要能回答"依据的是哪一版指南"，扁平字段无法承载版本与复核时间                                                         |
| C-04 | 新增「逐字照录」内容规则                                                                                 | 内容治理 | 预警征象属筛查工具，改写即失真。例：官方原文为"紧握拳**松不开**"，v1.0 写作"紧握拳**不松开**"，语义相近但不能改                          |
| C-05 | 免责声明从「仅 /sources 页」提升为**全站页脚 + 急症页顶部二次声明**                                                   | 合规   | 只在来源页声明，意味着 99% 的读者看不到；这是医疗信息类站点最主要的责任敞口                                                  |
| C-06 | 新增构建期数据校验与 CI 门禁（schema + 业务规则双重校验）                                                          | 工程质量 | 急症条目少一级 `severity_levels`，页面不会报错，但会在真实急症时少给一条行动指令                                         |
| C-07 | 搜索改为构建期生成索引 JSON + 按需加载 fuse.js                                                              | 性能   | 避免把全部条目正文打进首页包；首页 JS 预算收紧到 20KB gzip                                                      |
| C-08 | 新增第 17 章风险登记册、第 18 章「不做什么」                                                                   | 项目治理 | 个人公益项目最大的风险是范围蔓延与内容过时，需要显式记录                                                              |
| C-09 | 验收标准全部改写为可执行断言（含 Playwright 检查脚本）                                                            | 验收   | "移动端验收通过"不是可验收的句子，必须给出可运行的判据                                                              |
| C-10 | 附录 A 补全 0～3 岁预警征象 **32 条官方原文**                                                               | 内容   | v1.0 只有 2 条示例，M4 阶段会因缺少权威底稿而停滞                                                            |

### 0.2 未变更的决策

- 不引入后端、数据库、登录、SSR、AI 问答。
- 急症条目独立于月龄主轴，`age_range: "all"` 视为"始终可见"。
- 首页急症入口不依赖出生日期输入。
- v1 视频采用方案 A（外链官方账号），不嵌入。

---

## 1. 项目定位与边界

### 1.1 一句话定位

把国家卫健委、WHO、AAP 的婴幼儿养育指南，翻译成"按月龄可查、按症状可查、每句能溯源"的结构化知识地图。

### 1.2 设计原则

| 原则     | 含义                         | 反面案例（明确禁止）      |
| ------ | -------------------------- | --------------- |
| 溯源优先   | 每条结论都能指回原文的具体章节            | 写"研究表明……"却不给出处  |
| 保守表达   | 不确定就说不确定；能说"建议就医"就不说"没事"   | "一般不用管，观察两天就好"  |
| 分诊而非诊断 | 帮家长判断"要不要去医院、多急"，不判断"是什么病" | "这是典型的幼儿急疹"     |
| 减法     | 一个页面只解决一个问题；急症页不放疾病机制      | 急症页插入 800 字病理生理 |
| 可用性即安全 | 弱网、单手、慌乱状态下仍能读到关键信息        | 关键行动藏在折叠面板里     |

### 1.3 产品边界（必须写进页面，不能只写在文档里）

**本站做**：整理公开指南、按月龄组织、提供分诊参考、标注来源。  
**本站不做**：诊断疾病、推荐药品与剂量、替代面诊、提供个体化医疗建议。

急症页顶部固定声明文案（红色警示条下方，小字）：

> 本页为指南整理，用于帮助判断紧急程度，不能替代医生的面诊与诊断。任何让你不安的表现，都值得直接就医。

### 1.4 成功标准

公益项目不看 DAU，看四个质量指标：

| 指标       | 目标                                                        | 测量方式                               |
| -------- | --------------------------------------------------------- | ---------------------------------- |
| 溯源覆盖率    | 100% 条目具备 `source.name` + `source.section` 或 `source.url` | 构建期断言，缺失即构建失败                      |
| 急症路径可达性  | 任意页面 ≤ 2 次点击到达急症详情                                        | 手工走查 + 路由测试                        |
| 移动端首屏完整性 | 375px 下首页出生日期输入 + 急症入口同屏可见，无需滚动                           | Playwright 断言元素 `boundingBox` 在视口内 |
| 内容新鲜度    | 任一指南发布新版后 30 天内完成条目复核                                     | `last_reviewed` 字段 + 年度全量复查        |

---

## 2. 目标用户与核心场景

### 2.1 用户画像

**主画像：首次育儿的主要照护人，25～35 岁，手机为主。**

- 夜间使用比例高（哄睡、夜醒、突发状况），屏幕亮度低。
- 育儿知识来源碎片化（短视频、家长群、长辈经验），对"官方指南"有信任但缺少入口。
- 焦虑水平高，对"要不要去医院"的判断需求，远高于对"病理机制"的好奇。
- 不具备医学术语解码能力：「三凹征」「吸气性喉鸣」必须配可观察的描述。

**次画像：祖辈照护人，50～65 岁。**

- 字号需求更高，需要浏览器缩放 150% 后仍不破版。
- 更需要"看症状对号入座"，而不是按月龄系统学习。

### 2.2 核心场景（决定信息架构的三个场景）

| 场景    | 触发时刻                | 用户真实问题      | 产品应答                                                | 成功判据               |
| ----- | ------------------- | ----------- | --------------------------------------------------- | ------------------ |
| S1 突发 | 凌晨 2 点，孩子咳嗽像犬吠、声音嘶哑 | "现在要不要去医院？" | 首页急症入口 → `/quick/acute-laryngitis`，3 秒内看到红色警示条与三级分级 | 从打开到看见分级卡片 ≤ 3 次交互 |
| S2 阶段 | 孩子 5 个月，准备加辅食       | "这个月该注意什么？" | 输入出生日期 → 自动定位 `/age/4-6m`                           | 输入后无需刷新即出结果        |
| S3 核对 | 儿保体检前，孩子 8 个月还不会独坐  | "这算不算落后？"   | `/milestones` 勾选预警征象 → 出现就医建议                       | 勾选后 0 延迟出现提示条      |

### 2.3 反场景（明确不为它优化）

- 孕期用户：不提供胎教、待产内容。
- 已确诊疾病的治疗方案查询：不涉及用药、剂量、康复训练方案。
- 学术研究：不提供文献综述，只提供条目级溯源。

---

## 3. 技术栈与工程约束

### 3.1 选型

**Astro 静态站点 + Content Layer（Markdown/MDX 内容集合）**。理由不变：内容驱动、默认零 JS、弱网快、frontmatter 类型校验、文件即路由。

| 层面 | 选择                                                     | 版本/约束                                    |
| -- | ------------------------------------------------------ | ---------------------------------------- |
| 框架 | Astro                                                  | `^5.x`，启用 Content Layer（`glob()` loader） |
| 内容 | Markdown 为主，MDX 仅用于需要组件的正文                             | 里程碑表格用 Astro 组件，不写进正文                    |
| 样式 | 原生 CSS + CSS 变量（设计令牌）                                  | 不引入 Tailwind/UI 库，控制产物体积与长期可维护性          |
| 交互 | Astro Islands（`client:load` / `client:visible`）+ 原生 JS | 无框架运行时；如引入 React 仅用于 `/quick` 搜索岛屿       |
| 搜索 | fuse.js（动态 import）                                     | 仅 `/quick` 加载，≤ 15KB gzip                |
| 部署 | Cloudflare Pages（首选）/ GitHub Pages                     | 纯静态，无 Functions                          |
| CI | GitHub Actions：`astro check` + 内容校验 + Playwright       | PR 必须通过才可合并                              |

**不引入**：后端数据库、用户系统、SSR、AI 问答、评论、埋点 SDK（如后续需要统计，选无 Cookie 的自托管方案并同步更新 `/sources` 的隐私说明）。

### 3.2 目录结构

```text
infant-care-handbook/
├─ astro.config.mjs
├─ src/
│  ├─ content.config.ts            # 合集定义与 zod schema（Astro 5）
│  ├─ content/
│  │  ├─ developmental/
│  │  │  ├─ 0-1m/
│  │  │  ├─ 1-3m/ 4-6m/ 7-9m/ 10-12m/ 13-24m/ 25-36m/
│  │  ├─ acute/
│  │  │  ├─ acute-laryngitis.md
│  │  │  └─ febrile-seizure.md
│  │  └─ data/
│  │     ├─ milestones.yaml        # 通过 file() loader 载入
│  │     └─ warning-signs.yaml
│  ├─ components/
│  │  ├─ BirthDatePicker.astro     # 岛屿：输入 + 月龄定位
│  │  ├─ AgeNav.astro              # 横向滚动阶段条
│  │  ├─ KnowledgeCard.astro       # details/summary 卡片
│  │  ├─ SeverityCard.astro        # 三级分诊卡
│  │  ├─ QuickSearch.astro         # 岛屿：fuse.js
│  │  └─ WarningSignChecklist.astro
│  ├─ layouts/BaseLayout.astro     # 页脚免责声明、全局样式
│  ├─ lib/
│  │  ├─ age.ts                    # 月龄计算（含矫正月龄）
│  │  ├─ stages.ts                 # age_range 边界与映射
│  │  └─ sources.ts                # 来源层级与展示名
│  └─ pages/
│     ├─ index.astro
│     ├─ age/[range].astro
│     ├─ quick/index.astro
│     ├─ quick/[slug].astro
│     ├─ milestones.astro
│     ├─ sources.astro
│     └─ 404.astro
└─ scripts/
   ├─ validate-content.ts          # 业务规则校验（schema 之外的）
   └─ check-responsive.mjs         # Playwright 375px 断言
```

### 3.3 性能与兼容预算

| 项                       | 预算                                       | 说明                                  |
| ----------------------- | ---------------------------------------- | ----------------------------------- |
| 首页 JS（gzip）             | ≤ 20KB                                   | 仅出生日期岛屿 + 阶段条                       |
| 急症详情页 JS                | ≤ 8KB                                    | 无搜索结果、无岛屿，仅打印与来源折叠                  |
| LCP（Fast 3G，Moto G4 模拟） | ≤ 2.5s                                   | 首屏文本为主，字体 `font-display: swap`      |
| CLS                     | ≤ 0.05                                   | 出生日期区块预留固定高度，避免定位后跳动                |
| 首屏请求数                   | ≤ 8                                      | 内联关键 CSS，不加载第三方字体 CDN               |
| 浏览器支持                   | 近两年 Chrome/Edge/Safari/Firefox + iOS 15+ | `<details>`、`<dialog>`、`Date` 均原生可用 |

### 3.4 SEO 与内容可信度

- 全站 `sitemap.xml`，急症页 `changefreq: monthly`。
- 每页 `<title>` 采用「条目名｜月龄/症状｜手册名」结构。
- 结构化数据仅用于 `WebSite` 与 `BreadcrumbList`。**不添加 `MedicalWebPage` 之外的医疗断言型 schema**，避免被解读为医疗建议提供方。
- 所有页面 `<html lang="zh-CN">`；日期格式统一 `YYYY-MM-DD`。

---

## 4. 信息架构

### 4.1 路由总表

| 路由              | 页面         | 渲染               | 数据来源                                           | 关键交互             | 可索引 |
| --------------- | ---------- | ---------------- | ---------------------------------------------- | ---------------- | --- |
| `/`             | 首页         | SSG + 岛屿         | developmental（当前阶段）+ 全站导航                      | 出生日期输入、阶段定位、急症入口 | 是   |
| `/age/[range]`  | 月龄阶段页（7 个） | `getStaticPaths` | developmental 按 `age_range` 过滤 + warning_signs | 卡片展开             | 是   |
| `/quick`        | 快速查询       | SSG + 岛屿         | developmental + acute 合并索引                     | 搜索、分类筛选          | 是   |
| `/quick/[slug]` | 急症/场景详情    | `getStaticPaths` | acute（v1 仅 acute 进详情路由）                        | 来源折叠             | 是   |
| `/milestones`   | 里程碑 + 预警征象 | SSG + 岛屿         | milestones + warning_signs                     | 月龄切换、复选框         | 是   |
| `/sources`      | 来源与声明      | SSG              | 静态内容 + 构建期汇总的 source 清单                        | 无                | 是   |
| `/404`          | 未找到        | SSG              | —                                              | 回首页、去急症页         | 否   |

### 4.2 内容类型关系

```text
developmental（月龄主轴，7 个 age_range）
   └── 参与 /age/[range]、首页当前阶段、/quick 搜索
acute（急症，age_range 恒为 all）
   └── 只进 /quick 列表与 /quick/[slug] 详情；不进月龄页
milestones（结构化 YAML，非卡片）
   └── 只服务 /milestones
warning_signs（结构化 YAML，官方筛查表逐字照录）
   └── 服务 /age/[range] 页底 + /milestones
```


**关键约束**：acute 与 developmental 是两个独立合集，`/quick` 的"急症置顶"必须在**构建期**完成合并与排序，不允许在客户端用 `age_range === 'all'` 反推类型（类型应由 `content_type` 显式声明）。

---

## 5. 数据模型

### 5.1 合集定义（Astro 5，可直接落地）

```ts
// src/content.config.ts
import { defineCollection, z } from 'astro:content';
import { glob, file } from 'astro/loaders';

export const AGE_RANGES = [
  '0-1m', '1-3m', '4-6m', '7-9m', '10-12m', '13-24m', '25-36m',
] as const;
export const CATEGORIES = [
  'feeding', 'sleep', 'development', 'safety', 'daily_care',
] as const;
export const TIERS = ['NHC', 'AAP', 'WHO'] as const;
export const SEVERITY_ORDER = ['observe', 'urgent', 'emergency'] as const;

const source = z.object({
  name: z.string().min(4),          // 指南全称，含书名号
  section: z.string().default(''),  // 章节，可空但需与 url 二选一
  url: z.string().url().or(z.literal('')).default(''),
  year: z.number().int().min(1990), // 指南版本年份
  tier: z.enum(TIERS),
});

const developmental = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/developmental' }),
  schema: z.object({
    title: z.string().min(4).max(20),
    age_range: z.enum(AGE_RANGES),           // 禁止 'all'
    category: z.enum(CATEGORIES),
    scenario_tags: z.array(z.string().min(2)).min(1).max(6),
    summary: z.string().min(20).max(80),
    source,
    order: z.number().int().min(0).default(0),
    last_reviewed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    reviewer: z.string().min(2),             // 复核人（可为化名）
    related: z.array(z.string()).default([]),// 关联 acute 的 slug
    draft: z.boolean().default(false),
  }),
});

const acute = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/acute' }),
  schema: z.object({
    title: z.string().min(2).max(20),
    content_type: z.literal('acute'),
    age_range: z.literal('all'),
    peak_age_note: z.string().min(6),
    scenario_tags: z.array(z.string().min(2)).min(2).max(8),
    summary: z.string().min(20).max(100),
    severity_levels: z
      .array(z.object({
        level: z.enum(SEVERITY_ORDER),
        label: z.string().min(2),
        criteria: z.string().min(10),
        action: z.string().min(6),
      }))
      .length(3),
    red_flags: z.array(z.string().min(6)).min(1),
    home_care: z.array(z.string().min(4)).min(3).max(6),
    source,
    last_reviewed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    reviewer: z.string().min(2),
  })
  // 业务规则：三级必须齐全且按 observe→urgent→emergency 顺序
  .refine(
    (d) => d.severity_levels.map((s) => s.level).join(',') === SEVERITY_ORDER.join(','),
    { message: 'severity_levels 必须且只能按 observe→urgent→emergency 顺序各一条' }
  ),
});

const milestones = defineCollection({
  loader: file('./src/content/data/milestones.yaml'),
  schema: z.array(z.object({
    age_month: z.number().int().min(0).max(36),
    domain: z.enum(['motor', 'language', 'cognitive', 'social']),
    description: z.string().min(4),
    source: z.string().min(4),
  })),
});

export const collections = { developmental, acute, milestones };
```

> `warning-signs.yaml` 体量小、结构固定，建议直接在 `src/lib/warningSigns.ts` 中以常量数组维护并 `as const`，比 loader 更简单，且能被 `/milestones` 与 `/age/[range]` 同时静态引用。若坚持用 YAML，加 `file()` loader，字段为 `age_month / domain / sign / domain_note`。

### 5.2 字段级规则

| 字段                              | 规则                                | 违反后果            | 校验位置                  |
| ------------------------------- | --------------------------------- | --------------- | --------------------- |
| `title`                         | 4～20 字，疑问句优先（"要不要去医院"优于"急性喉炎概述"）  | 卡片换行、导航溢出       | zod                   |
| `summary`                       | 发展性 20～80 字，急症 20～100 字，必须是完整句子   | 首屏信息不完整         | zod                   |
| `scenario_tags`                 | 用家长会说的词，不用医学术语（"犬吠样咳嗽"可，"喉鸣"需配解释） | 搜不到             | 人工评审                  |
| `source.section` 与 `source.url` | 至少一项非空                            | 无法溯源 = 条目作废     | `validate-content.ts` |
| `severity_levels`               | 必须 3 条且顺序固定                       | 急症时漏掉一级行动       | zod refine            |
| `red_flags[0]`                  | 必须是"最不该做的那件事"，不是"注意事项"            | 顶部警示条失效         | 人工评审                  |
| `order`                         | 同 `age_range` + `category` 内唯一    | 首页取 top N 结果不稳定 | `validate-content.ts` |
| `last_reviewed`                 | ≤ 今天，且不超过 12 个月                   | 内容过时无感知         | `validate-content.ts` |


### 5.3 示例条目

**发展性：辅食引入**

```yaml
---
title: "什么时候可以加辅食"
age_range: "4-6m"
category: "feeding"
scenario_tags: ["辅食添加", "挺舌反射", "第一口辅食"]
summary: "满6月龄是最常见的起点。看三个信号：挺舌反射消失、能靠坐并稳定抬头、对大人的食物表现出兴趣。"
source:
  name: "国家卫生健康委办公厅《3岁以下婴幼儿健康养育照护指南（试行）》"
  section: "营养与喂养"
  url: ""
  year: 2022
  tier: "NHC"
order: 1
last_reviewed: "2026-10-29"
reviewer: "内容组"
related: []
draft: false
---
正文 3～5 段，每段不超过 4 行。
```

**急症：急性喉炎**

```yaml
---
title: "急性喉炎"
content_type: "acute"
age_range: "all"
peak_age_note: "好发于6月龄～3岁，但任何年龄都可能发生；夜间加重是典型特点"
scenario_tags: ["犬吠样咳嗽", "声音嘶哑", "吸气时有杂音", "半夜突然咳醒"]
summary: "咳嗽声像小狗叫、声音嘶哑，安静时能听到吸气有杂音，就要按急症处理，不要等天亮。"
severity_levels:
  - level: "observe"
    label: "可以密切观察"
    criteria: "只有犬吠样咳嗽和声音嘶哑，精神好、呼吸平稳、能正常喝水吃奶、入睡后无杂音"
    action: "家庭护理，夜间由大人同室守着，每 1～2 小时看一次呼吸"
  - level: "urgent"
    label: "立即就医"
    criteria: "安静时也能听到吸气时的杂音；吸气时锁骨上窝、肋间隙、剑突下出现凹陷；烦躁不安、拒绝喝水"
    action: "不要等天亮，立即去急诊；路上让孩子保持半坐位，尽量不哭"
  - level: "emergency"
    label: "立即拨打120"
    criteria: "口唇或面色发青发灰、精神萎靡叫不醒、极度烦躁、说不出话或哭不出声、喝水呛咳"
    action: "立即呼救；等待期间保持半坐卧位、保持安静，不要强行喂水喂药"
red_flags:
  - "不要自行喂止咳药：镇咳会掩盖病情变化，可能延误判断"
home_care:
  - "保持冷静并安抚孩子，哭闹会加重喉部水肿"
  - "开加湿器或带孩子到充满温蒸汽的浴室待 10 分钟"
  - "少量多次喝温水，不强迫"
  - "取半坐卧位，不要平躺"
source:
  name: "国家卫生健康委《3岁以下婴幼儿健康养育照护指南（试行）》常见健康问题防控章节；儿科急症处理共识"
  section: "常见健康问题的防控及照护"
  url: ""
  year: 2022
  tier: "NHC"
last_reviewed: "2026-10-29"
reviewer: "内容组"
---
```

> **注意**：以上 `criteria` / `action` 为结构与文案示范，上线前必须由具备儿科背景的复核人对照原文逐条核对（见第 13 章）。PRD 不承担医学结论的最终正确性。

### 5.4 构建期业务校验（schema 管不到的部分）

`scripts/validate-content.ts` 在 CI 中执行，任一失败即构建失败：

1. `developmental` 中不存在 `age_range: 'all'`。
2. `source.section` 与 `source.url` 至少一项非空。
3. 同一 `age_range` + `category` 下 `order` 不重复。
4. `last_reviewed` 距今 ≤ 365 天（超期输出 warning，不阻断）。
5. 每个 `age_range` 至少 3 条非 draft 条目（否则首页"当前阶段"区块可能为空）。
6. `warning_signs` 的 `age_month` 只能取 `[3,6,8,12,18,24,30,36]`，且每组恰好 4 条。
7. `related` 引用的 slug 必须存在于 `acute`。
8. 全站 `scenario_tags` 去重后统计，单词条标签数 ≥ 2。

---

## 6. 月龄计算与阶段映射

这一章是 v1.0 最大的漏洞，也是全站正确性的地基：算错月龄，首页推荐、阶段页、里程碑对照会同时错。

### 6.1 月龄算法

采用**日历月差**而非"天数 ÷ 30"，因为家长和儿保医生都用日历月说话。

```ts
// src/lib/age.ts
export type AgeInfo = {
  months: number;        // 用于阶段映射的月龄（早产儿已矫正）
  rawMonths: number;     // 实际月龄
  corrected: boolean;    // 是否使用了矫正月龄
  days: number;          // 实际天数
};

export function calcAge(birth: Date, today: Date, gestationalWeeks = 40): AgeInfo {
  const rawMonths = wholeMonths(birth, today);
  const days = Math.floor((startOfDay(today) - startOfDay(birth)) / 86400000);

  // 早产儿：胎龄 < 37 周，矫正至 24 月龄（矫正后按实际月龄计）
  const isPreterm = gestationalWeeks < 37;
  const correctionMonths = isPreterm ? (40 - gestationalWeeks) / 4.345 : 0;
  const corrected = isPreterm && rawMonths < 24 && correctionMonths > 0;

  const months = corrected
    ? Math.max(0, Math.floor(rawMonths - correctionMonths))
    : rawMonths;

  return { months, rawMonths, corrected, days };
}

function wholeMonths(a: Date, b: Date): number {
  let m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) m -= 1;   // 未到当月同日，不进位
  return Math.max(0, m);
}
```

**矫正月龄的产品表达**（必须显示，否则家长会误判）：

> 宝宝实际月龄 5 个月；因 34 周早产，按矫正月龄 3 个月 15 天对照发育里程碑。

### 6.2 `age_range` 边界（消除重叠）

| `age_range` | 月龄区间（含端点） | 展示名 | 阶段一句话 |
|---|---|---|---|
| `0-1m` | 0 ≤ m ≤ 1 | 0～1 个月 | 吃睡循环，建立最初的安全感 |
| `1-3m` | 2 ≤ m ≤ 3 | 1～3 个月 | 开始对视、微笑，昼夜节律萌芽 |
| `4-6m` | 4 ≤ m ≤ 6 | 4～6 个月 | 翻身、靠坐，准备第一口辅食 |
| `7-9m` | 7 ≤ m ≤ 9 | 7～9 个月 | 独坐、爬行，分离焦虑出现 |
| `10-12m` | 10 ≤ m ≤ 12 | 10～12 个月 | 扶站扶走，开始听懂"不" |
| `13-24m` | 13 ≤ m ≤ 24 | 1～2 岁 | 独走、说词，自主意识爆发 |
| `25-36m` | 25 ≤ m ≤ 36 | 2～3 岁 | 短句表达、假想游戏、如厕准备 |

规则：
- 映射函数按上表**闭区间匹配**，区间互不重叠，因此结果唯一。
- `m > 36`（已超出手册范围）→ 停在 `25-36m`，并显示："本手册覆盖 0～3 岁，当前已超出范围，内容可能不再适用。"
- `m < 0` 或 `birth > today` → 不写入存储，输入框下方提示"出生日期不能晚于今天"。

### 6.3 输入与存储

- `<input type="date">`，`max` 为今天，`min` 为 6 年前（防止误选）。
- 允许只选年月：`type="month"` 备选方案难保证 iOS 一致性，因此**不切换控件类型**，改为在 JS 中把缺失的"日"补为 1 号，并在 UI 上标注"精确到日更准"。
- 存储：`localStorage['ich.birth.v1'] = {"birth":"2026-03-14","ga":40,"ts":...}`，`ga` 为可选胎龄周（默认 40）。
- 读取失败（JSON 损坏、隐私模式禁用）→ 静默降级为未输入状态，不抛错、不弹窗。
- 提供"清除本机记录"链接（位于 `/sources` 与首页输入框下方小字），一键 `removeItem`。

### 6.4 时区与边界

- 一律使用浏览器本地时区计算"今天"，不调用网络时间。
- 生日为今天 → 月龄 0，显示"出生第 1 天"。
- 生日跨时区旅行导致的 ±1 天偏差可接受，不做处理。

---

## 7. 页面规格

### 7.1 首页 `/`

**第一屏（375×667 内必须完整可见，不滚动）**

1. 站点标题 + 一句话定位（≤ 20 字）。
2. 出生日期选择器（触控高度 ≥ 48px），下方一行小字：「用于定位月龄，只存在你的手机里」。
3. 月龄结果区（`aria-live="polite"`）：
   - 未输入：显示「输入出生日期，看当前阶段该注意什么」。
   - 已输入：显示「宝宝现在 **5 个月**，处于 4～6 个月阶段」+「查看该阶段全部内容 →」。
   - 早产儿：追加矫正月龄说明行。
4. **急症入口卡**（不依赖输入，始终可见，位于日期选择器正下方）：
   - 视觉：浅红底 + 深红字 + 右箭头，非按钮样式（避免与主 CTA 竞争）。
   - 文案：「孩子突发状况？直接查症状 →」，副行「咳嗽像犬吠、抽搐、误吞、烫伤」。
   - 点击 → `/quick`，并默认聚焦搜索框。

**第二屏**：月龄阶段导航条（7 个胶囊，横向滚动，`scroll-snap`，当前阶段高亮 + `aria-current="true"`）。

**第三屏**：三个入口卡——发育里程碑对照 / 快速查询 / 来源与声明。

**状态矩阵**

| 状态 | 表现 |
|---|---|
| 首次访问、无输入 | 阶段区块替换为"7 个阶段"全量入口列表；急症入口正常 |
| 已输入、有数据 | 展示该 `age_range` 下 `order` 最小的 3～5 条卡片（不足 3 条则全部展示） |
| 已输入、该阶段 0 条 | 显示「这一阶段的内容正在补充」+ 相邻阶段链接（不显示空卡片骨架） |
| localStorage 不可用 | 与"首次访问"一致，输入后仅在本次会话内生效 |

### 7.2 月龄阶段页 `/age/[range]`

- 顶部：阶段名（H1）+ 一句话概括 + 返回上一阶段的箭头（首阶段禁用）。
- 按 `category` 分组，组序固定：喂养 → 睡眠 → 发育 → 安全 → 日常照护；空组不渲染组标题。
- 卡片使用原生 `<details>`：`<summary>` 内为标题 + summary 文本（`-webkit-line-clamp: 3`）+ 来源小字（`--text-muted`，12px）。
- 展开区为正文 Markdown，末尾一行"来源：{name} · {section}"。
- 页底：该阶段预警征象（来自 `warning_signs`，若无对应月龄节点则展示"最近节点"并注明）。
- **不嵌入任何 acute 条目正文**；若 `related` 非空，只在页底放一条文字链接：「相关急症：急性喉炎 →」。

### 7.3 快速查询 `/quick`

- 顶部搜索框（`type="search"`，`enterkeyhint="search"`），占位文案「输入症状或关键词，如：抽搐、误吞、辅食」。
- 列表结构：
  - **区块一「急症 / 突发状况」**：全部 acute 条目，每条带「急症」标签（红底白字），固定置顶，永不参与任何筛选与月龄过滤。
  - **区块二「按月龄的知识」**：developmental，默认折叠为"按分类浏览"，选中分类后展开。
- 搜索行为：输入 ≥ 1 字符即过滤；匹配 `title`（权重 3）、`scenario_tags`（权重 2）、`summary`（权重 1）；结果高亮命中片段。
- 空结果：显示「没找到」+ 三个最常用急症入口 + 「去 /sources 看内容依据」。
- 实现：构建期产出 `search-index.json`（仅 `slug/title/tags/summary/type/category`，不含正文），`fuse.js` 通过 `await import()` 在输入框聚焦后加载。


### 7.4 急症详情页 `/quick/[slug]`

**渲染顺序（严格，不得调整）**

| 序 | 模块 | 规格 |
|---|---|---|
| 1 | 红色警示条 | `position: sticky; top: 0`，`role="note"`，内容为 `red_flags[0]`。滚动不消失；高度 ≤ 3 行，超出用两行截断 + 展开 |
| 2 | 一句话识别 | `scenario_tags` 渲染为标签组 + `summary` 作为 H1 下方第一段 |
| 3 | 三级分诊卡 | `observe` 黄 / `urgent` 橙 / `emergency` 红。PC（≥ 900px）三列并排，窄屏纵向堆叠。每卡：级别名（加粗，18px）+ criteria + action（前置"怎么做："） |
| 4 | 送医前家庭处理 | `home_care`，每条一行，左侧实心圆点，行高 ≥ 1.7 |
| 5 | 高发年龄 | `peak_age_note`，小字灰色，页面底部 |
| 6 | 来源 | `<details>` 默认收起，内容为 `source.name` + `section` + `year` + 外部链接（若有） |
| — | 页脚免责声明 | 全站统一，急症页额外在警示条下方重复一次精简版 |

**必须在急症页消失的东西**：月龄选择器、月龄阶段导航、`/age/` 的返回链接、药品名称与剂量、疾病机制长段落、评论区、"相关文章"推荐位（避免分心）。

**颜色不得单独承载语义**：三级卡片除底色外，必须同时有级别文字 + 图标（○ / ! / ⚠）+ `aria-label`，保证色盲可辨与黑白打印可读。

### 7.5 里程碑页 `/milestones`

- 顶部月龄选择器：`<select>`（8 个节点：3/6/8/12/18/24/30/36）或滑块（`<input type="range" step="1">`）。默认值取用户已保存月龄**向下取最近的筛查节点**（例：5 月龄 → 3 月龄节点，并提示"当前按 3 月龄节点对照，满 6 月龄后自动切换"）。
- 主体 1：四个维度（大运动 / 语言 / 认知 / 社交）里程碑清单，来自 `milestones`，按 `domain` 分组。
- 主体 2：同月龄预警征象 4 条，每条前置 `<input type="checkbox">`，`<label>` 全区域可点。
- 勾选任意一条 → 页面底部出现固定提示条（`role="status" aria-live="polite"`）：

  > 有任何一条符合，建议尽快咨询儿科医生或儿童保健机构进行评估。

  提示条**不可关闭**，`position: sticky; bottom: 0`，随页面滚动自然离开视口（不使用 `fixed`，避免长期遮挡内容）。
- 预警征象区域顶部必须标注：「依据国家卫健委《儿童心理行为发育问题预警征象筛查表》，原文照录；领域标签为本项目辅助标注。」
- 明确文案边界：**不显示"你的孩子发育落后"**，只显示"建议评估"。页面不出现任何评分、百分比、达标率。

### 7.6 来源页 `/sources`

三块内容：
1. **指南清单**（表格）：全称 / 发布机构 / 文号或版本 / 年份 / 站内使用范围。构建期从所有条目的 `source` 字段聚合去重，保证"页面上写的来源"与"条目实际引用的来源"永远一致。
2. **免责声明**（正文级，非小字）：公益整理、不替代诊疗、与原文冲突时以原文为准、内容更新不另行通知。
3. **版权与嵌入说明**：本站文字为原创整理，指南原文版权归原发布机构；不使用指南原文配图；如引用视频仅外链官方账号（见第 14 章）。

### 7.7 404 与异常

- `/404`：一句话 + 两个出口（回首页 / 去急症查询）。急症出口排在前面。
- 构建期若某 `age_range` 无数据，该路由仍生成（避免 404），页面显示"内容补充中"。

---

## 8. 急症模块架构硬约束

这 8 条是**验收项**，不是建议。每条附反例，便于 code review 时对照。

| 编号 | 约束 | 反例（视为缺陷） |
|---|---|---|
| A-1 | acute 条目 `age_range` 恒为 `"all"`，代码中 `"all"` 表示"始终可见"，不是筛选项 | 把 `"all"` 塞进 `AGE_RANGES` 枚举，导致月龄筛选下拉出现"all" |
| A-2 | 急症入口不依赖出生日期输入 | 首页急症入口放在 `if (birth)` 分支内 |
| A-3 | `/age/[range]` 不渲染 acute 正文，只允许一条链接 | 在 4-6m 页内嵌"急性喉炎"完整分级卡 |
| A-4 | 急症详情页不渲染月龄导航条与月龄选择器 | 复用 `BaseLayout` 的侧边栏时把月龄条一起带进来 |
| A-5 | 急症类型由 `content_type` 判定，不由 `age_range === 'all'` 反推 | `isAcute = item.data.age_range === 'all'` |
| A-6 | `severity_levels` 必须三级齐全、顺序固定，缺一级即构建失败 | 只写 observe 与 emergency，认为"urgent 差不多" |
| A-7 | 急症页不出现药品名、剂量、给药途径 | "可口服布洛芬 5～10mg/kg" |
| A-8 | 红色警示条永远在首屏，不因 sticky 与页头冲突而被遮挡 | 全站 header 也是 sticky，两层 sticky 叠在一起把警示条压到 60px 以下 |

---

## 9. 搜索实现

| 项 | 方案 |
|---|---|
| 索引生成 | `astro:build:done` 钩子或独立脚本，输出 `dist/search-index.json` |
| 索引字段 | `slug, title, tags[], summary, type(acute/developmental), category, age_range` |
| 索引体积 | ≤ 60KB（gzip ≤ 15KB），60 条以内条目可满足 |
| 匹配库 | `fuse.js`，`threshold: 0.35`，`keys` 权重如上 |
| 中文处理 | fuse.js 对中文按字符匹配效果一般；对 `tags` 额外做子串 `includes` 兜底，两者结果合并去重 |
| 加载时机 | 输入框 `focus` 或首次 `input` 时 `import('fuse.js')`；失败则降级为纯 `includes` 过滤 |
| 高亮 | 用 `<mark>`；必须对索引文本做 HTML 转义后再插入高亮标签，防 XSS |
| 无 JS | `<noscript>` 下显示按分类分组的完整条目列表（纯链接），保证基础可用 |

---

## 10. 响应式与可访问性

### 10.1 断点

| 断点 | 布局 |
|---|---|
| < 640px | 单栏；三级卡片纵向堆叠；导航条横滚；表格转卡片 |
| 640–899px | 单栏，卡片间距加大，触控目标 48px |
| ≥ 900px | 内容区最大 1120px，居中；三级卡片三列；阶段页两栏（左目录 sticky） |

### 10.2 硬性要求

| 约束 | 判据 |
|---|---|
| 无横向滚动 | 375px 下 `document.documentElement.scrollWidth <= 375`，所有路由逐一验证 |
| 触控目标 | 所有可点击元素 `min-width: 44px; min-height: 44px`（含 `<summary>`、复选框 label、Tab） |
| 对比度 | 正文 ≥ 4.5:1，大字号（≥ 18.66px 粗体或 24px）≥ 3:1；红色警示条文字与底色 ≥ 4.5:1 |
| 键盘可达 | Tab 顺序与视觉顺序一致；`<summary>` 有可见 `:focus-visible` 轮廓（≥ 2px，偏移 2px） |
| 屏幕阅读器 | 月龄结果 `aria-live="polite"`；里程碑提示条 `role="status"`；装饰图标 `aria-hidden="true"` |
| 缩放 | 浏览器 200% 缩放不出现横向滚动、不遮挡内容 |
| 弱网 | 禁用外部字体与图片后，首页与急症页核心内容仍完整可读 |
| 动效 | 尊重 `prefers-reduced-motion`，关闭滚动动画与卡片展开过渡 |

### 10.3 移动端验收脚本（M3/M4 各跑一次）

```js
// scripts/check-responsive.mjs
import { chromium } from 'playwright';
const routes = ['/', '/age/4-6m', '/quick', '/quick/acute-laryngitis',
                '/milestones', '/sources'];
const { browser } = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 375, height: 667 } });

for (const r of routes) {
  await page.goto(`http://localhost:4321${r}`);
  const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
  console.assert(scrollW <= 375, `[横向滚动] ${r} -> ${scrollW}px`);

  const smallTargets = await page.$$eval(
    'a, button, summary, input, select',
    (els) => els.filter((e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && (r.width < 44 || r.height < 44);
    }).map((e) => e.textContent?.trim().slice(0, 20))
  );
  console.assert(smallTargets.length === 0, `[触控<44px] ${r}: ${smallTargets}`);
}
await browser.close();
```


### 10.4 首屏强制断言（首页）

- 出生日期输入框与急症入口卡的 `boundingBox.y + height <= 667`。
- 两者都必须在 `375×667` 视口内，且急症入口不被 Cookie/引导层遮挡。

---

## 11. 打印

急症页与里程碑页必须两端（Chrome / Safari）验证。

| 规则 | 实现 |
|---|---|
| 隐藏交互件 | `@media print { .no-print { display: none } }`，覆盖导航、搜索、月龄选择器、折叠箭头 |
| 展开全部内容 | `details > *:not(summary) { display: block !important }`，打印时来源与正文不再折叠 |
| 三级卡片 | 强制纵向单列，避免打印时被切成两页；`break-inside: avoid` |
| 警示条 | 打印时变为页首实心边框块（不用 sticky），并在页脚重复一次 |
| 链接 | 仅外链追加 URL：`a[href^="http"]::after { content: " (" attr(href) ")" }`；站内链接不打印 URL |
| 页脚 | 每页打印"来源 + 打印日期 + 免责声明一句" |
| 页数 | 急症页 ≤ 2 页，里程碑页 ≤ 3 页 |

---

## 12. 隐私与本地存储

| 项 | 规则 |
|---|---|
| 出生日期 | 仅存 `localStorage`，**不上传、不进 URL、不进日志** |
| 存储键 | `ich.birth.v1`（带版本号，便于后续迁移） |
| 清除 | `/sources` 与首页提供"清除本机记录" |
| 埋点 | v1 不接入任何统计 SDK；若后续接入，必须无 Cookie、不采集输入内容，并更新 `/sources` |
| 第三方 | 无第三方字体、无 CDN、无广告、无社交嵌入脚本（视频仅外链） |
| 儿童信息 | 项目不收集任何儿童身份信息，符合公益站点最小化原则 |

---

## 13. 内容治理与医学审核

### 13.1 状态机

`draft` → `reviewed`（内容自校）→ `verified`（医学复核，写入 `reviewer` + `last_reviewed`）

规则：`draft: true` 的条目可以进构建产物但不进首页推荐、不进搜索索引、不进 sitemap。

### 13.2 五条铁律

1. **逐字照录**：预警征象、分级标准等工具性文本，必须与原文一字不差。官方原文是"紧握拳**松不开**"，就不能写成"紧握拳**不松开**"；四条就是四条，不能合并成三条。
2. **不改写数字与阈值**：月龄、频次、时长一律照抄，不做"约等于"。
3. **不加推断**：指南没说的因果不补。不写"因为缺钙所以……"。
4. **区分官方与自注**：领域标签、场景标签、通俗解释属本项目标注，必须在 `/sources` 与相关页面注明"非原文"。
5. **过期即下架**：`last_reviewed` 超过 12 个月，条目自动降级为 `draft`，并在页面顶部显示"本条内容待复核"。

### 13.3 更新响应 SLA

| 事件 | 响应 |
|---|---|
| 国家级指南发布新版 | 30 天内完成全量条目对照，记录差异 |
| 单条内容被读者指出错误 | 7 天内核实，确认有误则当日修正并在 `CHANGELOG` 记录 |
| 年度复查 | 每年 1 次全量复查，更新 `last_reviewed` |

### 13.4 复核人要求

- 至少 1 名具备儿科/儿童保健背景的复核人（可以是志愿者、可以是儿科医生朋友，需在 `/sources` 致谢或匿名标注）。
- 无医学复核人时，**急症模块不得上线**，可先上线月龄内容。

---

## 14. 视频嵌入合规

v1 决策：**采用方案 A，不嵌入任何视频**。

| 方案 | 做法 | 风险 |
|---|---|---|
| A（采用） | 卡片底部放文字链接：「相关视频可前往崔玉涛/育学园官方抖音账号观看」，`rel="noopener noreferrer"`，`target="_blank"` | 零嵌入风险，无第三方脚本 |
| B（备选） | 抖音网页版"嵌入视频"生成的官方 iframe，`width="320" height="568"`，移动端加 `playsinline` | 引入第三方脚本，需持续确认视频未下架 |
| C（不采用） | 抖音开放平台 API | 需企业/个体工商户资质，个人项目不具备条件 |

若未来采用方案 B，必须同时满足：仅嵌入账号本人或明确授权账号的原始视频；页面标注来源与版权；不下载、不转存、不剪辑、不二次上传；`/sources` 说明嵌入方式与合规依据；iframe 加 `loading="lazy"` 与 `title`。

---

## 15. 测试与验收

### 15.1 功能断言清单

| ID | 断言 | 阶段 |
|---|---|---|
| T-01 | 输入 2026-03-14，今天 2026-10-29 → 月龄 7，阶段 `7-9m` | M2 |
| T-02 | 输入今天日期 → 月龄 0，显示"出生第 1 天" | M2 |
| T-03 | 34 周早产儿，实际 5 月龄 → 矫正 3.5 月龄，界面显示矫正说明 | M2 |
| T-04 | 未输入出生日期时，急症入口可见且可点击 | M2 |
| T-05 | 刷新页面后出生日期自动恢复，阶段自动定位 | M2 |
| T-06 | 清空 localStorage 后无报错，回到未输入态 | M2 |
| T-07 | 急性喉炎页按 1→6 顺序渲染，警示条 sticky | M3 |
| T-08 | 急症页无月龄选择器 / 无月龄导航 / 无药品名 | M3 |
| T-09 | 三级卡在 375px 下纵向堆叠且三张全部可见 | M3 |
| T-10 | 勾选任一预警征象 → 提示条出现；取消勾选 → 提示条消失 | M4 |
| T-11 | 里程碑页显示筛查表来源标注 | M4 |
| T-12 | 搜索"抽搐"命中热性惊厥；搜索"辅食"命中喂养条目 | M5 |
| T-13 | 375px 全路由无横向滚动、触控 ≥ 44px | M5 |
| T-14 | 打印急症页 ≤ 2 页，三级卡不被分页切断 | M5 |
| T-15 | 构建时故意删掉一个 `severity_levels` → CI 失败 | M1 |

### 15.2 人工走查清单（上线前）

- 手机 4G 弱网下，从打开首页到看见三级分诊卡的实际秒数（目标 ≤ 8s）。
- 夜间模式（系统深色）下红色警示条是否仍醒目。
- 祖辈用户测试：能否在 10 秒内找到"咳嗽像犬吠"该点哪里。
- 黑白打印后，三级卡片是否仍能靠文字与图标区分。

---

## 16. 里程碑与交付定义

| 阶段 | 交付物 | 完成定义（DoD） |
|---|---|---|
| **M0 合规底座** | 全站页脚免责声明、`/sources` 骨架、内容模板与复核流程 | 免责声明在每一页可见；模板含全部必填字段；复核人确定 |
| **M1 数据层** | `content.config.ts`、两个 YAML 数据集、3～5 条示例条目、`validate-content.ts` | `astro check` 通过；8 条业务规则全部生效；故意破坏数据能让 CI 红 |
| **M2 首页 + 月龄页** | 出生日期输入、月龄与矫正月龄、阶段卡、阶段导航 | T-01～T-06 全过；375px 首屏断言通过 |
| **M3 急症通道** | `/quick`、`/quick/[slug]`、急性喉炎完整条目 | T-07～T-09 全过；第 8 章 8 条硬约束逐条对照通过；移动端当阶段验收 |
| **M4 里程碑 + 预警征象** | `/milestones`、32 条官方原文、复选框提示条 | T-10、T-11 通过；移动端当阶段验收；来源标注可见 |
| **M5 搜索与打磨** | 搜索索引、打印样式、来源页、404 | T-12～T-14 通过；Lighthouse 性能 ≥ 95、可访问性 ≥ 95 |

**排期原则**：M3 优先于 M2 的内容填充。急症骨架跑通后再补月龄内容——因为急症模块的结构一旦做错（分级缺级、混入月龄筛选），返工成本最高，且直接影响安全。

---

## 17. 风险登记册

| ID | 风险 | 影响 | 概率 | 应对 |
|---|---|---|---|---|
| R-01 | 内容被当作诊断依据，延误就医 | 高（安全） | 中 | 急症页顶部声明 + 保守措辞 + 不出现"可以不去医院"类表述 |
| R-02 | 指南更新，站内内容过时 | 高 | 高 | `last_reviewed` + 12 个月自动降级 + 年度复查 |
| R-03 | 无医学复核人 | 高 | 中 | 急症模块设为上线前置条件；无复核人时只上月龄内容 |
| R-04 | 早产儿月龄误导 | 中 | 高 | 矫正月龄 + 界面显式提示 |
| R-05 | 急症分级卡片被误读为"自测工具" | 中 | 中 | 卡片标题加"参考"，不提供打分与结论 |
| R-06 | 个人维护中断，站点腐化 | 中 | 中 | 内容冻结页（超过 18 个月未复核则在首页提示"本站内容最近更新于 X"） |
| R-07 | 引用指南原文被指侵权 | 低 | 低 | 只引用短句并标注出处；不使用原文配图；`/sources` 说明 |
| R-08 | 范围蔓延（加问答、加社群、加记录工具） | 中 | 高 | 第 18 章明确不做清单，新增需求一律进 v3 候选池 |

---

## 18. 不做什么（v1 Out of Scope）

- 不做用户系统、不做云端同步、不做多宝宝档案。
- 不做生长曲线记录与百分位计算（涉及个体化评估，风险高于价值）。
- 不做 AI 问答与症状自查问卷。
- 不做用药提示、剂量计算、疫苗提醒。
- 不做社区、评论、投稿入口。
- 不做英文版与多语言。

**v3 候选**（需先解决医学审核与责任边界）：生长曲线可视化、疫苗接种时间表、按月龄的喂养日程表、离线 PWA。

---

## 附录 A：0～3 岁儿童心理行为发育问题预警征象（官方原文 32 条）

> 逐字照录自国家卫生健康委《儿童心理行为发育问题预警征象筛查表》。该表适用于 0～6 岁儿童，本手册仅收录 0～3 岁的 8 个节点。「领域」列为本项目为便于筛选而添加的辅助标注，非原表内容。

| 月龄 | 序号 | 预警征象（原文） | 领域（自注） |
|---|---|---|---|
| 3 月 | 1 | 对很大声音没有反应 | 语言社会 |
| 3 月 | 2 | 逗引时不发音或不会微笑 | 语言社会 |
| 3 月 | 3 | 不注视人脸，不追视移动人或物品 | 认知 |
| 3 月 | 4 | 俯卧时不会抬头 | 运动 |
| 6 月 | 1 | 发音少，不会笑出声 | 语言社会 |
| 6 月 | 2 | 不会伸手抓物 | 运动 |
| 6 月 | 3 | 紧握拳松不开 | 运动 |
| 6 月 | 4 | 不能扶坐 | 运动 |
| 8 月 | 1 | 听到声音无应答 | 语言社会 |
| 8 月 | 2 | 不会区分生人和熟人 | 语言社会 |
| 8 月 | 3 | 双手间不会传递玩具 | 认知 |
| 8 月 | 4 | 不会独坐 | 运动 |
| 12 月 | 1 | 呼唤名字无反应 | 语言社会 |
| 12 月 | 2 | 不会模仿"再见"或"欢迎"动作 | 认知 |
| 12 月 | 3 | 不会用拇食指对捏小物品 | 运动 |
| 12 月 | 4 | 不会扶物站立 | 运动 |
| 18 月 | 1 | 不会有意识叫"爸爸"或"妈妈" | 语言社会 |
| 18 月 | 2 | 不会按要求指人或物 | 语言社会 |
| 18 月 | 3 | 与人无目光交流 | 语言社会 |
| 18 月 | 4 | 不会独走 | 运动 |
| 24 月 | 1 | 不会说 3 个物品的名称 | 语言社会 |
| 24 月 | 2 | 不会按吩咐做简单事情 | 认知 |
| 24 月 | 3 | 不会用勺吃饭 | 运动 |
| 24 月 | 4 | 不会扶栏上楼梯/台阶 | 运动 |
| 30 月 | 1 | 不会说 2—3 个字的短语 | 语言社会 |
| 30 月 | 2 | 兴趣单一、刻板 | 语言社会 |
| 30 月 | 3 | 不会示意大小便 | 语言社会 |
| 30 月 | 4 | 不会跑 | 运动 |
| 36 月 | 1 | 不会说自己的名字 | 语言社会 |
| 36 月 | 2 | 不会玩"拿棍当马骑"等假想游戏 | 认知 |
| 36 月 | 3 | 不会模仿画圆 | 认知 |
| 36 月 | 4 | 不会双脚跳 | 运动 |

**判定规则（原表注）**：该年龄段任何一条预警征象阳性，提示有发育偏异的可能。

**页面措辞约束**：站内不得写"发育落后""异常""确诊"，一律使用"建议尽快咨询儿科医生或儿童保健机构进行评估"。

---

## 附录 B：WHO 六项粗大运动里程碑窗口（1～99 百分位）

| 里程碑 | 达成窗口（月） |
|---|---|
| 无支撑独坐 | 3.8 – 9.2 |
| 扶物站立 | 4.8 – 11.4 |
| 手膝爬行 | 5.2 – 13.5 |
| 扶物行走 | 5.9 – 13.7 |
| 独自站立 | 6.9 – 16.9 |
| 独立行走 | 8.2 – 17.6 |

来源：WHO Multicentre Growth Reference Study，Windows of Achievement（Acta Paediatrica Suppl. 2006;450:86–95）。

**使用规则**：
1. 窗口是"98% 健康儿童的范围"，不是达标线。落在窗口内即属正常，早不表扬、晚不警告。
2. 超出窗口上限 ≠ 诊断，只提示"需要筛查"。
3. 早产儿一律按矫正月龄对照。
4. 站内展示必须成对出现"窗口下限—上限"，禁止只显示单一月龄数字（如"6 个月会坐"），以避免制造焦虑。

---

## 附录 C：引用文献

| 编号 | 文献 | 发布机构 | 版本/年份 | 站内用途 |
|---|---|---|---|---|
| S1 | 《3岁以下婴幼儿健康养育照护指南（试行）》（国卫办妇幼函〔2022〕409号） | 国家卫生健康委办公厅 | 2022 年 11 月 | 喂养、睡眠、生活照护、伤害预防、常见健康问题防控的主干依据 |
| S2 | 《儿童心理行为发育问题预警征象筛查表》（附于 0～6 岁儿童心理行为发育档案） | 国家卫生健康委 | 现行版，2017 年起纳入国家基本公共卫生服务 | 附录 A 全表；`/milestones` 与 `/age/[range]` 页底 |
| S3 | WHO Multicentre Growth Reference Study：六项粗大运动里程碑窗口 | 世界卫生组织 | Acta Paediatr Suppl. 2006;450:86–95 | 附录 B；`milestones.yaml` 的运动维度 |
| S4 | WHO Guideline for complementary feeding of infants and young children 6–23 months of age | 世界卫生组织 | 2023（ISBN 978-92-4-008186-4） | 辅食添加条目 |
| S5 | Infant and young child feeding（fact sheet） | 世界卫生组织 | 现行版 | 纯母乳喂养 6 个月、持续母乳至 2 岁及以上 |
| S6 | 婴幼儿喂养健康教育核心信息 | 国家卫生健康委 | 现行版 | 喂养类条目的通俗化表述校验 |

---

## 附录 D：待核实清单（上线前必须闭合）

| 编号 | 待核实项 | 负责 | 阻塞阶段 |
|---|---|---|---|
| V-01 | 急性喉炎三级分级的 `criteria` 与 `action` 是否与所引指南原文一致 | 医学复核人 | M3 |
| V-02 | AAP 相关条目具体引用的政策声明名称与年份（安全睡眠、辅食过敏原引入） | 内容组 | 对应条目上线前 |
| V-03 | `source.url` 是否可稳定访问（政府网站链接易变更，需准备备用引用格式） | 内容组 | M1 |
| V-04 | 里程碑 `description` 与 WHO 原文的表述对应关系（避免自造阈值） | 医学复核人 | M4 |
| V-05 | 抖音官方账号链接的长期有效性 | 内容组 | 视频外链上线前 |

---

**文档结束**。本文档中所有医学内容均为结构示范，正式上线前须完成第 13 章与附录 D 的复核流程。
