# Inkglass Desktop Source

End users should download a compiled Windows portable ZIP or installer from [Releases](https://github.com/KennyMcSimpson/inkglass/releases/latest).

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
| `desktop/main.cjs` | Window lifecycle, native menus, live `fs.watch`, strictly scoped IPC, PDF export, always-on-top, legacy state migration |
| `desktop/preload.cjs` | Narrow `contextBridge` API (`window.inkglassDesktop`) + trusted OS file drop bridge |
| `desktop/files.cjs` | Encoding detection, size/type limits, image/link boundary checks, read-only folder walker, debounced file watcher, legacy state migration |
| `desktop/installer.nsh` | Per-user Windows **Open with** registration (`Inkglass.Markdown`) |
| `lib/frontmatter.ts` | Zero-dependency leading YAML frontmatter parser |
| `lib/alerts.ts` | GitHub Alerts (`[!NOTE]` / `[!TIP]` / `[!IMPORTANT]` / `[!WARNING]` / `[!CAUTION]`) parser |
| `lib/live-diff.ts` | Fence-aware heading section splitter and live-reload diff engine |
| `lib/table-export.ts` | RFC-4180 CSV and TSV table serializer |
| `lib/citations.ts` | Markdown quote + source/section citation formatter |
| `components/reader.tsx` | Reader shell, Live Diff-Watch banner, Read-Only Folder drawer, Split view, Back/Forward history |
| `components/markdown-document.tsx` | Markdown/KaTeX/Mermaid renderer, Frontmatter card, GitHub Alerts, Zoom/Pan Lightbox, 1-click TeX/CSV/TSV copy |
| `components/desktop-find.tsx` | CSS Custom Highlight API find bar across Read, Split, and Source views |
| `scripts/build-desktop.mjs` | Renderer bundling, strict CSP injection, dependency license collection |
| `scripts/smoke-desktop.mjs` | End-to-end Playwright Electron smoke suite against real Windows builds |

## Security Model & Verification

- **Sandboxed renderer**: `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`, strict CSP (`connect-src 'none'`), and main-frame URL verification on every IPC handler.
- **No arbitrary filesystem access**: Relative images and relative `.md` links are canonicalized via `fs.realpath` and verified inside the document directory (or user-selected folder root), rejecting `..` traversal and symlink/junction escapes.
- **Tests**:
  - `pnpm test` runs `desktop/tests/files.test.cjs` (encodings, limits, traversal/symlink escapes, folder walk bounds, real file watcher, legacy state migration) and `desktop/tests/features.test.mjs` (frontmatter, GitHub Alerts, fence-aware live diff, CSV/TSV export, citations).
  - `pnpm run test:desktop` launches the real Electron binary to verify version match, sandbox flags, zero remote requests, Frontmatter, GitHub Alerts, KaTeX, Mermaid, Split view, Find, relative `.md` links, Folder drawer, Always-on-Top, Export PDF, Live Diff-Watch, Paste, and single-instance handoff.

The legacy single-file HTML build remains available via `pnpm run build:html`, though it is not part of the Windows desktop release packages.
