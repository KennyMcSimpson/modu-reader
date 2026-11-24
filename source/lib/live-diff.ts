export type MarkdownSection = {
  index: number;
  headingIndex: number;
  heading: string;
  body: string;
  signature: string;
};

export type SectionDiff = {
  changedCount: number;
  changedHeadings: string[];
  changedSectionIndices: number[];
  changedPreviews: string[];
};

export type DiffLine = {
  kind: "add" | "del" | "ctx";
  text: string;
};

export type LineDiffResult = {
  addedLines: number;
  removedLines: number;
  hunks: DiffLine[];
  truncated: boolean;
  appendedAtEof: boolean;
};

export type HeadingLine = {
  index: number;
  level: number;
  title: string;
  line: number;
};

function quickHash(text: string): string {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

// Returns the body after a valid leading YAML frontmatter block along with how many lines were skipped.
function stripLeadingFrontmatterInfo(normalized: string): { body: string; skippedLines: number } {
  const openMatch = /^---[ \t]*\n/.exec(normalized);
  if (!openMatch) return { body: normalized, skippedLines: 0 };
  const rest = normalized.slice(openMatch[0].length);
  const closeMatch = /\n---[ \t]*(?:\n|$)/.exec(rest);
  if (!closeMatch || closeMatch.index > 16384) return { body: normalized, skippedLines: 0 };
  const block = rest.slice(0, closeMatch.index);
  let hasKey = false;
  for (const line of block.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || /^\s*-\s+/.test(line)) continue;
    if (/^[A-Za-z0-9_.-]+\s*:/.test(line)) {
      hasKey = true;
      continue;
    }
    return { body: normalized, skippedLines: 0 };
  }
  if (!hasKey) return { body: normalized, skippedLines: 0 };
  const consumed = openMatch[0].length + closeMatch.index + closeMatch[0].length;
  const skippedLines = normalized.slice(0, consumed).split("\n").length - 1;
  return { body: normalized.slice(consumed), skippedLines };
}

// Normalizes inline Markdown syntax in headings so `## \`API\` **Changes**` matches rendered text `API Changes`.
export function normalizeHeadingText(raw: string): string {
  return raw
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/(\*\*|__|~~)(.*?)\1/g, "$2")
    .replace(/(^|[^\w])(\*|_)(.*?)\2(?=[^\w]|$)/g, "$1$3")
    .replace(/\\([\\`*_{}[\]()#+\-.!>])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

// Detects a CommonMark ATX heading (0-3 leading spaces) and extracts level + normalized title.
function matchAtxHeading(line: string): { level: number; title: string } | null {
  const match = /^ {0,3}(#{1,6})(?:[ \t]+(.*))?$/.exec(line);
  if (!match) return null;
  const raw = (match[2] || "").replace(/[ \t]+$/, "").replace(/(?:^|[ \t])#+$/, "").trim();
  return { level: match[1].length, title: normalizeHeadingText(raw) };
}

// Detects a CommonMark Setext heading where `line` is a paragraph line and `nextLine` is `===` or `---`.
function matchSetextHeading(line: string, nextLine: string | undefined): { level: number; title: string } | null {
  if (nextLine === undefined) return null;
  const underline = /^ {0,3}(=+|-+)[ \t]*$/.exec(nextLine);
  if (!underline) return null;
  if (!line.trim()) return null;
  if (/^(?: {4}|\t)/.test(line)) return null;
  if (/^ {0,3}>/.test(line)) return null;
  if (/^ {0,3}(?:[-+*]|\d{1,9}[.)])(?:[ \t]+|$)/.test(line)) return null;
  if (/^ {0,3}#{1,6}(?:[ \t]|$)/.test(line)) return null;
  if (/^ {0,3}(?:`{3,}|~{3,})/.test(line)) return null;
  if (/^ {0,3}(?:(\*[ \t]*){3,}|(-[ \t]*){3,}|(_[ \t]*){3,})$/.test(line)) return null;
  if (/^ {0,3}<\/?[A-Za-z]/.test(line)) return null;
  return {
    level: underline[1][0] === "=" ? 1 : 2,
    title: normalizeHeadingText(line.trim()),
  };
}

// Splits a Markdown document into heading-scoped sections while respecting fenced code blocks and frontmatter.
export function splitMarkdownSections(markdown: string): MarkdownSection[] {
  const normalized = markdown.replace(/\r\n?/g, "\n");
  const lines = stripLeadingFrontmatterInfo(normalized).body.split("\n");
  const sections: MarkdownSection[] = [];
  let fenceChar = "";
  let fenceLen = 0;
  let currentHeading = "";
  let currentHeadingIndex = -1;
  let nextHeadingIndex = 0;
  let buffer: string[] = [];

  const pushSection = () => {
    const body = buffer.join("\n").trim();
    if (!currentHeading && !body) return;
    sections.push({
      index: sections.length,
      headingIndex: currentHeadingIndex,
      heading: currentHeading,
      body,
      signature: quickHash(currentHeading + "\n" + body),
    });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fenceMatch = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (fenceMatch) {
      const marker = fenceMatch[1];
      if (!fenceChar) {
        fenceChar = marker[0];
        fenceLen = marker.length;
      } else if (marker[0] === fenceChar && marker.length >= fenceLen && /^ {0,3}(`+|~+)[ \t]*$/.test(line)) {
        fenceChar = "";
        fenceLen = 0;
      }
      buffer.push(line);
      continue;
    }

    if (!fenceChar) {
      const atx = matchAtxHeading(line);
      if (atx) {
        pushSection();
        currentHeading = atx.title;
        currentHeadingIndex = nextHeadingIndex++;
        buffer = [line];
        continue;
      }
      const setext = matchSetextHeading(line, lines[i + 1]);
      if (setext) {
        pushSection();
        currentHeading = setext.title;
        currentHeadingIndex = nextHeadingIndex++;
        buffer = [line, lines[i + 1]];
        i++;
        continue;
      }
    }
    buffer.push(line);
  }
  pushSection();
  return sections;
}

export function diffDocumentSections(prevMarkdown: string, nextMarkdown: string): SectionDiff {
  if (prevMarkdown === nextMarkdown) {
    return { changedCount: 0, changedHeadings: [], changedSectionIndices: [], changedPreviews: [] };
  }
  const prevSections = splitMarkdownSections(prevMarkdown);
  const nextSections = splitMarkdownSections(nextMarkdown);
  const prevCounts = new Map<string, number>();
  for (const sec of prevSections) {
    prevCounts.set(sec.signature, (prevCounts.get(sec.signature) || 0) + 1);
  }

  const changedHeadings: string[] = [];
  const changedSectionIndices: number[] = [];
  const changedPreviews: string[] = [];
  const seenHeadings = new Set<string>();
  let changedCount = 0;

  for (const sec of nextSections) {
    const remaining = prevCounts.get(sec.signature) || 0;
    if (remaining > 0) {
      prevCounts.set(sec.signature, remaining - 1);
      continue;
    }
    changedCount += 1;
    if (sec.headingIndex >= 0) {
      changedSectionIndices.push(sec.headingIndex);
    }
    if (sec.heading && !seenHeadings.has(sec.heading)) {
      seenHeadings.add(sec.heading);
      changedHeadings.push(sec.heading);
    }
    const preview = (sec.heading || sec.body.split("\n").find(l => l.trim()) || "Updated section").slice(0, 80);
    if (changedPreviews.length < 5) changedPreviews.push(preview);
  }

  if (changedCount === 0 && prevSections.length !== nextSections.length) {
    changedCount = Math.abs(nextSections.length - prevSections.length);
  }
  return { changedCount, changedHeadings, changedSectionIndices, changedPreviews };
}

const MAX_DISPLAY_HUNK_LINES = 200;
const CONTEXT_LINES = 2;
const MAX_DP_CELLS = 360_000;

// Zero-dependency line-level diff with prefix/suffix trimming and graceful caps for large documents.
export function computeLineDiff(prevMarkdown: string, nextMarkdown: string, maxLines = 1200): LineDiffResult {
  const prev = prevMarkdown.replace(/\r\n?/g, "\n");
  const next = nextMarkdown.replace(/\r\n?/g, "\n");
  if (prev === next) {
    return { addedLines: 0, removedLines: 0, hunks: [], truncated: false, appendedAtEof: false };
  }

  const prevLines = prev.length ? prev.split("\n") : [];
  const nextLines = next.length ? next.split("\n") : [];

  let prefix = 0;
  const minLen = Math.min(prevLines.length, nextLines.length);
  while (prefix < minLen && prevLines[prefix] === nextLines[prefix]) {
    prefix++;
  }

  let suffix = 0;
  while (
    suffix < minLen - prefix &&
    prevLines[prevLines.length - 1 - suffix] === nextLines[nextLines.length - 1 - suffix]
  ) {
    suffix++;
  }

  const a = prevLines.slice(prefix, prevLines.length - suffix);
  const b = nextLines.slice(prefix, nextLines.length - suffix);
  const suffixAllBlank = suffix > 0 && prevLines.slice(prevLines.length - suffix).every(l => l === "");
  const appendedAtEof = (suffix === 0 || suffixAllBlank) && a.length === 0 && b.length > 0;

  let ops: DiffLine[] = [];
  let addedLines = 0;
  let removedLines = 0;
  let truncated = false;

  if (a.length === 0) {
    addedLines = b.length;
    ops = b.map(text => ({ kind: "add" as const, text }));
  } else if (b.length === 0) {
    removedLines = a.length;
    ops = a.map(text => ({ kind: "del" as const, text }));
  } else if (a.length + b.length > maxLines || a.length * b.length > MAX_DP_CELLS) {
    // Graceful linear-time cap so massive rewrites never block the renderer thread.
    truncated = true;
    const prevFreq = new Map<string, number>();
    for (const line of a) prevFreq.set(line, (prevFreq.get(line) || 0) + 1);
    let common = 0;
    for (const line of b) {
      const c = prevFreq.get(line) || 0;
      if (c > 0) {
        prevFreq.set(line, c - 1);
        common++;
      }
    }
    removedLines = a.length - common;
    addedLines = b.length - common;
    const sampleEach = Math.max(10, Math.floor(MAX_DISPLAY_HUNK_LINES / 2) - 4);
    for (const line of a.slice(0, sampleEach)) ops.push({ kind: "del", text: line });
    for (const line of b.slice(0, sampleEach)) ops.push({ kind: "add", text: line });
  } else {
    // Exact LCS DP over the trimmed differing slice.
    const n = a.length;
    const m = b.length;
    const cols = m + 1;
    const dp = new Int32Array((n + 1) * cols);

    for (let i = n - 1; i >= 0; i--) {
      const rowOffset = i * cols;
      const nextRowOffset = (i + 1) * cols;
      for (let j = m - 1; j >= 0; j--) {
        if (a[i] === b[j]) {
          dp[rowOffset + j] = dp[nextRowOffset + j + 1] + 1;
        } else {
          const down = dp[nextRowOffset + j];
          const right = dp[rowOffset + j + 1];
          dp[rowOffset + j] = down >= right ? down : right;
        }
      }
    }

    let i = 0;
    let j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && a[i] === b[j]) {
        ops.push({ kind: "ctx", text: a[i] });
        i++;
        j++;
      } else if (i < n && (j === m || dp[(i + 1) * cols + j] >= dp[i * cols + j + 1])) {
        ops.push({ kind: "del", text: a[i] });
        removedLines++;
        i++;
      } else {
        ops.push({ kind: "add", text: b[j] });
        addedLines++;
        j++;
      }
    }
  }

  // Build compact hunks with bounded context lines around edits.
  const leadingCtx: DiffLine[] = prevLines
    .slice(Math.max(0, prefix - CONTEXT_LINES), prefix)
    .map(text => ({ kind: "ctx", text }));
  const trailingCtx: DiffLine[] = prevLines
    .slice(prevLines.length - suffix, Math.min(prevLines.length, prevLines.length - suffix + CONTEXT_LINES))
    .map(text => ({ kind: "ctx", text }));

  const compact: DiffLine[] = [...leadingCtx];
  let ctxRun: DiffLine[] = [];
  for (const op of ops) {
    if (op.kind === "ctx") {
      ctxRun.push(op);
      continue;
    }
    if (ctxRun.length > CONTEXT_LINES * 2) {
      compact.push(...ctxRun.slice(0, CONTEXT_LINES), { kind: "ctx", text: "…" }, ...ctxRun.slice(-CONTEXT_LINES));
    } else if (ctxRun.length > 0) {
      compact.push(...ctxRun);
    }
    ctxRun = [];
    compact.push(op);
  }
  if (ctxRun.length > 0) {
    compact.push(...ctxRun.slice(0, CONTEXT_LINES));
  }
  compact.push(...trailingCtx);

  let hunks = compact;
  if (hunks.length > MAX_DISPLAY_HUNK_LINES) {
    hunks = hunks.slice(0, MAX_DISPLAY_HUNK_LINES);
    truncated = true;
  }

  return { addedLines, removedLines, hunks, truncated, appendedAtEof };
}

// Extracts 0-based raw source line indices for all top-level headings (respecting frontmatter & code fences).
export function extractHeadingLines(markdown: string): { headings: HeadingLine[]; totalLines: number } {
  const normalized = markdown.replace(/\r\n?/g, "\n");
  const allLines = normalized.split("\n");
  const { body, skippedLines } = stripLeadingFrontmatterInfo(normalized);
  const bodyLines = body.split("\n");
  const headings: HeadingLine[] = [];
  let fenceChar = "";
  let fenceLen = 0;

  for (let i = 0; i < bodyLines.length; i++) {
    const line = bodyLines[i];
    const fenceMatch = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (fenceMatch) {
      const marker = fenceMatch[1];
      if (!fenceChar) {
        fenceChar = marker[0];
        fenceLen = marker.length;
      } else if (marker[0] === fenceChar && marker.length >= fenceLen && /^ {0,3}(`+|~+)[ \t]*$/.test(line)) {
        fenceChar = "";
        fenceLen = 0;
      }
      continue;
    }
    if (!fenceChar) {
      const atx = matchAtxHeading(line);
      if (atx) {
        headings.push({
          index: headings.length,
          level: atx.level,
          title: atx.title,
          line: skippedLines + i,
        });
        continue;
      }
      const setext = matchSetextHeading(line, bodyLines[i + 1]);
      if (setext) {
        headings.push({
          index: headings.length,
          level: setext.level,
          title: setext.title,
          line: skippedLines + i,
        });
        i++;
      }
    }
  }

  return { headings, totalLines: allLines.length };
}
