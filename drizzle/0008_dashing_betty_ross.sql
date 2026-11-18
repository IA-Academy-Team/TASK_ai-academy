ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'colaborador';
--> statement-breakpoint
-- Los roles pasan de admin/usuario a administrador/trainer/colaborador/practicante.
-- Backfill de filas existentes: el valor por defecto nuevo ya cubre altas futuras.
UPDATE "user" SET "role" = 'administrador' WHERE "role" = 'admin';
--> statement-breakpoint
UPDATE "user" SET "role" = 'colaborador' WHERE "role" = 'usuario';