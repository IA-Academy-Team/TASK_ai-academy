// Los roles de usuario de la Academia. "administrador" es el único con
// permisos elevados (antes "admin") — los otros tres son organizacionales,
// con los mismos permisos que antes tenía "usuario".
export const ROLES = [
  "administrador",
  "trainer",
  "colaborador",
  "practicante",
] as const;

export type Role = (typeof ROLES)[number];

export const ADMIN_ROLE: Role = "administrador";

export const DEFAULT_ROLE: Role = "colaborador";

export const ROLE_LABELS: Record<Role, string> = {
  administrador: "Administrador",
  trainer: "Trainer",
  colaborador: "Colaborador",
  practicante: "Practicante",
};

export function isAdminRole(role: string): boolean {
  return role === ADMIN_ROLE;
}
