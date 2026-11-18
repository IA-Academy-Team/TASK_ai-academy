import type { NextFunction, Request, Response } from "express";
import type { Role } from "../domain/roles.ts";
import { HttpError } from "../lib/http-error.ts";

export function authorize(role: Role) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (req.user?.role !== role) {
      next(new HttpError(403, "no tenés permiso para acceder a esta página"));
      return;
    }
    next();
  };
}
