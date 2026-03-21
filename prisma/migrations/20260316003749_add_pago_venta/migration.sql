-- CreateTable
CREATE TABLE "PagoVenta" (
    "id" TEXT NOT NULL,
    "ventaId" TEXT NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "metodoPago" TEXT,
    "nota" TEXT,
    "usuarioEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PagoVenta_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PagoVenta" ADD CONSTRAINT "PagoVenta_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
