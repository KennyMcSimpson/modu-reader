# 贡献 MoDu Reader · Contributing

## 中文

欢迎提交问题、改进建议和代码贡献。

- 报告问题时，请说明浏览器、操作系统、输入文件类型，以及能稳定复现问题的步骤。
- 涉及界面或交互的修改，请同时检查中文和 English 两种界面，以及窄屏布局。
- 源码改动请在 `source/` 中运行 `pnpm install --frozen-lockfile`、`pnpm run typecheck` 和 `pnpm run build`。
- 如果源码行为发生变化，请把新的离线产物复制到根目录的 `墨读.html`。
- 不要添加上传文档、账号系统、远程统计或其他会改变本地隐私边界的功能，除非先讨论并获得明确同意。

## English

Issues, suggestions, and code contributions are welcome.

- When reporting a bug, include the browser, operating system, input file type, and reproducible steps.
- For UI or interaction changes, check both Chinese and English locales and a narrow viewport.
- For source changes, run `pnpm install --frozen-lockfile`, `pnpm run typecheck`, and `pnpm run build` from `source/`.
- If source behavior changes, copy the new offline artifact to the root-level `墨读.html`.
- Do not add document uploads, accounts, remote analytics, or other changes to the local privacy boundary without prior discussion and explicit agreement.
