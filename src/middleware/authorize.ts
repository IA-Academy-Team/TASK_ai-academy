import type { NextFunction, Request, Response } from "express";

// Clase mínima acá — E2-T3 la mueve a src/lib/http-error.ts sin cambiar este comportamiento.
export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function authorize(role: "admin" | "usuario") {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (req.user?.role !== role) {
      next(new HttpError(403, "forbidden"));
      return;
    }
    next();
  };
}
