import { describe, expect, it } from "vitest";
import { toCsv } from "../../src/lib/csv.ts";

describe("lib/csv", () => {
  it("usa ; como separador y arranca con BOM UTF-8", () => {
    const csv = toCsv(
      [{ name: "Ana", hours: 4 }],
      [
        { header: "Nombre", value: (r) => r.name },
        { header: "Horas", value: (r) => r.hours },
      ],
    );
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("Nombre;Horas");
    expect(csv).toContain("Ana;4");
  });

  it("escapa valores con el separador, comillas o saltos de línea", () => {
    const csv = toCsv(
      [{ note: 'Tiene ; y "comillas"' }],
      [{ header: "Nota", value: (r) => r.note }],
    );
    expect(csv).toContain('"Tiene ; y ""comillas"""');
  });
});
