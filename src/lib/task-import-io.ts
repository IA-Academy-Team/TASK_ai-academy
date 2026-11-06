import ExcelJS from "exceljs";
import {
  TASK_IMPORT_HEADERS,
  type TaskImportRow,
} from "../domain/task-import.ts";

const TEMPLATE_SAMPLE_ROW = [
  "Revisar propuesta comercial",
  "Propuesta revisada y aprobada",
  "Descripción opcional",
  "admin@aiacademy.local",
  "",
  "media",
  "1",
  "4",
  "2026-12-01",
];

export async function buildTaskImportTemplate(): Promise<
  Buffer<ArrayBufferLike>
> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Tareas");
  sheet.addRow([...TASK_IMPORT_HEADERS]);
  sheet.getRow(1).font = { bold: true };
  sheet.addRow(TEMPLATE_SAMPLE_ROW);
  for (const column of sheet.columns) {
    column.width = 26;
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

export async function parseTaskImportFile(
  buffer: Buffer,
): Promise<TaskImportRow[]> {
  const workbook = new ExcelJS.Workbook();
  // exceljs trae su propio tipo Buffer (pre-genéricos de @types/node); el
  // objeto en runtime es un Buffer normal, solo cambia la forma del tipo.
  await workbook.xlsx.load(
    buffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
  );
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const rows: TaskImportRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const cells = Array.from({ length: 9 }, (_, i) => cellText(row, i + 1));
    if (!cells.some(Boolean)) return;
    rows.push({
      title: cells[0],
      deliverable: cells[1],
      description: cells[2],
      ownerEmail: cells[3],
      supportEmails: cells[4],
      priority: cells[5],
      weight: cells[6],
      estimate: cells[7],
      due: cells[8],
    });
  });
  return rows;
}
