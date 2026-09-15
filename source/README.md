# 墨读 MoDu Reader · 源码 / Source

## 中文

正常使用只需双击上一级的「墨读.html」，无需执行以下步骤。

修改程序时，在本目录中操作。开发环境：Node.js `22.13` 或更高版本，以及 pnpm `11.25.0`。

```sh
pnpm install --frozen-lockfile
pnpm run dev
```

类型检查：

```sh
pnpm run typecheck
```

重新生成可离线双击打开的单文件：

```sh
pnpm run build
```

产物为 `dist/墨读.html`，可以独立复制到其他电脑。所有脚本、样式和字体均已内嵌。仓库根目录的 `墨读.html` 是用于直接分发的副本。

- `components/reader.tsx`：阅读器界面、文件读取、语言和偏好设置。
- `components/markdown-document.tsx`：Markdown、代码、数学和图表渲染。
- `app/globals.css`：界面与阅读排版样式。
- `lib/demo.ts`：内置示例文档。
- `scripts/build-offline.mjs`：单文件离线构建。

第三方许可见上一级 `THIRD_PARTY_NOTICES/`。

## English

For normal use, double-click the parent folder's `墨读.html`; no development setup is needed.

When changing the app, work in this directory. The development environment is Node.js `22.13` or newer and pnpm `11.25.0`.

```sh
pnpm install --frozen-lockfile
pnpm run dev
```

Type-check the source:

```sh
pnpm run typecheck
```

Build the standalone offline file:

```sh
pnpm run build
```

The output is `dist/墨读.html`, which can be copied to another computer by itself. Scripts, styles, and fonts are bundled into the file. The root-level `墨读.html` is the checked-in distribution copy.

- `components/reader.tsx`: reader UI, file loading, locale, and preferences.
- `components/markdown-document.tsx`: Markdown, code, math, and diagram rendering.
- `app/globals.css`: interface and reading typography styles.
- `lib/demo.ts`: built-in sample documents.
- `scripts/build-offline.mjs`: single-file offline build.

Third-party licenses are listed in the parent `THIRD_PARTY_NOTICES/` directory.
