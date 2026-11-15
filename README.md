# 婴幼儿健康养育手册

0～3 岁按月龄组织的可溯源知识站点，外加一份婴幼儿高危疾病识别手册、一份辅食指南与北京亲子户外清单。静态生成、零后端、无追踪。医学内容依据国家卫健委发布的指南整理，并参考 WHO 与 AAP 公开资料；户外信息来自公园与主管部门的公开页面。

**线上地址**：<https://dixinbao0527.github.io/BabyCare/>
**源码仓库**：<https://github.com/dixinbao0527/BabyCare>

---

## 这个站点做了什么

| 路由 | 作用 |
|---|---|
| `/` | 输入出生日期 → 成长轴定位月龄 → 显示当前阶段重点；急症入口不依赖输入，始终可见 |
| `/age/[range]` | 7 个月龄阶段页，按喂养 / 睡眠 / 发育 / 安全 / 日常照护分组，页底附当月龄预警征象 |
| `/health` | **健康查询**（合并入口）：症状速查 + 婴幼儿高危疾病识别手册。全局搜索可检索 12 类高危问题并直达手册锚点 |
| `/health/handbook` | 高危疾病识别手册全文：三把通用标尺、12 类问题总览与逐项详解、黄金一小时、就医沟通、预防清单、参考文献 |
| `/quick` | 症状速查（健康查询路径 01）。急症条目固定置顶、不参与月龄筛选；支持搜索与分类浏览 |
| `/quick/[slug]` | 急症详情。红色警示条贴顶 → 一句话识别 → 三级分诊卡 → 送医前处理 → 高发年龄 → 来源 |
| `/milestones` | WHO 六项大运动窗口图（当前月龄竖线）+ 8 个筛查节点 × 4 个维度四色卡片 + 32 条预警征象自查清单 |
| `/feeding` | 婴幼儿辅食：按月龄时间轴、频次与质地表、五条原则、7 类食物、安全红线与常见疑问 |
| `/outdoor` | 北京亲子户外清单。地标插画卡片，按区 / 类型 / 票务 / 推车 / 是否临水筛选；**点卡片直达官网**，右下角「站内详情」进结构化信息 |
| `/outdoor/[slug]` | 场所详情。带娃适配表 → 实用信息 → 出门前 3 分钟安全清单 → 关联条目 → 来源与纠错 |
| `/scene/[slug]` | 场景入口（夜醒、吐奶、带娃出门、体检、发烧）。由 `taxonomy.json` 生成，不手写内容 |
| `/about` | 关于：联系邮箱 → 为什么做 → 内容怎么来的 → 赞赏码 → 版权应用与免责 |
| `/sources` | 指南清单（构建期自动聚合）、复核状态、内容分舱说明、免责声明、版权与隐私说明 |

页头提供全局搜索（`⌘K` / `Ctrl+K`），复用构建期生成的 `search-index.json`；急症条目在结果中固定置顶。

核心约束（也是验收项）：

- 急症模块**不参与月龄主轴**，`age_range` 恒为 `all`，类型由 `content_type` 判定（不用 `age_range === 'all'` 反推）。
- 急症页**不出现**月龄选择器、月龄导航条、药品名与剂量。
- 三级分诊必须齐全且顺序固定（observe → urgent → emergency），缺一级**构建失败**。
- 预警征象**逐字照录**官方原文，任何改写都会让筛查工具失真。
- 运动里程碑一律成对显示 WHO 窗口上下限，不提供单点月龄标准。
- 医学内容与户外信息**分舱**：户外条目不得出现药品、剂量或「促进发育」这类医学化断言，构建期扫描拦截。
- 户外条目必须有 `verified_on`；超过 180 天页面标「待复核」，超过 365 天**构建失败**。
- 户外条目未核实的设施字段必须显式写 `unknown`，不许猜。

---

## 本地开发

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # 校验 → 构建 → 生成 search-index.json / sitemap.xml
npm run preview    # 预览构建产物
```

## 验收命令

```bash
npm run validate   # 内容业务规则（8 条）+ 32 条预警征象完整性
npm run verify     # 375px 无横向滚动、触控 ≥44px、急症页结构、首屏完整性、交互行为
```

`npm run verify` 使用本机 Chrome/Edge 无头模式跑真实布局，需要本机已安装其中之一。
需要顺手留截图时执行 `node scripts/check-responsive.mjs --shots`，输出到 `output/screens/`。

---

## 内容维护

```
src/content/
  developmental/<age_range>/<slug>.md   # 发展性条目，10 个字段的 frontmatter
  acute/<slug>.md                       # 急症条目，含三级分诊结构化字段
  outdoor/<slug>.md                     # 户外场所，含核验日期、设施四态与安全标签
  data/milestones.yaml                  # 里程碑数据集（file loader）；运动窗口写在 windows 字段
  data/taxonomy.json                    # 主题 / 场景 / 同义词词表（派生层输入，不手写页面）
  data/handbook.json                    # 高危手册 12 类问题 + 7 个通用工具（供 /health、搜索索引共用）
  data/feeding.json                     # 辅食时间轴 / 原则 / 安全红线（供 /feeding、搜索索引共用）
src/data/handbook.html                  # 高危手册正文，原单文件手册逐字转存，不做改写
src/styles/handbook.css                 # 手册样式，所有选择器限定在 .hb 内，与 global.css 隔离
public/images/outdoor/<slug>.svg        # 10 个场所的地标插画，本地文件、零外部请求
public/images/coffee-*.png              # 赞赏码，放进目录后关于页自动显示
src/lib/warningSigns.ts                 # 32 条预警征象常量（逐字照录，禁止改写）
src/lib/monthlyTasks.ts                 # 首页「本月 3 件事」，slug 需对应阶段页条目
src/lib/relations.ts                    # 构建期关系图：显式边 + 反向补全
src/lib/taxonomy.ts                     # 主题/场景读取
```

运动维度的 WHO 窗口用 `windows` 数组维护，每条含 `label / start / end / order`（`end` 必须大于 `start`，`order` 决定图上的行序）。当前六项：独坐 3.8–9.2、手膝爬行 5.2–13.5、扶物站立 4.8–11.4、扶物行走 5.9–13.7、独站 6.9–16.9、独走 8.2–17.6 个月。

新增一条发展性条目：在对应月龄目录下建 `.md`，frontmatter 必填 `title / age_range / category / scenario_tags / summary / source / order / last_reviewed / reviewer`。`order` 在同月龄同分类内必须唯一，`source.section` 与 `source.url` 至少一项非空。

新增一条急症条目：`severity_levels` 必须恰好三条且按 observe → urgent → emergency 排列，`red_flags[0]` 写「最不该做的那件事」，`home_care` 至少三条，**不得出现药品名与剂量**。

新增一条户外场所：在 `src/content/outdoor/` 下建 `.md`，必填 `title / district / venue_type / summary / tags / age_fit / stroller / shade / nursing_room / toilet / playground / water_hazard / free / address / official_name / official_url / safety_tags / verified_on / last_reviewed / reviewer`。
设施字段只接受 `yes / partial / no / unknown` 四态，没查到就写 `unknown`；`free` 只接受 `free / paid / unknown`。
`water_hazard: true` 时必须通过 `relations` 关联至少一条急症条目。票价与开放时间不要写估计值，页面会统一附加「以官方公告为准」。

新增一条户外条目后跑 `npm run validate`；核验超过 180 天会提示，超过 365 天会阻断构建。

改完跑 `npm run validate`，任一规则不过会直接告诉你文件与原因。

---

## 部署到 GitHub Pages

**目标仓库**：`https://github.com/dixinbao0527/BabyCare`
**线上地址**：`https://dixinbao0527.github.io/BabyCare/`

### 1. 推送

```bash
git push -u origin main
```

首次推送会弹出 GitHub 登录窗口（本机已配置 Git Credential Manager），授权一次即可。

### 2. 打开 Pages

仓库 → **Settings → Pages → Build and deployment → Source** 选 **GitHub Actions**（不要选 Deploy from a branch）。

### 3. 等 Actions 跑完

推送后 `.github/workflows/deploy.yml` 会自动执行：安装依赖 → 内容校验 → 构建 → 上传 → 部署。

`base` 路径由 workflow 按仓库名自动注入：仓库名是 `<user>.github.io` 时用根路径，否则用 `/<仓库名>/`，不需要手改配置。

### 推送失败时的备选：走 REST API

如果所在网络对 `github.com:443` 的 git 智能 HTTP 被拦截（`CONNECT tunnel failed 502` / `schannel: server closed abruptly`），
但 `api.github.com` 可达，可直接用 Git Data API 提交：

```bash
GITHUB_TOKEN=github_pat_xxx GITHUB_REPO=dixinbao0527/BabyCare npm run deploy:api
```

token 用 fine-grained PAT，仅授权该仓库，勾选 **Contents: Read and write**、**Pages: Read and write**、**Actions: Read and write**。
脚本会创建 blob / tree / commit、更新 `refs/heads/main`，并把 Pages 构建源设为 GitHub Actions。用完即可撤销该 token。

### 本地验证部署路径

`base` 前缀是最容易在部署后才暴露的问题（`/quick` 被写成根路径就会 404）。构建后本地验证：

```bash
BASE_PATH=/BabyCare SITE_URL=https://dixinbao0527.github.io npm run build
BASE_PATH=/BabyCare npm run verify:base
```

脚本会把 `dist` 挂在 `/BabyCare/` 子路径下用无头 Chrome 真实访问，检查页面资源无 404、内链可达、搜索能取到 `search-index.json`，并静态扫描是否还有漏掉 `base` 的裸根链接。

> Windows Git Bash 注意：`BASE_PATH=/BabyCare` 会被 MSYS 改写成 `D:/.../BabyCare`，需加 `MSYS_NO_PATHCONV=1` 前缀。CI 跑在 Linux，不受影响。

### 手动发布（不走 Actions）

```bash
BASE_PATH=/BabyCare SITE_URL=https://dixinbao0527.github.io npm run build
# 然后把 dist/ 推到 gh-pages 分支
```

---

## 技术栈

Astro 5 静态生成 · Astro Content Collections（zod schema + 构建期业务校验）· 原生 CSS · 少量岛屿脚本 · fuse.js（按需动态加载）· 构建期派生层（`dist/derived/*.json`：关系图 / 复核状态 / 词表 / 站点导览）。

不引入：后端数据库、用户系统、SSR、AI 问答、评论、埋点 SDK、地图 SDK。出生日期只写入浏览器 `localStorage`，不上传。

## 免责声明

本项目为公益整理，**不替代专业医疗诊断，也不构成用药建议**。孩子出现呼吸困难、意识改变、抽搐、面色发青等急症表现时请立即拨打 120 或前往急诊。站内表述与指南原文不一致时，以原文为准。

急症条目的分级文案为结构化整理，**目前尚未完成儿科背景复核人的逐条核对**，页面与 `/sources` 已如实标注该状态。户外场所的票价、开放时间与设施信息以官方公告为准，本站不做实时同步。
