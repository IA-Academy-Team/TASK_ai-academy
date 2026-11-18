// Paleta cerrada de colores distintivos que un usuario puede elegir para su
// perfil (/perfil) — cerrada a propósito: un color libre podría no tener
// contraste suficiente con el texto blanco que usan los avatares.
export const USER_COLORS = [
  "#7346CC",
  "#2563EB",
  "#0D9488",
  "#16A34A",
  "#CA8A04",
  "#EA580C",
  "#DC2626",
  "#DB2777",
  "#4F46E5",
  "#0891B2",
] as const;

export type UserColor = (typeof USER_COLORS)[number];

export function isUserColor(value: string): value is UserColor {
  return (USER_COLORS as readonly string[]).includes(value);
}
