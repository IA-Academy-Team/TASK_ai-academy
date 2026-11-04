import type { NextFunction, Request, Response } from "express";
import { auth } from "../lib/auth.ts";

type SessionUser = {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
};

declare module "express-serve-static-core" {
  interface Request {
    user?: SessionUser;
  }
}

export async function attachSession(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const session = await auth.api.getSession({
    headers: new Headers(req.headers as Record<string, string>),
  });

  if (session?.user) {
    req.user = {
      id: session.user.id,
      email: session.user.email,
      role: (session.user as unknown as { role: string }).role,
      isActive: (session.user as unknown as { isActive: boolean }).isActive,
    };
  }

  next();
}
