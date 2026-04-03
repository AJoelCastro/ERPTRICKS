"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import jsPDF from "jspdf";
import QRCode from "qrcode";
import JsBarcode from "jsbarcode";
import { svg2pdf } from "svg2pdf.js";

type Producto = {
  id: string;
  codigo: string;
  codigoBarras?: string | null;
  modelo: string;
  color: string;
  material: string;
  taco: string;
  coleccion?: string | null;
  talla: number;
  costo: string;
  precio: string;
  estado: string;
};

type Almacen = {
  id: string;
  codigo: string;
  nombre: string;
  activo: boolean;
};

type EtapaProduccion = {
  id: string;
  ordenProduccionId: string;
  etapa: string;
  ordenEtapa: number;
  responsableId?: string | null;
  responsableNombre?: string | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  fechaCompromiso?: string | null;
  fechaReprogramada?: string | null;
  cantidadRecibida: number;
  cantidadProcesada: number;
  cantidadObservada: number;
  costoManoObra: string | number;
  estadoEtapa: string;
  observaciones?: string | null;
  usuarioEmail?: string | null;
  createdAt: string;
  updatedAt: string;
};

type MovimientoProduccion = {
  id: string;
  ordenProduccionId: string;
  etapaOrigen?: string | null;
  etapaDestino?: string | null;
  responsableSale?: string | null;
  responsableEntra?: string | null;
  cantidad: number;
  observaciones?: string | null;
  usuarioEmail?: string | null;
  createdAt: string;
};

type OrdenProduccion = {
  id: string;
  codigo: string;
  productoBaseId: string;
  modelo: string;
  color: string;
  material?: string | null;
  taco?: string | null;
  coleccion?: string | null;
  cantidadPares: number;
  corridaJson: Record<string, number>;
  almacenDestinoId: string;
  prioridad: string;
  fechaInicio?: string | null;
  fechaCompromiso?: string | null;
  fechaEntregaReal?: string | null;
  estadoGeneral: string;
  etapaActual?: string | null;
  paresComprometidos: number;
  paresLibres: number;
  observaciones?: string | null;
  usuarioEmail?: string | null;
  createdAt: string;
  updatedAt: string;
  productoBase: Producto & {
    codigoBarras?: string | null;
    sku?: string | null;
  };
  almacenDestino: Almacen;
  etapas: EtapaProduccion[];
  movimientos: MovimientoProduccion[];
  codigoBarrasPorTalla?: Record<string, string | null>;
  skuPorTalla?: Record<string, string | null>;
};

type SortKeyProduccion =
  | "codigo"
  | "modelo"
  | "cantidadPares"
  | "prioridad"
  | "fechaCompromiso"
  | "estadoGeneral"
  | "etapaActual"
  | "createdAt";

type ScanPayloadGeneral = {
  type: "OP_GENERAL";
  opId: string;
  opCodigo: string;
};

type ScanPayloadCaja = {
  type: "OP_CAJA";
  opCodigo: string;
};

type ScanPayload = ScanPayloadGeneral | ScanPayloadCaja;

type QrScannerModule = {
  default: new (
    video: HTMLVideoElement,
    onDecode: (result: { data?: string } | string) => void,
    options?: Record<string, unknown>
  ) => {
    start: () => Promise<void>;
    stop: () => void;
    destroy: () => void;
  };
};

const COMPANY_LOGO_PATH = "/logo-empresa.svg";

async function readJsonSafe(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(text || "Respuesta no válida del servidor");
  }
}

function formatDate(v?: string | null) {
  if (!v) return "-";
  try {
    return new Date(v).toLocaleDateString("es-PE");
  } catch {
    return v;
  }
}

function formatDateTime(v?: string | null) {
  if (!v) return "-";
  try {
    return new Date(v).toLocaleString("es-PE");
  } catch {
    return v;
  }
}

function formatMoney(v: string | number | null | undefined) {
  return `S/ ${Number(v || 0).toFixed(2)}`;
}

function mmToPt(mm: number) {
  return mm * 2.834645669;
}

function safeUpper(v?: string | null) {
  return String(v || "-").toUpperCase();
}

function getCurrentStage(order: OrdenProduccion | null) {
  if (!order) return null;
  const etapas = [...order.etapas].sort((a, b) => a.ordenEtapa - b.ordenEtapa);

  return (
    etapas.find((e) => e.etapa === order.etapaActual) ||
    etapas.find((e) => e.estadoEtapa === "EN_PROCESO") ||
    etapas.find((e) => e.estadoEtapa === "PENDIENTE") ||
    etapas[0] ||
    null
  );
}

function fitText(
  doc: jsPDF,
  text: string,
  maxWidth: number,
  maxFontSize: number,
  minFontSize = 8,
  fontStyle: "normal" | "bold" = "normal"
) {
  let size = maxFontSize;
  doc.setFont("helvetica", fontStyle);

  while (size >= minFontSize) {
    doc.setFontSize(size);
    if (doc.getTextWidth(text) <= maxWidth) return size;
    size -= 1;
  }

  return minFontSize;
}

function truncateText(doc: jsPDF, text: string, maxWidth: number) {
  if (doc.getTextWidth(text) <= maxWidth) return text;

  let out = text;
  while (out.length > 0 && doc.getTextWidth(`${out}...`) > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out}...`;
}

function drawLabelField(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  labelWidth = 46
) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text(label, x, y);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  doc.text(value, x + labelWidth, y);
}

function drawPremiumFrame(doc: jsPDF, x: number, y: number, w: number, h: number) {
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(1);
  doc.roundedRect(x, y, w, h, 10, 10);
}

async function loadSvgText(path: string) {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error("No se pudo cargar el logo SVG");
  }
  return await res.text();
}

async function drawSvgLogo(
  doc: jsPDF,
  svgText: string,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(svgText, "image/svg+xml");
  const svgElement = svgDoc.documentElement as unknown as SVGElement;

  const originalWidth = Number(svgElement.getAttribute("width")) || 300;
  const originalHeight = Number(svgElement.getAttribute("height")) || 100;

  const viewBox = svgElement.getAttribute("viewBox");
  let vbWidth = originalWidth;
  let vbHeight = originalHeight;

  if (viewBox) {
    const parts = viewBox.split(/\s+/).map(Number);
    if (parts.length === 4) {
      vbWidth = parts[2];
      vbHeight = parts[3];
    }
  }

  const scale = Math.min(width / vbWidth, height / vbHeight);
  const finalWidth = vbWidth * scale;
  const finalHeight = vbHeight * scale;

  const offsetX = x + (width - finalWidth) / 2;
  const offsetY = y + (height - finalHeight) / 2;

  await svg2pdf(svgElement, doc, {
    x: offsetX,
    y: offsetY,
    width: finalWidth,
    height: finalHeight,
  });
}

function normalizeScannerText(raw: string) {
  let text = String(raw || "").trim();

  if (!text) return text;

  text = text.replace(/[\r\n\t]+/g, "").trim();

  text = text
    .replace(/¨/g, "{")
    .replace(/\*/g, "}")
    .replace(/\[/g, '"')
    .replace(/]/g, '"')
    .replace(/Ñ/g, ":")
    .replace(/\?/g, "_")
    .replace(/'/g, "-")
    .replace(/`/g, '"')
    .replace(/´/g, '"')
    .replace(/“|”/g, '"')
    .replace(/‘|’/g, "-")
    .replace(/＋/g, ":")
    .replace(/\+/g, ":");

  text = text.replace(/\u0000/g, "").trim();

  if (!text.startsWith("{") && text.includes('"type"')) {
    text = `{${text}`;
  }
  if (!text.endsWith("}") && text.includes('"type"')) {
    text = `${text}}`;
  }

  text = text
    .replace(/,,+/g, ",")
    .replace(/"\s*,\s*"/g, '","')
    .replace(/"\s*:\s*"/g, '":"')
    .replace(/"\s*}\s*$/g, '"}')
    .replace(/^\s+|\s+$/g, "");

  return text;
}

async function generateBarcodeDataUrl(value: string) {
  const cleanValue = String(value || "").trim();
  if (!cleanValue) return null;

  const canvas = document.createElement("canvas");
  const scale = 3;

  canvas.width = 900;
  canvas.height = 240;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  JsBarcode(canvas, cleanValue, {
    format: "CODE128",
    displayValue: true,
    font: "monospace",
    fontOptions: "bold",
    fontSize: 16,
    textMargin: 6,
    margin: 0,
    height: 52,
    width: 2.2,
    background: "#ffffff",
    lineColor: "#000000",
  });

  return canvas.toDataURL("image/png");
}

export default function ProduccionPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  const [ordenes, setOrdenes] = useState<OrdenProduccion[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [etapaFiltro, setEtapaFiltro] = useState("");
  const [prioridadFiltro, setPrioridadFiltro] = useState("");

  const [sortKey, setSortKey] = useState<SortKeyProduccion>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [paginaActual, setPaginaActual] = useState(1);
  const [filasPorPagina, setFilasPorPagina] = useState(10);

  const [detalleOpen, setDetalleOpen] = useState(false);
  const [ordenActiva, setOrdenActiva] = useState<OrdenProduccion | null>(null);

  const [procesando, setProcesando] = useState(false);

  const [etapaSeleccionada, setEtapaSeleccionada] = useState<EtapaProduccion | null>(null);

  const [responsableNombre, setResponsableNombre] = useState("");
  const [fechaCompromisoEtapa, setFechaCompromisoEtapa] = useState("");
  const [costoManoObra, setCostoManoObra] = useState("0");
  const [observacionesEtapa, setObservacionesEtapa] = useState("");

  const [cantidadProcesada, setCantidadProcesada] = useState("0");
  const [cantidadObservada, setCantidadObservada] = useState("0");
  const [observacionesFinalizar, setObservacionesFinalizar] = useState("");

  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [scanMode, setScanMode] = useState<"CAMARA" | "MANUAL">("CAMARA");
  const [scanExpected, setScanExpected] = useState<"OP_GENERAL" | "OP_CAJA">("OP_GENERAL");
  const [scannerInput, setScannerInput] = useState("");
  const [scannerStatus, setScannerStatus] = useState("Listo para escanear");
  const [cameraError, setCameraError] = useState("");
  const [lastScannedCaja, setLastScannedCaja] = useState<ScanPayloadCaja | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const qrScannerRef = useRef<{
    stop: () => void;
    destroy: () => void;
  } | null>(null);

  async function cargarOrdenes() {
    try {
      setLoading(true);
      const res = await fetch(`${apiUrl}/produccion`);
      const data = await readJsonSafe(res);

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "No se pudo cargar producción");
      }

      setOrdenes(data.data || []);
    } catch (error) {
      console.error(error);
      alert("No se pudo cargar producción");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarOrdenes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function limpiarFormularioEtapa() {
    setResponsableNombre("");
    setFechaCompromisoEtapa("");
    setCostoManoObra("0");
    setObservacionesEtapa("");
    setCantidadProcesada("0");
    setCantidadObservada("0");
    setObservacionesFinalizar("");
  }

  function prepararEtapa(etapa: EtapaProduccion | null) {
    setEtapaSeleccionada(etapa);

    if (!etapa) {
      limpiarFormularioEtapa();
      return;
    }

    setResponsableNombre(etapa.responsableNombre || "");
    setFechaCompromisoEtapa(
      etapa.fechaCompromiso
        ? new Date(etapa.fechaCompromiso).toISOString().slice(0, 10)
        : ""
    );
    setCostoManoObra(String(Number(etapa.costoManoObra || 0)));
    setObservacionesEtapa(etapa.observaciones || "");
    setCantidadProcesada(String(Number(etapa.cantidadRecibida || 0)));
    setCantidadObservada("0");
    setObservacionesFinalizar("");
  }

  async function abrirDetalle(id: string) {
    try {
      const res = await fetch(`${apiUrl}/produccion/${id}`);
      const data = await readJsonSafe(res);

      if (!res.ok || !data.ok) {
        alert(data.error || "No se pudo abrir la orden");
        return null;
      }

      const orden = data.data as OrdenProduccion;
      setOrdenActiva(orden);
      setDetalleOpen(true);
      prepararEtapa(null);

      return orden;
    } catch (error) {
      console.error(error);
      alert("Error al abrir detalle");
      return null;
    }
  }

  const ordenesFiltradas = useMemo(() => {
    const filtradas = ordenes.filter((o) => {
      const texto = q.trim().toLowerCase();

      const matchQ =
        !texto ||
        o.codigo.toLowerCase().includes(texto) ||
        o.modelo.toLowerCase().includes(texto) ||
        o.color.toLowerCase().includes(texto) ||
        String(o.productoBase?.codigo || "").toLowerCase().includes(texto) ||
        String(o.productoBase?.codigoBarras || "").toLowerCase().includes(texto);

      const matchEstado = !estadoFiltro || o.estadoGeneral === estadoFiltro;
      const matchEtapa = !etapaFiltro || o.etapaActual === etapaFiltro;
      const matchPrioridad = !prioridadFiltro || o.prioridad === prioridadFiltro;

      return matchQ && matchEstado && matchEtapa && matchPrioridad;
    });

    return [...filtradas].sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";

      switch (sortKey) {
        case "codigo":
          av = a.codigo;
          bv = b.codigo;
          break;
        case "modelo":
          av = a.modelo;
          bv = b.modelo;
          break;
        case "cantidadPares":
          av = a.cantidadPares;
          bv = b.cantidadPares;
          break;
        case "prioridad":
          av = a.prioridad;
          bv = b.prioridad;
          break;
        case "fechaCompromiso":
          av = a.fechaCompromiso ? new Date(a.fechaCompromiso).getTime() : 0;
          bv = b.fechaCompromiso ? new Date(b.fechaCompromiso).getTime() : 0;
          break;
        case "estadoGeneral":
          av = a.estadoGeneral;
          bv = b.estadoGeneral;
          break;
        case "etapaActual":
          av = a.etapaActual || "";
          bv = b.etapaActual || "";
          break;
        case "createdAt":
          av = new Date(a.createdAt).getTime();
          bv = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          break;
      }

      if (typeof av === "string") av = av.toUpperCase();
      if (typeof bv === "string") bv = bv.toUpperCase();

      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [ordenes, q, estadoFiltro, etapaFiltro, prioridadFiltro, sortKey, sortDir]);

  const totalPaginas = Math.max(1, Math.ceil(ordenesFiltradas.length / filasPorPagina));
  const ordenesPagina = useMemo(() => {
    const start = (paginaActual - 1) * filasPorPagina;
    return ordenesFiltradas.slice(start, start + filasPorPagina);
  }, [ordenesFiltradas, paginaActual, filasPorPagina]);

  useEffect(() => {
    setPaginaActual(1);
  }, [q, estadoFiltro, etapaFiltro, prioridadFiltro, filasPorPagina]);

  function toggleSort(key: SortKeyProduccion) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function sortLabel(label: string, key: SortKeyProduccion) {
    if (sortKey !== key) return `${label} ↕`;
    return `${label} ${sortDir === "asc" ? "▲" : "▼"}`;
  }

  function badgeEstado(estado: string) {
    const map: Record<string, string> = {
      LIBERADA: "bg-slate-100 text-slate-700",
      EN_PROCESO: "bg-blue-100 text-blue-700",
      PAUSADA: "bg-yellow-100 text-yellow-700",
      TERMINADA: "bg-emerald-100 text-emerald-700",
      CANCELADA: "bg-red-100 text-red-700",
    };

    return (
      <span
        className={`rounded-full px-3 py-1 text-xs font-bold ${
          map[estado] || "bg-slate-100 text-slate-700"
        }`}
      >
        {estado}
      </span>
    );
  }

  function badgeEtapa(estado: string) {
    const map: Record<string, string> = {
      PENDIENTE: "bg-slate-100 text-slate-700",
      EN_PROCESO: "bg-blue-100 text-blue-700",
      TERMINADA: "bg-emerald-100 text-emerald-700",
      OBSERVADA: "bg-red-100 text-red-700",
      ESPERA: "bg-yellow-100 text-yellow-700",
    };

    return (
      <span
        className={`rounded-full px-3 py-1 text-xs font-bold ${
          map[estado] || "bg-slate-100 text-slate-700"
        }`}
      >
        {estado}
      </span>
    );
  }

  async function iniciarEtapa() {
    if (!ordenActiva || !etapaSeleccionada) return;

    try {
      setProcesando(true);

      const res = await fetch(
        `${apiUrl}/produccion/${ordenActiva.id}/etapas/${encodeURIComponent(
          etapaSeleccionada.etapa
        )}/iniciar`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            responsableNombre: responsableNombre || null,
            fechaCompromiso: fechaCompromisoEtapa || null,
            observaciones: observacionesEtapa || null,
            costoManoObra: Number(costoManoObra || 0),
            usuarioEmail: "admin@erp.com",
          }),
        }
      );

      const data = await readJsonSafe(res);

      if (!res.ok || !data.ok) {
        alert(data.error || "No se pudo iniciar la etapa");
        return;
      }

      await cargarOrdenes();
      const orden = await abrirDetalle(ordenActiva.id);
      prepararEtapa(getCurrentStage(orden));
      alert("Etapa iniciada correctamente");
    } catch (error) {
      console.error(error);
      alert("Error iniciando etapa");
    } finally {
      setProcesando(false);
    }
  }

  async function finalizarEtapa() {
    if (!ordenActiva || !etapaSeleccionada) return;

    try {
      setProcesando(true);

      const res = await fetch(
        `${apiUrl}/produccion/${ordenActiva.id}/etapas/${encodeURIComponent(
          etapaSeleccionada.etapa
        )}/finalizar`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            cantidadProcesada: Number(cantidadProcesada || 0),
            cantidadObservada: Number(cantidadObservada || 0),
            observaciones: observacionesFinalizar || null,
            usuarioEmail: "admin@erp.com",
          }),
        }
      );

      const data = await readJsonSafe(res);

      if (!res.ok || !data.ok) {
        alert(data.error || "No se pudo finalizar la etapa");
        return;
      }

      await cargarOrdenes();
      const orden = await abrirDetalle(ordenActiva.id);
      prepararEtapa(getCurrentStage(orden));
      setLastScannedCaja(null);
      alert("Etapa finalizada correctamente");
    } catch (error) {
      console.error(error);
      alert("Error finalizando etapa");
    } finally {
      setProcesando(false);
    }
  }

  async function moverUnaCajaRapido() {
    if (!ordenActiva || !etapaSeleccionada || !lastScannedCaja) return;

    try {
      setProcesando(true);

      const res = await fetch(
        `${apiUrl}/produccion/${ordenActiva.id}/etapas/${encodeURIComponent(
          etapaSeleccionada.etapa
        )}/finalizar`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            cantidadProcesada: 1,
            cantidadObservada: 0,
            observaciones: `Movimiento rápido por escaneo · OP ${lastScannedCaja.opCodigo}`,
            usuarioEmail: "admin@erp.com",
          }),
        }
      );

      const data = await readJsonSafe(res);

      if (!res.ok || !data.ok) {
        alert(data.error || "No se pudo mover la caja");
        return;
      }

      await cargarOrdenes();
      const orden = await abrirDetalle(ordenActiva.id);
      prepararEtapa(getCurrentStage(orden));
      setLastScannedCaja(null);
      alert("Caja movida correctamente");
    } catch (error) {
      console.error(error);
      alert("Error moviendo caja");
    } finally {
      setProcesando(false);
    }
  }

  async function generarEtiquetaCajaPDF(orden: OrdenProduccion) {
    try {
      const width = mmToPt(100);
      const height = mmToPt(50);

      const margin = 10;
      const frameX = margin;
      const frameY = margin;
      const frameW = width - margin * 2;
      const frameH = height - margin * 2;

      const tallaBoxX = 16;
      const tallaBoxW = 56;

      const rightColW = 86;
      const rightColX = width - margin - rightColW;

      const logoX = rightColX + 8;
      const logoY = 12;
      const logoW = rightColW - 16;
      const logoH = 12;

      const qrSize = 58;
      const qrX = rightColX + (rightColW - qrSize) / 2;
      const qrY = 28;

      const leftX = tallaBoxX + tallaBoxW + 8;
      const leftW = rightColX - leftX - 8;

      const modeloY = 26;
      const lineY = 32;
      const colorY = 42;
      const materialY = 52;
      const tacoY = 62;
      const coleccionY = 72;

      const barcodeX = 18;
      const barcodeY = 84;
      const barcodeW = rightColX - barcodeX - 10;
      const barcodeH = 38;

      const entries = Object.entries(orden.corridaJson || {})
        .map(([talla, cantidad]) => ({
          talla,
          cantidad: Number(cantidad || 0),
        }))
        .filter((x) => x.cantidad > 0);

      const etiquetas: Array<{
        talla: string;
        index: number;
        total: number;
      }> = [];

      for (const item of entries) {
        for (let i = 1; i <= item.cantidad; i++) {
          etiquetas.push({
            talla: item.talla,
            index: i,
            total: item.cantidad,
          });
        }
      }

      const doc = new jsPDF({
        orientation: "landscape",
        unit: "pt",
        format: [width, height],
      });

      let logoSvgText = "";
      try {
        logoSvgText = await loadSvgText(COMPANY_LOGO_PATH);
      } catch (e) {
        console.warn("No se pudo cargar el logo SVG:", e);
      }

      for (let i = 0; i < etiquetas.length; i++) {
        if (i > 0) doc.addPage([width, height], "landscape");

        const item = etiquetas[i];

        const payload: ScanPayloadCaja = {
          type: "OP_CAJA",
          opCodigo: orden.codigo,
        };

        const qrUrl = await QRCode.toDataURL(JSON.stringify(payload), {
          margin: 1,
          width: 420,
          errorCorrectionLevel: "H",
        });

        const barcodeValue = String(
          orden.codigoBarrasPorTalla?.[String(item.talla)] ||
            orden.productoBase?.codigoBarras ||
            ""
        ).trim();

        const barcodeUrl = barcodeValue
          ? await generateBarcodeDataUrl(barcodeValue)
          : null;

        drawPremiumFrame(doc, frameX, frameY, frameW, frameH);

        if (logoSvgText) {
          await drawSvgLogo(doc, logoSvgText, logoX, logoY, logoW, logoH);
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(0, 0, 0);
        doc.text("TALLA", tallaBoxX + tallaBoxW / 2, 28, { align: "center" });

        doc.setFont("helvetica", "bold");
        doc.setFontSize(30);
        doc.setTextColor(0, 0, 0);
        doc.text(String(item.talla), tallaBoxX + tallaBoxW / 2, 58, {
          align: "center",
        });

        const modeloTexto = safeUpper(orden.modelo);
        const modeloFont = fitText(doc, modeloTexto, leftW, 13, 8, "bold");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(modeloFont);
        doc.setTextColor(0, 0, 0);
        doc.text(truncateText(doc, modeloTexto, leftW), leftX, modeloY);

        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.4);
        doc.line(leftX, lineY, rightColX - 6, lineY);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.3);
        doc.setTextColor(0, 0, 0);
        doc.text("Color", leftX, colorY);
        doc.text("Material", leftX, materialY);
        doc.text("Taco", leftX, tacoY);
        doc.text("Colección", leftX, coleccionY);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.3);
        doc.setTextColor(0, 0, 0);
        doc.text(truncateText(doc, safeUpper(orden.color), leftW - 42), leftX + 42, colorY);
        doc.text(
          truncateText(doc, safeUpper(orden.material), leftW - 42),
          leftX + 42,
          materialY
        );
        doc.text(truncateText(doc, safeUpper(orden.taco), leftW - 42), leftX + 42, tacoY);
        doc.text(
          truncateText(doc, safeUpper(orden.coleccion), leftW - 42),
          leftX + 42,
          coleccionY
        );

        doc.addImage(qrUrl, "PNG", qrX, qrY, qrSize, qrSize);

        if (barcodeUrl) {
          doc.addImage(barcodeUrl, "PNG", barcodeX, barcodeY, barcodeW, barcodeH);
        } else {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8);
          doc.setTextColor(120, 120, 120);
          doc.text("SIN CÓDIGO DE BARRAS", barcodeX + barcodeW / 2, barcodeY + 20, {
            align: "center",
          });
        }
      }

      doc.save(`${orden.codigo}-etiquetas-caja.pdf`);
    } catch (error) {
      console.error(error);
      alert("No se pudieron generar las etiquetas por caja");
    }
  }

  async function generarEtiquetaGeneralOP(orden: OrdenProduccion) {
    try {
      const width = mmToPt(100);
      const height = mmToPt(70);

      const margin = 12;
      const frameX = margin;
      const frameY = margin;
      const frameW = width - margin * 2;
      const frameH = height - margin * 2;

      const qrSize = 74;
      const qrX = width - margin - qrSize - 8;
      const qrY = 22;

      const leftX = 22;
      const leftW = qrX - leftX - 14;

      const doc = new jsPDF({
        orientation: "landscape",
        unit: "pt",
        format: [width, height],
      });

      const corridaTexto = Object.entries(orden.corridaJson || {})
        .map(([talla, cant]) => `${talla}:${cant}`)
        .join("  |  ");

      const payload: ScanPayloadGeneral = {
        type: "OP_GENERAL",
        opId: orden.id,
        opCodigo: orden.codigo,
      };

      const qrUrl = await QRCode.toDataURL(JSON.stringify(payload), {
        margin: 1,
        width: 240,
      });

      drawPremiumFrame(doc, frameX, frameY, frameW, frameH);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.setTextColor(0, 0, 0);
      doc.text(orden.codigo, leftX, 33);

      const modeloTexto = safeUpper(orden.modelo);
      const modeloFont = fitText(doc, modeloTexto, leftW, 19, 11, "bold");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(modeloFont);
      doc.setTextColor(0, 0, 0);
      doc.text(truncateText(doc, modeloTexto, leftW), leftX, 56);

      drawLabelField(doc, "Color", safeUpper(orden.color), leftX, 74, 44);
      drawLabelField(doc, "Material", safeUpper(orden.material), leftX, 87, 44);
      drawLabelField(doc, "Taco", safeUpper(orden.taco), leftX, 100, 44);
      drawLabelField(doc, "Pares", String(orden.cantidadPares), leftX, 113, 44);
      drawLabelField(doc, "Prioridad", safeUpper(orden.prioridad), leftX, 126, 44);
      drawLabelField(doc, "Entrega", formatDate(orden.fechaCompromiso), leftX, 139, 44);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      doc.text("Corrida", leftX, 153);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      const corridaLines = doc.splitTextToSize(corridaTexto || "-", leftW - 4);
      doc.text(corridaLines.slice(0, 2), leftX + 38, 153);

      doc.addImage(qrUrl, "PNG", qrX, qrY, qrSize, qrSize);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(0, 0, 0);
      doc.text("QR OP", qrX + qrSize / 2, qrY + qrSize + 11, {
        align: "center",
      });

      doc.save(`${orden.codigo}-etiqueta-op.pdf`);
    } catch (error) {
      console.error(error);
      alert("No se pudo generar la etiqueta general de OP");
    }
  }

  function stopCameraScanner() {
    try {
      qrScannerRef.current?.stop();
      qrScannerRef.current?.destroy();
      qrScannerRef.current = null;
    } catch {
      // noop
    }
  }

  async function startCameraScanner() {
    try {
      setCameraError("");
      setScannerStatus("Iniciando cámara...");

      if (!videoRef.current) return;

      stopCameraScanner();

      const mod = (await import("qr-scanner")) as QrScannerModule;
      const QrScanner = mod.default;

      const scanner = new QrScanner(
        videoRef.current,
        (result) => {
          const text = typeof result === "string" ? result : result?.data || "";
          if (!text) return;

          setScannerInput(text);
          setScannerStatus("QR detectado");
          stopCameraScanner();
          procesarTextoEscaneado(text);
        },
        {
          returnDetailedScanResult: true,
          highlightScanRegion: true,
          highlightCodeOutline: true,
        }
      );

      qrScannerRef.current = scanner;
      await scanner.start();
      setScannerStatus("Apunta la cámara al QR");
    } catch (error) {
      console.error(error);
      setCameraError(
        "No se pudo iniciar la cámara. Revisa permisos o usa el modo manual con lector externo."
      );
      setScannerStatus("Error de cámara");
    }
  }

  useEffect(() => {
    if (scanModalOpen && scanMode === "CAMARA") {
      startCameraScanner();
    } else {
      stopCameraScanner();
    }

    return () => {
      stopCameraScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanModalOpen, scanMode]);

  async function procesarTextoEscaneado(raw?: string) {
    try {
      const originalText = String(raw ?? scannerInput).trim();
      const text = normalizeScannerText(originalText);

      if (!text) {
        alert("No hay contenido escaneado.");
        return;
      }

      let payload: ScanPayload | null = null;

      try {
        payload = JSON.parse(text) as ScanPayload;
      } catch {
        const encontrada = ordenes.find(
          (o) => o.codigo === originalText || o.codigo === text
        );

        if (encontrada) {
          const orden = await abrirDetalle(encontrada.id);
          const etapa = getCurrentStage(orden);
          prepararEtapa(etapa);
          setScannerStatus(`OP abierta: ${encontrada.codigo}`);
          setScanModalOpen(false);
          setLastScannedCaja(null);
          return;
        }

        console.error("Texto original escaneado:", originalText);
        console.error("Texto normalizado:", text);

        alert(
          `El contenido escaneado no es un QR válido del sistema.\n\nOriginal:\n${originalText}\n\nNormalizado:\n${text}`
        );
        return;
      }

      if (!payload) {
        alert("QR inválido");
        return;
      }

      if (scanExpected === "OP_GENERAL" && payload.type !== "OP_GENERAL") {
        alert("Este lector está esperando una etiqueta general de OP.");
        return;
      }

      if (scanExpected === "OP_CAJA" && payload.type !== "OP_CAJA") {
        alert("Este lector está esperando una etiqueta de caja.");
        return;
      }

      if (payload.type === "OP_GENERAL") {
        const orden = await abrirDetalle(payload.opId);
        if (!orden) return;

        const etapaActual = getCurrentStage(orden);
        prepararEtapa(etapaActual);

        setScannerStatus(`OP abierta correctamente: ${payload.opCodigo}`);
        setScanModalOpen(false);
        setLastScannedCaja(null);
        return;
      }

      if (payload.type === "OP_CAJA") {
        const encontrada = ordenes.find((o) => o.codigo === payload.opCodigo);

        if (!encontrada) {
          alert(`No se encontró la OP ${payload.opCodigo}`);
          return;
        }

        const orden = await abrirDetalle(encontrada.id);
        if (!orden) return;

        const etapaActual = getCurrentStage(orden);
        prepararEtapa(etapaActual);

        setCantidadProcesada("1");
        setCantidadObservada("0");
        setObservacionesFinalizar(`Movimiento rápido por escaneo · OP ${payload.opCodigo}`);
        setScannerStatus(`Caja detectada · OP ${payload.opCodigo}`);
        setLastScannedCaja(payload);
        setScanModalOpen(false);
        return;
      }
    } catch (error) {
      console.error(error);
      alert("No se pudo procesar el escaneo.");
    }
  }

  const etapasOrdenadas = ordenActiva
    ? [...ordenActiva.etapas].sort((a, b) => a.ordenEtapa - b.ordenEtapa)
    : [];

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Producción</h1>
            <p className="text-sm text-slate-500">
              Control visual de órdenes, etapas, movimientos y etiquetas del taller
            </p>
          </div>

          <button
            onClick={() => {
              setScanModalOpen(true);
              setScannerStatus("Listo para escanear");
              setScannerInput("");
            }}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Escanear etiqueta
          </button>
        </div>

        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar OP, modelo, color o código producto"
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
          />

          <select
            value={estadoFiltro}
            onChange={(e) => setEstadoFiltro(e.target.value)}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
          >
            <option value="">Estado general</option>
            <option value="LIBERADA">LIBERADA</option>
            <option value="EN_PROCESO">EN_PROCESO</option>
            <option value="PAUSADA">PAUSADA</option>
            <option value="TERMINADA">TERMINADA</option>
            <option value="CANCELADA">CANCELADA</option>
          </select>

          <select
            value={etapaFiltro}
            onChange={(e) => setEtapaFiltro(e.target.value)}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
          >
            <option value="">Etapa actual</option>
            <option value="CORTADO">CORTADO</option>
            <option value="PERFILADO">PERFILADO</option>
            <option value="ARMADO">ARMADO</option>
            <option value="ALISTADO">ALISTADO</option>
            <option value="TERMINADO">TERMINADO</option>
            <option value="INGRESO_ALMACEN">INGRESO_ALMACEN</option>
          </select>

          <select
            value={prioridadFiltro}
            onChange={(e) => setPrioridadFiltro(e.target.value)}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
          >
            <option value="">Prioridad</option>
            <option value="BAJA">BAJA</option>
            <option value="MEDIA">MEDIA</option>
            <option value="ALTA">ALTA</option>
          </select>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Cargando producción...</p>
        ) : ordenesFiltradas.length === 0 ? (
          <p className="text-sm text-slate-500">No hay órdenes para esos filtros.</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100 text-left text-slate-700">
                  <tr>
                    <th onClick={() => toggleSort("codigo")} className="cursor-pointer px-4 py-3 font-bold">
                      {sortLabel("Código", "codigo")}
                    </th>
                    <th onClick={() => toggleSort("modelo")} className="cursor-pointer px-4 py-3 font-bold">
                      {sortLabel("Modelo", "modelo")}
                    </th>
                    <th onClick={() => toggleSort("cantidadPares")} className="cursor-pointer px-4 py-3 font-bold">
                      {sortLabel("Pares", "cantidadPares")}
                    </th>
                    <th onClick={() => toggleSort("prioridad")} className="cursor-pointer px-4 py-3 font-bold">
                      {sortLabel("Prioridad", "prioridad")}
                    </th>
                    <th onClick={() => toggleSort("fechaCompromiso")} className="cursor-pointer px-4 py-3 font-bold">
                      {sortLabel("Compromiso", "fechaCompromiso")}
                    </th>
                    <th onClick={() => toggleSort("estadoGeneral")} className="cursor-pointer px-4 py-3 font-bold">
                      {sortLabel("Estado", "estadoGeneral")}
                    </th>
                    <th onClick={() => toggleSort("etapaActual")} className="cursor-pointer px-4 py-3 font-bold">
                      {sortLabel("Etapa actual", "etapaActual")}
                    </th>
                    <th onClick={() => toggleSort("createdAt")} className="cursor-pointer px-4 py-3 font-bold">
                      {sortLabel("Creación", "createdAt")}
                    </th>
                    <th className="px-4 py-3 font-bold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {ordenesPagina.map((orden) => (
                    <tr key={orden.id} className="border-t border-slate-200 bg-white hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-900">{orden.codigo}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{orden.modelo}</div>
                        <div className="text-xs text-slate-500">
                          {orden.color} · {orden.material || "-"} · {orden.taco || "-"}
                        </div>
                      </td>
                      <td className="px-4 py-3">{orden.cantidadPares}</td>
                      <td className="px-4 py-3">{orden.prioridad}</td>
                      <td className="px-4 py-3">{formatDate(orden.fechaCompromiso)}</td>
                      <td className="px-4 py-3">{badgeEstado(orden.estadoGeneral)}</td>
                      <td className="px-4 py-3">{orden.etapaActual || "-"}</td>
                      <td className="px-4 py-3">{formatDate(orden.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => abrirDetalle(orden.id)}
                            className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            Ver detalle
                          </button>
                          <button
                            onClick={() => generarEtiquetaCajaPDF(orden)}
                            className="rounded-lg border border-blue-300 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                          >
                            Etiquetas cajas
                          </button>
                          <button
                            onClick={() => generarEtiquetaGeneralOP(orden)}
                            className="rounded-lg border border-emerald-300 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                          >
                            Etiqueta OP
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <span>Mostrar</span>
                <select
                  value={filasPorPagina}
                  onChange={(e) => setFilasPorPagina(Number(e.target.value))}
                  className="rounded-lg border border-slate-300 px-3 py-2"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span>filas</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  disabled={paginaActual <= 1}
                  onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  ◀ Anterior
                </button>
                <div className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                  Página {paginaActual} de {totalPaginas}
                </div>
                <button
                  disabled={paginaActual >= totalPaginas}
                  onClick={() => setPaginaActual((p) => Math.min(totalPaginas, p + 1))}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  Siguiente ▶
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {scanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-slate-900">Scanner de producción</h2>
                <p className="text-sm text-slate-500">
                  Usa cámara del celular o lector externo
                </p>
              </div>

              <button
                onClick={() => {
                  stopCameraScanner();
                  setScanModalOpen(false);
                }}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Cerrar
              </button>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setScanExpected("OP_GENERAL")}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                  scanExpected === "OP_GENERAL"
                    ? "bg-slate-900 text-white"
                    : "border border-slate-300 text-slate-700"
                }`}
              >
                Scanner QR OP
              </button>
              <button
                type="button"
                onClick={() => setScanExpected("OP_CAJA")}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                  scanExpected === "OP_CAJA"
                    ? "bg-slate-900 text-white"
                    : "border border-slate-300 text-slate-700"
                }`}
              >
                Scanner QR cajas
              </button>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setScanMode("CAMARA")}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                  scanMode === "CAMARA"
                    ? "bg-blue-600 text-white"
                    : "border border-slate-300 text-slate-700"
                }`}
              >
                Cámara celular
              </button>
              <button
                type="button"
                onClick={() => setScanMode("MANUAL")}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                  scanMode === "MANUAL"
                    ? "bg-blue-600 text-white"
                    : "border border-slate-300 text-slate-700"
                }`}
              >
                Manual / lector externo
              </button>
            </div>

            <div className="mb-3 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
              {scannerStatus}
            </div>

            {scanMode === "CAMARA" ? (
              <div className="space-y-3">
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-black">
                  <video
                    ref={videoRef}
                    className="h-[340px] w-full object-cover"
                    muted
                    playsInline
                  />
                </div>

                {cameraError ? (
                  <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                    {cameraError}
                  </div>
                ) : null}

                <div className="rounded-xl bg-blue-50 p-3 text-sm text-blue-700">
                  Apunta la cámara al QR. Se abrirá la OP automáticamente.
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <textarea
                  value={scannerInput}
                  onChange={(e) => setScannerInput(e.target.value)}
                  placeholder="Pega aquí el contenido del QR o usa tu lector externo..."
                  className="min-h-[180px] w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm"
                />

                <button
                  onClick={() => procesarTextoEscaneado()}
                  className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Procesar escaneo manual
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {detalleOpen && ordenActiva && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4">
          <div className="max-h-[95vh] w-full max-w-7xl overflow-y-auto rounded-3xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black text-slate-900">
                  Orden {ordenActiva.codigo}
                </h2>
                <p className="text-sm text-slate-500">
                  {ordenActiva.modelo} · {ordenActiva.color} · {ordenActiva.material || "-"} ·{" "}
                  {ordenActiva.taco || "-"}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => generarEtiquetaCajaPDF(ordenActiva)}
                  className="rounded-xl border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                >
                  Etiquetas cajas
                </button>
                <button
                  onClick={() => generarEtiquetaGeneralOP(ordenActiva)}
                  className="rounded-xl border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
                >
                  Etiqueta OP
                </button>
                <button
                  onClick={() => setDetalleOpen(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Cerrar
                </button>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <div className="space-y-4 lg:col-span-2">
                <section className="rounded-2xl border border-slate-200 p-4">
                  <h3 className="mb-3 text-lg font-black text-slate-900">Resumen</h3>
                  <div className="grid gap-3 text-sm text-slate-700 md:grid-cols-2">
                    <div><b>Código:</b> {ordenActiva.codigo}</div>
                    <div><b>Producto base:</b> {ordenActiva.productoBase.codigo}</div>
                    <div><b>Código barras:</b> {ordenActiva.productoBase.codigoBarras || "-"}</div>
                    <div><b>Modelo:</b> {ordenActiva.modelo}</div>
                    <div><b>Color:</b> {ordenActiva.color}</div>
                    <div><b>Material:</b> {ordenActiva.material || "-"}</div>
                    <div><b>Taco:</b> {ordenActiva.taco || "-"}</div>
                    <div><b>Colección:</b> {ordenActiva.coleccion || "-"}</div>
                    <div><b>Almacén destino:</b> {ordenActiva.almacenDestino.codigo}</div>
                    <div><b>Cantidad pares:</b> {ordenActiva.cantidadPares}</div>
                    <div><b>Prioridad:</b> {ordenActiva.prioridad}</div>
                    <div><b>Estado:</b> {ordenActiva.estadoGeneral}</div>
                    <div><b>Etapa actual:</b> {ordenActiva.etapaActual || "-"}</div>
                    <div><b>Fecha compromiso:</b> {formatDate(ordenActiva.fechaCompromiso)}</div>
                    <div><b>Entrega real:</b> {formatDate(ordenActiva.fechaEntregaReal)}</div>
                    <div className="md:col-span-2"><b>Observaciones:</b> {ordenActiva.observaciones || "-"}</div>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 p-4">
                  <h3 className="mb-3 text-lg font-black text-slate-900">Corrida</h3>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(ordenActiva.corridaJson || {}).map(([talla, cantidad]) => (
                      <div
                        key={talla}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                      >
                        <b>Talla {talla}</b>: {cantidad}
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 p-4">
                  <h3 className="mb-3 text-lg font-black text-slate-900">Etapas</h3>

                  <div className="space-y-3">
                    {etapasOrdenadas.map((etapa) => (
                      <button
                        key={etapa.id}
                        onClick={() => prepararEtapa(etapa)}
                        className={`block w-full rounded-2xl border p-4 text-left ${
                          etapaSeleccionada?.id === etapa.id
                            ? "border-blue-400 bg-blue-50"
                            : "border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="font-bold text-slate-900">
                              {etapa.ordenEtapa}. {etapa.etapa}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              Responsable: {etapa.responsableNombre || "-"} · Inicio:{" "}
                              {formatDateTime(etapa.fechaInicio)} · Fin:{" "}
                              {formatDateTime(etapa.fechaFin)}
                            </div>
                          </div>
                          <div>{badgeEtapa(etapa.estadoEtapa)}</div>
                        </div>

                        <div className="mt-2 grid gap-2 text-xs text-slate-600 md:grid-cols-4">
                          <div>Recibida: <b>{etapa.cantidadRecibida}</b></div>
                          <div>Procesada: <b>{etapa.cantidadProcesada}</b></div>
                          <div>Observada: <b>{etapa.cantidadObservada}</b></div>
                          <div>MO: <b>{formatMoney(etapa.costoManoObra)}</b></div>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 p-4">
                  <h3 className="mb-3 text-lg font-black text-slate-900">Movimientos</h3>

                  {ordenActiva.movimientos.length === 0 ? (
                    <p className="text-sm text-slate-500">No hay movimientos aún.</p>
                  ) : (
                    <div className="space-y-3">
                      {ordenActiva.movimientos.map((mov) => (
                        <div key={mov.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                          <div className="font-bold text-slate-900">
                            {mov.etapaOrigen || "-"} → {mov.etapaDestino || "-"}
                          </div>
                          <div className="text-slate-600">Cantidad: {mov.cantidad}</div>
                          <div className="text-slate-600">
                            Sale: {mov.responsableSale || "-"} · Entra: {mov.responsableEntra || "-"}
                          </div>
                          <div className="text-xs text-slate-500">
                            {formatDateTime(mov.createdAt)} · {mov.usuarioEmail || "-"}
                          </div>
                          <div className="text-xs text-slate-500">{mov.observaciones || "-"}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>

              <div className="space-y-4">
                {lastScannedCaja ? (
                  <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                    <h3 className="mb-2 text-lg font-black text-slate-900">Caja escaneada</h3>
                    <div className="space-y-1 text-sm text-slate-700">
                      <div><b>OP:</b> {lastScannedCaja.opCodigo}</div>
                    </div>

                    <button
                      onClick={moverUnaCajaRapido}
                      disabled={procesando || !etapaSeleccionada}
                      className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                      Mover 1 caja
                    </button>
                  </section>
                ) : null}

                {etapaSeleccionada ? (
                  <>
                    <section className="rounded-2xl border border-slate-200 p-4">
                      <h3 className="mb-3 text-lg font-black text-slate-900">
                        Iniciar etapa: {etapaSeleccionada.etapa}
                      </h3>

                      <div className="space-y-3">
                        <input
                          value={responsableNombre}
                          onChange={(e) => setResponsableNombre(e.target.value)}
                          placeholder="Responsable"
                          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                        />

                        <input
                          type="date"
                          value={fechaCompromisoEtapa}
                          onChange={(e) => setFechaCompromisoEtapa(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                        />

                        <input
                          type="number"
                          step="0.01"
                          value={costoManoObra}
                          onChange={(e) => setCostoManoObra(e.target.value)}
                          placeholder="Costo mano de obra"
                          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                        />

                        <textarea
                          value={observacionesEtapa}
                          onChange={(e) => setObservacionesEtapa(e.target.value)}
                          placeholder="Observaciones de inicio"
                          className="min-h-[90px] w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                        />

                        <button
                          onClick={iniciarEtapa}
                          disabled={procesando}
                          className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                          Iniciar etapa
                        </button>
                      </div>
                    </section>

                    <section className="rounded-2xl border border-slate-200 p-4">
                      <h3 className="mb-3 text-lg font-black text-slate-900">
                        Finalizar etapa: {etapaSeleccionada.etapa}
                      </h3>

                      <div className="space-y-3">
                        <input
                          type="number"
                          min={0}
                          value={cantidadProcesada}
                          onChange={(e) => setCantidadProcesada(e.target.value)}
                          placeholder="Cantidad procesada"
                          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                        />

                        <input
                          type="number"
                          min={0}
                          value={cantidadObservada}
                          onChange={(e) => setCantidadObservada(e.target.value)}
                          placeholder="Cantidad observada"
                          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                        />

                        <textarea
                          value={observacionesFinalizar}
                          onChange={(e) => setObservacionesFinalizar(e.target.value)}
                          placeholder="Observaciones de cierre"
                          className="min-h-[90px] w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                        />

                        <button
                          onClick={finalizarEtapa}
                          disabled={procesando}
                          className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                        >
                          Finalizar etapa
                        </button>
                      </div>
                    </section>
                  </>
                ) : (
                  <section className="rounded-2xl border border-slate-200 p-4">
                    <h3 className="mb-2 text-lg font-black text-slate-900">Acciones</h3>
                    <p className="text-sm text-slate-500">
                      Selecciona una etapa para iniciar o finalizar el trabajo.
                    </p>
                  </section>
                )}

                <section className="rounded-2xl border border-slate-200 p-4">
                  <h3 className="mb-3 text-lg font-black text-slate-900">Etiquetas</h3>

                  <div className="space-y-2">
                    <button
                      onClick={() => generarEtiquetaCajaPDF(ordenActiva)}
                      className="w-full rounded-xl border border-blue-300 px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                    >
                      Generar etiquetas por caja
                    </button>
                    <button
                      onClick={() => generarEtiquetaGeneralOP(ordenActiva)}
                      className="w-full rounded-xl border border-emerald-300 px-4 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
                    >
                      Generar etiqueta general OP
                    </button>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}