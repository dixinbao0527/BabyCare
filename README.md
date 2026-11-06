# 婴幼儿健康养育手册

0～3 岁按月龄组织的可溯源知识站点。静态生成、零后端、无追踪，内容依据国家卫健委、WHO、AAP 公开发布的指南整理。

**线上地址**：<https://dixinbao0527.github.io/BabyCare/>
**源码仓库**：<https://github.com/dixinbao0527/BabyCare>

---

## 这个站点做了什么

| 路由 | 作用 |
|---|---|
| `/` | 输入出生日期 → 成长轴定位月龄 → 显示当前阶段重点；急症入口不依赖输入，始终可见 |
| `/age/[range]` | 7 个月龄阶段页，按喂养 / 睡眠 / 发育 / 安全 / 日常照护分组，页底附当月龄预警征象 |
| `/quick` | 症状速查。急症条目固定置顶、不参与月龄筛选；支持搜索与分类浏览 |
| `/quick/[slug]` | 急症详情。红色警示条贴顶 → 一句话识别 → 三级分诊卡 → 送医前处理 → 高发年龄 → 来源 |
| `/milestones` | WHO 六项大运动窗口图（当前月龄竖线）+ 8 个筛查节点 × 4 个维度里程碑 + 32 条预警征象自查清单 |
| `/sources` | 指南清单（构建期自动聚合）、免责声明、版权与隐私说明 |

页头提供全局搜索（`⌘K` / `Ctrl+K`），复用构建期生成的 `search-index.json`；急症条目在结果中固定置顶。

核心约束（也是验收项）：

- 急症模块**不参与月龄主轴**，`age_range` 恒为 `all`，类型由 `content_type` 判定（不用 `age_range === 'all'` 反推）。
- 急症页**不出现**月龄选择器、月龄导航条、药品名与剂量。
- 三级分诊必须齐全且顺序固定（observe → urgent → emergency），缺一级**构建失败**。
- 预警征象**逐字照录**官方原文，任何改写都会让筛查工具失真。
- 运动里程碑一律成对显示 WHO 窗口上下限，不提供单点月龄标准。

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
  data/milestones.yaml                  # 里程碑数据集（file loader）；运动窗口写在 windows 字段
src/lib/warningSigns.ts                 # 32 条预警征象常量（逐字照录，禁止改写）
src/lib/monthlyTasks.ts                 # 首页「本月 3 件事」，slug 需对应阶段页条目
```

运动维度的 WHO 窗口用 `windows` 数组维护，每条含 `label / start / end / order`（`end` 必须大于 `start`，`order` 决定图上的行序）。当前六项：独坐 3.8–9.2、手膝爬行 5.2–13.5、扶物站立 4.8–11.4、扶物行走 5.9–13.7、独站 6.9–16.9、独走 8.2–17.6 个月。

新增一条发展性条目：在对应月龄目录下建 `.md`，frontmatter 必填 `title / age_range / category / scenario_tags / summary / source / order / last_reviewed / reviewer`。`order` 在同月龄同分类内必须唯一，`source.section` 与 `source.url` 至少一项非空。

新增一条急症条目：`severity_levels` 必须恰好三条且按 observe → urgent → emergency 排列，`red_flags[0]` 写「最不该做的那件事」，`home_care` 至少三条，**不得出现药品名与剂量**。

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

Astro 5 静态生成 · Astro Content Collections（zod schema + 构建期业务校验）· 原生 CSS · 少量岛屿脚本 · fuse.js（按需动态加载）。

不引入：后端数据库、用户系统、SSR、AI 问答、评论、埋点 SDK。出生日期只写入浏览器 `localStorage`，不上传。

## 免责声明

本项目为公益整理，**不替代专业医疗诊断，也不构成用药建议**。孩子出现呼吸困难、意识改变、抽搐、面色发青等急症表现时请立即拨打 120 或前往急诊。站内表述与指南原文不一致时，以原文为准。

急症条目的分级文案为结构化整理，**上线前须由具备儿科背景的复核人对照原文逐条核对**。
