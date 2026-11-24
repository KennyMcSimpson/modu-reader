---
title: "Inkglass 2.2 Sample Document"
status: ready
tags: [offline, markdown, windows, living-docs]
---

# Welcome to Inkglass 2.2

This sample file demonstrates how Inkglass renders living technical and research documentation completely offline.

> [!TIP]
> Edit this file in any external editor while it is open in Inkglass — Live Diff-Watch will reload it automatically, keep your scroll position, and highlight which sections changed.

> [!NOTE]
> Inkglass is strictly read-only. Opening a repository folder never creates hidden metadata files or alters your source Markdown.

## Technical Tables (Hover to Copy CSV / TSV)

| Feature | Shortcut | Behavior |
| --- | --- | --- |
| Open Documents | `Ctrl+O` | Native Windows file dialog |
| Open Folder (Read-Only) | `Ctrl+Shift+O` | Bounded tree browser (depth 4 / 300 files) |
| Export PDF | `Ctrl+P` | Print-styled clean PDF |
| Always on Top | `Ctrl+Shift+T` | Floating reference window |

## Bundled Math (Hover Display Math to Copy TeX)

Inline math renders natively: $E = mc^2$.

$$
\mathcal{L}(\theta) = -\frac{1}{N} \sum_{i=1}^{N} \log p_\theta(y_i \mid x_i)
$$

## Bundled Mermaid Diagrams (Click to Zoom & Copy SVG)

```mermaid
graph LR
  A[Local Repo / AI Agent] -->|Writes .md| B[Inkglass Live Watch]
  B --> C[Section Diff Highlights]
  B --> D[Preserved Scroll Position]
```
