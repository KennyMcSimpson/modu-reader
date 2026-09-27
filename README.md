# 墨读 MoDu Reader

[![Windows desktop](https://github.com/KennyMcSimpson/modu-reader/actions/workflows/windows-release.yml/badge.svg)](https://github.com/KennyMcSimpson/modu-reader/actions/workflows/windows-release.yml)
[![Latest release](https://img.shields.io/github/v/release/KennyMcSimpson/modu-reader)](https://github.com/KennyMcSimpson/modu-reader/releases/latest)

一款专注阅读的 **Windows 桌面 Markdown 应用**。独立窗口、本地文件、打开即读；无需注册、浏览器或开发环境。

A calm **Windows desktop Markdown reader**. A standalone application for local documents, with no account, browser, or development environment required.

## 下载 · Download

**[下载最新版 / Latest release](https://github.com/KennyMcSimpson/modu-reader/releases/latest)** · Windows 10 / 11，64 位 x64

| 文件 / File | 用法 / How to use |
| --- | --- |
| [免安装 ZIP / Portable ZIP](https://github.com/KennyMcSimpson/modu-reader/releases/latest/download/MoDu-Reader-2.0.0-Windows-x64.zip) | 完整解压，双击 `MoDu Reader.exe`。可直接把整个 ZIP 发给朋友。 / Extract everything, then launch `MoDu Reader.exe`. Share the entire ZIP. |
| [安装包 / Installer](https://github.com/KennyMcSimpson/modu-reader/releases/latest/download/MoDu-Reader-2.0.0-Setup-x64.exe) | 安装后从桌面或开始菜单打开。 / Install and launch from the desktop or Start menu. |

免安装版的 EXE 需要旁边的运行文件，请勿单独移动 EXE，也不要在压缩包预览中直接运行。**GitHub 的 Code → Download ZIP 是源码，不是可运行的 Windows 安装包。**

Keep the portable EXE together with all neighboring files. Extract it before running. **GitHub’s Code → Download ZIP contains source code, not the Windows application.**

当前安装包未进行商业代码签名，Windows 可能显示“未知发布者”。发布页提供 SHA-256 校验文件。 / The builds are unsigned; Windows may show an unknown publisher. SHA-256 checksums are included in each release.

## 开始阅读 · Start reading

1. 打开程序后，点击 **打开文件**、按 **Ctrl+O**，或拖入 Markdown 文件。
2. 安装版可在文件右键菜单的 **打开方式** 中选择 **MoDu Reader**；设为默认后，双击 `.md` 就能打开。
3. **Ctrl+F** 查找、**F5** 重新读取外部修改、**Ctrl+Shift+F** 切换专注模式。
4. **文件 → 最近打开** 可重新打开文档；右下角 **中 / EN** 切换界面语言。

1. Choose **Open file**, press **Ctrl+O**, or drag Markdown files into the window.
2. With the installed version, choose **MoDu Reader** in Windows **Open with**. Set it as the default if you want to open `.md` files by double-clicking.
3. **Ctrl+F** finds text; **F5** reloads changes made in another editor; **Ctrl+Shift+F** toggles focus mode.
4. Use **File → Open recent** to reopen documents, and **中 / EN** to change the UI language.

## 功能 · Features

- 系统文件对话框、多文档切换、拖放、粘贴阅读、命令行打开 / Native file dialog, multiple documents, drag-and-drop, pasted text, command-line opening
- 最近打开记录、窗口位置记忆、系统文件“打开方式” / Recent files, remembered window bounds, Windows file integration
- 目录导航、查找、阅读进度、源码视图与专注模式 / Contents navigation, find, reading progress, source view, focus mode
- 中英界面、字体与排版调整、浅色/深色/系统主题 / Chinese and English UI, typography settings, light/dark/system themes
- GFM 表格、任务列表、代码高亮与复制 / GFM tables, task lists, syntax highlighting and copying
- LaTeX 数学公式和 Mermaid 图表，所需组件随应用附带 / Bundled LaTeX math and Mermaid diagrams
- 自动显示文档同目录或子目录中的相对路径图片 / Relative images inside the document’s own directory or its subdirectories
- `.md`、`.markdown`、`.mdown`、`.txt`；UTF-8、带 BOM 的 UTF-16、GB18030 / Markdown and text files in common encodings

单个文档上限 2 MB，本地图片上限 20 MB；不读取文档文件夹以外的图片。网络图片仍需联网，外部网页链接由系统默认浏览器打开。墨读是阅读器，不会修改原文件。

Documents are limited to 2 MB and local images to 20 MB. Images outside the document folder are not read. Remote images need a network connection; external links open in your default browser. MoDu is a reader and does not modify source documents.

## 隐私 · Privacy

文档与粘贴文本在本机内存中处理，不上传、不遥测、无账号。主题、语言、窗口位置及最近文件的路径保存在本机应用数据目录；最近文件记录可以从菜单清空。关闭应用后不会保存文档正文或粘贴内容。免安装版也会使用当前 Windows 用户的应用数据目录保存这些设置。

Documents and pasted text are processed locally in memory. There are no uploads, accounts, or analytics. Preferences, language, window bounds, and recent file paths are stored in local application data; clear recent paths from the File menu. Document text and pasted content are not saved on exit. The portable version also stores settings in the current Windows user’s application data directory.

## 开发与构建 · Development

桌面外壳使用 Electron，阅读界面使用 React/Vite；程序自带运行环境。源码使用 Node.js 24 与 pnpm 11.25.0。正常使用只需下载上面的 Windows 成品。

The desktop shell uses Electron and the reader UI uses React/Vite. The runtime is bundled. Development requires Node.js 24 and pnpm 11.25.0; end users only need the release downloads.

```sh
cd source
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm test
pnpm run dev
# 在 Windows 上生成 ZIP 与安装包 / Build Windows packages on Windows:
pnpm run dist:win
```

构建产物位于根目录的 `release/`。GitHub Actions 在 Windows 上构建，验证解压后的 EXE 和安装后的 EXE，通过后发布当前版本；已经发布的同版本文件不会被覆盖。

Build outputs go to `release/`. GitHub Actions builds on Windows, tests both the extracted portable EXE and the installed EXE, and publishes the version after successful checks. Published versions are never overwritten.

- [`source/README.md`](source/README.md)：源码结构与验证 / source layout and verification
- [`使用说明.txt`](使用说明.txt)：双语使用说明 / bilingual quick start
- [`docs/releases/v2.0.0.md`](docs/releases/v2.0.0.md)：2.0 桌面版发布说明 / desktop release notes
- [`CONTRIBUTING.md`](CONTRIBUTING.md)：贡献指南 / contribution guide
- [`LICENSE`](LICENSE)：MIT 许可证 / MIT license

第三方许可证随 Windows 应用一起分发；Electron / Chromium 的许可证与阅读器组件的 `THIRD_PARTY_NOTICES` 均保留。

Third-party licenses are shipped with the Windows app, including Electron / Chromium notices and the renderer’s `THIRD_PARTY_NOTICES` directory.
