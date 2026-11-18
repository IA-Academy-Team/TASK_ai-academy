import { describe, expect, it } from "vitest";
import { isUserColor, USER_COLORS } from "../../src/domain/user-colors.ts";

describe("isUserColor", () => {
  it("acepta cualquier color de la paleta", () => {
    for (const color of USER_COLORS) {
      expect(isUserColor(color)).toBe(true);
    }
  });

  it("rechaza un color fuera de la paleta", () => {
    expect(isUserColor("#000000")).toBe(false);
  });
});
