export type AlertKind = "note" | "tip" | "important" | "warning" | "caution";

export type ParsedAlert = {
  kind: AlertKind;
  label: string;
  remainder: string;
};

const LABELS: Record<AlertKind, string> = {
  note: "Note",
  tip: "Tip",
  important: "Important",
  warning: "Warning",
  caution: "Caution",
};

const PATTERN = /^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:[ \t]*\n|[ \t]+|$)/i;

export function parseGitHubAlert(rawFirstText: string): ParsedAlert | null {
  const match = PATTERN.exec(rawFirstText);
  if (!match) return null;
  const kind = match[1].toLowerCase() as AlertKind;
  return {
    kind,
    label: LABELS[kind],
    remainder: rawFirstText.slice(match[0].length),
  };
}
