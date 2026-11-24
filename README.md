# Inkglass

[![Windows desktop](https://github.com/KennyMcSimpson/Inkglass/actions/workflows/windows-release.yml/badge.svg)](https://github.com/KennyMcSimpson/Inkglass/actions/workflows/windows-release.yml)
[![Latest release](https://img.shields.io/github/v/release/KennyMcSimpson/Inkglass)](https://github.com/KennyMcSimpson/Inkglass/releases/latest)

**The offline Windows Markdown reader built for living AI, research, and repository docs.**

Open any local `.md` file or folder — without creating `.obsidian/` folders, vault indexes, or touching a single byte of your files. When an AI coding agent, build script, or external editor rewrites the file on disk, Inkglass automatically live-reloads it, accumulates a line-level diff against your baseline, highlights which exact sections changed, and keeps your scroll position.

> Formerly known as **MoDu Reader**. On Windows desktop, existing window bounds, recent file paths, live-watch, and pin state (`desktop-state.json`) from `%APPDATA%\MoDu Reader` are imported automatically on first launch without altering your previous folder.

## Why Inkglass Instead of Typora / Obsidian / VS Code Preview?

| Need | Mainstream Tools | Inkglass 2.3 |
| --- | --- | --- |
| Read docs inside a Git repo | Obsidian creates `.obsidian/` vaults; editors risk accidental keystrokes | **Strict Read-Only** — zero repo pollution, zero accidental edits |
| Follow AI agent plans (`PLAN.md`, reports) | Manual `F5` reload or scrolling jumps back to top | **Live Diff-Watch** — accumulates diffs across rapid edits, expandable inline `- / +` line diff drawer, Follow mode, unread dots, and exact section highlights |
| Inspect huge Mermaid diagrams, math & tables | Tiny cramped SVG / garbled KaTeX in table copies | **Zoom/pan lightbox + Copy SVG**, **clean KaTeX-aware CSV / TSV & Citation copy**, **1-click display & `Alt+Click` inline raw LaTeX** |
| Navigate repository docs folders | Broken `../images` in subfolders or missing `[!NOTE]` alerts | **Read-only Folder drawer** (filter, A–Z/Recent sort, refresh), **cross-subdirectory relative images**, **directory `README.md` & extensionless `.md` links**, **`Ctrl+K` Quick Jump** |
| Privacy & offline reliability | Accounts, telemetry, or remote CDN fonts | **100% offline bundled** (KaTeX, Mermaid, Highlight.js), sandboxed Electron renderer, zero telemetry |

## Download (Windows 10 / 11 x64)

**[Download latest release](https://github.com/KennyMcSimpson/Inkglass/releases/latest)**

| Package | How to use |
| --- | --- |
| [Portable ZIP](https://github.com/KennyMcSimpson/Inkglass/releases/latest/download/Inkglass-2.3.0-Windows-x64.zip) | Extract the full archive and run `Inkglass.exe`. Keep neighboring files beside the EXE. |
| [Windows Installer](https://github.com/KennyMcSimpson/Inkglass/releases/latest/download/Inkglass-2.3.0-Setup-x64.exe) | Per-user installer with Start Menu / Desktop shortcut and Windows **Open with** registration. |

> [!NOTE]
> GitHub's **Code → Download ZIP** contains source code, not the compiled Windows application. Release binaries are currently unsigned; Windows SmartScreen may show an unknown-publisher prompt. Verify every download against `SHA256SUMS.txt`.

## Features

- **Upgraded Live Diff-Watch (`Radio` toggle)**: Watches opened local files for external changes (including atomic-rename editor saves and manual `F5` reloads), accumulates changes against your baseline until dismissed, shows `+N / -M lines · K sections changed`, opens a collapsible line-level `- / +` **Show diff** drawer, offers **Follow** mode to auto-scroll to incoming edits, marks duplicate heading titles unambiguously by section index, and shows unread dots on updated background documents.
- **Read-Only Folder Drawer (`Ctrl+Shift+O`) & Smart Repository Links**: Filter folder files live, sort `A–Z` or `Recent`, refresh or close the folder drawer, resolve cross-subdirectory relative images (`../images/fig.png`) safely within the folder boundary, follow directory links (`./docs/` → `README.md`) and extensionless links (`./guide` → `guide.md`), and step Back / Forward (`Alt+Left` / `Alt+Right`) across both linked documents and same-document `#anchor` jumps.
- **`Ctrl+K` Quick Jump & Enhanced Find (`Ctrl+F`)**: Fuzzy-jump across current document headings, open documents, folder files, and recent files. In-document Find avoids phantom cross-block matches, preserves your match position across live updates and lazy diagram renders, supports **Match Case (`Aa`)**, **Whole Word (`\b`)**, `F3` / `Shift+F3`, selection seeding, and horizontal scrolling inside wide code blocks and tables.
- **Clean Technical Reading Tools**:
  - **KaTeX-Clean Extraction**: Tables with math export clean `$...$` in CSV/TSV; headings with math render cleanly in the TOC; citations extract clean Markdown LaTeX; hover display equations to copy raw `TeX` or `Alt+Click` any inline equation.
  - **Mermaid & Image Lightbox**: Click any diagram or image to zoom (`+`/`-`/wheel) and pan, or copy sanitized SVG straight to the clipboard.
  - **Quote with Citation (`Ctrl+Shift+C`)**: Copies your selected passage (or active heading) as a formatted Markdown blockquote with filename and section reference.
- **Read / Split / Source Modes**: Heading-aligned scroll sync in **Split** view, accessible TOC popover in Split view, persistent Source mode across tab switches, duplicate filename disambiguation, and 1-click Copy Path in the breadcrumb.
- **Native YAML Frontmatter & GitHub Alerts**: Renders leading `---` metadata blocks as collapsible cards and styles `[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, and `[!CAUTION]` callouts natively.
- **Crisp PDF Export (`Ctrl+P`) & Always-on-Top Pin (`Ctrl+Shift+T`)**: Forces light-paper print colors even in dark mode, eagerly decodes lazy images and off-screen Mermaid diagrams before export, avoids orphaned headings, and repeats table headers across pages.
- **Local Security Boundaries**: Sandboxed renderer (`contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`), strict document/folder symlink & Windows junction escape checks, 2 MB document cap, 20 MB local image cap, UTF-8 / UTF-16 BOM / GB18030 decoding, and zero remote requests for local content.

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl+O` | Open Markdown files |
| `Ctrl+Shift+O` | Open folder (read-only) |
| `Ctrl+K` | Quick Jump (headings, open docs, folder, recent) |
| `Ctrl+Shift+V` | Paste Markdown text |
| `Ctrl+F` | Find in document (`F3` / `Shift+F3` next/previous) |
| `Ctrl+Shift+C` | Copy quote with citation |
| `Alt+Click` (inline math) | Copy raw LaTeX expression |
| `F5` | Manually reload current file |
| `Ctrl+P` | Export PDF |
| `Ctrl+Shift+T` | Toggle Always on Top |
| `Ctrl+Shift+F` | Toggle Focus Mode (`Esc` exits) |
| `Alt+Left` / `Alt+Right` | Navigate Back / Forward across linked docs & `#anchor` jumps |
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
- [`docs/releases/v2.3.0.md`](docs/releases/v2.3.0.md) — v2.3.0 release notes
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — Contribution guidelines
- [`LICENSE`](LICENSE) — MIT License

Third-party dependency licenses are bundled in `THIRD_PARTY_NOTICES`.
