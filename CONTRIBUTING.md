# Contributing to Inkglass

- When reporting an issue, please include your Inkglass version, Windows version, document type, and reproduction steps.
- Keep pull requests focused, preserve strict read-only boundaries, and verify changes with `pnpm run typecheck` and `pnpm test` inside `source/`.
- Do not commit `node_modules`, `dist`, or `release` binaries; packaged builds are published via GitHub Releases.
- Run `pnpm run test:desktop` on Windows when changing Electron shell, packaging, or desktop IPC behavior.
