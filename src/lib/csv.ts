const BOM = "﻿";
const DELIMITER = ";";

function escapeCell(value: string): string {
  if (
    value.includes(DELIMITER) ||
    value.includes('"') ||
    value.includes("\n")
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCell(c.header)).join(DELIMITER);
  const lines = rows.map((row) =>
    columns.map((c) => escapeCell(String(c.value(row)))).join(DELIMITER),
  );
  return BOM + [header, ...lines].join("\n");
}
