-- Agregar columnas nuevas permitiendo transición con datos existentes

ALTER TABLE "NotificacionYape"
ADD COLUMN "estado" TEXT NOT NULL DEFAULT 'POR_VALIDAR',
ADD COLUMN "observacion" TEXT,
ADD COLUMN "updatedAt" TIMESTAMP(3);

-- Rellenar updatedAt para filas antiguas
UPDATE "NotificacionYape"
SET "updatedAt" = "createdAt"
WHERE "updatedAt" IS NULL;

-- Ahora sí volverla obligatoria
ALTER TABLE "NotificacionYape"
ALTER COLUMN "updatedAt" SET NOT NULL;

-- Índice por estado
CREATE INDEX "NotificacionYape_estado_idx" ON "NotificacionYape"("estado");