"use client";

import { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Almacen = {
  id: string;
  codigo: string;
  nombre: string;
  activo: boolean;
};

type Caja = {
  id: string;
  codigo: string;
  nombre: string;
  almacenId: string;
  saldoInicial: string | number;
  saldoActual: string | number;
  responsable?: string | null;
  estado: "ABIERTA" | "CERRADA";
  fechaApertura?: string | null;
  fechaCierre?: string | null;
  notas?: string | null;
  saldoContado?: string | number | null;
  diferenciaCierre?: string | number | null;
  observacionCierre?: string | null;
  createdAt: string;
  updatedAt: string;
  almacen: Almacen;
  movimientos?: MovimientoCaja[];
};

type MovimientoCaja = {
  id: string;
  cajaId: string;
  tipo: "INGRESO" | "EGRESO" | "TRANSFERENCIA" | "AJUSTE";
  subtipo?: string | null;
  monto: string | number;
  moneda: string;
  metodoPago?: string | null;
  referencia?: string | null;
  proveedor?: string | null;
  persona?: string | null;
  usuarioEmail?: string | null;
  facturaSiNo?: string | null;
  numFactura?: string | null;
  vinculo?: string | null;
  detalle?: string | null;
  saldoPost: string | number;
  notas?: string | null;
  createdAt: string;
  caja?: Caja;
};

type SortCajaKey =
  | "codigo"
  | "nombre"
  | "almacen"
  | "saldoInicial"
  | "saldoActual"
  | "estado"
  | "fechaApertura"
  | "createdAt";

type SortMovimientoKey =
  | "createdAt"
  | "tipo"
  | "subtipo"
  | "monto"
  | "metodoPago"
  | "persona"
  | "saldoPost";

async function readJsonSafe(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(text || "Respuesta no válida del servidor");
  }
}

function formatMoney(v: string | number | null | undefined) {
  return `S/ ${Number(v || 0).toFixed(2)}`;
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

export default function CajaPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  const [cajas, setCajas] = useState<Caja[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoCaja[]>([]);
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);

  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState(false);

  const [cajaActiva, setCajaActiva] = useState<Caja | null>(null);

  const [modalNuevaCaja, setModalNuevaCaja] = useState(false);
  const [modalAbrirCaja, setModalAbrirCaja] = useState(false);
  const [modalCerrarCaja, setModalCerrarCaja] = useState(false);
  const [modalMovimiento, setModalMovimiento] = useState(false);
  const [detalleCajaOpen, setDetalleCajaOpen] = useState(false);
  const [detalleCaja, setDetalleCaja] = useState<Caja | null>(null);

  const [codigoCaja, setCodigoCaja] = useState("");
  const [nombreCaja, setNombreCaja] = useState("");
  const [almacenIdCaja, setAlmacenIdCaja] = useState("");
  const [saldoInicialCaja, setSaldoInicialCaja] = useState("0");
  const [responsableCaja, setResponsableCaja] = useState("admin@erp.com");
  const [notasCaja, setNotasCaja] = useState("");

  const [cajaSeleccionadaAbrirId, setCajaSeleccionadaAbrirId] = useState("");
  const [saldoApertura, setSaldoApertura] = useState("0");

  const [notasCierre, setNotasCierre] = useState("");
  const [observacionCierre, setObservacionCierre] = useState("");
  const [saldoContadoCierre, setSaldoContadoCierre] = useState("0");

  const [arqueoEfectivo, setArqueoEfectivo] = useState("0");
  const [arqueoYape, setArqueoYape] = useState("0");
  const [arqueoPlin, setArqueoPlin] = useState("0");
  const [arqueoTransferencia, setArqueoTransferencia] = useState("0");
  const [arqueoOtros, setArqueoOtros] = useState("0");

  const [movimientoTipo, setMovimientoTipo] = useState<"INGRESO" | "EGRESO" | "AJUSTE">("INGRESO");
  const [movimientoSubtipo, setMovimientoSubtipo] = useState("");
  const [movimientoMonto, setMovimientoMonto] = useState("0");
  const [movimientoMetodoPago, setMovimientoMetodoPago] = useState("EFECTIVO");
  const [movimientoReferencia, setMovimientoReferencia] = useState("");
  const [movimientoPersona, setMovimientoPersona] = useState("");
  const [movimientoDetalle, setMovimientoDetalle] = useState("");
  const [movimientoNotas, setMovimientoNotas] = useState("");

  const [qCaja, setQCaja] = useState("");
  const [estadoCajaFiltro, setEstadoCajaFiltro] = useState("");
  const [sortCajaKey, setSortCajaKey] = useState<SortCajaKey>("createdAt");
  const [sortCajaDir, setSortCajaDir] = useState<"asc" | "desc">("desc");

  const [qMov, setQMov] = useState("");
  const [tipoMovFiltro, setTipoMovFiltro] = useState("");
  const [metodoMovFiltro, setMetodoMovFiltro] = useState("");
  const [fechaDesdeMov, setFechaDesdeMov] = useState("");
  const [fechaHastaMov, setFechaHastaMov] = useState("");
  const [sortMovKey, setSortMovKey] = useState<SortMovimientoKey>("createdAt");
  const [sortMovDir, setSortMovDir] = useState<"asc" | "desc">("desc");

  const [paginaCajas, setPaginaCajas] = useState(1);
  const [filasCajas, setFilasCajas] = useState(10);

  const [paginaMov, setPaginaMov] = useState(1);
  const [filasMov, setFilasMov] = useState(10);

  async function cargarTodo() {
    try {
      setLoading(true);

      const [cajasRes, movsRes, almacenesRes] = await Promise.all([
        fetch(`${apiUrl}/cajas`),
        fetch(`${apiUrl}/movimientos-caja`),
        fetch(`${apiUrl}/almacenes`),
      ]);

      const cajasData = await readJsonSafe(cajasRes);
      const movsData = await readJsonSafe(movsRes);
      const almacenesData = await readJsonSafe(almacenesRes);

      const cajasList = cajasData.data || [];
      const movsList = movsData.data || [];
      const almacenesList = almacenesData.data || [];

      setCajas(cajasList);
      setMovimientos(movsList);
      setAlmacenes(almacenesList);

      const abierta = cajasList.find((c: Caja) => c.estado === "ABIERTA") || null;
      setCajaActiva(abierta);

      if (almacenesList.length > 0 && !almacenIdCaja) {
        setAlmacenIdCaja(almacenesList[0].id);
      }
    } catch (error) {
      console.error(error);
      alert("No se pudo cargar Caja / Tesorería.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarTodo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resumen = useMemo(() => {
    const hoy = new Date();
    const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime();

    const movsCajaActiva = cajaActiva
      ? movimientos.filter((m) => m.cajaId === cajaActiva.id)
      : [];

    const movsHoy = movsCajaActiva.filter(
      (m) => new Date(m.createdAt).getTime() >= inicioHoy
    );

    const ingresosHoy = movsHoy
      .filter((m) => m.tipo === "INGRESO")
      .reduce((acc, m) => acc + Number(m.monto || 0), 0);

    const egresosHoy = movsHoy
      .filter((m) => m.tipo === "EGRESO")
      .reduce((acc, m) => acc + Number(m.monto || 0), 0);

    const ingresosEfectivo = movsHoy
      .filter((m) => m.tipo === "INGRESO" && (m.metodoPago || "") === "EFECTIVO")
      .reduce((acc, m) => acc + Number(m.monto || 0), 0);

    const ingresosYape = movsHoy
      .filter((m) => m.tipo === "INGRESO" && (m.metodoPago || "") === "YAPE")
      .reduce((acc, m) => acc + Number(m.monto || 0), 0);

    const ingresosPlin = movsHoy
      .filter((m) => m.tipo === "INGRESO" && (m.metodoPago || "") === "PLIN")
      .reduce((acc, m) => acc + Number(m.monto || 0), 0);

    const ingresosTransferencia = movsHoy
      .filter((m) => m.tipo === "INGRESO" && (m.metodoPago || "") === "TRANSFERENCIA")
      .reduce((acc, m) => acc + Number(m.monto || 0), 0);

    return {
      ingresosHoy,
      egresosHoy,
      saldoInicial: Number(cajaActiva?.saldoInicial || 0),
      saldoActual: Number(cajaActiva?.saldoActual || 0),
      ingresosEfectivo,
      ingresosYape,
      ingresosPlin,
      ingresosTransferencia,
    };
  }, [cajaActiva, movimientos]);

  const totalArqueoMedios = useMemo(() => {
    return (
      Number(arqueoEfectivo || 0) +
      Number(arqueoYape || 0) +
      Number(arqueoPlin || 0) +
      Number(arqueoTransferencia || 0) +
      Number(arqueoOtros || 0)
    );
  }, [arqueoEfectivo, arqueoYape, arqueoPlin, arqueoTransferencia, arqueoOtros]);

  useEffect(() => {
    setSaldoContadoCierre(String(totalArqueoMedios.toFixed(2)));
  }, [totalArqueoMedios]);

  const cajasFiltradas = useMemo(() => {
    const filtradas = cajas.filter((c) => {
      const t = qCaja.trim().toLowerCase();

      const matchQ =
        !t ||
        c.codigo.toLowerCase().includes(t) ||
        c.nombre.toLowerCase().includes(t) ||
        c.almacen.codigo.toLowerCase().includes(t) ||
        c.almacen.nombre.toLowerCase().includes(t) ||
        String(c.responsable || "").toLowerCase().includes(t);

      const matchEstado = !estadoCajaFiltro || c.estado === estadoCajaFiltro;

      return matchQ && matchEstado;
    });

    return [...filtradas].sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";

      switch (sortCajaKey) {
        case "codigo":
          av = a.codigo;
          bv = b.codigo;
          break;
        case "nombre":
          av = a.nombre;
          bv = b.nombre;
          break;
        case "almacen":
          av = a.almacen.codigo;
          bv = b.almacen.codigo;
          break;
        case "saldoInicial":
          av = Number(a.saldoInicial || 0);
          bv = Number(b.saldoInicial || 0);
          break;
        case "saldoActual":
          av = Number(a.saldoActual || 0);
          bv = Number(b.saldoActual || 0);
          break;
        case "estado":
          av = a.estado;
          bv = b.estado;
          break;
        case "fechaApertura":
          av = a.fechaApertura ? new Date(a.fechaApertura).getTime() : 0;
          bv = b.fechaApertura ? new Date(b.fechaApertura).getTime() : 0;
          break;
        case "createdAt":
          av = new Date(a.createdAt).getTime();
          bv = new Date(b.createdAt).getTime();
          break;
      }

      if (typeof av === "string") av = av.toUpperCase();
      if (typeof bv === "string") bv = bv.toUpperCase();

      if (av < bv) return sortCajaDir === "asc" ? -1 : 1;
      if (av > bv) return sortCajaDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [cajas, qCaja, estadoCajaFiltro, sortCajaKey, sortCajaDir]);

  const movimientosFiltrados = useMemo(() => {
    const filtrados = movimientos.filter((m) => {
      const t = qMov.trim().toLowerCase();

      const matchQ =
        !t ||
        String(m.subtipo || "").toLowerCase().includes(t) ||
        String(m.metodoPago || "").toLowerCase().includes(t) ||
        String(m.referencia || "").toLowerCase().includes(t) ||
        String(m.persona || "").toLowerCase().includes(t) ||
        String(m.detalle || "").toLowerCase().includes(t) ||
        String(m.usuarioEmail || "").toLowerCase().includes(t);

      const matchTipo = !tipoMovFiltro || m.tipo === tipoMovFiltro;
      const matchMetodo = !metodoMovFiltro || (m.metodoPago || "") === metodoMovFiltro;

      const fecha = new Date(m.createdAt).getTime();
      const matchDesde =
        !fechaDesdeMov || fecha >= new Date(`${fechaDesdeMov}T00:00:00`).getTime();
      const matchHasta =
        !fechaHastaMov || fecha <= new Date(`${fechaHastaMov}T23:59:59`).getTime();

      return matchQ && matchTipo && matchMetodo && matchDesde && matchHasta;
    });

    return [...filtrados].sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";

      switch (sortMovKey) {
        case "createdAt":
          av = new Date(a.createdAt).getTime();
          bv = new Date(b.createdAt).getTime();
          break;
        case "tipo":
          av = a.tipo;
          bv = b.tipo;
          break;
        case "subtipo":
          av = a.subtipo || "";
          bv = b.subtipo || "";
          break;
        case "monto":
          av = Number(a.monto || 0);
          bv = Number(b.monto || 0);
          break;
        case "metodoPago":
          av = a.metodoPago || "";
          bv = b.metodoPago || "";
          break;
        case "persona":
          av = a.persona || "";
          bv = b.persona || "";
          break;
        case "saldoPost":
          av = Number(a.saldoPost || 0);
          bv = Number(b.saldoPost || 0);
          break;
      }

      if (typeof av === "string") av = av.toUpperCase();
      if (typeof bv === "string") bv = bv.toUpperCase();

      if (av < bv) return sortMovDir === "asc" ? -1 : 1;
      if (av > bv) return sortMovDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [
    movimientos,
    qMov,
    tipoMovFiltro,
    metodoMovFiltro,
    fechaDesdeMov,
    fechaHastaMov,
    sortMovKey,
    sortMovDir,
  ]);

  const totalPaginasCajas = Math.max(1, Math.ceil(cajasFiltradas.length / filasCajas));
  const cajasPagina = useMemo(() => {
    const start = (paginaCajas - 1) * filasCajas;
    return cajasFiltradas.slice(start, start + filasCajas);
  }, [cajasFiltradas, paginaCajas, filasCajas]);

  const totalPaginasMov = Math.max(1, Math.ceil(movimientosFiltrados.length / filasMov));
  const movsPagina = useMemo(() => {
    const start = (paginaMov - 1) * filasMov;
    return movimientosFiltrados.slice(start, start + filasMov);
  }, [movimientosFiltrados, paginaMov, filasMov]);

  useEffect(() => {
    setPaginaCajas(1);
  }, [qCaja, estadoCajaFiltro, filasCajas]);

  useEffect(() => {
    setPaginaMov(1);
  }, [qMov, tipoMovFiltro, metodoMovFiltro, fechaDesdeMov, fechaHastaMov, filasMov]);

  function toggleSortCaja(key: SortCajaKey) {
    if (sortCajaKey === key) {
      setSortCajaDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortCajaKey(key);
      setSortCajaDir("asc");
    }
  }

  function toggleSortMov(key: SortMovimientoKey) {
    if (sortMovKey === key) {
      setSortMovDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortMovKey(key);
      setSortMovDir("asc");
    }
  }

  function labelSortCaja(label: string, key: SortCajaKey) {
    if (sortCajaKey !== key) return `${label} ↕`;
    return `${label} ${sortCajaDir === "asc" ? "▲" : "▼"}`;
  }

  function labelSortMov(label: string, key: SortMovimientoKey) {
    if (sortMovKey !== key) return `${label} ↕`;
    return `${label} ${sortMovDir === "asc" ? "▲" : "▼"}`;
  }

  function badgeEstado(estado: string) {
    const styles =
      estado === "ABIERTA"
        ? "bg-emerald-100 text-emerald-700"
        : "bg-slate-100 text-slate-700";

    return (
      <span className={`rounded-full px-3 py-1 text-xs font-bold ${styles}`}>
        {estado}
      </span>
    );
  }

  function resetNuevaCaja() {
    setCodigoCaja("");
    setNombreCaja("");
    setSaldoInicialCaja("0");
    setResponsableCaja("admin@erp.com");
    setNotasCaja("");
  }

  function resetMovimiento() {
    setMovimientoTipo("INGRESO");
    setMovimientoSubtipo("");
    setMovimientoMonto("0");
    setMovimientoMetodoPago("EFECTIVO");
    setMovimientoReferencia("");
    setMovimientoPersona("");
    setMovimientoDetalle("");
    setMovimientoNotas("");
  }

  function resetCierre() {
    setNotasCierre("");
    setObservacionCierre("");
    setSaldoContadoCierre("0");
    setArqueoEfectivo("0");
    setArqueoYape("0");
    setArqueoPlin("0");
    setArqueoTransferencia("0");
    setArqueoOtros("0");
  }

  async function crearCaja() {
    try {
      setProcesando(true);

      const res = await fetch(`${apiUrl}/cajas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          codigo: codigoCaja,
          nombre: nombreCaja,
          almacenId: almacenIdCaja,
          saldoInicial: Number(saldoInicialCaja || 0),
          responsable: responsableCaja || null,
          notas: notasCaja || null,
        }),
      });

      const data = await readJsonSafe(res);

      if (!res.ok || !data.ok) {
        alert(data.error || "No se pudo crear la caja");
        return;
      }

      await cargarTodo();
      setModalNuevaCaja(false);
      resetNuevaCaja();
      alert("Caja creada correctamente");
    } catch (error) {
      console.error(error);
      alert("Error creando caja");
    } finally {
      setProcesando(false);
    }
  }

  async function abrirCaja(caja: Caja) {
    try {
      setProcesando(true);

      const res = await fetch(`${apiUrl}/cajas/${caja.id}/abrir`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          saldoInicial: Number(saldoApertura || 0),
          responsable: caja.responsable || "admin@erp.com",
        }),
      });

      const data = await readJsonSafe(res);

      if (!res.ok || !data.ok) {
        alert(data.error || "No se pudo abrir la caja");
        return;
      }

      await cargarTodo();
      setModalAbrirCaja(false);
      setCajaSeleccionadaAbrirId("");
      setSaldoApertura("0");
      alert("Caja abierta correctamente");
    } catch (error) {
      console.error(error);
      alert("Error abriendo caja");
    } finally {
      setProcesando(false);
    }
  }

  async function cerrarCaja(caja: Caja) {
    try {
      setProcesando(true);

      const observacionFinal = [
        observacionCierre ? `OBS: ${observacionCierre}` : "",
        `ARQUEO EFECTIVO: ${Number(arqueoEfectivo || 0).toFixed(2)}`,
        `ARQUEO YAPE: ${Number(arqueoYape || 0).toFixed(2)}`,
        `ARQUEO PLIN: ${Number(arqueoPlin || 0).toFixed(2)}`,
        `ARQUEO TRANSFERENCIA: ${Number(arqueoTransferencia || 0).toFixed(2)}`,
        `ARQUEO OTROS: ${Number(arqueoOtros || 0).toFixed(2)}`,
      ]
        .filter(Boolean)
        .join(" | ");

      const res = await fetch(`${apiUrl}/cajas/${caja.id}/cerrar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          saldoContado: Number(saldoContadoCierre || 0),
          notas: notasCierre || null,
          observacionCierre: observacionFinal || null,
        }),
      });

      const data = await readJsonSafe(res);

      if (!res.ok || !data.ok) {
        alert(data.error || "No se pudo cerrar la caja");
        return;
      }

      await cargarTodo();
      setModalCerrarCaja(false);
      resetCierre();
      alert("Caja cerrada correctamente");
    } catch (error) {
      console.error(error);
      alert("Error cerrando caja");
    } finally {
      setProcesando(false);
    }
  }

  async function registrarMovimiento() {
    if (!cajaActiva) {
      alert("No hay caja abierta.");
      return;
    }

    try {
      setProcesando(true);

      const monto = Number(movimientoMonto || 0);

      if (monto <= 0) {
        alert("El monto debe ser mayor a 0.");
        return;
      }

      const res = await fetch(`${apiUrl}/movimientos-caja`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cajaId: cajaActiva.id,
          tipo: movimientoTipo,
          subtipo: movimientoSubtipo || null,
          monto,
          moneda: "PEN",
          metodoPago: movimientoMetodoPago || null,
          referencia: movimientoReferencia || null,
          proveedor: null,
          persona: movimientoPersona || null,
          usuarioEmail: "admin@erp.com",
          facturaSiNo: null,
          numFactura: null,
          vinculo: null,
          detalle: movimientoDetalle || null,
          notas: movimientoNotas || null,
        }),
      });

      const data = await readJsonSafe(res);

      if (!res.ok || !data.ok) {
        alert(data.error || "No se pudo registrar el movimiento");
        return;
      }

      await cargarTodo();
      setModalMovimiento(false);
      resetMovimiento();
      alert("Movimiento registrado correctamente");
    } catch (error) {
      console.error(error);
      alert("Error registrando movimiento");
    } finally {
      setProcesando(false);
    }
  }

  async function verDetalleCaja(id: string) {
    try {
      const res = await fetch(`${apiUrl}/cajas/${id}`);
      const data = await readJsonSafe(res);

      if (!res.ok || !data.ok) {
        alert(data.error || "No se pudo cargar el detalle de caja");
        return;
      }

      setDetalleCaja(data.data);
      setDetalleCajaOpen(true);
    } catch (error) {
      console.error(error);
      alert("Error cargando detalle de caja");
    }
  }

  function exportarPdfCajaDia() {
    if (!cajaActiva) {
      alert("No hay caja abierta.");
      return;
    }

    const doc = new jsPDF();

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 28, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text("Reporte de Caja", 14, 18);

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(11);

    doc.text(`Caja: ${cajaActiva.codigo} - ${cajaActiva.nombre}`, 14, 40);
    doc.text(`Almacén: ${cajaActiva.almacen.codigo} - ${cajaActiva.almacen.nombre}`, 14, 48);
    doc.text(`Responsable: ${cajaActiva.responsable || "-"}`, 14, 56);
    doc.text(`Estado: ${cajaActiva.estado}`, 14, 64);
    doc.text(`Saldo inicial: ${formatMoney(cajaActiva.saldoInicial)}`, 110, 40);
    doc.text(`Saldo actual: ${formatMoney(cajaActiva.saldoActual)}`, 110, 48);
    doc.text(`Fecha apertura: ${formatDateTime(cajaActiva.fechaApertura)}`, 110, 56);
    doc.text(`Fecha cierre: ${formatDateTime(cajaActiva.fechaCierre)}`, 110, 64);

    doc.text(`Ingresos efectivo: ${formatMoney(resumen.ingresosEfectivo)}`, 14, 76);
    doc.text(`Ingresos Yape: ${formatMoney(resumen.ingresosYape)}`, 14, 84);
    doc.text(`Ingresos Plin: ${formatMoney(resumen.ingresosPlin)}`, 14, 92);
    doc.text(`Ingresos transferencia: ${formatMoney(resumen.ingresosTransferencia)}`, 14, 100);

    const movsCaja = movimientos
      .filter((m) => m.cajaId === cajaActiva.id)
      .sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

    autoTable(doc, {
      startY: 108,
      head: [[
        "Fecha",
        "Tipo",
        "Subtipo",
        "Monto",
        "Método",
        "Persona",
        "Saldo post",
      ]],
      body: movsCaja.map((m) => [
        formatDateTime(m.createdAt),
        m.tipo,
        m.subtipo || "-",
        formatMoney(m.monto),
        m.metodoPago || "-",
        m.persona || "-",
        formatMoney(m.saldoPost),
      ]),
      headStyles: {
        fillColor: [30, 41, 59],
      },
      styles: {
        fontSize: 8,
      },
    });

    doc.save(`caja-${cajaActiva.codigo}.pdf`);
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <section className="rounded-2xl bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6">
        <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
          <div>
            <h1 className="text-xl font-black text-slate-900 sm:text-2xl">Caja / Tesorería</h1>
            <p className="text-sm text-slate-500">
              Control profesional de cajas, movimientos, aperturas, cierres y arqueo
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:flex xl:flex-wrap">
            <button
              onClick={() => setModalNuevaCaja(true)}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:py-2"
            >
              + Nueva caja
            </button>

            {cajaActiva ? (
              <>
                <button
                  onClick={() => {
                    resetMovimiento();
                    setModalMovimiento(true);
                  }}
                  className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 sm:py-2"
                >
                  Registrar movimiento
                </button>
                <button
                  onClick={exportarPdfCajaDia}
                  className="rounded-xl border border-blue-300 px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-50 sm:py-2"
                >
                  PDF caja
                </button>
                <button
                  onClick={() => {
                    setArqueoEfectivo("0");
                    setArqueoYape("0");
                    setArqueoPlin("0");
                    setArqueoTransferencia("0");
                    setArqueoOtros("0");
                    setNotasCierre("");
                    setObservacionCierre("");
                    setSaldoContadoCierre(String(Number(cajaActiva.saldoActual || 0)));
                    setModalCerrarCaja(true);
                  }}
                  className="rounded-xl border border-red-300 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-50 sm:py-2"
                >
                  Cerrar caja
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  setCajaSeleccionadaAbrirId("");
                  setSaldoApertura("0");
                  setModalAbrirCaja(true);
                }}
                className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 sm:py-2"
              >
                Abrir caja
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
            <div className="text-sm font-semibold text-slate-500">Caja activa</div>
            <div className="mt-2 text-lg font-black text-slate-900 sm:text-xl">
              {cajaActiva ? cajaActiva.codigo : "Sin caja abierta"}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
            <div className="text-sm font-semibold text-slate-500">Saldo inicial</div>
            <div className="mt-2 text-2xl font-black text-slate-900 sm:text-3xl">
              {formatMoney(resumen.saldoInicial)}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
            <div className="text-sm font-semibold text-slate-500">Ingresos del día</div>
            <div className="mt-2 text-2xl font-black text-emerald-700 sm:text-3xl">
              {formatMoney(resumen.ingresosHoy)}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
            <div className="text-sm font-semibold text-slate-500">Saldo actual</div>
            <div className="mt-2 text-2xl font-black text-blue-700 sm:text-3xl">
              {formatMoney(resumen.saldoActual)}
            </div>
          </div>
        </div>

        {cajaActiva ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="text-xs font-semibold text-emerald-700">Ingresos efectivo</div>
              <div className="mt-2 text-lg font-black text-emerald-800 sm:text-xl">
                {formatMoney(resumen.ingresosEfectivo)}
              </div>
            </div>

            <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
              <div className="text-xs font-semibold text-cyan-700">Ingresos Yape</div>
              <div className="mt-2 text-lg font-black text-cyan-800 sm:text-xl">
                {formatMoney(resumen.ingresosYape)}
              </div>
            </div>

            <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
              <div className="text-xs font-semibold text-violet-700">Ingresos Plin</div>
              <div className="mt-2 text-lg font-black text-violet-800 sm:text-xl">
                {formatMoney(resumen.ingresosPlin)}
              </div>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="text-xs font-semibold text-amber-700">Ingresos transferencia</div>
              <div className="mt-2 text-lg font-black text-amber-800 sm:text-xl">
                {formatMoney(resumen.ingresosTransferencia)}
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6">
        <div className="mb-4">
          <h2 className="text-lg font-black text-slate-900 sm:text-xl">Cajas</h2>
          <p className="text-sm text-slate-500">Listado, estado y detalle de cajas registradas</p>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <input
            value={qCaja}
            onChange={(e) => setQCaja(e.target.value)}
            placeholder="Buscar por código, nombre, almacén o responsable"
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
          />

          <select
            value={estadoCajaFiltro}
            onChange={(e) => setEstadoCajaFiltro(e.target.value)}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
          >
            <option value="">Todos los estados</option>
            <option value="ABIERTA">ABIERTA</option>
            <option value="CERRADA">CERRADA</option>
          </select>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Cargando cajas...</p>
        ) : (
          <>
            <div className="hidden xl:block overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100 text-left text-slate-700">
                  <tr>
                    <th onClick={() => toggleSortCaja("codigo")} className="cursor-pointer px-4 py-3 font-bold">
                      {labelSortCaja("Código", "codigo")}
                    </th>
                    <th onClick={() => toggleSortCaja("nombre")} className="cursor-pointer px-4 py-3 font-bold">
                      {labelSortCaja("Nombre", "nombre")}
                    </th>
                    <th onClick={() => toggleSortCaja("almacen")} className="cursor-pointer px-4 py-3 font-bold">
                      {labelSortCaja("Almacén", "almacen")}
                    </th>
                    <th onClick={() => toggleSortCaja("saldoInicial")} className="cursor-pointer px-4 py-3 font-bold">
                      {labelSortCaja("Saldo inicial", "saldoInicial")}
                    </th>
                    <th onClick={() => toggleSortCaja("saldoActual")} className="cursor-pointer px-4 py-3 font-bold">
                      {labelSortCaja("Saldo actual", "saldoActual")}
                    </th>
                    <th onClick={() => toggleSortCaja("estado")} className="cursor-pointer px-4 py-3 font-bold">
                      {labelSortCaja("Estado", "estado")}
                    </th>
                    <th onClick={() => toggleSortCaja("fechaApertura")} className="cursor-pointer px-4 py-3 font-bold">
                      {labelSortCaja("Apertura", "fechaApertura")}
                    </th>
                    <th className="px-4 py-3 font-bold">Responsable</th>
                    <th className="px-4 py-3 font-bold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {cajasPagina.map((caja) => (
                    <tr
                      key={caja.id}
                      className={`border-t border-slate-200 ${cajaActiva?.id === caja.id ? "bg-blue-50" : "bg-white"}`}
                    >
                      <td className="px-4 py-3 font-semibold text-slate-900">{caja.codigo}</td>
                      <td className="px-4 py-3">{caja.nombre}</td>
                      <td className="px-4 py-3">
                        {caja.almacen.codigo} - {caja.almacen.nombre}
                      </td>
                      <td className="px-4 py-3">{formatMoney(caja.saldoInicial)}</td>
                      <td className="px-4 py-3">{formatMoney(caja.saldoActual)}</td>
                      <td className="px-4 py-3">{badgeEstado(caja.estado)}</td>
                      <td className="px-4 py-3">{formatDateTime(caja.fechaApertura)}</td>
                      <td className="px-4 py-3">{caja.responsable || "-"}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => verDetalleCaja(caja.id)}
                          className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          Ver detalle
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 xl:hidden">
              {cajasPagina.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 p-6 text-center text-sm text-slate-500">
                  No hay cajas para esos filtros.
                </div>
              ) : (
                cajasPagina.map((caja) => (
                  <div
                    key={caja.id}
                    className={`rounded-2xl border p-4 shadow-sm ${cajaActiva?.id === caja.id ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-black text-slate-900">{caja.codigo}</div>
                        <div className="text-sm text-slate-600">{caja.nombre}</div>
                      </div>
                      {badgeEstado(caja.estado)}
                    </div>

                    <div className="mt-3 space-y-2 text-sm text-slate-700">
                      <div><span className="font-semibold">Almacén:</span> {caja.almacen.codigo} - {caja.almacen.nombre}</div>
                      <div><span className="font-semibold">Saldo inicial:</span> {formatMoney(caja.saldoInicial)}</div>
                      <div><span className="font-semibold">Saldo actual:</span> {formatMoney(caja.saldoActual)}</div>
                      <div><span className="font-semibold">Apertura:</span> {formatDateTime(caja.fechaApertura)}</div>
                      <div><span className="font-semibold">Responsable:</span> {caja.responsable || "-"}</div>
                    </div>

                    <div className="mt-4">
                      <button
                        onClick={() => verDetalleCaja(caja.id)}
                        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        Ver detalle
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <span>Mostrar</span>
                <select
                  value={filasCajas}
                  onChange={(e) => setFilasCajas(Number(e.target.value))}
                  className="rounded-lg border border-slate-300 px-3 py-2"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span>filas</span>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center">
                <button
                  disabled={paginaCajas <= 1}
                  onClick={() => setPaginaCajas((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  ◀ Ant.
                </button>
                <div className="flex items-center justify-center rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                  {paginaCajas} / {totalPaginasCajas}
                </div>
                <button
                  disabled={paginaCajas >= totalPaginasCajas}
                  onClick={() => setPaginaCajas((p) => Math.min(totalPaginasCajas, p + 1))}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  Sig. ▶
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6">
        <div className="mb-4">
          <h2 className="text-lg font-black text-slate-900 sm:text-xl">Movimientos de caja</h2>
          <p className="text-sm text-slate-500">
            Ingresos, egresos y ajustes con filtros, buscador y ordenamiento
          </p>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <input
            value={qMov}
            onChange={(e) => setQMov(e.target.value)}
            placeholder="Buscar por subtipo, referencia, persona..."
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
          />

          <select
            value={tipoMovFiltro}
            onChange={(e) => setTipoMovFiltro(e.target.value)}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
          >
            <option value="">Todos los tipos</option>
            <option value="INGRESO">INGRESO</option>
            <option value="EGRESO">EGRESO</option>
            <option value="AJUSTE">AJUSTE</option>
            <option value="TRANSFERENCIA">TRANSFERENCIA</option>
          </select>

          <select
            value={metodoMovFiltro}
            onChange={(e) => setMetodoMovFiltro(e.target.value)}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
          >
            <option value="">Todos los métodos</option>
            <option value="EFECTIVO">EFECTIVO</option>
            <option value="YAPE">YAPE</option>
            <option value="PLIN">PLIN</option>
            <option value="TRANSFERENCIA">TRANSFERENCIA</option>
          </select>

          <input
            type="date"
            value={fechaDesdeMov}
            onChange={(e) => setFechaDesdeMov(e.target.value)}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
          />

          <input
            type="date"
            value={fechaHastaMov}
            onChange={(e) => setFechaHastaMov(e.target.value)}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
          />
        </div>

        <div className="hidden xl:block overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-left text-slate-700">
              <tr>
                <th onClick={() => toggleSortMov("createdAt")} className="cursor-pointer px-4 py-3 font-bold">
                  {labelSortMov("Fecha", "createdAt")}
                </th>
                <th onClick={() => toggleSortMov("tipo")} className="cursor-pointer px-4 py-3 font-bold">
                  {labelSortMov("Tipo", "tipo")}
                </th>
                <th onClick={() => toggleSortMov("subtipo")} className="cursor-pointer px-4 py-3 font-bold">
                  {labelSortMov("Subtipo", "subtipo")}
                </th>
                <th onClick={() => toggleSortMov("monto")} className="cursor-pointer px-4 py-3 font-bold">
                  {labelSortMov("Monto", "monto")}
                </th>
                <th onClick={() => toggleSortMov("metodoPago")} className="cursor-pointer px-4 py-3 font-bold">
                  {labelSortMov("Método", "metodoPago")}
                </th>
                <th onClick={() => toggleSortMov("persona")} className="cursor-pointer px-4 py-3 font-bold">
                  {labelSortMov("Persona", "persona")}
                </th>
                <th className="px-4 py-3 font-bold">Detalle</th>
                <th onClick={() => toggleSortMov("saldoPost")} className="cursor-pointer px-4 py-3 font-bold">
                  {labelSortMov("Saldo post", "saldoPost")}
                </th>
              </tr>
            </thead>
            <tbody>
              {movsPagina.map((m) => (
                <tr key={m.id} className="border-t border-slate-200 bg-white">
                  <td className="px-4 py-3">{formatDateTime(m.createdAt)}</td>
                  <td className="px-4 py-3 font-semibold">{m.tipo}</td>
                  <td className="px-4 py-3">{m.subtipo || "-"}</td>
                  <td className="px-4 py-3">{formatMoney(m.monto)}</td>
                  <td className="px-4 py-3">{m.metodoPago || "-"}</td>
                  <td className="px-4 py-3">{m.persona || "-"}</td>
                  <td className="px-4 py-3">{m.detalle || "-"}</td>
                  <td className="px-4 py-3">{formatMoney(m.saldoPost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 xl:hidden">
          {movsPagina.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 p-6 text-center text-sm text-slate-500">
              No hay movimientos para esos filtros.
            </div>
          ) : (
            movsPagina.map((m) => (
              <div key={m.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-black text-slate-900">{m.tipo}</div>
                    <div className="text-xs text-slate-500">{formatDateTime(m.createdAt)}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-slate-900">{formatMoney(m.monto)}</div>
                    <div className="text-xs text-slate-500">{m.metodoPago || "-"}</div>
                  </div>
                </div>

                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  <div><span className="font-semibold">Subtipo:</span> {m.subtipo || "-"}</div>
                  <div><span className="font-semibold">Persona:</span> {m.persona || "-"}</div>
                  <div><span className="font-semibold">Detalle:</span> {m.detalle || "-"}</div>
                  <div><span className="font-semibold">Saldo post:</span> {formatMoney(m.saldoPost)}</div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span>Mostrar</span>
            <select
              value={filasMov}
              onChange={(e) => setFilasMov(Number(e.target.value))}
              className="rounded-lg border border-slate-300 px-3 py-2"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>filas</span>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center">
            <button
              disabled={paginaMov <= 1}
              onClick={() => setPaginaMov((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50"
            >
              ◀ Ant.
            </button>
            <div className="flex items-center justify-center rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
              {paginaMov} / {totalPaginasMov}
            </div>
            <button
              disabled={paginaMov >= totalPaginasMov}
              onClick={() => setPaginaMov((p) => Math.min(totalPaginasMov, p + 1))}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50"
            >
              Sig. ▶
            </button>
          </div>
        </div>
      </section>

      {modalNuevaCaja && (
        <div className="fixed inset-0 z-50 bg-black/40 p-0 sm:flex sm:items-center sm:justify-center sm:p-4">
          <div className="flex h-dvh w-full flex-col bg-white shadow-xl sm:h-auto sm:max-h-[92vh] sm:max-w-2xl sm:rounded-3xl">
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white p-4 sm:rounded-t-3xl sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xl font-black text-slate-900">Nueva caja</h3>
                <button
                  onClick={() => setModalNuevaCaja(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  Cerrar
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  value={codigoCaja}
                  onChange={(e) => setCodigoCaja(e.target.value)}
                  placeholder="Código"
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
                />
                <input
                  value={nombreCaja}
                  onChange={(e) => setNombreCaja(e.target.value)}
                  placeholder="Nombre"
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
                />
                <select
                  value={almacenIdCaja}
                  onChange={(e) => setAlmacenIdCaja(e.target.value)}
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
                >
                  {almacenes.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.codigo} - {a.nombre}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.01"
                  value={saldoInicialCaja}
                  onChange={(e) => setSaldoInicialCaja(e.target.value)}
                  placeholder="Saldo inicial"
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
                />
                <input
                  value={responsableCaja}
                  onChange={(e) => setResponsableCaja(e.target.value)}
                  placeholder="Responsable"
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm md:col-span-2"
                />
                <textarea
                  value={notasCaja}
                  onChange={(e) => setNotasCaja(e.target.value)}
                  placeholder="Notas"
                  className="min-h-[100px] rounded-xl border border-slate-300 px-4 py-3 text-sm md:col-span-2"
                />
              </div>
            </div>

            <div className="border-t border-slate-200 p-4 sm:rounded-b-3xl sm:p-6">
              <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                <button
                  onClick={() => setModalNuevaCaja(false)}
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  onClick={crearCaja}
                  disabled={procesando}
                  className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  Crear caja
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalAbrirCaja && (
        <div className="fixed inset-0 z-50 bg-black/40 p-0 sm:flex sm:items-center sm:justify-center sm:p-4">
          <div className="flex h-dvh w-full flex-col bg-white shadow-xl sm:h-auto sm:max-w-md sm:rounded-3xl">
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white p-4 sm:rounded-t-3xl sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xl font-black text-slate-900">Abrir caja</h3>
                <button
                  onClick={() => setModalAbrirCaja(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  Cerrar
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              <select
                value={cajaSeleccionadaAbrirId}
                onChange={(e) => {
                  setCajaSeleccionadaAbrirId(e.target.value);
                  const caja = cajas.find((c) => c.id === e.target.value) || null;
                  setSaldoApertura(String(Number(caja?.saldoActual || 0)));
                }}
                className="mb-3 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
              >
                <option value="">Selecciona caja</option>
                {cajas
                  .filter((c) => c.estado === "CERRADA")
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.codigo} - {c.nombre}
                    </option>
                  ))}
              </select>

              <input
                type="number"
                step="0.01"
                value={saldoApertura}
                onChange={(e) => setSaldoApertura(e.target.value)}
                placeholder="Saldo apertura"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
              />
            </div>

            <div className="border-t border-slate-200 p-4 sm:rounded-b-3xl sm:p-6">
              <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                <button
                  onClick={() => setModalAbrirCaja(false)}
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    const caja = cajas.find((c) => c.id === cajaSeleccionadaAbrirId);
                    if (caja) abrirCaja(caja);
                  }}
                  disabled={procesando || !cajaSeleccionadaAbrirId}
                  className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  Abrir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalCerrarCaja && cajaActiva && (
        <div className="fixed inset-0 z-50 bg-black/40 p-0 sm:flex sm:items-center sm:justify-center sm:p-4">
          <div className="flex h-dvh w-full flex-col bg-white shadow-xl sm:h-auto sm:max-h-[92vh] sm:max-w-3xl sm:rounded-3xl">
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white p-4 sm:rounded-t-3xl sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xl font-black text-slate-900">Cerrar caja con arqueo</h3>
                <button
                  onClick={() => setModalCerrarCaja(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  Cerrar
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="mb-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                  <div><b>Caja:</b> {cajaActiva.codigo}</div>
                  <div><b>Saldo sistema:</b> {formatMoney(cajaActiva.saldoActual)}</div>
                </div>

                <div className="rounded-2xl bg-blue-50 p-4 text-sm text-blue-700">
                  <div><b>Total arqueado:</b> {formatMoney(saldoContadoCierre)}</div>
                  <div>
                    <b>Diferencia:</b>{" "}
                    {formatMoney(
                      Number(saldoContadoCierre || 0) - Number(cajaActiva.saldoActual || 0)
                    )}
                  </div>
                </div>
              </div>

              <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <input
                  type="number"
                  step="0.01"
                  value={arqueoEfectivo}
                  onChange={(e) => setArqueoEfectivo(e.target.value)}
                  placeholder="Efectivo"
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
                />
                <input
                  type="number"
                  step="0.01"
                  value={arqueoYape}
                  onChange={(e) => setArqueoYape(e.target.value)}
                  placeholder="Yape"
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
                />
                <input
                  type="number"
                  step="0.01"
                  value={arqueoPlin}
                  onChange={(e) => setArqueoPlin(e.target.value)}
                  placeholder="Plin"
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
                />
                <input
                  type="number"
                  step="0.01"
                  value={arqueoTransferencia}
                  onChange={(e) => setArqueoTransferencia(e.target.value)}
                  placeholder="Transferencia"
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
                />
                <input
                  type="number"
                  step="0.01"
                  value={arqueoOtros}
                  onChange={(e) => setArqueoOtros(e.target.value)}
                  placeholder="Otros"
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
                />
              </div>

              <div className="space-y-3">
                <input
                  type="number"
                  step="0.01"
                  value={saldoContadoCierre}
                  onChange={(e) => setSaldoContadoCierre(e.target.value)}
                  placeholder="Saldo contado total"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                />

                <textarea
                  value={observacionCierre}
                  onChange={(e) => setObservacionCierre(e.target.value)}
                  placeholder="Observación de arqueo"
                  className="min-h-[90px] w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                />

                <textarea
                  value={notasCierre}
                  onChange={(e) => setNotasCierre(e.target.value)}
                  placeholder="Notas de cierre"
                  className="min-h-[90px] w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                />
              </div>
            </div>

            <div className="border-t border-slate-200 p-4 sm:rounded-b-3xl sm:p-6">
              <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                <button
                  onClick={() => setModalCerrarCaja(false)}
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => cerrarCaja(cajaActiva)}
                  disabled={procesando}
                  className="rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  Cerrar caja
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalMovimiento && cajaActiva && (
        <div className="fixed inset-0 z-50 bg-black/40 p-0 sm:flex sm:items-center sm:justify-center sm:p-4">
          <div className="flex h-dvh w-full flex-col bg-white shadow-xl sm:h-auto sm:max-h-[92vh] sm:max-w-2xl sm:rounded-3xl">
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white p-4 sm:rounded-t-3xl sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xl font-black text-slate-900">Registrar movimiento</h3>
                <button
                  onClick={() => setModalMovimiento(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  Cerrar
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="mb-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                <div><b>Caja:</b> {cajaActiva.codigo}</div>
                <div><b>Saldo actual:</b> {formatMoney(cajaActiva.saldoActual)}</div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <select
                  value={movimientoTipo}
                  onChange={(e) => setMovimientoTipo(e.target.value as "INGRESO" | "EGRESO" | "AJUSTE")}
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
                >
                  <option value="INGRESO">INGRESO</option>
                  <option value="EGRESO">EGRESO</option>
                  <option value="AJUSTE">AJUSTE</option>
                </select>

                <input
                  value={movimientoSubtipo}
                  onChange={(e) => setMovimientoSubtipo(e.target.value)}
                  placeholder="Subtipo"
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
                />

                <input
                  type="number"
                  step="0.01"
                  value={movimientoMonto}
                  onChange={(e) => setMovimientoMonto(e.target.value)}
                  placeholder="Monto"
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
                />

                <select
                  value={movimientoMetodoPago}
                  onChange={(e) => setMovimientoMetodoPago(e.target.value)}
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
                >
                  <option value="EFECTIVO">EFECTIVO</option>
                  <option value="YAPE">YAPE</option>
                  <option value="PLIN">PLIN</option>
                  <option value="TRANSFERENCIA">TRANSFERENCIA</option>
                </select>

                <input
                  value={movimientoReferencia}
                  onChange={(e) => setMovimientoReferencia(e.target.value)}
                  placeholder="Referencia"
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
                />

                <input
                  value={movimientoPersona}
                  onChange={(e) => setMovimientoPersona(e.target.value)}
                  placeholder="Persona / tercero"
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
                />

                <input
                  value={movimientoDetalle}
                  onChange={(e) => setMovimientoDetalle(e.target.value)}
                  placeholder="Detalle"
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm md:col-span-2"
                />

                <textarea
                  value={movimientoNotas}
                  onChange={(e) => setMovimientoNotas(e.target.value)}
                  placeholder="Notas"
                  className="min-h-[100px] rounded-xl border border-slate-300 px-4 py-3 text-sm md:col-span-2"
                />
              </div>
            </div>

            <div className="border-t border-slate-200 p-4 sm:rounded-b-3xl sm:p-6">
              <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                <button
                  onClick={() => setModalMovimiento(false)}
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  onClick={registrarMovimiento}
                  disabled={procesando}
                  className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  Registrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {detalleCajaOpen && detalleCaja && (
        <div className="fixed inset-0 z-50 bg-black/40 p-0 sm:flex sm:items-center sm:justify-center sm:p-4">
          <div className="flex h-dvh w-full flex-col bg-white shadow-xl sm:h-auto sm:max-h-[92vh] sm:max-w-5xl sm:rounded-3xl">
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white p-4 sm:rounded-t-3xl sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-xl font-black text-slate-900">
                    Detalle de caja {detalleCaja.codigo}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {detalleCaja.nombre} · {detalleCaja.almacen.codigo} - {detalleCaja.almacen.nombre}
                  </p>
                </div>

                <button
                  onClick={() => setDetalleCajaOpen(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  Cerrar
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs font-semibold text-slate-500">Estado</div>
                  <div className="mt-2">{badgeEstado(detalleCaja.estado)}</div>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs font-semibold text-slate-500">Saldo inicial</div>
                  <div className="mt-2 text-xl font-black text-slate-900">
                    {formatMoney(detalleCaja.saldoInicial)}
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs font-semibold text-slate-500">Saldo actual</div>
                  <div className="mt-2 text-xl font-black text-blue-700">
                    {formatMoney(detalleCaja.saldoActual)}
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs font-semibold text-slate-500">Responsable</div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">
                    {detalleCaja.responsable || "-"}
                  </div>
                </div>
              </div>

              <div className="mb-5 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-4 text-sm">
                  <div><b>Fecha apertura:</b> {formatDateTime(detalleCaja.fechaApertura)}</div>
                  <div><b>Fecha cierre:</b> {formatDateTime(detalleCaja.fechaCierre)}</div>
                  <div><b>Saldo contado:</b> {formatMoney(detalleCaja.saldoContado)}</div>
                  <div><b>Diferencia cierre:</b> {formatMoney(detalleCaja.diferenciaCierre)}</div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4 text-sm">
                  <div><b>Notas:</b> {detalleCaja.notas || "-"}</div>
                  <div className="mt-2"><b>Obs. cierre:</b> {detalleCaja.observacionCierre || "-"}</div>
                </div>
              </div>

              <div>
                <h4 className="mb-3 text-lg font-black text-slate-900">Historial de movimientos</h4>

                <div className="hidden xl:block overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-100 text-left text-slate-700">
                      <tr>
                        <th className="px-4 py-3 font-bold">Fecha</th>
                        <th className="px-4 py-3 font-bold">Tipo</th>
                        <th className="px-4 py-3 font-bold">Subtipo</th>
                        <th className="px-4 py-3 font-bold">Monto</th>
                        <th className="px-4 py-3 font-bold">Método</th>
                        <th className="px-4 py-3 font-bold">Persona</th>
                        <th className="px-4 py-3 font-bold">Saldo post</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detalleCaja.movimientos || []).map((m) => (
                        <tr key={m.id} className="border-t border-slate-200 bg-white">
                          <td className="px-4 py-3">{formatDateTime(m.createdAt)}</td>
                          <td className="px-4 py-3">{m.tipo}</td>
                          <td className="px-4 py-3">{m.subtipo || "-"}</td>
                          <td className="px-4 py-3">{formatMoney(m.monto)}</td>
                          <td className="px-4 py-3">{m.metodoPago || "-"}</td>
                          <td className="px-4 py-3">{m.persona || "-"}</td>
                          <td className="px-4 py-3">{formatMoney(m.saldoPost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid gap-3 xl:hidden">
                  {(detalleCaja.movimientos || []).length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 p-6 text-center text-sm text-slate-500">
                      No hay movimientos registrados.
                    </div>
                  ) : (
                    (detalleCaja.movimientos || []).map((m) => (
                      <div key={m.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-black text-slate-900">{m.tipo}</div>
                            <div className="text-xs text-slate-500">{formatDateTime(m.createdAt)}</div>
                          </div>
                          <div className="text-right font-black text-slate-900">
                            {formatMoney(m.monto)}
                          </div>
                        </div>

                        <div className="mt-3 space-y-2 text-sm text-slate-700">
                          <div><span className="font-semibold">Subtipo:</span> {m.subtipo || "-"}</div>
                          <div><span className="font-semibold">Método:</span> {m.metodoPago || "-"}</div>
                          <div><span className="font-semibold">Persona:</span> {m.persona || "-"}</div>
                          <div><span className="font-semibold">Saldo post:</span> {formatMoney(m.saldoPost)}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}