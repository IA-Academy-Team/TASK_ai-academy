import type { NextFunction, Request, Response } from "express";
import { auth } from "../lib/auth.ts";

type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  mustChangePassword: boolean;
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

  const extra = session?.user as unknown as {
    isActive?: boolean;
    role: string;
    mustChangePassword?: boolean;
  };
  if (session?.user && extra.isActive !== false) {
    req.user = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: extra.role,
      isActive: true,
      mustChangePassword: extra.mustChangePassword === true,
    };
  }

  next();
}
