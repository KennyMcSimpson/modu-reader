export type TableExportFormat = "csv" | "tsv";

function escapeCsvCell(value: string): string {
  const normalized = value.replace(/\r\n?/g, "\n");
  if (/[",\n]/.test(normalized)) {
    return '"' + normalized.replaceAll('"', '""') + '"';
  }
  return normalized;
}

function escapeTsvCell(value: string): string {
  return value.replace(/\r\n|\r|\n/g, " ").replaceAll("\t", " ");
}

export function serializeTable(rows: string[][], format: TableExportFormat): string {
  return rows
    .map(row => row.map(cell => (format === "csv" ? escapeCsvCell(cell) : escapeTsvCell(cell))).join(format === "csv" ? "," : "\t"))
    .join("\n");
}
