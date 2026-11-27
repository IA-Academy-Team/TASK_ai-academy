import { Router } from "express";
import multer from "multer";
import {
  getProject,
  listAllActiveUsers,
  listAllActiveUsersIncludingAdmins,
} from "../db/projects-repo.ts";
import { createTask } from "../db/tasks-repo.ts";
import { isAdminRole } from "../domain/roles.ts";
import { validateTaskImportRow } from "../domain/task-import.ts";
import { HttpError } from "../lib/http-error.ts";
import {
  buildTaskImportTemplate,
  parseTaskImportFile,
} from "../lib/task-import-io.ts";

export const tasksImportRouter = Router();

function isLeaderOrAdmin(
  user: { id: string; role: string },
  project: { leaderId: string } | undefined,
): boolean {
  return isAdminRole(user.role) || (!!project && user.id === project.leaderId);
}

type ImportResultRow =
  | { row: number; ok: true; title: string }
  | { row: number; ok: false; message: string };

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

tasksImportRouter.get(
  "/proyectos/:id/tareas/plantilla.xlsx",
  async (req, res) => {
    if (!req.user) {
      res.redirect("/login");
      return;
    }
    const buffer = await buildTaskImportTemplate();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="plantilla-tareas.xlsx"',
    );
    res.send(buffer);
  },
);

tasksImportRouter.post(
  "/proyectos/:id/tareas/importar",
  upload.single("file"),
  async (req, res) => {
    if (!req.user) {
      res.redirect("/login");
      return;
    }

    const project = await getProject(String(req.params.id));
    if (!project) {
      throw new HttpError(404, "proyecto no encontrado");
    }
    if (!isLeaderOrAdmin(req.user, project)) {
      throw new HttpError(
        403,
        "solo el líder del proyecto o un admin pueden importar tareas",
      );
    }
    if (!req.file) {
      throw new HttpError(400, "subí un archivo .xlsx");
    }

    let rawRows: Awaited<ReturnType<typeof parseTaskImportFile>>;
    try {
      rawRows = await parseTaskImportFile(req.file.buffer);
    } catch {
      throw new HttpError(
        400,
        "no se pudo leer el archivo: debe ser un .xlsx válido",
      );
    }

    const [activeUsers, ownerCandidates] = await Promise.all([
      listAllActiveUsers(),
      listAllActiveUsersIncludingAdmins(),
    ]);
    const supportUsersByEmail = new Map(
      activeUsers.map((u) => [u.email.toLowerCase(), u.id]),
    );
    const ownerUsersByEmail = new Map(
      ownerCandidates.map((u) => [u.email.toLowerCase(), u.id]),
    );

    const results: ImportResultRow[] = [];
    for (let i = 0; i < rawRows.length; i++) {
      const rowNumber = i + 2; // fila 1 es el encabezado
      const outcome = validateTaskImportRow(
        rawRows[i],
        rowNumber,
        ownerUsersByEmail,
        supportUsersByEmail,
      );
      if (!outcome.ok) {
        results.push({ row: rowNumber, ok: false, message: outcome.message });
        continue;
      }
      try {
        await createTask({
          projectId: project.id,
          title: outcome.task.title,
          deliverable: outcome.task.deliverable,
          description: outcome.task.description,
          ownerId: outcome.task.ownerId,
          priority: outcome.task.priority,
          weight: outcome.task.weight,
          estimate: String(outcome.task.estimate),
          dependencyId: null,
          due: outcome.task.due,
          dueTime: outcome.task.dueTime,
          supportIds: outcome.task.supportIds,
          actorId: req.user.id,
        });
        results.push({ row: rowNumber, ok: true, title: outcome.task.title });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "error desconocido";
        results.push({ row: rowNumber, ok: false, message });
      }
    }

    res.render("proyectos/importar-resultado", {
      user: req.user,
      project,
      results,
      created: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
    });
  },
);
