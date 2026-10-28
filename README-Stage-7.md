# Stage 7 个人主页

本目录是新版个人主页的正式本地工作目录，连接原有的 `YaraHe/YaraHe.github.io` 仓库并保留其历史。网站包含 Home、What I Built、What I Understand、About Me，以及 RAG、Agent AI、Voice Agent 的目录和阅读页。当前仍在发布准备阶段；GitHub Pages 尚未完成正式发布与线上验收。

## 本地构建与预览

```powershell
npm ci
npm run build
npm run check
npm run dev
```

本地预览地址为 `http://127.0.0.1:8766/`。`dist/` 是可直接托管的静态构建产物，不纳入源码版本管理。改动页面或笔记后重新构建并刷新预览。

## 学习笔记内容源

兄弟目录 `../basic_learn/articles` 是正式 Markdown 与文章图片内容源。构建脚本默认从该目录读取内容；`CONTENT_DIR` 可在构建环境中指定另一个 `articles` 目录。当前内容为 RAG 16 篇、Agent AI 12 篇、Voice Agent 3 篇，共 31 篇 Markdown、186 张原始文章图片；构建仅复制实际被文章引用的图片。网站不维护第二套 Markdown 正文。

日常更新先在 `basic_learn` 修改和提交文章，再手动触发本站的 GitHub Actions 工作流重新构建。工作流定义在 `.github/workflows/deploy-pages.yml`：它将两个仓库检出为平级目录，使用 Node.js 22 构建、检查并发布 `dist/`。笔记仓库已推送正式内容并设为 Public；本站的 Pages 发布源仍需设为 GitHub Actions。工作流目前仅在本地准备，尚未提交、运行或完成线上验收。`dist/understand/article-index.json` 记录文章索引和构建时的内容摘要，可用于核对来源。

## 资源与发布状态

- Q1 视频模块使用已验收的 `src/built/q1/assets/onda-espanol-demo-native-crop-candidate.mp4` 和正式封面 `q1-demo-cover-plate.png`。原始录屏及上一版压缩视频保留在本地，由 `.gitignore` 排除。
- `Review/` 保存本地审查与迭代材料，不参与构建或提交。历史视觉稿也不由构建脚本复制到 `dist/`。
- About Me 已实现中英切换。公开版 A4 简历位于 `src/about/assets/resume.pdf`，Home 与 About Me 均链接至同一文件；构建后地址为 `/about/assets/resume.pdf`。日后替换同名 PDF 并重新发布即可保持入口地址不变。
- 当前个人主页仓库尚未完成正式文件提交、公开及 Pages 发布。首次发布仍需推送本站正式文件、将本站设为 Public、把 Pages 发布源设为 GitHub Actions，并进行线上验收。
