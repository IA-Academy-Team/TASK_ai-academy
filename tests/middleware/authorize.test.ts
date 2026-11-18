import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { ADMIN_ROLE, DEFAULT_ROLE } from "../../src/domain/roles.ts";
import { HttpError } from "../../src/lib/http-error.ts";
import { authorize } from "../../src/middleware/authorize.ts";

describe("authorize", () => {
  it("rechaza con HttpError 403 cuando el role no coincide", () => {
    const req = { user: { role: DEFAULT_ROLE } } as unknown as Request;
    const res = {} as Response;
    const next = vi.fn() as NextFunction;

    authorize(ADMIN_ROLE)(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(403);
  });

  it("deja pasar sin argumento cuando el role coincide", () => {
    const req = { user: { role: ADMIN_ROLE } } as unknown as Request;
    const res = {} as Response;
    const next = vi.fn() as NextFunction;

    authorize(ADMIN_ROLE)(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });
});
