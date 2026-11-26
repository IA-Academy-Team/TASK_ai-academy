import { Router } from "express";
import multer from "multer";
import {
  createProjectWithCode,
  listAllActiveUsers,
  listLeaderCandidates,
} from "../db/projects-repo.ts";
import { validateProjectImportRow } from "../domain/project-import.ts";
import { ADMIN_ROLE } from "../domain/roles.ts";
import { HttpError } from "../lib/http-error.ts";
import {
  buildProjectImportTemplate,
  parseProjectImportFile,
} from "../lib/project-import-io.ts";
import { authorize } from "../middleware/authorize.ts";

export const projectsImportRouter = Router();

type ImportResultRow =
  | { row: number; ok: true; name: string }
  | { row: number; ok: false; message: string };

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

projectsImportRouter.get(
  "/proyectos/plantilla.xlsx",
  authorize(ADMIN_ROLE),
  async (_req, res) => {
    const buffer = await buildProjectImportTemplate();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="plantilla-proyectos.xlsx"',
    );
    res.send(buffer);
  },
);

projectsImportRouter.post(
  "/proyectos/importar",
  authorize(ADMIN_ROLE),
  upload.single("file"),
  async (req, res) => {
    if (!req.file) {
      throw new HttpError(400, "subí un archivo .xlsx");
    }

    let rawRows: Awaited<ReturnType<typeof parseProjectImportFile>>;
    try {
      rawRows = await parseProjectImportFile(req.file.buffer);
    } catch {
      throw new HttpError(
        400,
        "no se pudo leer el archivo: debe ser un .xlsx válido",
      );
    }

    const [activeUsers, leaderCandidates] = await Promise.all([
      listAllActiveUsers(),
      listLeaderCandidates(),
    ]);
    const memberUsersByEmail = new Map(
      activeUsers.map((u) => [u.email.toLowerCase(), u.id]),
    );
    const leaderUsersByEmail = new Map(
      leaderCandidates.map((u) => [u.email.toLowerCase(), u.id]),
    );

    const results: ImportResultRow[] = [];
    for (let i = 0; i < rawRows.length; i++) {
      const rowNumber = i + 2; // fila 1 es el encabezado
      const outcome = validateProjectImportRow(
        rawRows[i],
        rowNumber,
        leaderUsersByEmail,
        memberUsersByEmail,
      );
      if (!outcome.ok) {
        results.push({ row: rowNumber, ok: false, message: outcome.message });
        continue;
      }
      try {
        await createProjectWithCode({
          name: outcome.project.name,
          objective: outcome.project.objective,
          leaderId: outcome.project.leaderId,
          start: outcome.project.start,
          due: outcome.project.due,
          limitActive: outcome.project.limitActive,
          limitReview: outcome.project.limitReview,
          memberIds: outcome.project.memberIds,
        });
        results.push({ row: rowNumber, ok: true, name: outcome.project.name });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "error desconocido";
        results.push({ row: rowNumber, ok: false, message });
      }
    }

    res.render("proyectos/importar-resultado-proyectos", {
      user: req.user,
      results,
      created: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
    });
  },
);
