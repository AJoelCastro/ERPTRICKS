-- DropForeignKey
ALTER TABLE "DetalleCompra" DROP CONSTRAINT "DetalleCompra_productoId_fkey";

-- AddForeignKey
ALTER TABLE "DetalleCompra" ADD CONSTRAINT "DetalleCompra_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
