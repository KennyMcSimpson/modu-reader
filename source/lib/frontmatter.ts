export type FrontmatterEntry = {
  key: string;
  value: string;
};

export type FrontmatterResult = {
  metadata: FrontmatterEntry[];
  body: string;
};

function stripQuotes(raw: string): string {
  const s = raw.trim();
  if (s.length >= 2 && ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")))) {
    return s.slice(1, -1);
  }
  return s;
}

// Parses a leading YAML frontmatter block (`--- ... ---`) without external dependencies.
// Leaves regular horizontal rules (`---`) untouched if no valid key: value entries exist.
export function extractFrontmatter(markdown: string): FrontmatterResult {
  const normalized = markdown.replace(/\r\n?/g, "\n");
  const openMatch = /^---[ \t]*\n/.exec(normalized);
  if (!openMatch) {
    return { metadata: [], body: normalized };
  }
  const restAfterOpen = normalized.slice(openMatch[0].length);
  const closeMatch = /\n---[ \t]*(?:\n|$)/.exec(restAfterOpen);
  if (!closeMatch || closeMatch.index > 16384) {
    return { metadata: [], body: normalized };
  }

  const block = restAfterOpen.slice(0, closeMatch.index);
  const lines = block.split("\n");
  const metadata: FrontmatterEntry[] = [];
  let currentKey = "";
  let listItems: string[] = [];

  const flushList = () => {
    if (currentKey && listItems.length) {
      metadata.push({ key: currentKey, value: listItems.join(", ") });
    }
    currentKey = "";
    listItems = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const listMatch = /^\s*-\s+(.+)$/.exec(line);
    if (listMatch && currentKey) {
      listItems.push(stripQuotes(listMatch[1]));
      continue;
    }
    flushList();
    const kv = /^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/.exec(line);
    if (!kv) {
      return { metadata: [], body: normalized };
    }
    const key = kv[1];
    const rest = kv[2].trim();
    if (!rest) {
      currentKey = key;
      listItems = [];
    } else if (rest.startsWith("[") && rest.endsWith("]")) {
      const items = rest.slice(1, -1).split(",").map(part => stripQuotes(part)).filter(Boolean);
      metadata.push({ key, value: items.join(", ") });
    } else {
      metadata.push({ key, value: stripQuotes(rest) });
    }
  }
  flushList();

  if (!metadata.length) {
    return { metadata: [], body: normalized };
  }
  const bodyStart = openMatch[0].length + closeMatch.index + closeMatch[0].length;
  return { metadata, body: normalized.slice(bodyStart).replace(/^\n+/, "") };
}
