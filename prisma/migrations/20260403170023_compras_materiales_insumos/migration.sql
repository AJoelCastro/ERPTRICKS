-- =========================================
-- TABLAS NUEVAS
-- =========================================

CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "unidadMedida" TEXT DEFAULT 'UND',
    "costoReferencial" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "estado" TEXT NOT NULL DEFAULT 'ACTIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Insumo" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "unidadMedida" TEXT DEFAULT 'UND',
    "costoReferencial" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "estado" TEXT NOT NULL DEFAULT 'ACTIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Insumo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Material_codigo_key" ON "Material"("codigo");
CREATE UNIQUE INDEX "Insumo_codigo_key" ON "Insumo"("codigo");

-- =========================================
-- CAMBIOS EN DetalleCompra
-- Primero agregar columnas como NULLABLE
-- =========================================

ALTER TABLE "DetalleCompra"
ADD COLUMN "tipoItem" TEXT,
ADD COLUMN "itemId" TEXT,
ADD COLUMN "codigoItem" TEXT,
ADD COLUMN "descripcionItem" TEXT,
ADD COLUMN "unidadMedida" TEXT DEFAULT 'UND';

-- =========================================
-- BACKFILL DE DATOS EXISTENTES
-- Todas las compras antiguas eran PRODUCTO
-- =========================================

UPDATE "DetalleCompra" d
SET
  "tipoItem" = 'PRODUCTO',
  "itemId" = d."productoId",
  "codigoItem" = p."codigo",
  "descripcionItem" = TRIM(
    CONCAT(
      COALESCE(p."modelo", ''),
      CASE WHEN COALESCE(p."color", '') <> '' THEN ' - ' || p."color" ELSE '' END,
      CASE WHEN COALESCE(p."material", '') <> '' THEN ' - ' || p."material" ELSE '' END,
      CASE WHEN COALESCE(p."taco", '') <> '' THEN ' - ' || p."taco" ELSE '' END,
      CASE WHEN p."talla" IS NOT NULL THEN ' - T' || p."talla"::TEXT ELSE '' END
    )
  ),
  "unidadMedida" = 'PAR'
FROM "Producto" p
WHERE d."productoId" = p."id";

-- =========================================
-- POR SI QUEDARA ALGUNA FILA HUÉRFANA
-- =========================================

UPDATE "DetalleCompra"
SET
  "tipoItem" = COALESCE("tipoItem", 'PRODUCTO'),
  "itemId" = COALESCE("itemId", "productoId", 'SIN_ITEM'),
  "codigoItem" = COALESCE("codigoItem", 'SIN-CODIGO'),
  "descripcionItem" = COALESCE("descripcionItem", 'ITEM SIN DESCRIPCION'),
  "unidadMedida" = COALESCE("unidadMedida", 'UND')
WHERE
  "tipoItem" IS NULL
  OR "itemId" IS NULL
  OR "codigoItem" IS NULL
  OR "descripcionItem" IS NULL;

-- =========================================
-- AHORA SI, VOLVER OBLIGATORIAS LAS COLUMNAS
-- =========================================

ALTER TABLE "DetalleCompra"
ALTER COLUMN "tipoItem" SET NOT NULL,
ALTER COLUMN "itemId" SET NOT NULL,
ALTER COLUMN "codigoItem" SET NOT NULL,
ALTER COLUMN "descripcionItem" SET NOT NULL;

-- =========================================
-- productoId ahora será opcional
-- =========================================

ALTER TABLE "DetalleCompra"
ALTER COLUMN "productoId" DROP NOT NULL;

-- =========================================
-- ÍNDICES
-- =========================================

CREATE INDEX "DetalleCompra_compraId_idx" ON "DetalleCompra"("compraId");
CREATE INDEX "DetalleCompra_productoId_idx" ON "DetalleCompra"("productoId");
CREATE INDEX "DetalleCompra_tipoItem_idx" ON "DetalleCompra"("tipoItem");
CREATE INDEX "DetalleCompra_itemId_idx" ON "DetalleCompra"("itemId");