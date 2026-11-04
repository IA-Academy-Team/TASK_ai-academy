import express from "express";
import supertest from "supertest";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { HttpError } from "../../src/lib/http-error.ts";
import { errorHandler } from "../../src/middleware/error-handler.ts";

function buildTestApp() {
  const app = express();
  app.get("/zod", () => {
    z.object({ a: z.string() }).parse({});
  });
  app.get("/http-error", () => {
    throw new HttpError(404, "no encontrado");
  });
  app.get("/boom", () => {
    throw new Error("algo explotó");
  });
  app.use(errorHandler);
  return app;
}

describe("error-handler", () => {
  it("ZodError responde 400 con success:false", async () => {
    const res = await supertest(buildTestApp()).get("/zod");
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("HttpError responde con su status y mensaje", async () => {
    const res = await supertest(buildTestApp()).get("/http-error");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("no encontrado");
  });

  it("Error inesperado responde 500 generico, nunca el stack", async () => {
    const res = await supertest(buildTestApp()).get("/boom");
    expect(res.status).toBe(500);
    expect(res.body.error).not.toContain("algo explotó");
  });
});
