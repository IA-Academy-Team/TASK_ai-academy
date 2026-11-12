import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../lib/http-error.ts";

export function authorize(role: "admin" | "usuario") {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (req.user?.role !== role) {
      next(new HttpError(403, "no tenés permiso para acceder a esta página"));
      return;
    }
    next();
  };
}
