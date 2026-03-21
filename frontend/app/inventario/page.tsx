"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Producto = {
  id: string;
  codigo: string;
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

type InventarioItem = {
  id: string;
  productoId: string;
  almacenId: string;
  codigoBarras: string;
  sku: string;
  stock: number;
  createdAt?: string;
  updatedAt?: string;
  producto: Producto;
  almacen: Almacen;
};

type MovimientoInventario = {
  id: string;
  tipo: string;
  productoId: string;
  almacenId: string;
  codigoBarras?: string | null;
  sku?: string | null;
  cantidad: number;
  stockAnterior: number;
  stockNuevo: number;
  referencia?: string | null;
  nota?: string | null;
  usuarioEmail?: string | null;
  createdAt: string;
  producto: Producto;
  almacen: Almacen;
};

type SortKeyInventario =
  | "codigo"
  | "modelo"
  | "color"
  | "material"
  | "taco"
  | "talla"
  | "almacen"
  | "stock"
  | "sku"
  | "codigoBarras";

type SortKeyMovimiento =
  | "createdAt"
  | "tipo"
  | "codigo"
  | "modelo"
  | "almacen"
  | "cantidad"
  | "stockAnterior"
  | "stockNuevo";

type MovimientoForm = {
  tipo: "INGRESO" | "SALIDA" | "AJUSTE";
  cantidad: string;
  referencia: string;
  nota: string;
  usuarioEmail: string;
};

type ScannerMode = "fisico" | "camara";

const initialMovimiento: MovimientoForm = {
  tipo: "INGRESO",
  cantidad: "",
  referencia: "",
  nota: "",
  usuarioEmail: "admin@erp.com",
};

const initialScannerMovimiento: MovimientoForm = {
  tipo: "INGRESO",
  cantidad: "1",
  referencia: "SCANNER",
  nota: "",
  usuarioEmail: "admin@erp.com",
};

async function readJsonSafe(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      text?.includes("<!DOCTYPE")
        ? "El backend respondió HTML en vez de JSON. Verifica que el backend esté reiniciado."
        : text || "La respuesta del servidor no es JSON válido"
    );
  }
}

function formatFecha(v?: string) {
  if (!v) return "-";
  try {
    return new Date(v).toLocaleString("es-PE");
  } catch {
    return v;
  }
}

export default function InventarioPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  const [items, setItems] = useState<InventarioItem[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoInventario[]>([]);
  const [loadingInventario, setLoadingInventario] = useState(true);
  const [loadingMovimientos, setLoadingMovimientos] = useState(true);

  const [q, setQ] = useState("");
  const [almacenFiltro, setAlmacenFiltro] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [filasPorPagina, setFilasPorPagina] = useState(10);
  const [paginaActual, setPaginaActual] = useState(1);

  const [sortKey, setSortKey] = useState<SortKeyInventario>("modelo");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const [modalOpen, setModalOpen] = useState(false);
  const [itemActivo, setItemActivo] = useState<InventarioItem | null>(null);
  const [movForm, setMovForm] = useState<MovimientoForm>(initialMovimiento);
  const [guardando, setGuardando] = useState(false);

  const [movQ, setMovQ] = useState("");
  const [movTipoFiltro, setMovTipoFiltro] = useState("");
  const [movAlmacenFiltro, setMovAlmacenFiltro] = useState("");
  const [movFechaDesde, setMovFechaDesde] = useState("");
  const [movFechaHasta, setMovFechaHasta] = useState("");
  const [movFilasPorPagina, setMovFilasPorPagina] = useState(10);
  const [movPaginaActual, setMovPaginaActual] = useState(1);
  const [movSortKey, setMovSortKey] =
    useState<SortKeyMovimiento>("createdAt");
  const [movSortDir, setMovSortDir] = useState<"asc" | "desc">("desc");

  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerMode, setScannerMode] = useState<ScannerMode>("fisico");
  const [scannerCodigo, setScannerCodigo] = useState("");
  const [scannerAlmacenId, setScannerAlmacenId] = useState("");
  const [scannerProducto, setScannerProducto] = useState<InventarioItem | null>(
    null
  );
  const [scannerLoading, setScannerLoading] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const [scannerMovimiento, setScannerMovimiento] =
    useState<MovimientoForm>(initialScannerMovimiento);
  const [camaraActiva, setCamaraActiva] = useState(false);

  const scannerInputRef = useRef<HTMLInputElement | null>(null);
  const html5QrCodeRef = useRef<any>(null);

  async function cargarInventario() {
    try {
      setLoadingInventario(true);
      const res = await fetch(`${apiUrl}/inventario`);
      const data = await readJsonSafe(res);
      setItems(data.data || []);
    } catch (error) {
      console.error("Error cargando inventario:", error);
      alert(
        error instanceof Error
          ? error.message
          : "No se pudo cargar el inventario"
      );
    } finally {
      setLoadingInventario(false);
    }
  }

  async function cargarMovimientos() {
    try {
      setLoadingMovimientos(true);
      const params = new URLSearchParams();

      if (movQ.trim()) params.set("q", movQ.trim());
      if (movTipoFiltro) params.set("tipo", movTipoFiltro);
      if (movAlmacenFiltro) params.set("almacenId", movAlmacenFiltro);
      if (movFechaDesde) params.set("fechaDesde", movFechaDesde);
      if (movFechaHasta) params.set("fechaHasta", movFechaHasta);

      const url = `${apiUrl}/movimientos-inventario${
        params.toString() ? `?${params.toString()}` : ""
      }`;

      const res = await fetch(url);
      const data = await readJsonSafe(res);
      setMovimientos(data.data || []);
    } catch (error) {
      console.error("Error cargando movimientos:", error);
      alert(
        error instanceof Error
          ? error.message
          : "No se pudieron cargar los movimientos"
      );
    } finally {
      setLoadingMovimientos(false);
    }
  }

  useEffect(() => {
    cargarInventario();
  }, [apiUrl]);

  useEffect(() => {
    cargarMovimientos();
  }, [apiUrl, movQ, movTipoFiltro, movAlmacenFiltro, movFechaDesde, movFechaHasta]);

  const almacenesUnicos = useMemo(() => {
    const map = new Map<string, Almacen>();
    items.forEach((x) => {
      if (x.almacen?.id) map.set(x.almacen.id, x.almacen);
    });
    return Array.from(map.values());
  }, [items]);

  const itemsFiltrados = useMemo(() => {
    const texto = q.toLowerCase();

    const filtrados = items.filter((it) => {
      const matchQ =
        !q ||
        it.producto.codigo.toLowerCase().includes(texto) ||
        it.producto.modelo.toLowerCase().includes(texto) ||
        it.producto.color.toLowerCase().includes(texto) ||
        it.producto.material.toLowerCase().includes(texto) ||
        it.producto.taco.toLowerCase().includes(texto) ||
        it.sku.toLowerCase().includes(texto) ||
        it.codigoBarras.toLowerCase().includes(texto) ||
        it.almacen.codigo.toLowerCase().includes(texto) ||
        String(it.producto.talla).includes(texto);

      const matchAlmacen = !almacenFiltro || it.almacenId === almacenFiltro;
      const matchEstado =
        !estadoFiltro ||
        it.producto.estado.toUpperCase() === estadoFiltro.toUpperCase();

      return matchQ && matchAlmacen && matchEstado;
    });

    const sorted = [...filtrados].sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";

      switch (sortKey) {
        case "codigo":
          av = a.producto.codigo;
          bv = b.producto.codigo;
          break;
        case "modelo":
          av = a.producto.modelo;
          bv = b.producto.modelo;
          break;
        case "color":
          av = a.producto.color;
          bv = b.producto.color;
          break;
        case "material":
          av = a.producto.material;
          bv = b.producto.material;
          break;
        case "taco":
          av = a.producto.taco;
          bv = b.producto.taco;
          break;
        case "talla":
          av = Number(a.producto.talla);
          bv = Number(b.producto.talla);
          break;
        case "almacen":
          av = a.almacen.codigo;
          bv = b.almacen.codigo;
          break;
        case "stock":
          av = Number(a.stock);
          bv = Number(b.stock);
          break;
        case "sku":
          av = a.sku;
          bv = b.sku;
          break;
        case "codigoBarras":
          av = a.codigoBarras;
          bv = b.codigoBarras;
          break;
      }

      if (typeof av === "string") av = av.toUpperCase();
      if (typeof bv === "string") bv = bv.toUpperCase();

      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [items, q, almacenFiltro, estadoFiltro, sortKey, sortDir]);

  const totalPaginas = Math.max(
    1,
    Math.ceil(itemsFiltrados.length / filasPorPagina)
  );

  const itemsPagina = useMemo(() => {
    const start = (paginaActual - 1) * filasPorPagina;
    const end = start + filasPorPagina;
    return itemsFiltrados.slice(start, end);
  }, [itemsFiltrados, paginaActual, filasPorPagina]);

  useEffect(() => {
    setPaginaActual(1);
  }, [q, almacenFiltro, estadoFiltro, filasPorPagina]);

  const movimientosOrdenados = useMemo(() => {
    const sorted = [...movimientos].sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";

      switch (movSortKey) {
        case "createdAt":
          av = new Date(a.createdAt).getTime();
          bv = new Date(b.createdAt).getTime();
          break;
        case "tipo":
          av = a.tipo;
          bv = b.tipo;
          break;
        case "codigo":
          av = a.producto.codigo;
          bv = b.producto.codigo;
          break;
        case "modelo":
          av = a.producto.modelo;
          bv = b.producto.modelo;
          break;
        case "almacen":
          av = a.almacen.codigo;
          bv = b.almacen.codigo;
          break;
        case "cantidad":
          av = Number(a.cantidad);
          bv = Number(b.cantidad);
          break;
        case "stockAnterior":
          av = Number(a.stockAnterior);
          bv = Number(b.stockAnterior);
          break;
        case "stockNuevo":
          av = Number(a.stockNuevo);
          bv = Number(b.stockNuevo);
          break;
      }

      if (typeof av === "string") av = av.toUpperCase();
      if (typeof bv === "string") bv = bv.toUpperCase();

      if (av < bv) return movSortDir === "asc" ? -1 : 1;
      if (av > bv) return movSortDir === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [movimientos, movSortKey, movSortDir]);

  const movTotalPaginas = Math.max(
    1,
    Math.ceil(movimientosOrdenados.length / movFilasPorPagina)
  );

  const movimientosPagina = useMemo(() => {
    const start = (movPaginaActual - 1) * movFilasPorPagina;
    const end = start + movFilasPorPagina;
    return movimientosOrdenados.slice(start, end);
  }, [movimientosOrdenados, movPaginaActual, movFilasPorPagina]);

  useEffect(() => {
    setMovPaginaActual(1);
  }, [movimientos, movFilasPorPagina]);

  function toggleSort(key: SortKeyInventario) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function toggleSortMovimiento(key: SortKeyMovimiento) {
    if (movSortKey === key) {
      setMovSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setMovSortKey(key);
      setMovSortDir("asc");
    }
  }

  function sortLabel(label: string, key: SortKeyInventario) {
    if (sortKey !== key) return `${label} ↕`;
    return `${label} ${sortDir === "asc" ? "▲" : "▼"}`;
  }

  function sortLabelMovimiento(label: string, key: SortKeyMovimiento) {
    if (movSortKey !== key) return `${label} ↕`;
    return `${label} ${movSortDir === "asc" ? "▲" : "▼"}`;
  }

  function abrirModalMovimiento(
    item: InventarioItem,
    tipo: "INGRESO" | "SALIDA" | "AJUSTE"
  ) {
    setItemActivo(item);
    setMovForm({
      ...initialMovimiento,
      tipo,
    });
    setModalOpen(true);
  }

  function cerrarModal() {
    if (guardando) return;
    setModalOpen(false);
    setItemActivo(null);
    setMovForm(initialMovimiento);
  }

  function updateMov<K extends keyof MovimientoForm>(
    key: K,
    value: MovimientoForm[K]
  ) {
    setMovForm((prev) => ({ ...prev, [key]: value }));
  }

  async function guardarMovimiento(e: React.FormEvent) {
    e.preventDefault();
    if (!itemActivo) return;

    try {
      setGuardando(true);

      const payload = {
        tipo: movForm.tipo,
        productoId: itemActivo.productoId,
        almacenId: itemActivo.almacenId,
        cantidad: Number(movForm.cantidad),
        referencia: movForm.referencia || null,
        nota: movForm.nota || null,
        usuarioEmail: movForm.usuarioEmail || null,
      };

      const res = await fetch(`${apiUrl}/inventario/movimiento`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await readJsonSafe(res);

      if (!res.ok || !data.ok) {
        alert(data.error || "No se pudo registrar el movimiento");
        return;
      }

      await Promise.all([cargarInventario(), cargarMovimientos()]);
      cerrarModal();
      alert(`Movimiento ${movForm.tipo} registrado correctamente`);
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "Ocurrió un error al registrar el movimiento"
      );
    } finally {
      setGuardando(false);
    }
  }

  async function buscarPorCodigoBarras(codigo: string) {
    try {
      setScannerLoading(true);
      setScannerError("");
      setScannerProducto(null);

      const params = new URLSearchParams();
      if (scannerAlmacenId) params.set("almacenId", scannerAlmacenId);

      const url = `${apiUrl}/inventario/buscar-por-barras/${encodeURIComponent(
        codigo
      )}${params.toString() ? `?${params.toString()}` : ""}`;

      const res = await fetch(url);
      const data = await readJsonSafe(res);

      if (!res.ok || !data.ok) {
        setScannerError(data.error || "No se encontró el código");
        return;
      }

      setScannerProducto(data.data || null);
      setScannerMovimiento((prev) => ({
        ...prev,
        referencia: "SCANNER",
        cantidad: prev.cantidad || "1",
      }));
    } catch (error) {
      console.error(error);
      setScannerError(
        error instanceof Error
          ? error.message
          : "Error buscando por código o QR"
      );
    } finally {
      setScannerLoading(false);
    }
  }

  function abrirScanner() {
    setScannerOpen(true);
    setScannerMode("fisico");
    setScannerCodigo("");
    setScannerProducto(null);
    setScannerError("");
    setScannerMovimiento(initialScannerMovimiento);
    setTimeout(() => {
      scannerInputRef.current?.focus();
    }, 100);
  }

  async function detenerScannerCamara() {
    try {
      if (html5QrCodeRef.current) {
        const state = html5QrCodeRef.current.getState?.();
        if (state === 2 || state === 1) {
          await html5QrCodeRef.current.stop();
        }
        await html5QrCodeRef.current.clear();
      }
    } catch (error) {
      console.error("Error cerrando cámara:", error);
    } finally {
      html5QrCodeRef.current = null;
      setCamaraActiva(false);
    }
  }

  async function cerrarScanner() {
    setScannerOpen(false);
    setScannerCodigo("");
    setScannerProducto(null);
    setScannerError("");
    setScannerMovimiento(initialScannerMovimiento);
    await detenerScannerCamara();
  }

  function updateScannerMov<K extends keyof MovimientoForm>(
    key: K,
    value: MovimientoForm[K]
  ) {
    setScannerMovimiento((prev) => ({ ...prev, [key]: value }));
  }

  function setScannerTipoRapido(tipo: "INGRESO" | "SALIDA") {
    setScannerMovimiento((prev) => ({
      ...prev,
      tipo,
      cantidad: prev.cantidad || "1",
    }));
  }

  async function guardarMovimientoScanner(e: React.FormEvent) {
    e.preventDefault();
    if (!scannerProducto) return;

    try {
      setGuardando(true);

      const payload = {
        tipo: scannerMovimiento.tipo,
        productoId: scannerProducto.productoId,
        almacenId: scannerProducto.almacenId,
        cantidad: Number(scannerMovimiento.cantidad),
        referencia: scannerMovimiento.referencia || null,
        nota: scannerMovimiento.nota || null,
        usuarioEmail: scannerMovimiento.usuarioEmail || null,
      };

      const res = await fetch(`${apiUrl}/inventario/movimiento`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await readJsonSafe(res);

      if (!res.ok || !data.ok) {
        alert(data.error || "No se pudo registrar el movimiento");
        return;
      }

      await Promise.all([cargarInventario(), cargarMovimientos()]);

      const seguir = window.confirm(
        "Movimiento registrado. ¿Deseas seguir escaneando?"
      );

      if (seguir) {
        setScannerCodigo("");
        setScannerProducto(null);
        setScannerError("");
        setScannerMovimiento(initialScannerMovimiento);
        setTimeout(() => {
          scannerInputRef.current?.focus();
        }, 100);
      } else {
        await cerrarScanner();
      }
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "Ocurrió un error al registrar el movimiento"
      );
    } finally {
      setGuardando(false);
    }
  }

  async function iniciarScannerCamara() {
    try {
      setScannerError("");
      setScannerProducto(null);

      const mod = await import("html5-qrcode");
      const Html5Qrcode = mod.Html5Qrcode;

      if (!document.getElementById("reader")) {
        setScannerError("No se encontró el contenedor del scanner.");
        return;
      }

      const html5QrCode = new Html5Qrcode("reader");
      html5QrCodeRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 220, height: 160 },
          aspectRatio: 1.777778,
        },
        async (decodedText: string) => {
          setScannerCodigo(decodedText);
          await buscarPorCodigoBarras(decodedText);
          await detenerScannerCamara();
        },
        () => {}
      );

      setCamaraActiva(true);
    } catch (error) {
      console.error(error);
      setScannerError(
        "No se pudo iniciar la cámara. Prueba en Chrome/Edge, o usa lector físico."
      );
      setCamaraActiva(false);
    }
  }

  useEffect(() => {
    if (!scannerOpen) return;

    if (scannerMode === "fisico") {
      detenerScannerCamara();
      setTimeout(() => scannerInputRef.current?.focus(), 120);
    }

    if (scannerMode === "camara") {
      setTimeout(() => {
        iniciarScannerCamara();
      }, 150);
    }

    return () => {
      detenerScannerCamara();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scannerOpen, scannerMode]);

  function badgeEstado(estado: string) {
    return estado === "ACTIVO" ? (
      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
        ACTIVO
      </span>
    ) : (
      <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
        INACTIVO
      </span>
    );
  }

  function badgeStock(stock: number) {
    if (stock <= 0) {
      return (
        <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
          {stock}
        </span>
      );
    }

    if (stock <= 5) {
      return (
        <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold text-yellow-700">
          {stock}
        </span>
      );
    }

    return (
      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
        {stock}
      </span>
    );
  }

  function badgeTipo(tipo: string) {
    if (tipo === "INGRESO") {
      return (
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
          INGRESO
        </span>
      );
    }
    if (tipo === "SALIDA") {
      return (
        <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
          SALIDA
        </span>
      );
    }
    return (
      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
        AJUSTE
      </span>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Inventario</h1>
            <p className="text-sm text-slate-500">
              Control de stock por producto y almacén
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={abrirScanner}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Scanner
            </button>
          </div>
        </div>

        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar modelo, código, SKU, talla, almacén..."
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
          />

          <select
            value={almacenFiltro}
            onChange={(e) => setAlmacenFiltro(e.target.value)}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
          >
            <option value="">Todos los almacenes</option>
            {almacenesUnicos.map((a) => (
              <option key={a.id} value={a.id}>
                {a.codigo} - {a.nombre}
              </option>
            ))}
          </select>

          <select
            value={estadoFiltro}
            onChange={(e) => setEstadoFiltro(e.target.value)}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
          >
            <option value="">Todos los estados</option>
            <option value="ACTIVO">ACTIVO</option>
            <option value="INACTIVO">INACTIVO</option>
          </select>

          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <span className="font-semibold">Filtrados:</span>
            <span>{itemsFiltrados.length}</span>
          </div>
        </div>

        {loadingInventario ? (
          <p className="text-sm text-slate-500">Cargando inventario...</p>
        ) : itemsFiltrados.length === 0 ? (
          <p className="text-sm text-slate-500">
            No hay registros de inventario.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100 text-left text-slate-700">
                  <tr>
                    <th onClick={() => toggleSort("codigo")} className="cursor-pointer px-4 py-3 font-bold">{sortLabel("Código", "codigo")}</th>
                    <th onClick={() => toggleSort("modelo")} className="cursor-pointer px-4 py-3 font-bold">{sortLabel("Modelo", "modelo")}</th>
                    <th onClick={() => toggleSort("color")} className="cursor-pointer px-4 py-3 font-bold">{sortLabel("Color", "color")}</th>
                    <th onClick={() => toggleSort("material")} className="cursor-pointer px-4 py-3 font-bold">{sortLabel("Material", "material")}</th>
                    <th onClick={() => toggleSort("taco")} className="cursor-pointer px-4 py-3 font-bold">{sortLabel("Taco", "taco")}</th>
                    <th onClick={() => toggleSort("talla")} className="cursor-pointer px-4 py-3 font-bold">{sortLabel("Talla", "talla")}</th>
                    <th onClick={() => toggleSort("almacen")} className="cursor-pointer px-4 py-3 font-bold">{sortLabel("Almacén", "almacen")}</th>
                    <th onClick={() => toggleSort("stock")} className="cursor-pointer px-4 py-3 font-bold">{sortLabel("Stock", "stock")}</th>
                    <th onClick={() => toggleSort("sku")} className="cursor-pointer px-4 py-3 font-bold">{sortLabel("SKU", "sku")}</th>
                    <th onClick={() => toggleSort("codigoBarras")} className="cursor-pointer px-4 py-3 font-bold">{sortLabel("Código barras", "codigoBarras")}</th>
                    <th className="px-4 py-3 font-bold">Estado</th>
                    <th className="px-4 py-3 font-bold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsPagina.map((it) => (
                    <tr key={it.id} className="border-t border-slate-200 bg-white hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-900">{it.producto.codigo}</td>
                      <td className="px-4 py-3">{it.producto.modelo}</td>
                      <td className="px-4 py-3">{it.producto.color}</td>
                      <td className="px-4 py-3">{it.producto.material}</td>
                      <td className="px-4 py-3">{it.producto.taco}</td>
                      <td className="px-4 py-3">{it.producto.talla}</td>
                      <td className="px-4 py-3">{it.almacen.codigo}</td>
                      <td className="px-4 py-3">{badgeStock(Number(it.stock || 0))}</td>
                      <td className="px-4 py-3">{it.sku}</td>
                      <td className="px-4 py-3">{it.codigoBarras}</td>
                      <td className="px-4 py-3">{badgeEstado(it.producto.estado)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => abrirModalMovimiento(it, "INGRESO")}
                            className="rounded-lg border border-emerald-300 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                          >
                            Ingreso
                          </button>
                          <button
                            onClick={() => abrirModalMovimiento(it, "SALIDA")}
                            className="rounded-lg border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                          >
                            Salida
                          </button>
                          <button
                            onClick={() => abrirModalMovimiento(it, "AJUSTE")}
                            className="rounded-lg border border-blue-300 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                          >
                            Ajuste
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
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ◀ Anterior
                </button>

                <div className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                  Página {paginaActual} de {totalPaginas}
                </div>

                <button
                  disabled={paginaActual >= totalPaginas}
                  onClick={() => setPaginaActual((p) => Math.min(totalPaginas, p + 1))}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Siguiente ▶
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black text-slate-900">
              Movimientos de inventario
            </h2>
            <p className="text-sm text-slate-500">
              Historial detallado de ingresos, salidas y ajustes
            </p>
          </div>

          <div className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            Total movimientos: {movimientos.length}
          </div>
        </div>

        <div className="mb-4 grid gap-3 md:grid-cols-5">
          <input
            value={movQ}
            onChange={(e) => setMovQ(e.target.value)}
            placeholder="Buscar producto, referencia, SKU..."
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
          />

          <select
            value={movTipoFiltro}
            onChange={(e) => setMovTipoFiltro(e.target.value)}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
          >
            <option value="">Todos los tipos</option>
            <option value="INGRESO">INGRESO</option>
            <option value="SALIDA">SALIDA</option>
            <option value="AJUSTE">AJUSTE</option>
          </select>

          <select
            value={movAlmacenFiltro}
            onChange={(e) => setMovAlmacenFiltro(e.target.value)}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
          >
            <option value="">Todos los almacenes</option>
            {almacenesUnicos.map((a) => (
              <option key={a.id} value={a.id}>
                {a.codigo} - {a.nombre}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={movFechaDesde}
            onChange={(e) => setMovFechaDesde(e.target.value)}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
          />

          <input
            type="date"
            value={movFechaHasta}
            onChange={(e) => setMovFechaHasta(e.target.value)}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
          />
        </div>

        {loadingMovimientos ? (
          <p className="text-sm text-slate-500">Cargando movimientos...</p>
        ) : movimientosOrdenados.length === 0 ? (
          <p className="text-sm text-slate-500">
            No hay movimientos para esos filtros.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100 text-left text-slate-700">
                  <tr>
                    <th onClick={() => toggleSortMovimiento("createdAt")} className="cursor-pointer px-4 py-3 font-bold">{sortLabelMovimiento("Fecha", "createdAt")}</th>
                    <th onClick={() => toggleSortMovimiento("tipo")} className="cursor-pointer px-4 py-3 font-bold">{sortLabelMovimiento("Tipo", "tipo")}</th>
                    <th onClick={() => toggleSortMovimiento("codigo")} className="cursor-pointer px-4 py-3 font-bold">{sortLabelMovimiento("Código", "codigo")}</th>
                    <th onClick={() => toggleSortMovimiento("modelo")} className="cursor-pointer px-4 py-3 font-bold">{sortLabelMovimiento("Modelo", "modelo")}</th>
                    <th onClick={() => toggleSortMovimiento("almacen")} className="cursor-pointer px-4 py-3 font-bold">{sortLabelMovimiento("Almacén", "almacen")}</th>
                    <th className="px-4 py-3 font-bold">SKU</th>
                    <th className="px-4 py-3 font-bold">Referencia</th>
                    <th onClick={() => toggleSortMovimiento("cantidad")} className="cursor-pointer px-4 py-3 font-bold">{sortLabelMovimiento("Cantidad", "cantidad")}</th>
                    <th onClick={() => toggleSortMovimiento("stockAnterior")} className="cursor-pointer px-4 py-3 font-bold">{sortLabelMovimiento("Stock ant.", "stockAnterior")}</th>
                    <th onClick={() => toggleSortMovimiento("stockNuevo")} className="cursor-pointer px-4 py-3 font-bold">{sortLabelMovimiento("Stock nuevo", "stockNuevo")}</th>
                    <th className="px-4 py-3 font-bold">Usuario</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientosPagina.map((mov) => (
                    <tr key={mov.id} className="border-t border-slate-200 bg-white hover:bg-slate-50">
                      <td className="px-4 py-3">{formatFecha(mov.createdAt)}</td>
                      <td className="px-4 py-3">{badgeTipo(mov.tipo)}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{mov.producto.codigo}</td>
                      <td className="px-4 py-3">
                        {mov.producto.modelo} / {mov.producto.color} / T{mov.producto.talla}
                      </td>
                      <td className="px-4 py-3">{mov.almacen.codigo}</td>
                      <td className="px-4 py-3">{mov.sku || "-"}</td>
                      <td className="px-4 py-3">{mov.referencia || "-"}</td>
                      <td className="px-4 py-3">{mov.cantidad}</td>
                      <td className="px-4 py-3">{mov.stockAnterior}</td>
                      <td className="px-4 py-3">{mov.stockNuevo}</td>
                      <td className="px-4 py-3">{mov.usuarioEmail || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <span>Mostrar</span>
                <select
                  value={movFilasPorPagina}
                  onChange={(e) => setMovFilasPorPagina(Number(e.target.value))}
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
                  disabled={movPaginaActual <= 1}
                  onClick={() => setMovPaginaActual((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ◀ Anterior
                </button>

                <div className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                  Página {movPaginaActual} de {movTotalPaginas}
                </div>

                <button
                  disabled={movPaginaActual >= movTotalPaginas}
                  onClick={() =>
                    setMovPaginaActual((p) => Math.min(movTotalPaginas, p + 1))
                  }
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Siguiente ▶
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {modalOpen && itemActivo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-900">
                  Movimiento de inventario
                </h2>
                <p className="text-sm text-slate-500">
                  {itemActivo.producto.modelo} · {itemActivo.producto.color} · T{itemActivo.producto.talla}
                </p>
              </div>

              <button
                onClick={cerrarModal}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Cerrar
              </button>
            </div>

            <div className="mb-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
              <div><b>Producto:</b> {itemActivo.producto.codigo}</div>
              <div><b>Almacén:</b> {itemActivo.almacen.codigo}</div>
              <div><b>SKU:</b> {itemActivo.sku}</div>
              <div><b>Stock actual:</b> {itemActivo.stock}</div>
            </div>

            <form onSubmit={guardarMovimiento} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">
                    Tipo
                  </label>
                  <select
                    value={movForm.tipo}
                    onChange={(e) =>
                      updateMov("tipo", e.target.value as "INGRESO" | "SALIDA" | "AJUSTE")
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                  >
                    <option value="INGRESO">INGRESO</option>
                    <option value="SALIDA">SALIDA</option>
                    <option value="AJUSTE">AJUSTE</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">
                    Cantidad
                  </label>
                  <input
                    type="number"
                    value={movForm.cantidad}
                    onChange={(e) => updateMov("cantidad", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">
                    Referencia
                  </label>
                  <input
                    value={movForm.referencia}
                    onChange={(e) => updateMov("referencia", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                    placeholder="Ejemplo: COMPRA-001"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">
                    Usuario
                  </label>
                  <input
                    value={movForm.usuarioEmail}
                    onChange={(e) => updateMov("usuarioEmail", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Nota
                </label>
                <textarea
                  value={movForm.nota}
                  onChange={(e) => updateMov("nota", e.target.value)}
                  className="min-h-[110px] w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                  placeholder="Detalle del movimiento"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={cerrarModal}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={guardando}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {guardando ? "Guardando..." : "Registrar movimiento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {scannerOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-3 sm:p-4">
          <div className="max-h-[95vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-4 shadow-xl sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-slate-900">Scanner</h2>
                <p className="text-xs text-slate-500">
                  Código de barras o QR
                </p>
              </div>

              <button
                onClick={cerrarScanner}
                className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Cerrar
              </button>
            </div>

            <div className="mb-3 flex flex-wrap gap-2 rounded-2xl bg-slate-50 p-3">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input
                  type="radio"
                  checked={scannerMode === "fisico"}
                  onChange={() => setScannerMode("fisico")}
                />
                Lector
              </label>

              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input
                  type="radio"
                  checked={scannerMode === "camara"}
                  onChange={() => setScannerMode("camara")}
                />
                Cámara
              </label>

              <select
                value={scannerAlmacenId}
                onChange={(e) => setScannerAlmacenId(e.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Todos los almacenes</option>
                {almacenesUnicos.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.codigo}
                  </option>
                ))}
              </select>
            </div>

            {scannerMode === "fisico" ? (
              <div className="mb-3 space-y-2">
                <label className="block text-sm font-semibold text-slate-700">
                  Código
                </label>
                <div className="flex gap-2">
                  <input
                    ref={scannerInputRef}
                    value={scannerCodigo}
                    onChange={(e) => setScannerCodigo(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (scannerCodigo.trim()) {
                          buscarPorCodigoBarras(scannerCodigo.trim());
                        }
                      }
                    }}
                    placeholder="Escanear"
                    className="flex-1 rounded-xl border border-slate-300 px-3 py-3 text-sm outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={() => {
                      if (scannerCodigo.trim()) {
                        buscarPorCodigoBarras(scannerCodigo.trim());
                      }
                    }}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Buscar
                  </button>
                </div>
              </div>
            ) : (
              <div className="mb-3 space-y-2">
                <div
                  id="reader"
                  className="overflow-hidden rounded-2xl border border-slate-200"
                />
                <div className="text-xs text-slate-500">
                  {camaraActiva
                    ? "Apunta al código."
                    : "Preparando cámara..."}
                </div>
              </div>
            )}

            {scannerLoading && (
              <div className="mb-3 rounded-2xl bg-blue-50 p-3 text-sm text-blue-700">
                Buscando producto...
              </div>
            )}

            {scannerError && (
              <div className="mb-3 rounded-2xl bg-red-50 p-3 text-sm text-red-700">
                {scannerError}
              </div>
            )}

            {scannerProducto && (
              <div className="space-y-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <h3 className="mb-2 text-base font-black text-slate-900">
                    Producto encontrado
                  </h3>

                  <div className="space-y-1 text-sm text-slate-700">
                    <div>
                      <b>{scannerProducto.producto.codigo}</b> ·{" "}
                      {scannerProducto.producto.modelo}
                    </div>
                    <div>
                      {scannerProducto.producto.color} ·{" "}
                      {scannerProducto.producto.material} ·{" "}
                      {scannerProducto.producto.taco} · T
                      {scannerProducto.producto.talla}
                    </div>
                    <div>
                      <b>Almacén:</b> {scannerProducto.almacen.codigo}
                    </div>
                    <div>
                      <b>Stock:</b> {scannerProducto.stock}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setScannerTipoRapido("INGRESO")}
                    className={`rounded-xl px-3 py-3 text-sm font-bold ${
                      scannerMovimiento.tipo === "INGRESO"
                        ? "bg-emerald-600 text-white"
                        : "border border-emerald-300 text-emerald-700"
                    }`}
                  >
                    Ingreso
                  </button>

                  <button
                    type="button"
                    onClick={() => setScannerTipoRapido("SALIDA")}
                    className={`rounded-xl px-3 py-3 text-sm font-bold ${
                      scannerMovimiento.tipo === "SALIDA"
                        ? "bg-red-600 text-white"
                        : "border border-red-300 text-red-700"
                    }`}
                  >
                    Salida
                  </button>
                </div>

                <form onSubmit={guardarMovimientoScanner} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-700">
                        Cantidad
                      </label>
                      <input
                        type="number"
                        value={scannerMovimiento.cantidad}
                        onChange={(e) =>
                          updateScannerMov("cantidad", e.target.value)
                        }
                        className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm outline-none focus:border-blue-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-700">
                        Usuario
                      </label>
                      <input
                        value={scannerMovimiento.usuarioEmail}
                        disabled
                        className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-3 text-sm text-slate-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">
                      Referencia
                    </label>
                    <input
                      value={scannerMovimiento.referencia}
                      onChange={(e) =>
                        updateScannerMov("referencia", e.target.value)
                      }
                      className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">
                      Nota
                    </label>
                    <textarea
                      value={scannerMovimiento.nota}
                      onChange={(e) =>
                        updateScannerMov("nota", e.target.value)
                      }
                      className="min-h-[80px] w-full rounded-xl border border-slate-300 px-3 py-3 text-sm outline-none focus:border-blue-500"
                      placeholder="Opcional"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setScannerCodigo("");
                        setScannerProducto(null);
                        setScannerError("");
                        setScannerMovimiento(initialScannerMovimiento);
                        setTimeout(() => scannerInputRef.current?.focus(), 100);
                      }}
                      className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Limpiar
                    </button>

                    <button
                      type="submit"
                      disabled={guardando}
                      className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                      {guardando ? "Guardando..." : "Registrar"}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}