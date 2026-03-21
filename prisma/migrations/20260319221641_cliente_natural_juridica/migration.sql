/*
  Warnings:

  - A unique constraint covering the columns `[ruc]` on the table `Cliente` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN     "razonSocial" TEXT,
ADD COLUMN     "ruc" TEXT,
ADD COLUMN     "tipoCliente" TEXT NOT NULL DEFAULT 'PERSONA_NATURAL',
ALTER COLUMN "dni" DROP NOT NULL,
ALTER COLUMN "nombres" DROP NOT NULL,
ALTER COLUMN "apellidos" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_ruc_key" ON "Cliente"("ruc");
