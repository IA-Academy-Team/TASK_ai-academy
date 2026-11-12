import type { NextFunction, Request, Response } from "express";
import { auth } from "../lib/auth.ts";

type SessionUser = {
  id: string;
  email: string;
  name: string;
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

  const isActive = (session?.user as unknown as { isActive?: boolean })
    ?.isActive;
  if (session?.user && isActive !== false) {
    req.user = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: (session.user as unknown as { role: string }).role,
      isActive: true,
    };
  }

  next();
}
