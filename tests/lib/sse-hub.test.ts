import { describe, expect, it } from "vitest";
import { publish, subscribe, unsubscribe } from "../../src/lib/sse-hub.ts";

function fakeResponse() {
  const chunks: string[] = [];
  return {
    chunks,
    write(chunk: string) {
      chunks.push(chunk);
    },
  } as unknown as import("express").Response & { chunks: string[] };
}

describe("sse-hub", () => {
  it("publish escribe el evento solo en las conexiones del usuario suscrito", () => {
    const userId = "user-1";
    const res = fakeResponse();
    const otherRes = fakeResponse();
    subscribe(userId, res);
    subscribe("other-user", otherRes);

    publish(userId, "support-request", { taskTitle: "Tarea X" });

    expect(res.chunks).toHaveLength(1);
    expect(res.chunks[0]).toContain("event: support-request");
    expect(res.chunks[0]).toContain('"taskTitle":"Tarea X"');
    expect(otherRes.chunks).toHaveLength(0);

    unsubscribe(userId, res);
    unsubscribe("other-user", otherRes);
  });

  it("publish no hace nada si el usuario no tiene conexiones activas", () => {
    expect(() => publish("sin-conexion", "support-request", {})).not.toThrow();
  });

  it("unsubscribe detiene los envíos a esa conexión", () => {
    const userId = "user-2";
    const res = fakeResponse();
    subscribe(userId, res);
    unsubscribe(userId, res);

    publish(userId, "support-request", { taskTitle: "Tarea Y" });

    expect(res.chunks).toHaveLength(0);
  });
});
