# 清和的小站

一个使用 Astro、Markdown 和少量 TypeScript 构建的个人博客。一份文章内容，共用搜索、导航与阅读功能，可切换 16 种外观：原有六套博客主题，加上 Traveritas 和知识库 D-018 中九个设计案例的博客适配。

16 套首页分别保留所选原主题的主要构图，采用独立 Astro 组件；切换时只挂载当前主题，文章与基础功能共用。它们是对原主题结构的适配，并非多个上游项目的原样安装；背景和头像使用本站素材。来源与素材说明见 `DESIGN.md`。

## 本地运行

需要 Node.js 22.12 或更新版本。

```sh
npm ci
npm run dev
```

开发预览默认位于 `http://127.0.0.1:4321/`。如果端口已占用，终端会显示实际地址。

```sh
npm run check
npm run build
npm run preview
```

`build` 只在本机生成 `dist/`，不会上传或发布网站。GitHub Pages 通过下述 Actions 工作流发布。

## GitHub Pages

发布仓库：[XVSHIFU/ccc666yyyy.github.io](https://github.com/XVSHIFU/ccc666yyyy.github.io)。站点地址：[清和的小站](https://xvshifu.github.io/ccc666yyyy.github.io/)。

`.github/workflows/deploy-pages.yml` 在推送至本 fork 的 `main` 后构建并发布，也支持手动运行。工作流使用 Node.js 22、`npm ci`、`npm run build`，由 GitHub Pages 配置自动提供 `SITE_URL` 和 `BASE_PATH`，只上传 `dist/`。生产地址包含 `/ccc666yyyy.github.io/` 前缀；本地开发仍使用根路径。

仓库 Settings → Pages 的 Source 设为 GitHub Actions。修改完成后提交并推送到 `main`，在 Actions 中查看发布结果即可；不需要提交 `dist/`，也不需要配置自定义域名。

## 写一篇文章

```sh
npm run new:post -- my-first-note "我的第一篇笔记"
```

新文件位于 `src/content/posts/my-first-note.md`，已存在的文件不会被覆盖。也可以直接复制一篇 Markdown，调整顶部字段：

```yaml
---
title: 我的第一篇笔记
description: 首页与搜索结果显示的简介。
published: 2026-10-07T12:00:00+08:00
category: 随笔
tags: [阅读, 写作]
cover: /media/my-cover.webp
example: false
archived: false
---
```

- `title`、`description`、`published`、`category` 为必填字段。
- `tags` 默认为空，`cover` 可省略；封面路径相对于 `public/`。
- `example: true` 会在文章列表、正文页与 RSS 标出示例，避免被误认为真实经历。
- `archived: true` 会从首页、公开归档、搜索和 RSS 列表隐藏文章，**不会撤销文章 URL 的访问权限**；不要用它保存私密内容。
- 普通文章地址为 `/posts/文件名/`。`permalink` 用于迁移旧文章，当前只为两个旧地址配置了专门路由；添加新 `permalink` 时须同时增加对应 Astro 路由。

文章正文图片可放入 `public/media/`。对于 `/posts/文件名/` 这种文章地址，正文使用 `../../media/图片名.webp`，在站点部署至子路径时也能正确解析。迁移到其他深度的文章需要相应调整相对路径。

## 当前内容与旧链接

- 保留 `Hello World` 的原始正文和 `/2025/12/18/hello-world/` 地址。
- 保留旧空文章 `/2025/12/19/post/`，不在首页等列表展示。
- 保留已有关于页中的身份、学习方向与开发工具信息；修复邮件入口。
- 三篇中文长文是明确标注的示例：`a-little-space.md`、`a-small-tool.md`、`between-the-pages.md`。它们用来展示目录、引用、中文表格、代码、图片和图注，可随时删除或替换。
- 原先由 Hexo / Fluid 生成的根目录 HTML、CSS、JS 仍保留为迁移证据。新构建读取 `src/` 与 `public/`，产物位于 `dist/`，不会直接使用那些旧 HTML。

## 站点设置

名称、简介、GitHub、邮件和默认主题在 `src/lib/site.ts`。16 种外观共用此处的数据。外观选择与明暗设置保存在访客自己的浏览器里，不需要账户。

`astro.config.mjs` 支持两个构建环境变量：

- `SITE_URL`：真实站点 origin，例如 `https://example.com`。未配置时使用 `http://localhost:4321`，预览中不会假称某个线上域名。
- `BASE_PATH`：项目站点的前缀，例如 `/blog/`，默认 `/`。

PowerShell 示例（仅构建本地产物）：

```powershell
$env:SITE_URL = 'https://example.com'
$env:BASE_PATH = '/blog/'
npm run build
```

内部链接、封面、搜索索引和 RSS 会使用同一前缀。修改配置后需要重新构建。

## 共用功能与评论

文章分类、标签和年份归档均有独立 URL。搜索索引由本站文章生成，不向第三方发送搜索词。RSS 位于 `/rss.xml`，搜索索引位于 `/search-index.json`。

本地预览没有连接旧站的远程评论服务，也没有生成模拟评论。文章末尾提供已有邮箱联系方式。未来接入评论前，应确认服务配置、旧数据归属与文章标识映射；建议使用稳定的文章 ID 或保留路径绑定评论，避免主题或域名变化造成重复讨论区。

16 种外观共用同一份正文 DOM 与稳定标题锚点。切换主题时无需重建内容或更换文章地址。文章复制链接与代码复制由共用脚本处理，具体浏览器支持与验证记录见交付说明。

## 目录

```text
src/content.config.ts       文章结构约束
src/content/posts/         Markdown 文章
src/lib/                   站点配置与内容查询
src/layouts/Base.astro     公共页面框架
src/components/            文章、导航、外观与搜索组件
src/components/home/       16 套各自独立的首页结构
src/pages/                 首页、文章、归档与静态数据端点
src/styles/                共用控件和正文排版
public/themes/             16 套按需加载的外观样式
public/media/              本地图片资源
scripts/new-post.mjs       新建文章命令
```

当前先发布到 fork 的 GitHub Pages，保留明确标注的示例文章。正式使用时可按需替换示例，并继续维护 `src/lib/site.ts` 中的站点身份和外部链接。


## 设计漫游

外观菜单提供「博客手记」和「设计漫游」筛选。新加入 Traveritas、Radar、Good Fella、AVA、Nfinite、Follow Art、Milkin、Digilab、Stefan、Büro 18；可使用 `/?theme=traveritas` 等链接直接预览。

每套采用独立首页构图和共用文章内容。它们是参考网站的博客适配，不是十个原站完整移植：品牌文案、商业服务、专有视频、3D 模型和声音均未照搬。公开参考、实际截图与素材替代记录见 `DESIGN.md` 与 `.references/`。

动态研究以官方 GitHub、作者技术文章和真实交互为依据；Traveritas 对照其公开工程，Stefan 对照 `/projects` 与作者的 Codrops 实现说明。每套已适配的机制、源码可用情况和仍有差异见 `DESIGN.md` 中的「源码与动态还原记录」。

主题切换采用中性纸白／炭灰的随机扩散遮罩。900ms 展开后至少停顿 550ms，资源就绪且布局稳定后用 650ms 揭开；启用系统减少动态效果时退化为短淡入淡出。加载期间可以按 Escape 取消，较慢时显示取消按钮。
