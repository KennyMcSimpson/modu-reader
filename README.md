# Inkglass

[![Windows desktop](https://github.com/KennyMcSimpson/inkglass/actions/workflows/windows-release.yml/badge.svg)](https://github.com/KennyMcSimpson/inkglass/actions/workflows/windows-release.yml)
[![Latest release](https://img.shields.io/github/v/release/KennyMcSimpson/inkglass)](https://github.com/KennyMcSimpson/inkglass/releases/latest)

**The offline Windows Markdown reader built for living AI, research, and repository docs.**

Open any local `.md` file or folder — without creating `.obsidian/` folders, vault indexes, or touching a single byte of your files. When an AI coding agent, build script, or external editor rewrites the file on disk, Inkglass automatically live-reloads it, highlights which sections changed, and keeps your exact scroll position.

> Formerly known as **MoDu Reader**. On Windows desktop, existing window bounds, recent file paths, live-watch, and pin state (`desktop-state.json`) from `%APPDATA%\MoDu Reader` are imported automatically on first launch without altering your previous folder.

## Why Inkglass Instead of Typora / Obsidian / VS Code Preview?

| Need | Mainstream Tools | Inkglass 2.2 |
| --- | --- | --- |
| Read docs inside a Git repo | Obsidian creates `.obsidian/` vaults; editors risk accidental keystrokes | **Strict Read-Only** — zero repo pollution, zero accidental edits |
| Follow AI agent plans (`PLAN.md`, reports) | Manual `F5` reload or scrolling jumps back to top | **Live Diff-Watch** — auto-reloads on disk edits, highlights changed sections, and jumps straight to the next change |
| Inspect huge Mermaid diagrams & tables | Tiny cramped SVG / manual cell selection | **Click-to-zoom pan lightbox + Copy SVG**, **1-click CSV / TSV table copy**, **1-click Copy Raw LaTeX** |
| Read GitHub / docs folders | Missing `[!NOTE]` alerts or YAML frontmatter shows as raw text | **Native YAML Frontmatter cards**, **5 GitHub Alerts**, **Read-only Folder drawer**, and **relative `.md` link navigation** |
| Privacy & offline reliability | Accounts, telemetry, or remote CDN fonts | **100% offline bundled** (KaTeX, Mermaid, Highlight.js), sandboxed Electron renderer, zero telemetry |

## Download (Windows 10 / 11 x64)

**[Download latest release](https://github.com/KennyMcSimpson/inkglass/releases/latest)**

| Package | How to use |
| --- | --- |
| [Portable ZIP](https://github.com/KennyMcSimpson/inkglass/releases/latest/download/Inkglass-2.2.0-Windows-x64.zip) | Extract the full archive and run `Inkglass.exe`. Keep neighboring files beside the EXE. |
| [Windows Installer](https://github.com/KennyMcSimpson/inkglass/releases/latest/download/Inkglass-2.2.0-Setup-x64.exe) | Per-user installer with Start Menu / Desktop shortcut and Windows **Open with** registration. |

> [!NOTE]
> GitHub's **Code → Download ZIP** contains source code, not the compiled Windows application. Release binaries are currently unsigned; Windows SmartScreen may show an unknown-publisher prompt. Verify every download against `SHA256SUMS.txt`.

## Features

- **Live Diff-Watch (`Radio` toggle)**: Watches opened local files for external changes (including atomic-rename editor saves), reloads without losing your scroll position, marks changed headings in the body and Table of Contents, and provides a **Next change** jump button.
- **Read-Only Folder Drawer (`Ctrl+Shift+O`) & Relative `.md` Link Navigation**: Browse an entire repository's Markdown files without modifying anything, follow relative `[other](./guide.md#section)` links within the authorized folder boundary, and step through history with `Alt+Left` / `Alt+Right`.
- **Interactive Technical Reading Tools**:
  - **Mermaid & Image Lightbox**: Click any diagram or image to zoom (`+`/`-`/wheel) and pan, or copy sanitized SVG straight to the clipboard.
  - **1-Click Copy Raw LaTeX (`TeX`)**: Hover any display equation to copy its original LaTeX expression.
  - **1-Click Table Copy (`CSV` / `TSV`)**: Hover any GFM table to copy RFC-4180 CSV or spreadsheet-ready TSV.
  - **Quote with Citation (`Quote` button)**: Copies your selected passage (or active heading) as a formatted Markdown blockquote with filename and section reference.
- **Native YAML Frontmatter & GitHub Alerts**: Renders leading `---` metadata blocks as collapsible cards and styles `[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, and `[!CAUTION]` callouts natively.
- **Read / Split / Source Modes**: Inspect rendered output side-by-side with raw Markdown source in Split view.
- **Export Clean PDF (`Ctrl+P`) & Always-on-Top Pin (`Ctrl+Shift+T`)**: Print-styled PDF export and floating reference window mode.
- **Persistent Reading Position**: Automatically remembers scroll positions per document path across restarts.
- **Local Security Boundaries**: Sandboxed renderer (`contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`), strict document/folder symlink-escape checks, 2 MB document cap, 20 MB local image cap, UTF-8 / UTF-16 BOM / GB18030 decoding, and zero remote requests for local content.

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl+O` | Open Markdown files |
| `Ctrl+Shift+O` | Open folder (read-only) |
| `Ctrl+Shift+V` | Paste Markdown text |
| `Ctrl+F` | Find in document |
| `F5` | Manually reload current file |
| `Ctrl+P` | Export PDF |
| `Ctrl+Shift+T` | Toggle Always on Top |
| `Ctrl+Shift+F` | Toggle Focus Mode (`Esc` exits) |
| `Alt+Left` / `Alt+Right` | Navigate Back / Forward across linked documents |
| `Ctrl+W` | Close active document |

## Privacy

Documents and pasted text are processed exclusively in local memory. There are no accounts, cloud sync, analytics, or update pings. Only preferences, window bounds, recent paths (clearable from **File → Open Recent**), and per-file scroll offsets are saved locally. Inkglass never modifies your Markdown files.

## Development & Build

Requires Node.js 24 and pnpm 11.25.0.

```sh
cd source
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm test
pnpm run dev
# Build Windows portable ZIP + NSIS installer into ../release/
pnpm run dist:win
```

- [`source/README.md`](source/README.md) — Source layout, security model, and verification
- [`docs/releases/v2.2.0.md`](docs/releases/v2.2.0.md) — v2.2.0 release notes
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — Contribution guidelines
- [`LICENSE`](LICENSE) — MIT License

Third-party dependency licenses are bundled in `THIRD_PARTY_NOTICES`.
