-- Migration: 20261108000000_autonomous_microgames
-- Etapa 12: Microjuegos autónomos sin Assignment y aislamiento de práctica (Decisiones 130, 136, 137, RF-01, BUG-04)

-- 1. Purgar intentos históricos de juego que tenían assignment_id (Decisión 136)
DELETE FROM "progress_events" WHERE "attempt_id" IN (
  SELECT a."id" FROM "attempts" a
  JOIN "assignments" asg ON a."assignment_id" = asg."id"
  JOIN "activities" act ON asg."activity_id" = act."id"
  WHERE act."type" = 'game'
);

UPDATE "attempts" SET "previous_attempt_id" = NULL WHERE "id" IN (
  SELECT a."id" FROM "attempts" a
  JOIN "assignments" asg ON a."assignment_id" = asg."id"
  JOIN "activities" act ON asg."activity_id" = act."id"
  WHERE act."type" = 'game'
);

DELETE FROM "attempts" WHERE "id" IN (
  SELECT a."id" FROM "attempts" a
  JOIN "assignments" asg ON a."assignment_id" = asg."id"
  JOIN "activities" act ON asg."activity_id" = act."id"
  WHERE act."type" = 'game'
);

DELETE FROM "assignments" WHERE "activity_id" IN (
  SELECT "id" FROM "activities" WHERE "type" = 'game'
);

-- 2. Alterar tabla attempts para soportar microjuegos autónomos
ALTER TABLE "attempts" ADD COLUMN "activity_id" UUID;

ALTER TABLE "attempts" ALTER COLUMN "assignment_id" DROP NOT NULL;

-- Clave foránea activity_id con borrado restringido (SPEC-11 §6)
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Modificar clave foránea assignment_id para ON DELETE RESTRICT (SPEC-11 §6)
ALTER TABLE "attempts" DROP CONSTRAINT IF EXISTS "attempts_assignment_id_fkey";
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Restricción XOR estricta: un intento pertenece a un assignment O a una activity autónoma, nunca a ambos ni a ninguno
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_parent_xor_check" CHECK (
  ("assignment_id" IS NOT NULL AND "activity_id" IS NULL) OR
  ("assignment_id" IS NULL AND "activity_id" IS NOT NULL)
);

-- Índices y restricciones de unicidad
CREATE UNIQUE INDEX "attempts_activity_id_student_id_attempt_number_key" ON "attempts"("activity_id", "student_id", "attempt_number");

CREATE INDEX "attempts_organization_id_activity_id_status_graded_at_idx" ON "attempts"("organization_id", "activity_id", "status", "graded_at");

-- 3. Índice en media_assets por student_id (BUG-04)
CREATE INDEX "media_assets_student_id_idx" ON "media_assets"("student_id");
