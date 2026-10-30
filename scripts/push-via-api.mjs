/**
 * 通过 GitHub REST API（api.github.com）推送仓库内容。
 *
 * 为什么需要它：本机到 github.com:443 的 git 智能 HTTP 被网络策略拦截
 * （CONNECT 502 / TLS 中断），但 api.github.com 可达。此时可用 Git Data API
 * 直接创建 blob → tree → commit → 更新 ref，效果等价于 git push。
 *
 * 用法：
 *   GITHUB_TOKEN=github_pat_xxx GITHUB_REPO=dixinbao0527/BabyCare node scripts/push-via-api.mjs
 *
 * 需要的 token 权限（fine-grained PAT，仅限该仓库）：
 *   - Contents: Read and write   （推送代码）
 *   - Pages:    Read and write   （开启 Pages，可省略，用 --no-pages 跳过）
 *   - Actions:  Read and write   （触发部署工作流，可省略）
 *
 * 只推送 git 已跟踪的文件（git ls-files），不会把 dist / node_modules 带上去。
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const TOKEN = process.env.GITHUB_TOKEN;
const REPO = process.env.GITHUB_REPO || 'dixinbao0527/BabyCare';
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const MESSAGE =
  process.env.COMMIT_MESSAGE ||
  execFileSync('git', ['log', '-1', '--pretty=%B'], { encoding: 'utf8' }).trim();
const SKIP_PAGES = process.argv.includes('--no-pages');

if (!TOKEN) {
  console.error('缺少 GITHUB_TOKEN 环境变量');
  process.exit(1);
}
if (!/^[\w.-]+\/[\w.-]+$/.test(REPO)) {
  console.error(`GITHUB_REPO 格式不对：${REPO}（应为 owner/repo）`);
  process.exit(1);
}

const API = 'https://api.github.com';
const headers = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'Content-Type': 'application/json',
  'User-Agent': 'babycare-deploy',
};

async function api(method, url, body, { allow404 = false } = {}) {
  const res = await fetch(url.startsWith('http') ? url : API + url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (allow404 && res.status === 404) return null;
  if (!res.ok) {
    const msg = data && data.message ? data.message : text.slice(0, 300);
    const err = new Error(`${method} ${url} → ${res.status} ${msg}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

// ---------- 1. 校验 token 与仓库 ----------
const me = await api('GET', '/user');
const repo = await api('GET', `/repos/${REPO}`);
console.log(`✓ 账号 ${me.login}，仓库 ${repo.full_name}（${repo.private ? 'private' : 'public'}）`);
if (!repo.permissions?.push) {
  console.error('✗ 该 token 对仓库没有写权限（Contents: Read and write）');
  process.exit(1);
}

// ---------- 2. 枚举要推送的文件 ----------
const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)
  .filter((f) => fs.existsSync(f));

console.log(`✓ 待推送 ${files.length} 个文件`);

// ---------- 3. 空仓库自举 ----------
// GitHub 的 Git Data API 在没有任何提交的仓库上会返回 409 "Git Repository is empty"，
// 因此先用 Contents API 落一个 README 提交作为锚点，之后才能创建 blob/tree。
// 注意：空仓库上 GET ref 返回的是 409 而不是 404，两种都要当作"没有 ref"。
let ref = null;
try {
  ref = await api('GET', `/repos/${REPO}/git/ref/heads/${BRANCH}`, null, { allow404: true });
} catch (e) {
  if (e.status !== 409) throw e;
}

if (!ref) {
  const readmePath = files.find((f) => /^README\.md$/i.test(f));
  const bootFile = readmePath || files[0];
  if (!bootFile) {
    console.error('✗ 工作区没有可提交的文件');
    process.exit(1);
  }
  const buf = fs.readFileSync(bootFile);
  await api('PUT', `/repos/${REPO}/contents/${encodeURIComponent(bootFile)}`, {
    message: 'chore: 初始化仓库（为 Git Data API 建立首个提交）',
    content: buf.toString('base64'),
    branch: BRANCH,
  });
  ref = await api('GET', `/repos/${REPO}/git/ref/heads/${BRANCH}`);
  console.log(`· 空仓库已自举：${bootFile} → 首个提交 ${ref.object.sha.slice(0, 8)}`);
}

// 父提交的 tree：把它作为 base_tree，保证只新增/覆盖、不误删
const parentCommit = await api('GET', `/repos/${REPO}/git/commits/${ref.object.sha}`);
const baseTree = parentCommit.tree.sha;
console.log(`· 父提交 ${ref.object.sha.slice(0, 8)}，base_tree ${baseTree.slice(0, 8)}`);

// ---------- 4. 创建 blob ----------
const blobs = new Array(files.length);
let cursor = 0;
let done = 0;
async function worker() {
  while (cursor < files.length) {
    const i = cursor++;
    const f = files[i];
    const content = fs.readFileSync(f);
    // 纯文本用 utf8 传，二进制走 base64（GitHub 两者都支持）
    const isBinary = content.includes(0);
    const res = await api('POST', `/repos/${REPO}/git/blobs`, {
      content: content.toString(isBinary ? 'base64' : 'utf8'),
      encoding: isBinary ? 'base64' : 'utf-8',
    });
    blobs[i] = { path: f, mode: '100644', type: 'blob', sha: res.sha };
    done += 1;
    if (done % 20 === 0 || done === files.length) {
      process.stdout.write(`  已上传 ${done}/${files.length}\r`);
    }
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
console.log(`✓ blob 上传完成 ${blobs.length} 个`);

// ---------- 4. 创建 tree ----------
// 注意：token 若没有 Workflows 权限，任何包含 .github/workflows/ 的 tree 都会被拒，
// 而且返回的是伪装成权限问题的 403「Resource not accessible by personal access token」。
// 这里自动降级：剔除 workflow 文件重试，并把这件事明确告知用户。
const isWorkflow = (p) => p.startsWith('.github/workflows/');
let tree;
try {
  tree = await api('POST', `/repos/${REPO}/git/trees`, { base_tree: baseTree, tree: blobs });
} catch (e) {
  if (e.status !== 403) throw e;
  const kept = blobs.filter((b) => !isWorkflow(b.path));
  if (kept.length === blobs.length) throw e; // 与 workflow 无关，是真权限问题
  tree = await api('POST', `/repos/${REPO}/git/trees`, { base_tree: baseTree, tree: kept });
  const dropped = blobs.filter((b) => isWorkflow(b.path)).map((b) => b.path);
  console.log(`⚠ token 缺 Workflows 权限，已跳过 ${dropped.length} 个 workflow 文件：${dropped.join(', ')}`);
  console.log('  站点可以部署，但自动部署流水线需要你在 token 上补 Workflows: Read and write 后再推一次');
}
console.log(`✓ tree ${tree.sha.slice(0, 8)}`);

// ---------- 5. 创建 commit ----------
const parents = [ref.object.sha];

const commit = await api('POST', `/repos/${REPO}/git/commits`, {
  message: MESSAGE,
  tree: tree.sha,
  parents,
});
console.log(`✓ commit ${commit.sha.slice(0, 8)}`);

// ---------- 7. 更新 ref ----------
if (ref?.object?.sha) {
  await api('PATCH', `/repos/${REPO}/git/refs/heads/${BRANCH}`, { sha: commit.sha, force: true });
} else {
  await api('POST', `/repos/${REPO}/git/refs`, { ref: `refs/heads/${BRANCH}`, sha: commit.sha });
}
console.log(`✓ 已更新 refs/heads/${BRANCH} → ${commit.sha.slice(0, 8)}`);

// ---------- 8. 开启 Pages（GitHub Actions 作为构建源） ----------
if (!SKIP_PAGES) {
  const existing = await api('GET', `/repos/${REPO}/pages`, null, { allow404: true });
  if (existing) {
    if (existing.build_type !== 'workflow') {
      await api('PUT', `/repos/${REPO}/pages`, { build_type: 'workflow' });
      console.log('✓ Pages 构建源已改为 GitHub Actions');
    } else {
      console.log('· Pages 已是 GitHub Actions，无需改动');
    }
  } else {
    try {
      await api('POST', `/repos/${REPO}/pages`, { build_type: 'workflow' });
      console.log('✓ 已开启 Pages（构建源：GitHub Actions）');
    } catch (e) {
      console.log(`· 自动开启 Pages 失败（${e.message}），需在 Settings → Pages 手动选择 GitHub Actions`);
    }
  }
}

// ---------- 9. 触发部署工作流 ----------
const run = await api('GET', `/repos/${REPO}/actions/workflows`, null, { allow404: true });
const deploy = run?.workflows?.find((w) => /deploy/i.test(w.path));
if (deploy) {
  try {
    await api('POST', `/repos/${REPO}/actions/workflows/${deploy.id}/dispatches`, { ref: BRANCH });
    console.log('✓ 已触发部署工作流');
  } catch (e) {
    console.log(`· 触发工作流失败（${e.message}），push 通常已自动触发`);
  }
}

const pagesUrl = `https://${repo.owner.login.toLowerCase()}.github.io/${repo.name}/`;
console.log(`\n站点地址（首次部署约需 1～2 分钟）：${pagesUrl}`);
