-- CreateEnum
CREATE TYPE "EstadoGeneral" AS ENUM ('ACTIVO', 'INACTIVO');

-- CreateEnum
CREATE TYPE "EstadoPedido" AS ENUM ('CONFIRMADO', 'PAGADO_PARCIAL', 'PAGADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "EstadoEntregaPedido" AS ENUM ('PENDIENTE', 'EN_PRODUCCION', 'LISTO', 'ENTREGADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "ModalidadPedido" AS ENUM ('MINORISTA', 'MAYORISTA');

-- CreateEnum
CREATE TYPE "TipoMovimientoInventario" AS ENUM ('INGRESO', 'SALIDA', 'AJUSTE', 'TRANSFERENCIA');

-- CreateEnum
CREATE TYPE "TipoMovimientoCaja" AS ENUM ('INGRESO', 'EGRESO', 'TRANSFERENCIA', 'AJUSTE');

-- CreateEnum
CREATE TYPE "EstadoCaja" AS ENUM ('ABIERTA', 'CERRADA');

-- CreateEnum
CREATE TYPE "EstadoProduccion" AS ENUM ('LIBERADA', 'EN_PROCESO', 'PAUSADA', 'TERMINADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "EstadoEtapaProduccion" AS ENUM ('PENDIENTE', 'EN_PROCESO', 'TERMINADA', 'OBSERVADA', 'ESPERA');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "rol" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "departamento" TEXT,
    "ciudad" TEXT,
    "distrito" TEXT,
    "direccion" TEXT,
    "agencia" TEXT,
    "local" TEXT,
    "estado" "EstadoGeneral" NOT NULL DEFAULT 'ACTIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Producto" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "material" TEXT NOT NULL,
    "taco" TEXT NOT NULL,
    "coleccion" TEXT,
    "talla" INTEGER NOT NULL,
    "costo" DECIMAL(10,2) NOT NULL,
    "precio" DECIMAL(10,2) NOT NULL,
    "estado" "EstadoGeneral" NOT NULL DEFAULT 'ACTIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Producto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Almacen" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Almacen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inventario" (
    "id" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "almacenId" TEXT NOT NULL,
    "codigoBarras" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoInventario" (
    "id" TEXT NOT NULL,
    "tipo" "TipoMovimientoInventario" NOT NULL,
    "productoId" TEXT NOT NULL,
    "almacenId" TEXT NOT NULL,
    "codigoBarras" TEXT,
    "sku" TEXT,
    "cantidad" INTEGER NOT NULL,
    "stockAnterior" INTEGER NOT NULL,
    "stockNuevo" INTEGER NOT NULL,
    "referencia" TEXT,
    "nota" TEXT,
    "usuarioEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimientoInventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Venta" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "almacenId" TEXT NOT NULL,
    "totalProductos" INTEGER NOT NULL,
    "subtotalSinIgv" DECIMAL(10,2) NOT NULL,
    "descuento" DECIMAL(10,2) NOT NULL,
    "igv" DECIMAL(10,2) NOT NULL,
    "totalConIgv" DECIMAL(10,2) NOT NULL,
    "metodoPago" TEXT NOT NULL,
    "adelanto" DECIMAL(10,2) NOT NULL,
    "saldo" DECIMAL(10,2) NOT NULL,
    "estado" TEXT NOT NULL,
    "fechaEnvio" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Venta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetalleVenta" (
    "id" TEXT NOT NULL,
    "ventaId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "codigoBarras" TEXT,
    "sku" TEXT,
    "modelo" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "material" TEXT,
    "talla" INTEGER NOT NULL,
    "taco" TEXT,
    "cantidad" INTEGER NOT NULL,
    "precioUnitario" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "fechaEnvio" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DetalleVenta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pedido" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "modalidad" "ModalidadPedido" NOT NULL,
    "tipoPedido" TEXT NOT NULL,
    "almacenSolicitadoId" TEXT NOT NULL,
    "almacenAtendidoId" TEXT NOT NULL,
    "fechaCompromiso" TIMESTAMP(3),
    "prioridad" TEXT NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "descuento" DECIMAL(10,2) NOT NULL,
    "igv" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "adelanto" DECIMAL(10,2) NOT NULL,
    "saldo" DECIMAL(10,2) NOT NULL,
    "metodoPago" TEXT,
    "estadoPedido" "EstadoPedido" NOT NULL DEFAULT 'CONFIRMADO',
    "estadoEntrega" "EstadoEntregaPedido" NOT NULL DEFAULT 'PENDIENTE',
    "origenAtencion" TEXT,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetallePedido" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "material" TEXT,
    "talla" INTEGER NOT NULL,
    "taco" TEXT,
    "cantidad" INTEGER NOT NULL,
    "precioUnitario" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "stockActualAlmacen" INTEGER NOT NULL DEFAULT 0,
    "stockOtrosAlmacenes" TEXT,
    "tipoAtencion" TEXT NOT NULL,
    "codigoBarras" TEXT,
    "estadoLinea" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DetallePedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistorialPedido" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "detallePedidoId" TEXT,
    "tipoEvento" TEXT NOT NULL,
    "estadoAnterior" TEXT,
    "estadoNuevo" TEXT,
    "detalle" TEXT,
    "usuarioEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistorialPedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Caja" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "almacenId" TEXT NOT NULL,
    "saldoInicial" DECIMAL(10,2) NOT NULL,
    "saldoActual" DECIMAL(10,2) NOT NULL,
    "responsable" TEXT,
    "estado" "EstadoCaja" NOT NULL DEFAULT 'CERRADA',
    "fechaApertura" TIMESTAMP(3),
    "fechaCierre" TIMESTAMP(3),
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Caja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoCaja" (
    "id" TEXT NOT NULL,
    "cajaId" TEXT NOT NULL,
    "tipo" "TipoMovimientoCaja" NOT NULL,
    "subtipo" TEXT,
    "monto" DECIMAL(10,2) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "metodoPago" TEXT,
    "referencia" TEXT,
    "proveedor" TEXT,
    "persona" TEXT,
    "usuarioEmail" TEXT,
    "facturaSiNo" TEXT,
    "numFactura" TEXT,
    "vinculo" TEXT,
    "detalle" TEXT,
    "saldoPost" DECIMAL(10,2) NOT NULL,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimientoCaja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdenProduccion" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "productoBaseId" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "material" TEXT,
    "taco" TEXT,
    "coleccion" TEXT,
    "cantidadPares" INTEGER NOT NULL,
    "corridaJson" JSONB NOT NULL,
    "almacenDestinoId" TEXT NOT NULL,
    "prioridad" TEXT NOT NULL,
    "fechaInicio" TIMESTAMP(3),
    "fechaCompromiso" TIMESTAMP(3),
    "fechaEntregaReal" TIMESTAMP(3),
    "estadoGeneral" "EstadoProduccion" NOT NULL DEFAULT 'LIBERADA',
    "etapaActual" TEXT,
    "paresComprometidos" INTEGER NOT NULL DEFAULT 0,
    "paresLibres" INTEGER NOT NULL DEFAULT 0,
    "observaciones" TEXT,
    "usuarioEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrdenProduccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EtapaProduccion" (
    "id" TEXT NOT NULL,
    "ordenProduccionId" TEXT NOT NULL,
    "etapa" TEXT NOT NULL,
    "ordenEtapa" INTEGER NOT NULL,
    "responsableId" TEXT,
    "responsableNombre" TEXT,
    "fechaInicio" TIMESTAMP(3),
    "fechaFin" TIMESTAMP(3),
    "fechaCompromiso" TIMESTAMP(3),
    "fechaReprogramada" TIMESTAMP(3),
    "cantidadRecibida" INTEGER NOT NULL DEFAULT 0,
    "cantidadProcesada" INTEGER NOT NULL DEFAULT 0,
    "cantidadObservada" INTEGER NOT NULL DEFAULT 0,
    "costoManoObra" DECIMAL(10,2) NOT NULL,
    "estadoEtapa" "EstadoEtapaProduccion" NOT NULL DEFAULT 'PENDIENTE',
    "observaciones" TEXT,
    "usuarioEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EtapaProduccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoProduccion" (
    "id" TEXT NOT NULL,
    "ordenProduccionId" TEXT NOT NULL,
    "etapaOrigen" TEXT,
    "etapaDestino" TEXT,
    "responsableSale" TEXT,
    "responsableEntra" TEXT,
    "cantidad" INTEGER NOT NULL,
    "observaciones" TEXT,
    "usuarioEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimientoProduccion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_codigo_key" ON "Cliente"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_dni_key" ON "Cliente"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "Producto_codigo_key" ON "Producto"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Almacen_codigo_key" ON "Almacen"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Inventario_codigoBarras_key" ON "Inventario"("codigoBarras");

-- CreateIndex
CREATE UNIQUE INDEX "Inventario_productoId_almacenId_key" ON "Inventario"("productoId", "almacenId");

-- CreateIndex
CREATE UNIQUE INDEX "Venta_codigo_key" ON "Venta"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Pedido_codigo_key" ON "Pedido"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Caja_codigo_key" ON "Caja"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "OrdenProduccion_codigo_key" ON "OrdenProduccion"("codigo");

-- AddForeignKey
ALTER TABLE "Inventario" ADD CONSTRAINT "Inventario_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventario" ADD CONSTRAINT "Inventario_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "Almacen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoInventario" ADD CONSTRAINT "MovimientoInventario_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoInventario" ADD CONSTRAINT "MovimientoInventario_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "Almacen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "Almacen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetalleVenta" ADD CONSTRAINT "DetalleVenta_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetalleVenta" ADD CONSTRAINT "DetalleVenta_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_almacenSolicitadoId_fkey" FOREIGN KEY ("almacenSolicitadoId") REFERENCES "Almacen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_almacenAtendidoId_fkey" FOREIGN KEY ("almacenAtendidoId") REFERENCES "Almacen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetallePedido" ADD CONSTRAINT "DetallePedido_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetallePedido" ADD CONSTRAINT "DetallePedido_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistorialPedido" ADD CONSTRAINT "HistorialPedido_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Caja" ADD CONSTRAINT "Caja_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "Almacen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoCaja" ADD CONSTRAINT "MovimientoCaja_cajaId_fkey" FOREIGN KEY ("cajaId") REFERENCES "Caja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenProduccion" ADD CONSTRAINT "OrdenProduccion_productoBaseId_fkey" FOREIGN KEY ("productoBaseId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenProduccion" ADD CONSTRAINT "OrdenProduccion_almacenDestinoId_fkey" FOREIGN KEY ("almacenDestinoId") REFERENCES "Almacen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EtapaProduccion" ADD CONSTRAINT "EtapaProduccion_ordenProduccionId_fkey" FOREIGN KEY ("ordenProduccionId") REFERENCES "OrdenProduccion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoProduccion" ADD CONSTRAINT "MovimientoProduccion_ordenProduccionId_fkey" FOREIGN KEY ("ordenProduccionId") REFERENCES "OrdenProduccion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
