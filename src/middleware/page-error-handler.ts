import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { HttpError } from "../lib/http-error.ts";

// Las rutas de página (navegación GET, fuera de /api) muestran una vista de
// error con el layout de la app en vez del JSON crudo que usa el resto de la
// API — para esas, delega al errorHandler genérico sin tocarlo.
export function pageErrorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (req.method !== "GET" || req.path.startsWith("/api/")) {
    next(err);
    return;
  }

  let status = 500;
  let message = "Ocurrió un error inesperado.";
  if (err instanceof ZodError) {
    status = 400;
    message = err.issues[0]?.message ?? "Solicitud inválida.";
  } else if (err instanceof HttpError) {
    status = err.status;
    message = err.message;
  } else {
    console.error(err);
  }

  try {
    res.status(status).render("error", { status, message, user: req.user });
  } catch {
    next(err);
  }
}
