import ExcelJS from "exceljs";
import {
  PROJECT_IMPORT_HEADERS,
  type ProjectImportRow,
} from "../domain/project-import.ts";

const TEMPLATE_SAMPLE_ROW = [
  "Campaña de verano",
  "Lanzar la campaña de verano en los tres canales",
  "admin@aiacademy.local",
  "",
  "2026-01-05",
  "2026-03-01",
  "2",
  "2",
];

export async function buildProjectImportTemplate(): Promise<
  Buffer<ArrayBufferLike>
> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Proyectos");
  sheet.addRow([...PROJECT_IMPORT_HEADERS]);
  sheet.getRow(1).font = { bold: true };
  sheet.addRow(TEMPLATE_SAMPLE_ROW);
  for (const column of sheet.columns) {
    column.width = 30;
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function cellText(row: ExcelJS.Row, index: number): string {
  const value = row.getCell(index).value;
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (value && typeof value === "object" && "result" in value) {
    return String((value as { result: unknown }).result ?? "").trim();
  }
  return String(value ?? "").trim();
}

export async function parseProjectImportFile(
  buffer: Buffer,
): Promise<ProjectImportRow[]> {
  const workbook = new ExcelJS.Workbook();
  // exceljs trae su propio tipo Buffer (pre-genéricos de @types/node); el
  // objeto en runtime es un Buffer normal, solo cambia la forma del tipo.
  await workbook.xlsx.load(
    buffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
  );
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const rows: ProjectImportRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const cells = Array.from({ length: 8 }, (_, i) => cellText(row, i + 1));
    if (!cells.some(Boolean)) return;
    rows.push({
      name: cells[0],
      objective: cells[1],
      leaderEmail: cells[2],
      memberEmails: cells[3],
      start: cells[4],
      due: cells[5],
      limitActive: cells[6],
      limitReview: cells[7],
    });
  });
  return rows;
}
