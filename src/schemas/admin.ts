import { z } from "zod";

export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
});

// Contraseña inicial compartida para toda cuenta creada por un admin — no es
// secreta, se le comunica al usuario junto con su email, y queda inutilizable
// en cuanto el middleware de mustChangePassword lo obliga a cambiarla en su
// primer login.
export const GENERIC_PASSWORD = "CambiarAhora2026!";
