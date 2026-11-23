// Client-side CSV export of data the board already fetched (no extra request).

type Cell = string | number | boolean | null | undefined;

export interface Column<T> {
  header: string;
  value: (row: T) => Cell;
}

// RFC 4180 quoting. Text that a spreadsheet would read as a formula
// (=, +, -, @ at the start) gets a leading apostrophe, so a name that came
// from the cloud can never run as a formula in Excel.
function cell(v: Cell): string {
  if (v === null || v === undefined) return "";
  let s = typeof v === "boolean" ? (v ? "yes" : "no") : String(v);
  if (typeof v === "string" && /^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV<T>(rows: T[], columns: Column<T>[]): string {
  const head = columns.map((c) => cell(c.header)).join(",");
  const body = rows.map((r) => columns.map((c) => cell(c.value(r))).join(","));
  return [head, ...body].join("\r\n") + "\r\n";
}

export function downloadCSV(filename: string, csv: string) {
  // The BOM makes Excel read the file as UTF-8 (°C, names with accents).
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
