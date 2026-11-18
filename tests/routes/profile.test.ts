import { eq } from "drizzle-orm";
import supertest from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { user } from "../../src/db/auth-schema.ts";
import { db } from "../../src/db/client.ts";
import { USER_COLORS } from "../../src/domain/user-colors.ts";
import { signUpAndGetCookie } from "../helpers/auth.ts";

describe("GET /perfil", () => {
  it("responde 200 para un usuario logueado", async () => {
    const app = createApp();
    const cookie = await signUpAndGetCookie("perfil1@test.local");
    const res = await supertest(app).get("/perfil").set("Cookie", cookie);
    expect(res.status).toBe(200);
  });

  it("redirige a login sin sesión", async () => {
    const app = createApp();
    const res = await supertest(app).get("/perfil");
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/login");
  });
});

describe("POST /perfil/color", () => {
  it("actualiza el color y redirige a /perfil", async () => {
    const app = createApp();
    const email = "perfil2@test.local";
    const cookie = await signUpAndGetCookie(email);
    const [me] = await db.select().from(user).where(eq(user.email, email));

    const res = await supertest(app)
      .post("/perfil/color")
      .set("Cookie", cookie)
      .type("form")
      .send({ color: USER_COLORS[1] });

    expect(res.status).toBe(303);
    expect(res.headers.location).toBe("/perfil?guardado=1");

    const [updated] = await db.select().from(user).where(eq(user.id, me.id));
    expect(updated.color).toBe(USER_COLORS[1]);
  });

  it("responde 400 para un color fuera de la paleta", async () => {
    const app = createApp();
    const cookie = await signUpAndGetCookie("perfil3@test.local");
    const res = await supertest(app)
      .post("/perfil/color")
      .set("Cookie", cookie)
      .type("form")
      .send({ color: "#000000" });
    expect(res.status).toBe(400);
  });
});
