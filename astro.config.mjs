import { defineConfig } from 'astro/config';

// GitHub Pages 项目页部署在 https://<user>.github.io/<repo>/ 下，
// 因此 base 必须跟随仓库名；用户页/自定义域时 BASE_PATH 留空即可。
const base = process.env.BASE_PATH || '/';
const site = process.env.SITE_URL || 'https://example.github.io';

export default defineConfig({
  site,
  base,
  trailingSlash: 'ignore',
  build: { format: 'directory', inlineStylesheets: 'auto' },
  compressHTML: true,
  devToolbar: { enabled: false },
  markdown: { shikiConfig: { theme: 'github-light' } },
});
