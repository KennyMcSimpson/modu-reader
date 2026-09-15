# 墨读 MoDu Reader

> A calm, local-first Markdown reader for notes, long-form writing, and technical documents.

墨读是一款打开即用的本地 Markdown 阅读器：不需要注册，不上传文件，也不要求安装 Node.js。把文件拖进窗口，专心读内容。

MoDu Reader is a local-first Markdown reader for notes, long-form writing, and technical documents. It works offline as a single HTML file, with no account, upload, or server required.

## 立即使用 · Use It Now

1. 下载或克隆这个仓库。
2. 双击根目录的 `墨读.html`。
3. 用 Edge、Chrome 或 Firefox 打开，然后点击“打开文件”，或把 Markdown 文件直接拖进窗口。

1. Download or clone this repository.
2. Double-click the root-level `墨读.html` file.
3. Open it in Edge, Chrome, or Firefox. Choose **Open file**, or drag Markdown files into the window.

不需要 Node.js、Python、安装步骤或网络连接。网络图片仍需要网络；文档文本只在当前浏览器页面中处理。

No Node.js, Python, installation step, or network connection is required. Remote images still need a network connection; document text is processed only in the current browser page.

## 功能 · Features

- 中英双语界面，语言选择会保存在当前浏览器中 / Chinese and English UI with a persisted locale choice
- 多文件切换、拖放打开、粘贴 Markdown / multiple documents, drag-and-drop, and paste-to-read
- GFM 表格、任务清单、代码高亮与复制 / GFM tables, task lists, syntax highlighting, and code copying
- LaTeX 数学公式与 Mermaid 图表 / LaTeX math and Mermaid diagrams
- 目录、阅读进度、源码视图、专注模式 / table of contents, reading progress, source view, and focus mode
- 字号、行距、字体、正文宽度与浅色/深色/系统主题 / type size, line height, font, page width, and light/dark/system themes
- 支持 `.md`、`.markdown`、`.mdown`、`.txt`，以及 UTF-8、UTF-16 BOM、GB18030 文本 / supported Markdown and text formats with common Chinese encodings
- 本地图片匹配与完全离线的单文件构建 / local image matching and a fully offline single-file build

## 隐私 · Privacy

墨读不会上传你的文档。文件内容、粘贴文本和本地图片只保存在当前页面的内存中；刷新或关闭页面后，需要重新打开文档。只有阅读偏好和语言选择会保存在浏览器的本地存储中。

MoDu Reader does not upload your documents. File contents, pasted text, and local images stay in the current page's memory; after a refresh or close, open them again. Only reading preferences and locale choice are stored in the browser's local storage.

## 从源码运行 · Develop From Source

需要 Node.js `>=22.13.0` 和 pnpm `11.25.0`。完整命令、目录说明和离线构建步骤见 [`source/README.md`](source/README.md)。

The source project requires Node.js `>=22.13.0` and pnpm `11.25.0`. See [`source/README.md`](source/README.md) for commands, file responsibilities, and the offline build.

```sh
cd source
pnpm install --frozen-lockfile
pnpm run dev
pnpm run typecheck
pnpm run build
```

`pnpm run build` 会生成 `source/dist/墨读.html`。发布时，构建结果会被复制到根目录的 `墨读.html`，让不使用 Node.js 的读者也能直接打开。

`pnpm run build` creates `source/dist/墨读.html`. For distribution, copy that build output to the root-level `墨读.html` so readers without Node.js can launch it directly.

## 仓库结构 · Repository Layout

- `墨读.html`：可双击运行的离线应用 / the standalone offline application
- `示例文档.md`：用于测试拖放与 Markdown 渲染的示例 / a sample document for drag-and-drop and rendering checks
- `source/`：React/Vite 源码 / React/Vite source
- `使用说明.txt`：面向非开发者的双语使用说明 / bilingual quick-start guide
- `THIRD_PARTY_NOTICES/`：离线构建中使用的第三方许可证 / third-party licenses used by the offline bundle
- [`LICENSE`](LICENSE)：MIT 许可证 / MIT license
- [`CONTRIBUTING.md`](CONTRIBUTING.md)：贡献与本地验证说明 / contribution and local validation guide

## 许可证 · License

本项目采用 MIT License。第三方组件仍受各自许可证约束，详见 [`THIRD_PARTY_NOTICES/`](THIRD_PARTY_NOTICES/)。

This project is released under the MIT License. Third-party components remain subject to their own licenses; see [`THIRD_PARTY_NOTICES/`](THIRD_PARTY_NOTICES/).

## 相关文档 · Documentation

- [使用说明 / Quick Start](使用说明.txt)
- [源码开发 / Source Development](source/README.md)
- [贡献指南 / Contributing](CONTRIBUTING.md)
