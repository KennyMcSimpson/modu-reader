# Public Bilingual Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing offline Markdown reader into a polished public MIT repository with a bilingual UI and bilingual documentation, while retaining the standalone `墨读.html` distribution.

**Architecture:** Keep the current React/Vite source tree and local-only document pipeline. Add a typed, component-local translation dictionary in `reader.tsx`, pass locale-aware copy into `MarkdownDocument`, and persist only UI preferences. Keep repository-level release files separate from application code so the root offline artifact remains usable without Node.js.

**Tech Stack:** React 19, TypeScript, Vite, pnpm, Tailwind CSS 4, Radix UI, Lucide icons, react-markdown, Mermaid, KaTeX, GitHub CLI.

## Global Constraints

- Public repository: `KennyMcSimpson/modu-reader`.
- License: standard MIT license, copyright `KennyMcSimpson`, year `2026`.
- The application remains local-only; no upload, account, analytics, or server storage is added.
- The root `墨读.html` remains a checked-in, directly launchable offline artifact.
- `source/dist/` remains generated and ignored; the checked-in root artifact is not ignored.
- Do not add runtime dependencies for localization or visual styling.
- Do not change supported input formats, encoding behavior, size limits, Markdown parsing, Mermaid, KaTeX, or local image handling.
- Default locale is Chinese for Chinese browser languages and English otherwise; an explicit choice persists in local storage.
- Use `pnpm install --frozen-lockfile`, `pnpm run typecheck`, and `pnpm run build` from `source/` as the required automated checks.

---

### Task 1: Add Public Repository Metadata and Documentation

**Files:**
- Create: `README.md`
- Create: `LICENSE`
- Create: `.gitignore`
- Create: `CONTRIBUTING.md`
- Modify: `使用说明.txt`
- Modify: `source/README.md`
- Modify: `source/package.json`
- Modify: `source/index.html`

**Interfaces:**
- Documentation consumes the current root layout and source commands.
- `source/package.json` produces public repository metadata without changing dependency versions.
- `source/index.html` supplies the bilingual document title and language-neutral HTML metadata.

- [ ] **Step 1: Write the root README.**

  Include paired Chinese and English sections for the product description, offline usage, supported formats, privacy promise, source development, build command, repository layout, third-party notices, and MIT license. Link to `source/README.md`, `使用说明.txt`, `LICENSE`, and `THIRD_PARTY_NOTICES/`. State that the checked-in `墨读.html` can be opened after extracting the repository archive.

- [ ] **Step 2: Add the standard MIT license.**

  Use the complete MIT text with `Copyright (c) 2026 KennyMcSimpson`. Do not shorten the warranty or permission clauses.

- [ ] **Step 3: Add repository hygiene files.**

  Make `.gitignore` ignore `source/node_modules/`, `source/dist/`, `*.tsbuildinfo`, `.sites-runtime/`, `.env`, `.env.*`, and editor/OS metadata. Do not ignore the root `墨读.html`, sample document, third-party notices, or source lockfile. Make `CONTRIBUTING.md` bilingual and describe issue reports, local validation, and the local-only privacy boundary.

- [ ] **Step 4: Rewrite the two existing guides bilingually.**

  Keep the existing Chinese usage facts intact, then add directly paired English wording. Keep the no-install offline path prominent. In `source/README.md`, document Node.js `>=22.13.0`, pnpm `11.25.0`, frozen install, dev server, typecheck, offline build, and the roles of the main source files.

- [ ] **Step 5: Update package and HTML metadata.**

  Change `private` to `false`, keep the package name `modu-offline-reader`, set `license` to `MIT`, and add:

  ```json
  "description": "A local-first Markdown reader with an offline single-file build.",
  "repository": {"type": "git", "url": "git+https://github.com/KennyMcSimpson/modu-reader.git"},
  "bugs": {"url": "https://github.com/KennyMcSimpson/modu-reader/issues"},
  "homepage": "https://github.com/KennyMcSimpson/modu-reader",
  "keywords": ["markdown", "reader", "offline", "local-first", "react", "vite"]
  ```

  Keep all existing dependency and script versions. Update `source/index.html` with `lang="zh-CN"`, a bilingual title such as `墨读 MoDu Reader · Offline Markdown Reader`, and a short description meta tag.

- [ ] **Step 6: Verify documentation and metadata.**

  Run:

  ```powershell
  rg -n "MIT|KennyMcSimpson|modu-reader|pnpm|offline|离线|双击|local-only|本地" README.md LICENSE CONTRIBUTING.md 使用说明.txt source/README.md source/package.json source/index.html
  git diff --check
  ```

  Expected: each public entry point contains the required repository, license, and offline-use references, and `git diff --check` reports no whitespace errors.

### Task 2: Add the Typed Application Locale Layer

**Files:**
- Modify: `source/components/reader.tsx`
- Modify: `source/components/markdown-document.tsx`

**Interfaces:**
- `reader.tsx` owns `Locale`, the translation dictionary, locale selection, and persisted UI language.
- `MarkdownDocument` accepts `locale: Locale` and uses it only for renderer-owned UI text; Markdown document content remains unchanged.

- [ ] **Step 1: Define the locale contract and dictionaries.**

  Add `type Locale = "zh" | "en"`, a `LocaleCopy` type, and two complete dictionaries with fields for branding, file actions, document sections, read/source tabs, settings, themes, fonts, widths, table of contents, progress, paste dialog, empty states, drop overlay, toasts, copy buttons, image fallback, Mermaid states, and accessible labels. Use functions for dynamic strings such as filenames, counts, minutes, and percentages.

- [ ] **Step 2: Add locale initialization and persistence.**

  Add `const localeStorageKey = "modu-locale"`, a `getInitialLocale()` helper that reads only valid stored values and otherwise checks `navigator.language`, and a `locale` state initialized from that helper. Persist the selected locale in a guarded `useEffect`, alongside the existing preference persistence. Add `const copy = copies[locale]` so JSX reads one active dictionary.

- [ ] **Step 3: Add the language switch control.**

  Add a compact `LocaleSwitch` control with `中` and `EN` options, active state, `aria-label`, and tooltip labels. Place it in the sidebar footer beside the theme controls, give it a stable class name, and update only locale state on click. The active document, scroll positions, theme, reading settings, and focus mode must remain untouched.

- [ ] **Step 4: Replace reader-owned literal copy.**

  Replace all visible reader literals and reader-owned `aria-label`, `title`, toast, placeholder, dialog, settings, empty-state, progress, and drop-overlay strings with `copy` lookups. Keep user document names, Markdown content, code language labels, and source text untouched. Preserve the existing document IDs and event handlers.

- [ ] **Step 5: Pass locale to Markdown rendering.**

  Change `MarkdownDocument` props to include `locale: Locale` and pass it from `ReaderApp`. Translate only renderer-owned strings: copy button labels, failed-copy toast, missing-image fallback, Mermaid loading/error/source labels, and diagram alt text. Keep all rendered document text supplied by `content` unchanged.

- [ ] **Step 6: Verify the locale layer statically.**

  Run:

  ```powershell
  rg -n "[\u4e00-\u9fff]|READING GUIDE|MARKDOWN READER|复制|打开文件|Paste|Open file|Copy" source/components/reader.tsx source/components/markdown-document.tsx
  pnpm run typecheck
  ```

  Expected: remaining Chinese or English literals are either dictionary entries, document-derived content, code-language labels, or intentional brand text; TypeScript exits with code 0.

### Task 3: Refine the Reader Visual System for Bilingual Copy

**Files:**
- Modify: `source/app/globals.css`
- Modify: `source/components/reader.tsx`
- Modify: `source/index.html`
- Modify: `source/public/favicon.svg`

**Interfaces:**
- CSS consumes stable class names from the locale switch and bilingual brand lockup.
- The reader layout continues to use the existing sidebar, topbar, content column, table of contents, and status footer.

- [ ] **Step 1: Add bilingual brand structure and locale classes.**

  Render the brand name as `墨读` with a secondary `MoDu Reader` line and a short bilingual descriptor. Render locale controls using `.locale-switch`, `.locale-option`, and `.locale-option.is-active` classes. Keep all controls keyboard focusable and use the existing icon/button conventions.

- [ ] **Step 2: Tune stable dimensions and spacing.**

  Update the existing brand, topbar, reading-tools, footer, and settings rules so longer English labels do not force unexpected width changes. Use fixed/minimum dimensions for icon buttons, locale options, progress bar, and toolbar groups. Preserve the existing palette, light/dark variables, border radii at or below the current design, and reduced-motion rule.

- [ ] **Step 3: Improve narrow-screen behavior.**

  Add responsive rules for the locale switch, brand subtitle, view tabs, toolbar, and reading status. At narrow widths, the switch may show only its two short locale labels, but it must remain visible and readable. Ensure translated text wraps inside its parent instead of overlapping the filename, settings trigger, or theme controls.

- [ ] **Step 4: Update browser-facing branding.**

  Keep the favicon as a simple existing local SVG asset, but align its label/title metadata with `墨读 MoDu Reader`. Do not introduce remote fonts, remote images, or network-required assets.

- [ ] **Step 5: Verify visual source constraints.**

  Run:

  ```powershell
  rg -n "locale-switch|locale-option|brand|topbar|reading-tools|@media|prefers-reduced-motion" source/app/globals.css source/components/reader.tsx
  git diff --check
  ```

  Expected: every new class has a matching rule, the responsive rules are present, and no whitespace errors are reported.

### Task 4: Rebuild the Offline Distribution and Align Samples

**Files:**
- Modify: `source/lib/demo.ts`
- Modify: root `墨读.html`

**Interfaces:**
- `source/lib/demo.ts` continues to export `welcome` and `formatGuide` as Markdown strings.
- `source/scripts/build-offline.mjs` continues to produce `source/dist/墨读.html`; the root artifact is updated from that build output.

- [ ] **Step 1: Add concise bilingual sample headings and guidance.**

  Keep the current sample content and demonstrations, but add English subtitles or paired lines where a first-time English reader needs context. Do not change code, formula, Mermaid, table, or checklist semantics used to exercise renderer features.

- [ ] **Step 2: Install and build from the locked dependency graph.**

  Run from `source/`:

  ```powershell
  pnpm install --frozen-lockfile
  pnpm run build
  ```

  Expected: the build exits with code 0 and writes a non-empty `source/dist/墨读.html`.

- [ ] **Step 3: Replace the root offline artifact.**

  After confirming the generated file exists and is inside the project, copy `source/dist/墨读.html` to the root `墨读.html`. Do not copy `node_modules/` or `source/dist/` into Git tracking.

- [ ] **Step 4: Verify the artifact boundary.**

  Run:

  ```powershell
  Get-Item 墨读.html, source/dist/墨读.html | Select-Object FullName,Length
  rg -n "墨读|MoDu|modu-locale|English|中文" 墨读.html | Select-Object -First 20
  git status --short --ignored
  ```

  Expected: both HTML files are non-empty and contain the new locale strings; `source/node_modules/` and `source/dist/` are ignored, not staged.

### Task 5: Run Browser Smoke Checks and Review the Release Diff

**Files:**
- No new source files; inspect the complete repository diff and generated artifact.

**Interfaces:**
- The development server exposes the Vite reader at a local URL.
- Browser checks exercise locale switching, persistence, layout, and existing reader controls.

- [ ] **Step 1: Run typecheck and the complete offline build again.**

  Run:

  ```powershell
  pnpm run typecheck
  pnpm run build
  ```

  Expected: both commands exit 0 after the final source state.

- [ ] **Step 2: Start the development server.**

  Run `pnpm run dev -- --host 127.0.0.1` from `source/` and record the reported local URL. Keep the process running only for the browser smoke check, then stop it using its own process/session.

- [ ] **Step 3: Check desktop reader behavior.**

  Open the local URL and verify the welcome document renders, switch `中` to `EN`, confirm the active document and reading position remain, open reader settings, switch theme, switch to source view, open the table of contents, and return to read view. Confirm all visible controls and toasts use English after switching.

- [ ] **Step 4: Check locale persistence and mobile layout.**

  Reload in English and confirm English remains selected. Inspect a narrow viewport and verify the brand, locale switch, view tabs, settings trigger, filename, and status footer do not overlap or clip. Switch back to Chinese and confirm the same controls remain usable.

- [ ] **Step 5: Review tracked-file boundaries.**

  Run:

  ```powershell
  git diff --check
  git status --short
  git diff --stat
  git ls-files | rg "(^|/)(node_modules|dist)/|\.env|package-lock|yarn.lock"
  ```

  Expected: no whitespace errors, no dependency/build/environment files are tracked, and the diff contains only the planned source, docs, metadata, license, sample, and root-artifact changes.

### Task 6: Commit and Publish the Public Repository

**Files:**
- Modify Git history and create the remote repository `KennyMcSimpson/modu-reader`.

**Interfaces:**
- Local `main` branch contains the verified release.
- GitHub CLI is authenticated as `KennyMcSimpson` and creates a public repository with MIT metadata.

- [ ] **Step 1: Stage and review the final release.**

  Run:

  ```powershell
  git add .
  git diff --cached --check
  git diff --cached --stat
  git status --short
  ```

  Expected: only intended release files are staged and the staged diff has no whitespace errors.

- [ ] **Step 2: Create the release commit.**

  Run `git commit -m "feat: publish bilingual offline reader"` and verify `git log -1 --oneline` shows the new commit.

- [ ] **Step 3: Create and push the public GitHub repository.**

  Run:

  ```powershell
  gh repo create KennyMcSimpson/modu-reader --public --source=. --remote=origin --description "A local-first bilingual Markdown reader with an offline single-file build." --disable-issues=false --license MIT --push
  ```

  If GitHub reports that the repository was created but the push was not completed, inspect `git remote -v` and run `git push -u origin main` once; do not recreate the repository.

- [ ] **Step 4: Verify the remote release.**

  Run:

  ```powershell
  gh repo view KennyMcSimpson/modu-reader --json name,visibility,defaultBranchRef,url,licenseInfo,description
  git ls-remote --heads origin main
  ```

 Expected: visibility is `PUBLIC`, the default branch is `main`, the repository URL is the new public URL, the MIT license is visible, and the remote `main` ref resolves to the local release commit.
