export type MarkdownSection = {
  index: number;
  heading: string;
  body: string;
  signature: string;
};

export type SectionDiff = {
  changedCount: number;
  changedHeadings: string[];
  changedPreviews: string[];
};

function quickHash(text: string): string {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

// Strips a valid leading YAML frontmatter block so `# comments` inside YAML are never mistaken for H1 headings.
function stripLeadingFrontmatter(normalized: string): string {
  const openMatch = /^---[ \t]*\n/.exec(normalized);
  if (!openMatch) return normalized;
  const rest = normalized.slice(openMatch[0].length);
  const closeMatch = /\n---[ \t]*(?:\n|$)/.exec(rest);
  if (!closeMatch || closeMatch.index > 16384) return normalized;
  const block = rest.slice(0, closeMatch.index);
  let hasKey = false;
  for (const line of block.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || /^\s*-\s+/.test(line)) continue;
    if (/^[A-Za-z0-9_.-]+\s*:/.test(line)) { hasKey = true; continue; }
    return normalized;
  }
  if (!hasKey) return normalized;
  return rest.slice(closeMatch.index + closeMatch[0].length);
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

// Splits a Markdown document into heading-scoped sections while respecting fenced code blocks and frontmatter.
export function splitMarkdownSections(markdown: string): MarkdownSection[] {
  const normalized = markdown.replace(/\r\n?/g, "\n");
  const lines = stripLeadingFrontmatter(normalized).split("\n");
  const sections: MarkdownSection[] = [];
  let fenceChar = "";
  let fenceLen = 0;
  let currentHeading = "";
  let buffer: string[] = [];

  const pushSection = () => {
    const body = buffer.join("\n").trim();
    if (!currentHeading && !body) return;
    sections.push({
      index: sections.length,
      heading: currentHeading,
      body,
      signature: quickHash(currentHeading + "\n" + body),
    });
  };

  for (const line of lines) {
    const fenceMatch = /^\s*(`{3,}|~{3,})/.exec(line);
    if (fenceMatch) {
      const marker = fenceMatch[1];
      if (!fenceChar) {
        fenceChar = marker[0];
        fenceLen = marker.length;
      } else if (marker[0] === fenceChar && marker.length >= fenceLen && /^\s*(`+|~+)\s*$/.test(line)) {
        fenceChar = "";
        fenceLen = 0;
      }
      buffer.push(line);
      continue;
    }

    if (!fenceChar) {
      const headingMatch = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
      if (headingMatch) {
        pushSection();
        currentHeading = normalizeHeadingText(headingMatch[2]);
        buffer = [line];
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
    return { changedCount: 0, changedHeadings: [], changedPreviews: [] };
  }
  const prevSections = splitMarkdownSections(prevMarkdown);
  const nextSections = splitMarkdownSections(nextMarkdown);
  const prevCounts = new Map<string, number>();
  for (const sec of prevSections) {
    prevCounts.set(sec.signature, (prevCounts.get(sec.signature) || 0) + 1);
  }

  const changedHeadings: string[] = [];
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
  return { changedCount, changedHeadings, changedPreviews };
}
