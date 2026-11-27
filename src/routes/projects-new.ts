import { Router } from "express";
import {
  listAllActiveUsers,
  listAllActiveUsersIncludingAdmins,
  listProjects,
} from "../db/projects-repo.ts";
import { ADMIN_ROLE } from "../domain/roles.ts";
import { authorize } from "../middleware/authorize.ts";

export const projectsNewRouter = Router();

projectsNewRouter.get(
  "/proyectos/nuevo",
  authorize(ADMIN_ROLE),
  async (req, res) => {
    const user = req.user;
    if (!user) {
      res.redirect("/login");
      return;
    }
    const [users, leaderCandidates, projects] = await Promise.all([
      listAllActiveUsers(),
      listAllActiveUsersIncludingAdmins(),
      listProjects(),
    ]);
    res.render("proyectos/nuevo", {
      user,
      users,
      leaderCandidates,
      activeProjects: projects.filter((project) => project.status === "activo"),
      error:
        req.query.error === "1"
          ? "Revisa los campos obligatorios del proyecto."
          : null,
    });
  },
);
