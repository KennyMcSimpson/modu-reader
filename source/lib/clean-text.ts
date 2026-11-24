export type CleanTextMode = "markdown" | "plain";

const BLOCK_TAGS = new Set([
  "P",
  "DIV",
  "LI",
  "TR",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "BLOCKQUOTE",
  "PRE",
  "DT",
  "DD",
  "UL",
  "OL",
  "TABLE",
  "THEAD",
  "TBODY",
  "TFOOT",
  "SECTION",
  "ARTICLE",
  "HR",
]);

const CELL_TAGS = new Set(["TD", "TH"]);

export function formatKatexMarkdown(tex: string, display = false): string {
  const cleaned = tex.trim();
  if (!cleaned) return "";
  return display ? `$$${cleaned}$$` : `$${cleaned}$`;
}

// Extracts clean text from a DOM node or DocumentFragment without KaTeX MathML/HTML duplication.
// - "markdown": replaces each .katex/.katex-display node with $tex$ / $$tex$$ from its annotation.
// - "plain": strips hidden .katex-mathml and injected .katex-copy-tex controls, preserving visible text.
export function extractCleanText(node: Node, mode: CleanTextMode = "plain"): string {
  if (node.nodeType === 3) {
    return node.textContent || "";
  }
  const owner = node.ownerDocument || (typeof document !== "undefined" ? document : null);
  if (!owner) {
    return node.textContent || "";
  }

  const wrapper = owner.createElement("div");
  wrapper.appendChild(node.cloneNode(true));

  // Always drop injected raw-TeX copy buttons so "TeX" never leaks into tables, TOC, or citations.
  wrapper.querySelectorAll(".katex-copy-tex").forEach(btn => btn.remove());

  // Process display math blocks first because each .katex-display wraps an inner .katex element.
  const displayBlocks = [...wrapper.querySelectorAll(".katex-display")];
  for (const block of displayBlocks) {
    if (!wrapper.contains(block)) continue;
    if (mode === "markdown") {
      const tex = block.querySelector('annotation[encoding="application/x-tex"]')?.textContent || "";
      const formatted = formatKatexMarkdown(tex, true);
      if (formatted) {
        block.replaceWith(owner.createTextNode(formatted));
        continue;
      }
    }
    block.querySelectorAll(".katex-mathml").forEach(el => el.remove());
  }

  // Process remaining inline .katex elements.
  const inlineBlocks = [...wrapper.querySelectorAll(".katex")];
  for (const block of inlineBlocks) {
    if (!wrapper.contains(block)) continue;
    if (mode === "markdown") {
      const tex = block.querySelector('annotation[encoding="application/x-tex"]')?.textContent || "";
      const formatted = formatKatexMarkdown(tex, false);
      if (formatted) {
        block.replaceWith(owner.createTextNode(formatted));
        continue;
      }
    }
    block.querySelectorAll(".katex-mathml").forEach(el => el.remove());
  }

  // Defensive cleanup for partial selections that start/end inside a KaTeX element.
  wrapper.querySelectorAll(".katex-mathml").forEach(el => el.remove());

  // Preserve explicit line breaks from <br>.
  wrapper.querySelectorAll("br").forEach(br => br.replaceWith(owner.createTextNode("\n")));

  // For multi-block fragments (e.g. Range.cloneContents() across lists, quotes, tables, or paragraphs),
  // recursively serialize block boundaries with newlines and table cells with tabs.
  if (node.nodeType === 11) {
    const parts: string[] = [];
    let pendingNewline = false;

    const emitText = (t: string) => {
      if (!t) return;
      if (pendingNewline && parts.length > 0 && !parts[parts.length - 1].endsWith("\n") && !t.startsWith("\n")) {
        parts.push("\n");
      }
      pendingNewline = false;
      parts.push(t);
    };

    const serializeChildren = (container: Element) => {
      let seenCellInRow = false;
      for (const child of [...container.childNodes]) {
        if (child.nodeType === 1 && CELL_TAGS.has((child as Element).tagName.toUpperCase())) {
          if (seenCellInRow) {
            pendingNewline = false;
            parts.push("\t");
          }
          seenCellInRow = true;
        }
        serialize(child);
      }
    };

    const serialize = (current: Node) => {
      if (current.nodeType === 3) {
        const text = current.textContent || "";
        if (!text) return;
        if (/^\s+$/.test(text) && text.includes("\n")) {
          const parentTag = (current.parentElement?.tagName || "").toUpperCase();
          if (parentTag !== "PRE" && parentTag !== "CODE") return;
        }
        emitText(text);
        return;
      }
      if (current.nodeType !== 1) return;
      const el = current as Element;
      const tag = el.tagName.toUpperCase();
      const isBlock = BLOCK_TAGS.has(tag);
      if (isBlock && parts.length > 0) {
        pendingNewline = true;
      }
      const beforeLen = parts.length;
      serializeChildren(el);
      if (isBlock && parts.length > beforeLen) {
        pendingNewline = true;
      }
    };

    serializeChildren(wrapper);
    return parts.join("");
  }

  return wrapper.textContent || "";
}

export type NamedDocRef = {
  id: string;
  name: string;
  path?: string;
};

// Disambiguates duplicate filenames in the Reading list (e.g. docs/README.md vs api/README.md).
export function disambiguateDocLabels(docs: NamedDocRef[]): Record<string, string> {
  const counts = new Map<string, number>();
  for (const d of docs) {
    const key = d.name.toLowerCase();
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const result: Record<string, string> = {};
  const usedLabels = new Map<string, number>();

  for (const d of docs) {
    const key = d.name.toLowerCase();
    if ((counts.get(key) || 0) <= 1 || !d.path) {
      result[d.id] = d.name;
      continue;
    }
    const parts = d.path.replaceAll("\\", "/").split("/").filter(Boolean);
    const candidate = parts.length >= 2 ? `${parts[parts.length - 2]}/${parts[parts.length - 1]}` : d.name;
    result[d.id] = candidate;
    const lower = candidate.toLowerCase();
    usedLabels.set(lower, (usedLabels.get(lower) || 0) + 1);
  }

  // Second pass: if two docs share the same immediate parent (e.g. a/docs/README.md and b/docs/README.md), include grandparent.
  for (const d of docs) {
    if (!d.path) continue;
    const label = result[d.id];
    if ((usedLabels.get(label.toLowerCase()) || 0) <= 1) continue;
    const parts = d.path.replaceAll("\\", "/").split("/").filter(Boolean);
    if (parts.length >= 3) {
      result[d.id] = `${parts[parts.length - 3]}/${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
    }
  }

  return result;
}

// Formats a file path relative to an active folder root (case-insensitive on Windows-style paths).
export function formatRelativeToRoot(filePath: string, folderRoot?: string | null): string | null {
  if (!filePath || !folderRoot) return null;
  const normFile = filePath.replaceAll("\\", "/");
  const normRoot = folderRoot.replaceAll("\\", "/").replace(/\/+$/, "");
  if (!normRoot) return null;
  const prefix = normRoot + "/";
  if (normFile.toLowerCase().startsWith(prefix.toLowerCase())) {
    return normFile.slice(prefix.length) || null;
  }
  return null;
}
