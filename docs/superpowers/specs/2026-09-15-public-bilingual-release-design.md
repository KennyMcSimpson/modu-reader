# MoDu Reader Public Bilingual Release Design

**Status:** Approved direction, pending written-spec review
**Date:** 2026-09-15
**Repository:** `KennyMcSimpson/modu-reader`

## Goal

Publish MoDu Reader as a public MIT-licensed repository that is understandable to Chinese and English readers, while preserving the existing offline single-file workflow and Markdown-reading behavior.

## Scope

### In scope

- Create a public GitHub repository named `modu-reader`.
- Preserve `墨读.html` as a directly launchable offline distribution artifact.
- Keep `source/` as the editable React/Vite project and make its package metadata suitable for a public repository.
- Add a bilingual application language switch with persisted preference and browser-language defaulting.
- Translate visible interface copy, transient messages, settings labels, empty states, keyboard hints, and accessibility labels.
- Add bilingual public documentation: root README, offline usage guide, and source-development guide.
- Add MIT `LICENSE`, repository hygiene files, and retain the existing third-party notices.
- Refine the existing reader visual system with clearer brand hierarchy, bilingual supporting copy, a compact language control, consistent spacing, and responsive behavior.
- Verify TypeScript, the offline build, the generated artifact, and representative browser interactions before pushing.

### Out of scope

- No online document storage, account system, analytics, or upload service.
- No GitHub Pages site or hosted reader by default.
- No change to the supported document formats, local-only processing model, Markdown renderer, Mermaid renderer, KaTeX renderer, or file-size limits.
- No replacement of the existing component library or addition of a new UI dependency.

## Repository Layout

The repository root will contain the user-facing offline bundle, sample material, public documentation, source tree, and third-party notices:

```text
modu-reader/
  墨读.html
  示例文档.md
  使用说明.txt
  README.md
  LICENSE
  THIRD_PARTY_NOTICES/
  source/
    package.json
    pnpm-lock.yaml
    app/globals.css
    components/reader.tsx
    components/markdown-document.tsx
    lib/demo.ts
    scripts/build-offline.mjs
  docs/superpowers/specs/
  docs/superpowers/plans/
```

The repository keeps the original distribution layout so a non-developer can download the repository archive, extract it, and open `墨读.html`. The source project remains independently buildable from `source/`.

## Application Design

### Language state

Introduce a small translation layer local to `source/components/reader.tsx`:

- `Locale` is `"zh" | "en"`.
- The initial locale is read from `localStorage` when valid; otherwise use `navigator.language` to select English for non-Chinese browser languages and Chinese for Chinese browser languages.
- Persist the selected locale under a namespaced key alongside the existing reading preferences.
- A `t` lookup function supplies all reader UI copy from one typed dictionary.
- Document content is never translated. User-authored Markdown remains exactly as loaded.

The language control is an icon-plus-text compact control in the sidebar footer or topbar, with `aria-label`, tooltip text, and an active state. The control changes UI copy immediately without resetting the active document, scroll position, theme, or reading settings.

### Copy coverage

The dictionary covers:

- branding and navigation;
- file opening, paste, drag-and-drop, supported formats, and loading states;
- document sections and sample labels;
- read/source view controls;
- reader settings, font choices, page widths, themes, and reset action;
- table of contents, progress, back-to-top, focus mode, and keyboard hints;
- empty states and dialog labels;
- success, info, and error toasts;
- document statistics and privacy copy;
- visible and assistive labels for buttons, inputs, dialogs, and tabs.

Dynamic values such as filenames, counts, sizes, and percentages remain interpolated through translation functions rather than duplicated JSX branches.

### Visual refinement

Retain the existing quiet editorial reader palette and component geometry, then make these bounded refinements:

- present `墨读` with `MoDu Reader` as a bilingual brand lockup;
- use a short bilingual product descriptor in the sidebar instead of an English-only all-caps label;
- style the locale switch as a compact segmented control that remains usable on narrow screens;
- align the topbar controls and reading status around stable dimensions so translations do not shift layout;
- improve mobile toolbar wrapping and label truncation without hiding required actions;
- preserve light, dark, and system themes with accessible focus states and reduced-motion behavior.

No decorative hero, marketing landing page, or extra card layer is introduced. The first screen remains the working reader.

## Documentation and Licensing

- `README.md` presents the project in Chinese and English, with a short product description, screenshots-free usage steps, feature list, privacy statement, source development commands, and license/third-party notice links.
- `使用说明.txt` remains easy to open for existing users and is rewritten with paired Chinese/English sections.
- `source/README.md` documents Node.js and pnpm requirements, development, typecheck, offline build, and file responsibilities in both languages.
- `LICENSE` contains the standard MIT text with copyright holder `KennyMcSimpson` and year `2026`.
- `.gitignore` covers dependencies, generated `source/dist`, local environment files, and tool caches without excluding the checked-in offline bundle.
- `package.json` changes `private` to `false`, uses the public package name `modu-offline-reader`, and adds repository, homepage, bugs, keywords, and license metadata without changing runtime dependencies.
- Existing `THIRD_PARTY_NOTICES/` remains in the repository and is linked from the public documentation.

## Data Flow and Error Handling

The existing local-only data flow remains unchanged:

```text
file picker / drag-drop / paste
  -> local browser File or text handling
  -> in-memory document and asset state
  -> Markdown / math / code / Mermaid rendering
  -> local scroll, progress, and preference state
```

Language selection is UI state only and never touches document bytes. Existing file size, encoding, unsupported-file, invalid-content, and rendering error paths continue to show user-facing feedback through the same toast system, with translated messages. No document or preference is sent to a server.

## Verification Plan

Run from `source/`:

1. `pnpm install --frozen-lockfile`
2. `pnpm run typecheck`
3. `pnpm run build`

Then verify:

- `source/dist/墨读.html` exists and is non-empty after build.
- the root `墨读.html` remains present and opens as a standalone HTML document;
- the development reader can switch between Chinese and English without losing the active document or settings;
- the language preference survives a reload;
- file picker, paste dialog, drag-and-drop overlay, read/source tabs, table of contents, focus mode, theme controls, and settings remain usable in both locales;
- desktop and narrow mobile layouts do not overlap or clip translated controls;
- Git status contains no dependency directory, local environment file, or generated `source/dist` output.

## Release Sequence

1. Apply the scoped source, documentation, licensing, and metadata changes.
2. Run typecheck and offline build.
3. Run a browser smoke check against the development server and inspect desktop/mobile screenshots.
4. Initialize the repository, review the final diff and tracked file list, and create a release commit.
5. Create `KennyMcSimpson/modu-reader` as a public GitHub repository with the MIT license metadata and push the release commit.
6. Verify the remote repository visibility, default branch, tracked license, README, and source/build instructions.

