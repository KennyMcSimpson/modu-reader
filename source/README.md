# Inkglass Desktop Source

End users should download a compiled Windows portable ZIP or installer from [Releases](https://github.com/KennyMcSimpson/Inkglass/releases/latest).

## Development

Requires **Node.js 24** and **pnpm 11.25.0**. Windows supports the full build, packaging, and Electron smoke suite; Linux supports typecheck, unit tests, and renderer builds.

```sh
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm test
pnpm run build
pnpm run dev
pnpm run test:desktop
pnpm run dist:win
```

- `dev` builds the renderer bundle and launches Electron directly.
- `build` compiles `dist/desktop` and stages `dist/app` with `THIRD_PARTY_NOTICES`.
- `dist:win` packages the portable ZIP and NSIS installer into `../release/`.
- On Linux CI without running Electron, pass `ELECTRON_SKIP_BINARY_DOWNLOAD=1` during install.

## Architecture & Layout

| Path | Responsibility |
| --- | --- |
| `desktop/main.cjs` | Window lifecycle, native menus (`Ctrl+K`, `Ctrl+Shift+C`), live `fs.watch`, scoped folder/recent IPC, `inkglass-media://` boundary resolver, PDF export, always-on-top, legacy state migration |
| `desktop/preload.cjs` | Narrow `contextBridge` API (`window.inkglassDesktop`) + trusted OS file drop bridge |
| `desktop/files.cjs` | Encoding detection, size/type limits, folder-bounded image & link checks (including directory `README.md` & extensionless `.md`), read-only folder walker, debounced file watcher, legacy state migration |
| `desktop/installer.nsh` | Per-user Windows **Open with** registration (`Inkglass.Markdown`) |
| `lib/frontmatter.ts` | Zero-dependency leading YAML frontmatter parser |
| `lib/alerts.ts` | GitHub Alerts (`[!NOTE]` / `[!TIP]` / `[!IMPORTANT]` / `[!WARNING]` / `[!CAUTION]`) parser |
| `lib/live-diff.ts` | Fence-aware heading section splitter, duplicate-heading index diff, zero-dependency line-level diff engine, and heading line-number extractor |
| `lib/clean-text.ts` | Clean KaTeX DOM text extraction (`markdown` / `plain`), duplicate filename disambiguator, and relative path helper |
| `lib/table-export.ts` | RFC-4180 CSV and TSV table serializer |
| `lib/citations.ts` | Markdown quote + source/section citation formatter |
| `components/reader.tsx` | Reader shell, accumulated Live Diff-Watch & diff drawer, Follow mode, filterable Folder drawer, `Ctrl+K` Quick Jump, Split heading scroll sync, anchor & doc history |
| `components/markdown-document.tsx` | Markdown/KaTeX/Mermaid renderer, Frontmatter card, GitHub Alerts, Zoom/Pan Lightbox, 1-click display & `Alt+Click` inline TeX copy, clean KaTeX CSV/TSV copy |
| `components/desktop-find.tsx` | CSS Custom Highlight API find bar with block boundaries, Match Case (`Aa`), Whole Word (`\b`), `F3` navigation, and mutation-safe active match preservation |
| `scripts/build-desktop.mjs` | Renderer bundling, strict CSP injection, dependency license collection |
| `scripts/smoke-desktop.mjs` | End-to-end Playwright Electron smoke suite against real Windows builds |

## Security Model & Verification

- **Sandboxed renderer**: `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`, strict CSP (`connect-src 'none'`), and main-frame URL verification on every IPC handler.
- **No arbitrary filesystem access**: Relative images and relative `.md` links (including cross-subdirectory images, directory `README.md` links, and extensionless `.md` links) are canonicalized via `fs.realpath` and verified inside the document directory or active folder boundary, rejecting `..` traversal and symlink/junction escapes. Folder refresh re-scans only main-process `activeFolderRoot`; recent-file opening accepts only paths already recorded in main-process `state.recent`.
- **Tests**:
  - `pnpm test` runs `desktop/tests/files.test.cjs` (encodings, limits, traversal/junction escapes, cross-subdir images, directory/extensionless links, folder walk bounds, real file watcher, legacy state migration) and `desktop/tests/features.test.mjs` (frontmatter, GitHub Alerts, fence-aware live diff, duplicate-heading indices, line-level diff + large-file cap, heading line mapping, clean-text helpers, CSV/TSV export, citations).
  - `pnpm run test:desktop` launches the real Electron binary to verify version match, sandbox flags, zero remote requests, Frontmatter, GitHub Alerts, KaTeX CSV/TOC cleanliness, Mermaid, Split view, Find, Quick Jump (`Ctrl+K`), Dark-mode print stylesheet colors, relative `.md` links, cross-subdirectory images via Folder drawer, Always-on-Top, Export PDF, Live Diff-Watch + Show diff drawer, Paste, and single-instance handoff.

The legacy single-file HTML build remains available via `pnpm run build:html`, though it is not part of the Windows desktop release packages.
