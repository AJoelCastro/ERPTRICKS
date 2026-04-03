-- CreateTable
CREATE TABLE "NotificacionYape" (
    "id" TEXT NOT NULL,
    "appOrigen" TEXT,
    "titulo" TEXT,
    "mensaje" TEXT,
    "fechaHoraTexto" TEXT,
    "timestampMs" BIGINT,
    "numerosDestino" TEXT,
    "estadoSms" TEXT,
    "detalleSms" TEXT,
    "payloadJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificacionYape_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotificacionYape_createdAt_idx" ON "NotificacionYape"("createdAt");
