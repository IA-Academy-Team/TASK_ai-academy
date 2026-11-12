import { z } from "zod";

// Formato AAAA-MM-DD, el mismo que usan las columnas `date` de Postgres y
// `toLocaleDateString("en-CA")` en el resto del código. Rechazar acá un
// valor que Postgres no aceptaría evita que el driver tire un error no
// controlado (500 genérico) en vez de un 400 con mensaje claro.
export const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "la fecha debe tener el formato AAAA-MM-DD");
