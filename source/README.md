# 墨读桌面版源码 · Desktop source

普通用户请下载仓库 [Releases](https://github.com/KennyMcSimpson/modu-reader/releases/latest) 中的 Windows ZIP 或安装包。

End users should download a Windows ZIP or installer from [Releases](https://github.com/KennyMcSimpson/modu-reader/releases/latest).

## 开发 · Development

Node.js 24、pnpm 11.25.0。Windows 上可执行完整构建及桌面验证；Linux 可做类型检查、文件测试与渲染器构建。

Use Node.js 24 and pnpm 11.25.0. Windows supports the complete build and desktop checks; Linux supports type checking, file tests, and renderer builds.

```sh
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm test
pnpm run build
pnpm run dev
pnpm run test:desktop
pnpm run dist:win
```

`dev` 先构建阅读界面，再启动 Electron 独立窗口。`build` 生成 `dist/desktop` 并准备 `dist/app`；`dist:win` 生成上一级 `release/` 中的 ZIP 和 NSIS 安装包。

`dev` builds the reader and launches an Electron window. `build` creates `dist/desktop` and stages `dist/app`; `dist:win` generates a ZIP and NSIS installer in the parent `release/` directory.

仅做 Linux 源码检查且不运行 Electron 时，可在安装依赖时设置 `ELECTRON_SKIP_BINARY_DOWNLOAD=1`，跳过与目标无关的 Linux Electron 二进制下载。不会更改依赖版本或依赖策略。

For Linux source-only checks, set `ELECTRON_SKIP_BINARY_DOWNLOAD=1` during dependency installation to skip the unused Linux Electron runtime. Dependency versions and policy remain unchanged.

## 文件结构 · Layout

| 路径 / Path | 职责 / Responsibility |
| --- | --- |
| `desktop/main.cjs` | 窗口、菜单、IPC、文件打开、最近记录 / window, menu, IPC, open files, recent paths |
| `desktop/preload.cjs` | 受限桌面 API / narrow desktop bridge |
| `desktop/files.cjs` | 编码识别、类型和大小限制、图片路径约束 / decoding, limits, image path boundaries |
| `desktop/installer.nsh` | 当前用户的“打开方式”注册 / per-user Open with registration |
| `components/reader.tsx` | 阅读器与桌面事件 / reader UI and desktop events |
| `components/desktop-find.tsx` | 窗口查找栏 / native find UI |
| `components/markdown-document.tsx` | Markdown、数学与图表 / Markdown, math, diagrams |
| `scripts/build-desktop.mjs` | 本地资源构建、CSP 与许可证 / local bundle, CSP, dependency notices |
| `scripts/smoke-desktop.mjs` | 实际桌面程序交互验证 / actual application smoke checks |
| `electron-builder.yml` | Windows ZIP 与安装包 / Windows packages |

## 验证和发布 · Verification and release

文件测试覆盖中文路径、常见编码、大小限制、目录逃逸与外部链接协议。桌面验证会启动 EXE，检查文件打开、相对图片、表格、公式、Mermaid、查找、重新读取、语言切换、粘贴及重复启动。

File tests cover Chinese paths, encodings, limits, path traversal, and external protocols. Desktop checks launch the EXE and exercise file opening, relative images, tables, math, Mermaid, find, reload, locale switching, paste, and second-instance handling.

渲染器启用 sandbox、contextIsolation，并禁用 Node.js 集成。只向已加载的本地页面暴露指定 IPC；文档 HTML 不执行。应用不自动设置 Windows 默认文件处理程序。

The renderer is sandboxed with context isolation and no Node.js integration. Only the app’s local main frame can use the defined IPC handlers. Document HTML is not executed. Windows default handlers are left to the user.

GitHub Actions 的 Windows 工作流在全部检查通过后发布 `package.json` 中的版本。发布新版本时同步更新版本号、下载链接与发布说明文件。修改已发布版本的源码不会覆盖其下载文件。

The Windows Actions workflow publishes the package version after checks pass. For a new release, update the version, download links, and release notes path together. A published version’s binaries are never overwritten.

历史单文件构建仍可通过 `pnpm run build:html` 生成，但不属于 2.0 的 Windows 分发包。

The legacy HTML build remains available as `pnpm run build:html`; it is not included in the 2.0 Windows release.
