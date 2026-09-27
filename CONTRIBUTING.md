# 贡献 · Contributing

- 报告问题时请提供墨读版本、Windows 版本、文档类型和复现步骤。 / Include the MoDu version, Windows version, file type, and reproduction steps.
- 界面修改应检查中英语言、深浅主题和窄窗口。 / Check both locales, light and dark themes, and narrow windows.
- 在 `source/` 运行 `pnpm install --frozen-lockfile`、`pnpm run typecheck`、`pnpm test` 和 `pnpm run build`。 / Run the dependency install, typecheck, file tests, and build from `source/`.
- 桌面相关修改还需在 Windows 执行 `pnpm run test:desktop`、`pnpm run dist:win`，并验证实际 EXE；CI 会验证免安装和安装版本。 / Test the actual Windows EXE for desktop changes; CI checks both distributions.
- 不要提交 `node_modules`、`dist` 或 `release` 二进制；成品放在 GitHub Releases。 / Keep build outputs out of Git; publish packages in Releases.
- 阅读器保持本地处理、只读文档。涉及账号、上传或遥测的改动须先讨论。 / Keep document processing local and read-only; discuss accounts, uploads, or analytics before changing this boundary.
