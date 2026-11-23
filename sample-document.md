---
title: "MoDu Reader 2.1 Sample Document"
status: ready
tags: [offline, markdown, windows, living-docs]
---

# Welcome to MoDu Reader 2.1

This sample file demonstrates how MoDu Reader renders living technical and research documentation completely offline.

> [!TIP]
> Edit this file in any external editor while it is open in MoDu Reader — Live Diff-Watch will reload it automatically, keep your scroll position, and highlight which sections changed.

> [!NOTE]
> MoDu Reader is strictly read-only. Opening a repository folder never creates hidden metadata files or alters your source Markdown.

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
  A[Local Repo / AI Agent] -->|Writes .md| B[MoDu Live Watch]
  B --> C[Section Diff Highlights]
  B --> D[Preserved Scroll Position]
```
