export function formatMarkdownCitation(quote: string, docName: string, heading?: string): string {
  const cleaned = quote.replace(/\r\n?/g, "\n").trim();
  if (!cleaned) return "";
  const quoted = cleaned
    .split("\n")
    .map(line => `> ${line}`.trimEnd())
    .join("\n");
  const source = heading ? `${docName} (§ ${heading})` : docName;
  return `${quoted}\n>\n> — ${source}`;
}
