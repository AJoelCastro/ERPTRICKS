"use client";

import { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Proveedor = {
  id: string;
  codigo: string;
  tipoProveedor: "PERSONA_NATURAL" | "PERSONA_JURIDICA";
  dni?: string | null;
  ruc?: string | null;
  nombres?: string | null;
  apellidos?: string | null;
  razonSocial?: string | null;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
  contacto?: string | null;
  estado: "ACTIVO" | "INACTIVO";
  createdAt: string;
  updatedAt: string;
};

type Almacen = {
  id: string;
  codigo: string;
  nombre: string;
  activo?: boolean;
};

type TipoItemCompra = "PRODUCTO" | "MATERIAL" | "INSUMO";

type Producto = {
  id: string;
  codigo: string;
  modelo: string;
  color: string;
  material: string;
  taco: string;
  coleccion?: string | null;
  talla: number;
  costo: string | number;
  precio: string | number;
  estado: string;
};

type CatalogoCompraItem = {
  tipoItem: TipoItemCompra;
  itemId: string;
  productoId?: string | null;
  codigo: string;
  nombre: string;
  descripcion: string;
  unidadMedida?: string | null;
  costoReferencial: string | number;
  precioReferencial?: string | number | null;
  estado?: string;
  raw?: Producto | Record<string, unknown>;
};

type DetalleCompra = {
  id?: string;
  compraId?: string;
  tipoItem: TipoItemCompra;
  itemId?: string | null;
  productoId?: string | null;
  codigoItem: string;
  descripcionItem: string;
  unidadMedida?: string | null;
  cantidad: number;
  costoUnitario: string | number;
  subtotal: string | number;
  observaciones?: string | null;
  producto?: Producto | null;
};

type HistorialCompra = {
  id: string;
  compraId: string;
  tipoEvento: string;
  estadoAnterior?: string | null;
  estadoNuevo?: string | null;
  detalle?: string | null;
  usuarioEmail?: string | null;
  createdAt: string;
};

type Compra = {
  id: string;
  codigo: string;
  proveedorId: string;
  almacenId: string;
  fechaCompra?: string | null;
  fechaRecepcion?: string | null;
  subtotal: string | number;
  descuento: string | number;
  igv: string | number;
  total: string | number;
  adelanto: string | number;
  saldo: string | number;
  metodoPago?: string | null;
  estadoCompra: string;
  estadoRecepcion: string;
  observaciones?: string | null;
  usuarioEmail?: string | null;
  createdAt: string;
  updatedAt: string;
  proveedor: Proveedor;
  almacen: Almacen;
  detalles: DetalleCompra[];
  historial?: HistorialCompra[];
};

type CompraFormLine = {
  uid: string;
  tipoItem: TipoItemCompra;
  itemId: string;
  productoId?: string;
  itemTexto: string;
  codigoItem: string;
  descripcionItem: string;
  unidadMedida: string;
  cantidad: string;
  costoUnitario: string;
  observaciones: string;
};

type SortKeyCompra =
  | "codigo"
  | "proveedor"
  | "createdAt"
  | "fechaCompra"
  | "total"
  | "adelanto"
  | "saldo"
  | "estadoCompra"
  | "estadoRecepcion";

type JsPDFWithAutoTable = jsPDF & {
  lastAutoTable?: {
    finalY?: number;
  };
};

type ItemRapidoForm = {
  codigo: string;
  nombre: string;
  descripcion: string;
  unidadMedida: string;
  costoReferencial: string;
};

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
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

async function readJsonSafe(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(text || "Respuesta no válida del servidor");
  }
}

function getProveedorNombre(p: Proveedor) {
  if (p.tipoProveedor === "PERSONA_JURIDICA") {
    return p.razonSocial || "-";
  }
  return `${p.nombres || ""} ${p.apellidos || ""}`.trim() || "-";
}

function getProveedorDocumento(p: Proveedor) {
  return p.tipoProveedor === "PERSONA_JURIDICA" ? p.ruc || "-" : p.dni || "-";
}

function getTipoItemLabel(tipo: TipoItemCompra) {
  if (tipo === "PRODUCTO") return "Producto";
  if (tipo === "MATERIAL") return "Material";
  return "Insumo";
}

function badgeTipoItem(tipo: TipoItemCompra) {
  const map: Record<TipoItemCompra, string> = {
    PRODUCTO: "bg-blue-100 text-blue-700",
    MATERIAL: "bg-amber-100 text-amber-700",
    INSUMO: "bg-violet-100 text-violet-700",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${map[tipo]}`}
    >
      {getTipoItemLabel(tipo)}
    </span>
  );
}

function createEmptyLine(): CompraFormLine {
  return {
    uid: uid(),
    tipoItem: "PRODUCTO",
    itemId: "",
    productoId: "",
    itemTexto: "",
    codigoItem: "",
    descripcionItem: "",
    unidadMedida: "UND",
    cantidad: "1",
    costoUnitario: "0",
    observaciones: "",
  };
}

function createEmptyItemForm(): ItemRapidoForm {
  return {
    codigo: "",
    nombre: "",
    descripcion: "",
    unidadMedida: "UND",
    costoReferencial: "0",
  };
}

function slugFromText(text: string) {
  return String(text || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function generarCodigoRapido(prefijo: "MAT" | "INS", nombre: string) {
  const base = slugFromText(nombre).slice(0, 10) || "ITEM";
  const stamp = Date.now().toString().slice(-5);
  return `${prefijo}-${base}-${stamp}`;
}

function classBotonSecundario(color: "amber" | "violet") {
  if (color === "amber") {
    return "border-amber-300 text-amber-700 hover:bg-amber-50";
  }
  return "border-violet-300 text-violet-700 hover:bg-violet-50";
}

export default function ComprasPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  const [compras, setCompras] = useState<Compra[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [catalogoItems, setCatalogoItems] = useState<CatalogoCompraItem[]>([]);
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);

  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [guardandoItemRapido, setGuardandoItemRapido] = useState(false);

  const [q, setQ] = useState("");
  const [proveedorFiltro, setProveedorFiltro] = useState("");
  const [estadoCompraFiltro, setEstadoCompraFiltro] = useState("");
  const [estadoRecepcionFiltro, setEstadoRecepcionFiltro] = useState("");

  const [sortKey, setSortKey] = useState<SortKeyCompra>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [pagina, setPagina] = useState(1);
  const [filas, setFilas] = useState(10);

  const [modalNueva, setModalNueva] = useState(false);
  const [detalleOpen, setDetalleOpen] = useState(false);
  const [compraActiva, setCompraActiva] = useState<Compra | null>(null);

  const [modalMaterial, setModalMaterial] = useState(false);
  const [modalInsumo, setModalInsumo] = useState(false);

  const [formMaterial, setFormMaterial] = useState<ItemRapidoForm>(
    createEmptyItemForm()
  );
  const [formInsumo, setFormInsumo] = useState<ItemRapidoForm>(
    createEmptyItemForm()
  );

  const [proveedorBusqueda, setProveedorBusqueda] = useState("");
  const [proveedorSeleccionado, setProveedorSeleccionado] =
    useState<Proveedor | null>(null);

  const [almacenId, setAlmacenId] = useState("");
  const [fechaCompra, setFechaCompra] = useState("");
  const [fechaRecepcion, setFechaRecepcion] = useState("");
  const [metodoPago, setMetodoPago] = useState("EFECTIVO");
  const [adelanto, setAdelanto] = useState("0");
  const [descuento, setDescuento] = useState("0");
  const [observaciones, setObservaciones] = useState("");

  const [detalle, setDetalle] = useState<CompraFormLine[]>([createEmptyLine()]);

  const [itemSearchByLine, setItemSearchByLine] = useState<Record<string, string>>(
    {}
  );

  const [pagoMonto, setPagoMonto] = useState("0");
  const [pagoMetodo, setPagoMetodo] = useState("EFECTIVO");
  const [pagoNota, setPagoNota] = useState("");

  async function cargarTodo() {
    try {
      setLoading(true);

      const [comprasRes, proveedoresRes, catalogoItemsRes, almacenesRes] =
        await Promise.all([
          fetch(`${apiUrl}/compras`),
          fetch(`${apiUrl}/proveedores`),
          fetch(`${apiUrl}/compras/catalogo-items`),
          fetch(`${apiUrl}/almacenes`),
        ]);

      const comprasData = await readJsonSafe(comprasRes);
      const proveedoresData = await readJsonSafe(proveedoresRes);
      const catalogoData = await readJsonSafe(catalogoItemsRes);
      const almacenesData = await readJsonSafe(almacenesRes);

      setCompras(comprasData.data || []);
      setProveedores(
        (proveedoresData.data || []).filter(
          (p: Proveedor) => p.estado === "ACTIVO"
        )
      );
      setCatalogoItems(catalogoData.data || []);
      setAlmacenes(almacenesData.data || []);

      if (!almacenId && (almacenesData.data || []).length > 0) {
        setAlmacenId(almacenesData.data[0].id);
      }
    } catch (error) {
      console.error(error);
      alert("No se pudo cargar Compras");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarTodo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetFormulario() {
    setProveedorBusqueda("");
    setProveedorSeleccionado(null);
    setFechaCompra("");
    setFechaRecepcion("");
    setMetodoPago("EFECTIVO");
    setAdelanto("0");
    setDescuento("0");
    setObservaciones("");
    setDetalle([createEmptyLine()]);
    setItemSearchByLine({});
  }

  function abrirNuevaCompra() {
    resetFormulario();
    setModalNueva(true);
  }

  function abrirModalMaterial() {
    setFormMaterial({
      ...createEmptyItemForm(),
      codigo: generarCodigoRapido("MAT", ""),
    });
    setModalMaterial(true);
  }

  function abrirModalInsumo() {
    setFormInsumo({
      ...createEmptyItemForm(),
      codigo: generarCodigoRapido("INS", ""),
    });
    setModalInsumo(true);
  }

  function cerrarModalMaterial() {
    if (guardandoItemRapido) return;
    setModalMaterial(false);
    setFormMaterial(createEmptyItemForm());
  }

  function cerrarModalInsumo() {
    if (guardandoItemRapido) return;
    setModalInsumo(false);
    setFormInsumo(createEmptyItemForm());
  }

  const proveedoresFiltrados = useMemo(() => {
    const t = proveedorBusqueda.trim().toLowerCase();
    if (!t) return proveedores.slice(0, 8);

    return proveedores
      .filter((p) => {
        return (
          p.codigo.toLowerCase().includes(t) ||
          String(p.dni || "").toLowerCase().includes(t) ||
          String(p.ruc || "").toLowerCase().includes(t) ||
          String(p.nombres || "").toLowerCase().includes(t) ||
          String(p.apellidos || "").toLowerCase().includes(t) ||
          String(p.razonSocial || "").toLowerCase().includes(t) ||
          String(p.telefono || "").toLowerCase().includes(t)
        );
      })
      .slice(0, 8);
  }, [proveedores, proveedorBusqueda]);

  function itemsFiltradosLinea(lineUid: string, tipoItem: TipoItemCompra) {
    const t = (itemSearchByLine[lineUid] || "").trim().toLowerCase();

    const itemsDelTipo = catalogoItems.filter((x) => x.tipoItem === tipoItem);

    if (!t) return itemsDelTipo.slice(0, 8);

    return itemsDelTipo
      .filter((item) => {
        return (
          item.codigo.toLowerCase().includes(t) ||
          item.nombre.toLowerCase().includes(t) ||
          item.descripcion.toLowerCase().includes(t) ||
          String(item.unidadMedida || "").toLowerCase().includes(t)
        );
      })
      .slice(0, 8);
  }

  function agregarLinea() {
    setDetalle((prev) => [...prev, createEmptyLine()]);
  }

  function eliminarLinea(uidLine: string) {
    setDetalle((prev) => prev.filter((x) => x.uid !== uidLine));
    setItemSearchByLine((prev) => {
      const clone = { ...prev };
      delete clone[uidLine];
      return clone;
    });
  }

  function updateLinea(uidLine: string, field: keyof CompraFormLine, value: string) {
    setDetalle((prev) =>
      prev.map((line) =>
        line.uid === uidLine ? { ...line, [field]: value } : line
      )
    );
  }

  function cambiarTipoLinea(uidLine: string, tipoItem: TipoItemCompra) {
    setDetalle((prev) =>
      prev.map((line) =>
        line.uid === uidLine
          ? {
              ...line,
              tipoItem,
              itemId: "",
              productoId: "",
              itemTexto: "",
              codigoItem: "",
              descripcionItem: "",
              unidadMedida: "UND",
              costoUnitario: "0",
            }
          : line
      )
    );

    setItemSearchByLine((prev) => ({
      ...prev,
      [uidLine]: "",
    }));
  }

  function seleccionarItem(uidLine: string, item: CatalogoCompraItem) {
    setDetalle((prev) =>
      prev.map((line) =>
        line.uid === uidLine
          ? {
              ...line,
              tipoItem: item.tipoItem,
              itemId: item.itemId,
              productoId:
                item.tipoItem === "PRODUCTO" ? item.productoId || item.itemId : "",
              itemTexto: `${item.codigo} - ${item.descripcion}`,
              codigoItem: item.codigo,
              descripcionItem: item.descripcion,
              unidadMedida: item.unidadMedida || "UND",
              costoUnitario: String(Number(item.costoReferencial || 0)),
            }
          : line
      )
    );

    setItemSearchByLine((prev) => ({
      ...prev,
      [uidLine]: `${item.codigo} ${item.nombre}`,
    }));
  }

  async function crearItemRapido(tipo: "MATERIAL" | "INSUMO") {
    const form = tipo === "MATERIAL" ? formMaterial : formInsumo;
    const endpoint = tipo === "MATERIAL" ? "materiales" : "insumos";

    const nombre = form.nombre.trim();
    const descripcion = form.descripcion.trim();
    const unidadMedida = form.unidadMedida.trim() || "UND";
    const codigo =
      form.codigo.trim() ||
      generarCodigoRapido(tipo === "MATERIAL" ? "MAT" : "INS", nombre);
    const costoReferencial = Number(form.costoReferencial || 0);

    if (!nombre) {
      alert(`Ingresa el nombre del ${tipo === "MATERIAL" ? "material" : "insumo"}`);
      return;
    }

    if (isNaN(costoReferencial) || costoReferencial < 0) {
      alert("El costo referencial debe ser válido");
      return;
    }

    try {
      setGuardandoItemRapido(true);

      const res = await fetch(`${apiUrl}/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          codigo,
          nombre,
          descripcion: descripcion || nombre,
          unidadMedida,
          costoReferencial,
          estado: "ACTIVO",
        }),
      });

      const data = await readJsonSafe(res);

      if (!res.ok || !data.ok) {
        alert(
          data.error ||
            `No se pudo registrar el ${tipo === "MATERIAL" ? "material" : "insumo"}`
        );
        return;
      }

      await cargarTodo();

      const nuevoItem: CatalogoCompraItem | undefined = (data.data &&
        {
          tipoItem: tipo,
          itemId: data.data.id,
          codigo: data.data.codigo,
          nombre: data.data.nombre,
          descripcion: data.data.descripcion || data.data.nombre,
          unidadMedida: data.data.unidadMedida || "UND",
          costoReferencial: data.data.costoReferencial || 0,
          estado: data.data.estado || "ACTIVO",
        }) as CatalogoCompraItem | undefined;

      if (modalNueva && nuevoItem && detalle.length > 0) {
        const ultimaLinea = detalle[detalle.length - 1];
        cambiarTipoLinea(ultimaLinea.uid, tipo);
        setTimeout(() => {
          seleccionarItem(ultimaLinea.uid, nuevoItem);
        }, 50);
      }

      if (tipo === "MATERIAL") {
        setModalMaterial(false);
        setFormMaterial(createEmptyItemForm());
      } else {
        setModalInsumo(false);
        setFormInsumo(createEmptyItemForm());
      }

      alert(
        `${tipo === "MATERIAL" ? "Material" : "Insumo"} registrado correctamente`
      );
    } catch (error) {
      console.error(error);
      alert(
        `Error registrando ${tipo === "MATERIAL" ? "material" : "insumo"}`
      );
    } finally {
      setGuardandoItemRapido(false);
    }
  }

  const resumenNuevaCompra = useMemo(() => {
    const lineas = detalle
      .map((line) => {
        const cantidad = Number(line.cantidad || 0);
        const costo = Number(line.costoUnitario || 0);
        const subtotal = cantidad * costo;
        return {
          cantidad,
          costo,
          subtotal,
        };
      })
      .filter((x) => x.cantidad > 0);

    const bruto = lineas.reduce((acc, x) => acc + x.subtotal, 0);
    let total = bruto - Number(descuento || 0);
    if (total < 0) total = 0;

    const subtotal = total / 1.18;
    const igv = total - subtotal;
    const adelantoNum = Number(adelanto || 0);
    const saldo = Math.max(0, total - adelantoNum);

    return {
      totalItems: lineas.reduce((acc, x) => acc + x.cantidad, 0),
      subtotal,
      igv,
      total,
      adelantoNum,
      saldo,
    };
  }, [detalle, descuento, adelanto]);

  async function registrarCompra() {
    if (!proveedorSeleccionado) {
      alert("Selecciona un proveedor");
      return;
    }

    if (!almacenId) {
      alert("Selecciona un almacén");
      return;
    }

    const lineasValidas = detalle
      .filter(
        (line) =>
          line.tipoItem &&
          line.itemId &&
          line.codigoItem &&
          line.descripcionItem &&
          Number(line.cantidad) > 0 &&
          Number(line.costoUnitario) >= 0
      )
      .map((line) => ({
        tipoItem: line.tipoItem,
        itemId: line.itemId,
        productoId:
          line.tipoItem === "PRODUCTO" ? line.productoId || line.itemId : null,
        codigoItem: line.codigoItem,
        descripcionItem: line.descripcionItem,
        unidadMedida: line.unidadMedida || "UND",
        cantidad: Number(line.cantidad),
        costoUnitario: Number(line.costoUnitario),
        observaciones: line.observaciones || null,
      }));

    if (lineasValidas.length === 0) {
      alert("Debes agregar al menos una línea válida");
      return;
    }

    try {
      setProcesando(true);

      const res = await fetch(`${apiUrl}/compras`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          proveedorId: proveedorSeleccionado.id,
          almacenId,
          fechaCompra: fechaCompra || null,
          fechaRecepcion: fechaRecepcion || null,
          metodoPago,
          adelanto: Number(adelanto || 0),
          descuento: Number(descuento || 0),
          observaciones,
          usuarioEmail: "admin@erp.com",
          detalle: lineasValidas,
        }),
      });

      const data = await readJsonSafe(res);

      if (!res.ok || !data.ok) {
        alert(data.error || "No se pudo registrar compra");
        return;
      }

      await cargarTodo();
      setModalNueva(false);
      alert("Compra registrada correctamente");
    } catch (error) {
      console.error(error);
      alert("Error registrando compra");
    } finally {
      setProcesando(false);
    }
  }

  async function abrirDetalle(id: string) {
    try {
      const res = await fetch(`${apiUrl}/compras/${id}`);
      const data = await readJsonSafe(res);

      if (!res.ok || !data.ok) {
        alert(data.error || "No se pudo abrir la compra");
        return;
      }

      setCompraActiva(data.data);
      setPagoMonto(String(Number(data.data.saldo || 0)));
      setPagoMetodo(data.data.metodoPago || "EFECTIVO");
      setPagoNota("");
      setDetalleOpen(true);
    } catch (error) {
      console.error(error);
      alert("Error abriendo detalle de compra");
    }
  }

  async function registrarPagoCompra() {
    if (!compraActiva) return;

    try {
      setProcesando(true);

      const res = await fetch(`${apiUrl}/compras/${compraActiva.id}/pagos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          monto: Number(pagoMonto || 0),
          metodoPago: pagoMetodo,
          nota: pagoNota || null,
          usuarioEmail: "admin@erp.com",
        }),
      });

      const data = await readJsonSafe(res);

      if (!res.ok || !data.ok) {
        alert(data.error || "No se pudo registrar pago");
        return;
      }

      await cargarTodo();
      await abrirDetalle(compraActiva.id);
      alert("Pago registrado correctamente");
    } catch (error) {
      console.error(error);
      alert("Error registrando pago");
    } finally {
      setProcesando(false);
    }
  }

  async function ingresarInventarioCompra() {
    if (!compraActiva) return;

    try {
      setProcesando(true);

      const res = await fetch(
        `${apiUrl}/compras/${compraActiva.id}/ingresar-inventario`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            nota: "Ingreso de mercadería desde frontend",
            usuarioEmail: "admin@erp.com",
          }),
        }
      );

      const data = await readJsonSafe(res);

      if (!res.ok || !data.ok) {
        alert(data.error || "No se pudo ingresar al inventario");
        return;
      }

      await cargarTodo();
      await abrirDetalle(compraActiva.id);
      alert("Compra procesada correctamente");
    } catch (error) {
      console.error(error);
      alert("Error ingresando inventario");
    } finally {
      setProcesando(false);
    }
  }

  async function cancelarCompra() {
    if (!compraActiva) return;

    const ok = window.confirm("¿Seguro que deseas cancelar esta compra?");
    if (!ok) return;

    try {
      setProcesando(true);

      const res = await fetch(`${apiUrl}/compras/${compraActiva.id}/cancelar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          detalle: "Cancelada desde frontend",
          usuarioEmail: "admin@erp.com",
        }),
      });

      const data = await readJsonSafe(res);

      if (!res.ok || !data.ok) {
        alert(data.error || "No se pudo cancelar compra");
        return;
      }

      await cargarTodo();
      await abrirDetalle(compraActiva.id);
      alert("Compra cancelada");
    } catch (error) {
      console.error(error);
      alert("Error cancelando compra");
    } finally {
      setProcesando(false);
    }
  }

  function exportarCompraPDF(compra: Compra) {
    const doc = new jsPDF();

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 28, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text("ERP CALZADO V2", 14, 12);
    doc.setFontSize(10);
    doc.text("Resumen de compra", 14, 20);

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(11);

    doc.text(`Compra: ${compra.codigo}`, 14, 40);
    doc.text(
      `Fecha compra: ${formatDate(compra.fechaCompra || compra.createdAt)}`,
      14,
      48
    );
    doc.text(`Fecha recepción: ${formatDate(compra.fechaRecepcion)}`, 14, 56);

    doc.text(`Proveedor: ${getProveedorNombre(compra.proveedor)}`, 105, 40);
    doc.text(`Documento: ${getProveedorDocumento(compra.proveedor)}`, 105, 48);
    doc.text(
      `Almacén: ${compra.almacen.codigo} - ${compra.almacen.nombre}`,
      105,
      56
    );

    autoTable(doc, {
      startY: 68,
      head: [["Tipo", "Código", "Descripción", "Cant.", "Costo", "Subtotal"]],
      body: compra.detalles.map((d) => [
        d.tipoItem,
        d.codigoItem || "-",
        d.descripcionItem || "-",
        String(d.cantidad || 0),
        formatMoney(d.costoUnitario || 0),
        formatMoney(d.subtotal || 0),
      ]),
      headStyles: {
        fillColor: [30, 41, 59],
      },
      styles: {
        fontSize: 8.2,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
    });

    const finalY = (doc as JsPDFWithAutoTable).lastAutoTable?.finalY || 120;

    doc.roundedRect(14, finalY + 8, 90, 34, 3, 3);
    doc.setFontSize(10);
    doc.text("Observaciones", 18, finalY + 16);
    doc.setFontSize(9);
    const obs = compra.observaciones || "-";
    const splitObs = doc.splitTextToSize(obs, 80);
    doc.text(splitObs, 18, finalY + 23);

    doc.roundedRect(116, finalY + 8, 80, 40, 3, 3);
    doc.setFontSize(10);
    doc.text(`Subtotal: ${formatMoney(compra.subtotal)}`, 120, finalY + 18);
    doc.text(`IGV: ${formatMoney(compra.igv)}`, 120, finalY + 25);
    doc.text(`Total: ${formatMoney(compra.total)}`, 120, finalY + 32);
    doc.text(`Adelanto: ${formatMoney(compra.adelanto)}`, 120, finalY + 39);
    doc.setFontSize(11);
    doc.text(`Saldo: ${formatMoney(compra.saldo)}`, 120, finalY + 46);

    doc.save(`${compra.codigo}.pdf`);
  }

  const resumen = useMemo(() => {
    const total = compras.length;
    const registradas = compras.filter((c) => c.estadoCompra === "REGISTRADA").length;
    const parciales = compras.filter((c) => c.estadoCompra === "PAGADO_PARCIAL").length;
    const pagadas = compras.filter((c) => c.estadoCompra === "PAGADA").length;
    const pendientesRecepcion = compras.filter(
      (c) => c.estadoRecepcion === "PENDIENTE"
    ).length;

    return {
      total,
      registradas,
      parciales,
      pagadas,
      pendientesRecepcion,
    };
  }, [compras]);

  const comprasFiltradas = useMemo(() => {
    const t = q.trim().toLowerCase();

    const filtradas = compras.filter((c) => {
      const nombreProveedor = getProveedorNombre(c.proveedor).toLowerCase();
      const textoDetalle = c.detalles
        .map((d) => `${d.codigoItem} ${d.descripcionItem} ${d.tipoItem}`)
        .join(" ")
        .toLowerCase();

      const matchQ =
        !t ||
        c.codigo.toLowerCase().includes(t) ||
        nombreProveedor.includes(t) ||
        getProveedorDocumento(c.proveedor).toLowerCase().includes(t) ||
        textoDetalle.includes(t);

      const matchProveedor = !proveedorFiltro || c.proveedorId === proveedorFiltro;
      const matchEstadoCompra =
        !estadoCompraFiltro || c.estadoCompra === estadoCompraFiltro;
      const matchEstadoRecepcion =
        !estadoRecepcionFiltro || c.estadoRecepcion === estadoRecepcionFiltro;

      return (
        matchQ &&
        matchProveedor &&
        matchEstadoCompra &&
        matchEstadoRecepcion
      );
    });

    return [...filtradas].sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";

      switch (sortKey) {
        case "codigo":
          av = a.codigo;
          bv = b.codigo;
          break;
        case "proveedor":
          av = getProveedorNombre(a.proveedor);
          bv = getProveedorNombre(b.proveedor);
          break;
        case "createdAt":
          av = new Date(a.createdAt).getTime();
          bv = new Date(b.createdAt).getTime();
          break;
        case "fechaCompra":
          av = a.fechaCompra ? new Date(a.fechaCompra).getTime() : 0;
          bv = b.fechaCompra ? new Date(b.fechaCompra).getTime() : 0;
          break;
        case "total":
          av = Number(a.total || 0);
          bv = Number(b.total || 0);
          break;
        case "adelanto":
          av = Number(a.adelanto || 0);
          bv = Number(b.adelanto || 0);
          break;
        case "saldo":
          av = Number(a.saldo || 0);
          bv = Number(b.saldo || 0);
          break;
        case "estadoCompra":
          av = a.estadoCompra;
          bv = b.estadoCompra;
          break;
        case "estadoRecepcion":
          av = a.estadoRecepcion;
          bv = b.estadoRecepcion;
          break;
      }

      if (typeof av === "string") av = av.toUpperCase();
      if (typeof bv === "string") bv = bv.toUpperCase();

      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [
    compras,
    q,
    proveedorFiltro,
    estadoCompraFiltro,
    estadoRecepcionFiltro,
    sortKey,
    sortDir,
  ]);

  const totalPaginas = Math.max(1, Math.ceil(comprasFiltradas.length / filas));

  const comprasPagina = useMemo(() => {
    const start = (pagina - 1) * filas;
    return comprasFiltradas.slice(start, start + filas);
  }, [comprasFiltradas, pagina, filas]);

  useEffect(() => {
    setPagina(1);
  }, [q, proveedorFiltro, estadoCompraFiltro, estadoRecepcionFiltro, filas]);

  function toggleSort(key: SortKeyCompra) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function sortLabel(label: string, key: SortKeyCompra) {
    if (sortKey !== key) return `${label} ↕`;
    return `${label} ${sortDir === "asc" ? "▲" : "▼"}`;
  }

  function badgeEstadoCompra(estado: string) {
    const map: Record<string, string> = {
      REGISTRADA: "bg-slate-100 text-slate-700",
      PAGADO_PARCIAL: "bg-yellow-100 text-yellow-700",
      PAGADA: "bg-emerald-100 text-emerald-700",
      CANCELADA: "bg-red-100 text-red-700",
    };

    return (
      <span
        className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
          map[estado] || "bg-slate-100 text-slate-700"
        }`}
      >
        {estado}
      </span>
    );
  }

  function badgeEstadoRecepcion(estado: string) {
    const map: Record<string, string> = {
      PENDIENTE: "bg-slate-100 text-slate-700",
      INGRESADA: "bg-blue-100 text-blue-700",
      PARCIAL: "bg-yellow-100 text-yellow-700",
      CANCELADA: "bg-red-100 text-red-700",
    };

    return (
      <span
        className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
          map[estado] || "bg-slate-100 text-slate-700"
        }`}
      >
        {estado}
      </span>
    );
  }

  const puedeIngresarInventario =
    compraActiva &&
    compraActiva.estadoCompra !== "CANCELADA" &&
    compraActiva.estadoRecepcion !== "INGRESADA";

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Compras</h1>
            <p className="text-sm text-slate-500">
              Registro de compras de productos, materiales e insumos
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <button
              onClick={abrirNuevaCompra}
              className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              + Nueva compra
            </button>

            <button
              onClick={abrirModalMaterial}
              className={`rounded-xl border px-4 py-3 text-sm font-semibold ${classBotonSecundario(
                "amber"
              )}`}
            >
              + Material
            </button>

            <button
              onClick={abrirModalInsumo}
              className={`rounded-xl border px-4 py-3 text-sm font-semibold ${classBotonSecundario(
                "violet"
              )}`}
            >
              + Insumo
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="text-sm font-semibold text-slate-500">Total</div>
            <div className="mt-2 text-3xl font-black text-slate-900">
              {resumen.total}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="text-sm font-semibold text-slate-500">Registradas</div>
            <div className="mt-2 text-3xl font-black text-slate-700">
              {resumen.registradas}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="text-sm font-semibold text-slate-500">
              Pago parcial
            </div>
            <div className="mt-2 text-3xl font-black text-yellow-700">
              {resumen.parciales}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="text-sm font-semibold text-slate-500">Pagadas</div>
            <div className="mt-2 text-3xl font-black text-emerald-700">
              {resumen.pagadas}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="text-sm font-semibold text-slate-500">
              Pendientes recepción
            </div>
            <div className="mt-2 text-3xl font-black text-blue-700">
              {resumen.pendientesRecepcion}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-4">
          <h2 className="text-xl font-black text-slate-900">Lista de compras</h2>
          <p className="text-sm text-slate-500">
            Filtros, vista responsive, pagos y recepción
          </p>
        </div>

        <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar compra, proveedor, documento o ítem"
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
          />

          <select
            value={proveedorFiltro}
            onChange={(e) => setProveedorFiltro(e.target.value)}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
          >
            <option value="">Todos los proveedores</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.codigo} - {getProveedorNombre(p)}
              </option>
            ))}
          </select>

          <select
            value={estadoCompraFiltro}
            onChange={(e) => setEstadoCompraFiltro(e.target.value)}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
          >
            <option value="">Estado compra</option>
            <option value="REGISTRADA">REGISTRADA</option>
            <option value="PAGADO_PARCIAL">PAGADO_PARCIAL</option>
            <option value="PAGADA">PAGADA</option>
            <option value="CANCELADA">CANCELADA</option>
          </select>

          <select
            value={estadoRecepcionFiltro}
            onChange={(e) => setEstadoRecepcionFiltro(e.target.value)}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
          >
            <option value="">Estado recepción</option>
            <option value="PENDIENTE">PENDIENTE</option>
            <option value="INGRESADA">INGRESADA</option>
            <option value="PARCIAL">PARCIAL</option>
            <option value="CANCELADA">CANCELADA</option>
          </select>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Cargando compras...</p>
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 lg:block">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100 text-left text-slate-700">
                  <tr>
                    <th
                      onClick={() => toggleSort("codigo")}
                      className="cursor-pointer px-4 py-3 font-bold"
                    >
                      {sortLabel("Código", "codigo")}
                    </th>
                    <th
                      onClick={() => toggleSort("proveedor")}
                      className="cursor-pointer px-4 py-3 font-bold"
                    >
                      {sortLabel("Proveedor", "proveedor")}
                    </th>
                    <th
                      onClick={() => toggleSort("createdAt")}
                      className="cursor-pointer px-4 py-3 font-bold"
                    >
                      {sortLabel("Registro", "createdAt")}
                    </th>
                    <th
                      onClick={() => toggleSort("fechaCompra")}
                      className="cursor-pointer px-4 py-3 font-bold"
                    >
                      {sortLabel("Fecha compra", "fechaCompra")}
                    </th>
                    <th
                      onClick={() => toggleSort("total")}
                      className="cursor-pointer px-4 py-3 font-bold"
                    >
                      {sortLabel("Total", "total")}
                    </th>
                    <th
                      onClick={() => toggleSort("adelanto")}
                      className="cursor-pointer px-4 py-3 font-bold"
                    >
                      {sortLabel("Adelanto", "adelanto")}
                    </th>
                    <th
                      onClick={() => toggleSort("saldo")}
                      className="cursor-pointer px-4 py-3 font-bold"
                    >
                      {sortLabel("Saldo", "saldo")}
                    </th>
                    <th
                      onClick={() => toggleSort("estadoCompra")}
                      className="cursor-pointer px-4 py-3 font-bold"
                    >
                      {sortLabel("Estado compra", "estadoCompra")}
                    </th>
                    <th
                      onClick={() => toggleSort("estadoRecepcion")}
                      className="cursor-pointer px-4 py-3 font-bold"
                    >
                      {sortLabel("Recepción", "estadoRecepcion")}
                    </th>
                    <th className="px-4 py-3 font-bold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {comprasPagina.map((c) => (
                    <tr key={c.id} className="border-t border-slate-200 bg-white">
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {c.codigo}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">
                          {getProveedorNombre(c.proveedor)}
                        </div>
                        <div className="text-xs text-slate-500">
                          {getProveedorDocumento(c.proveedor)}
                        </div>
                      </td>
                      <td className="px-4 py-3">{formatDate(c.createdAt)}</td>
                      <td className="px-4 py-3">{formatDate(c.fechaCompra)}</td>
                      <td className="px-4 py-3">{formatMoney(c.total)}</td>
                      <td className="px-4 py-3">{formatMoney(c.adelanto)}</td>
                      <td className="px-4 py-3">{formatMoney(c.saldo)}</td>
                      <td className="px-4 py-3">
                        {badgeEstadoCompra(c.estadoCompra)}
                      </td>
                      <td className="px-4 py-3">
                        {badgeEstadoRecepcion(c.estadoRecepcion)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => abrirDetalle(c.id)}
                            className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            Ver detalle
                          </button>
                          <button
                            onClick={() => exportarCompraPDF(c)}
                            className="rounded-lg border border-blue-300 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                          >
                            PDF
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {comprasPagina.length === 0 && (
                    <tr>
                      <td
                        colSpan={10}
                        className="px-4 py-10 text-center text-sm text-slate-500"
                      >
                        No hay compras para esos filtros.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 lg:hidden">
              {comprasPagina.map((c) => (
                <div
                  key={c.id}
                  className="rounded-2xl border border-slate-200 p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-black text-slate-900">
                        {c.codigo}
                      </div>
                      <div className="text-sm font-semibold text-slate-700">
                        {getProveedorNombre(c.proveedor)}
                      </div>
                      <div className="text-xs text-slate-500">
                        {getProveedorDocumento(c.proveedor)}
                      </div>
                    </div>
                    <div className="text-right text-xs text-slate-500">
                      {formatDate(c.fechaCompra || c.createdAt)}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <div className="text-xs text-slate-500">Total</div>
                      <div className="font-bold text-slate-900">
                        {formatMoney(c.total)}
                      </div>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <div className="text-xs text-slate-500">Saldo</div>
                      <div className="font-bold text-slate-900">
                        {formatMoney(c.saldo)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {badgeEstadoCompra(c.estadoCompra)}
                    {badgeEstadoRecepcion(c.estadoRecepcion)}
                  </div>

                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <button
                      onClick={() => abrirDetalle(c.id)}
                      className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Ver detalle
                    </button>
                    <button
                      onClick={() => exportarCompraPDF(c)}
                      className="w-full rounded-xl border border-blue-300 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                    >
                      PDF
                    </button>
                  </div>
                </div>
              ))}

              {comprasPagina.length === 0 && (
                <div className="rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">
                  No hay compras para esos filtros.
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <span>Mostrar</span>
                <select
                  value={filas}
                  onChange={(e) => setFilas(Number(e.target.value))}
                  className="rounded-lg border border-slate-300 px-3 py-2"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span>filas</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  disabled={pagina <= 1}
                  onClick={() => setPagina((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  ◀ Anterior
                </button>
                <div className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                  Página {pagina} de {totalPaginas}
                </div>
                <button
                  disabled={pagina >= totalPaginas}
                  onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  Siguiente ▶
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {modalNueva && (
        <div className="fixed inset-0 z-50 bg-black/40 p-2 sm:p-4">
          <div className="mx-auto max-h-[96vh] w-full max-w-7xl overflow-y-auto rounded-3xl bg-white p-4 shadow-xl sm:p-6">
            <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-900">
                  Nueva compra
                </h2>
                <p className="text-sm text-slate-500">
                  Registro de compra con detalle por producto, material o insumo
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <button
                  onClick={abrirModalMaterial}
                  className={`rounded-xl border px-4 py-3 text-sm font-semibold ${classBotonSecundario(
                    "amber"
                  )}`}
                >
                  + Material
                </button>
                <button
                  onClick={abrirModalInsumo}
                  className={`rounded-xl border px-4 py-3 text-sm font-semibold ${classBotonSecundario(
                    "violet"
                  )}`}
                >
                  + Insumo
                </button>
                <button
                  onClick={() => setModalNueva(false)}
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
                >
                  Cerrar
                </button>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-3">
              <div className="space-y-4 xl:col-span-2">
                <section className="rounded-2xl border border-slate-200 p-4">
                  <h3 className="mb-3 text-lg font-black text-slate-900">
                    Proveedor
                  </h3>

                  <input
                    value={proveedorBusqueda}
                    onChange={(e) => setProveedorBusqueda(e.target.value)}
                    placeholder="Buscar por código, DNI, RUC, nombre o razón social"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                  />

                  <div className="mt-3 max-h-52 overflow-y-auto rounded-xl border border-slate-200">
                    {proveedoresFiltrados.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setProveedorSeleccionado(p);
                          setProveedorBusqueda(
                            `${p.codigo} - ${getProveedorNombre(p)}`
                          );
                        }}
                        className="block w-full border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50"
                      >
                        <div className="font-semibold text-slate-900">
                          {getProveedorNombre(p)}
                        </div>
                        <div className="text-xs text-slate-500">
                          {p.codigo} · {getProveedorDocumento(p)}
                        </div>
                      </button>
                    ))}
                  </div>

                  {proveedorSeleccionado && (
                    <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
                      Proveedor seleccionado:{" "}
                      <b>{getProveedorNombre(proveedorSeleccionado)}</b> ·{" "}
                      {getProveedorDocumento(proveedorSeleccionado)}
                    </div>
                  )}
                </section>

                <section className="rounded-2xl border border-slate-200 p-4">
                  <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h3 className="text-lg font-black text-slate-900">
                        Detalle de compra
                      </h3>
                      <p className="text-xs text-slate-500">
                        Si no existe el material o insumo, créalo desde aquí mismo
                      </p>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-3">
                      <button
                        type="button"
                        onClick={agregarLinea}
                        className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
                      >
                        + Agregar línea
                      </button>

                      <button
                        type="button"
                        onClick={abrirModalMaterial}
                        className={`rounded-xl border px-4 py-3 text-sm font-semibold ${classBotonSecundario(
                          "amber"
                        )}`}
                      >
                        + Material
                      </button>

                      <button
                        type="button"
                        onClick={abrirModalInsumo}
                        className={`rounded-xl border px-4 py-3 text-sm font-semibold ${classBotonSecundario(
                          "violet"
                        )}`}
                      >
                        + Insumo
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {detalle.map((line, index) => {
                      const sugerencias = itemsFiltradosLinea(line.uid, line.tipoItem);

                      return (
                        <div
                          key={line.uid}
                          className="rounded-2xl border border-slate-200 p-4"
                        >
                          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="font-bold text-slate-900">
                              Línea {index + 1}
                            </div>

                            {detalle.length > 1 && (
                              <button
                                type="button"
                                onClick={() => eliminarLinea(line.uid)}
                                className="rounded-lg border border-red-300 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                              >
                                Eliminar
                              </button>
                            )}
                          </div>

                          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-12">
                            <div className="xl:col-span-3">
                              <label className="mb-1 block text-sm font-semibold text-slate-700">
                                Tipo de ítem
                              </label>
                              <select
                                value={line.tipoItem}
                                onChange={(e) =>
                                  cambiarTipoLinea(
                                    line.uid,
                                    e.target.value as TipoItemCompra
                                  )
                                }
                                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                              >
                                <option value="PRODUCTO">PRODUCTO</option>
                                <option value="MATERIAL">MATERIAL</option>
                                <option value="INSUMO">INSUMO</option>
                              </select>
                            </div>

                            <div className="xl:col-span-5">
                              <div className="mb-1 flex items-center justify-between gap-2">
                                <label className="block text-sm font-semibold text-slate-700">
                                  Buscar {getTipoItemLabel(line.tipoItem).toLowerCase()}
                                </label>

                                {line.tipoItem !== "PRODUCTO" && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      line.tipoItem === "MATERIAL"
                                        ? abrirModalMaterial()
                                        : abrirModalInsumo()
                                    }
                                    className="text-xs font-semibold text-blue-600 hover:underline"
                                  >
                                    + Crear ahora
                                  </button>
                                )}
                              </div>

                              <input
                                value={itemSearchByLine[line.uid] || ""}
                                onChange={(e) =>
                                  setItemSearchByLine((prev) => ({
                                    ...prev,
                                    [line.uid]: e.target.value,
                                  }))
                                }
                                placeholder={`Buscar ${getTipoItemLabel(
                                  line.tipoItem
                                ).toLowerCase()} por código o nombre`}
                                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                              />

                              <div className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-slate-200">
                                {sugerencias.map((item) => (
                                  <button
                                    key={`${item.tipoItem}-${item.itemId}`}
                                    type="button"
                                    onClick={() => seleccionarItem(line.uid, item)}
                                    className="block w-full border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50"
                                  >
                                    <div className="mb-1 flex flex-wrap items-center gap-2">
                                      {badgeTipoItem(item.tipoItem)}
                                      <span className="font-semibold text-slate-900">
                                        {item.codigo} - {item.nombre}
                                      </span>
                                    </div>
                                    <div className="text-xs text-slate-500">
                                      {item.descripcion}
                                    </div>
                                    <div className="mt-1 text-xs text-slate-500">
                                      Unidad: {item.unidadMedida || "UND"} · Costo{" "}
                                      {formatMoney(item.costoReferencial)}
                                    </div>
                                  </button>
                                ))}

                                {sugerencias.length === 0 && (
                                  <div className="px-4 py-3 text-sm text-slate-500">
                                    No hay resultados.{" "}
                                    {line.tipoItem !== "PRODUCTO"
                                      ? "Usa el botón Crear ahora."
                                      : ""}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="xl:col-span-2">
                              <label className="mb-1 block text-sm font-semibold text-slate-700">
                                Cantidad
                              </label>
                              <input
                                type="number"
                                min={1}
                                value={line.cantidad}
                                onChange={(e) =>
                                  updateLinea(line.uid, "cantidad", e.target.value)
                                }
                                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                              />
                            </div>

                            <div className="xl:col-span-2">
                              <label className="mb-1 block text-sm font-semibold text-slate-700">
                                Costo unit.
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                value={line.costoUnitario}
                                onChange={(e) =>
                                  updateLinea(
                                    line.uid,
                                    "costoUnitario",
                                    e.target.value
                                  )
                                }
                                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                              />
                            </div>

                            <div className="xl:col-span-3">
                              <label className="mb-1 block text-sm font-semibold text-slate-700">
                                Código
                              </label>
                              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                                {line.codigoItem || "-"}
                              </div>
                            </div>

                            <div className="xl:col-span-5">
                              <label className="mb-1 block text-sm font-semibold text-slate-700">
                                Ítem seleccionado
                              </label>
                              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                                {line.itemTexto || "Aún no seleccionado"}
                              </div>
                            </div>

                            <div className="xl:col-span-2">
                              <label className="mb-1 block text-sm font-semibold text-slate-700">
                                Unidad
                              </label>
                              <input
                                value={line.unidadMedida}
                                onChange={(e) =>
                                  updateLinea(line.uid, "unidadMedida", e.target.value)
                                }
                                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                              />
                            </div>

                            <div className="xl:col-span-2">
                              <label className="mb-1 block text-sm font-semibold text-slate-700">
                                Subtotal
                              </label>
                              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                                {formatMoney(
                                  Number(line.cantidad || 0) *
                                    Number(line.costoUnitario || 0)
                                )}
                              </div>
                            </div>

                            <div className="xl:col-span-12">
                              <label className="mb-1 block text-sm font-semibold text-slate-700">
                                Descripción
                              </label>
                              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                                {line.descripcionItem || "Aún no seleccionado"}
                              </div>
                            </div>

                            <div className="xl:col-span-12">
                              <label className="mb-1 block text-sm font-semibold text-slate-700">
                                Observación línea
                              </label>
                              <input
                                value={line.observaciones}
                                onChange={(e) =>
                                  updateLinea(
                                    line.uid,
                                    "observaciones",
                                    e.target.value
                                  )
                                }
                                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>

              <div className="space-y-4">
                <section className="rounded-2xl border border-slate-200 p-4">
                  <h3 className="mb-3 text-lg font-black text-slate-900">
                    Datos de compra
                  </h3>

                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-700">
                        Almacén
                      </label>
                      <select
                        value={almacenId}
                        onChange={(e) => setAlmacenId(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                      >
                        {almacenes.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.codigo} - {a.nombre}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-700">
                        Fecha compra
                      </label>
                      <input
                        type="date"
                        value={fechaCompra}
                        onChange={(e) => setFechaCompra(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-700">
                        Fecha recepción esperada
                      </label>
                      <input
                        type="date"
                        value={fechaRecepcion}
                        onChange={(e) => setFechaRecepcion(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-700">
                        Método de pago
                      </label>
                      <select
                        value={metodoPago}
                        onChange={(e) => setMetodoPago(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                      >
                        <option value="EFECTIVO">EFECTIVO</option>
                        <option value="YAPE">YAPE</option>
                        <option value="PLIN">PLIN</option>
                        <option value="TRANSFERENCIA">TRANSFERENCIA</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-700">
                        Descuento
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={descuento}
                        onChange={(e) => setDescuento(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-700">
                        Adelanto
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={adelanto}
                        onChange={(e) => setAdelanto(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-700">
                        Observaciones
                      </label>
                      <textarea
                        value={observaciones}
                        onChange={(e) => setObservaciones(e.target.value)}
                        className="min-h-[100px] w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                      />
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 p-4">
                  <h3 className="mb-3 text-lg font-black text-slate-900">
                    Resumen
                  </h3>

                  <div className="space-y-2 text-sm text-slate-700">
                    <div className="flex justify-between">
                      <span>Total unidades</span>
                      <b>{resumenNuevaCompra.totalItems}</b>
                    </div>
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <b>{formatMoney(resumenNuevaCompra.subtotal)}</b>
                    </div>
                    <div className="flex justify-between">
                      <span>IGV</span>
                      <b>{formatMoney(resumenNuevaCompra.igv)}</b>
                    </div>
                    <div className="flex justify-between">
                      <span>Total</span>
                      <b>{formatMoney(resumenNuevaCompra.total)}</b>
                    </div>
                    <div className="flex justify-between">
                      <span>Adelanto</span>
                      <b>{formatMoney(resumenNuevaCompra.adelantoNum)}</b>
                    </div>
                    <div className="flex justify-between text-base">
                      <span>Saldo</span>
                      <b>{formatMoney(resumenNuevaCompra.saldo)}</b>
                    </div>
                  </div>

                  <button
                    onClick={registrarCompra}
                    disabled={procesando}
                    className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    Registrar compra
                  </button>
                </section>
              </div>
            </div>
          </div>
        </div>
      )}

      {detalleOpen && compraActiva && (
        <div className="fixed inset-0 z-50 bg-black/40 p-2 sm:p-4">
          <div className="mx-auto max-h-[96vh] w-full max-w-7xl overflow-y-auto rounded-3xl bg-white p-4 shadow-xl sm:p-6">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-900">
                  Detalle compra {compraActiva.codigo}
                </h2>
                <p className="text-sm text-slate-500">
                  {getProveedorNombre(compraActiva.proveedor)} ·{" "}
                  {getProveedorDocumento(compraActiva.proveedor)}
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={() => exportarCompraPDF(compraActiva)}
                  className="w-full rounded-xl border border-blue-300 px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-50 sm:w-auto"
                >
                  PDF
                </button>

                <button
                  onClick={() => setDetalleOpen(false)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:w-auto"
                >
                  Cerrar
                </button>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-3">
              <div className="space-y-4 xl:col-span-2">
                <section className="rounded-2xl border border-slate-200 p-4">
                  <h3 className="mb-3 text-lg font-black text-slate-900">
                    Cabecera
                  </h3>

                  <div className="grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
                    <div>
                      <b>Código:</b> {compraActiva.codigo}
                    </div>
                    <div>
                      <b>Proveedor:</b> {getProveedorNombre(compraActiva.proveedor)}
                    </div>
                    <div>
                      <b>Documento:</b> {getProveedorDocumento(compraActiva.proveedor)}
                    </div>
                    <div>
                      <b>Almacén:</b> {compraActiva.almacen.codigo} -{" "}
                      {compraActiva.almacen.nombre}
                    </div>
                    <div>
                      <b>Fecha compra:</b> {formatDate(compraActiva.fechaCompra)}
                    </div>
                    <div>
                      <b>Fecha recepción:</b>{" "}
                      {formatDate(compraActiva.fechaRecepcion)}
                    </div>
                    <div>
                      <b>Método pago:</b> {compraActiva.metodoPago || "-"}
                    </div>
                    <div>
                      <b>Registrado:</b> {formatDateTime(compraActiva.createdAt)}
                    </div>
                    <div className="sm:col-span-2">
                      <b>Observaciones:</b> {compraActiva.observaciones || "-"}
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 p-4">
                  <h3 className="mb-3 text-lg font-black text-slate-900">
                    Detalle
                  </h3>

                  <div className="hidden overflow-x-auto rounded-xl border border-slate-200 md:block">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-100 text-left text-slate-700">
                        <tr>
                          <th className="px-4 py-3 font-bold">Tipo</th>
                          <th className="px-4 py-3 font-bold">Código</th>
                          <th className="px-4 py-3 font-bold">Descripción</th>
                          <th className="px-4 py-3 font-bold">Unidad</th>
                          <th className="px-4 py-3 font-bold">Cantidad</th>
                          <th className="px-4 py-3 font-bold">Costo</th>
                          <th className="px-4 py-3 font-bold">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {compraActiva.detalles.map((d, idx) => (
                          <tr
                            key={d.id || idx}
                            className="border-t border-slate-200 bg-white"
                          >
                            <td className="px-4 py-3">{badgeTipoItem(d.tipoItem)}</td>
                            <td className="px-4 py-3">{d.codigoItem || "-"}</td>
                            <td className="px-4 py-3">{d.descripcionItem || "-"}</td>
                            <td className="px-4 py-3">{d.unidadMedida || "UND"}</td>
                            <td className="px-4 py-3">{d.cantidad}</td>
                            <td className="px-4 py-3">
                              {formatMoney(d.costoUnitario)}
                            </td>
                            <td className="px-4 py-3">
                              {formatMoney(d.subtotal)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="space-y-3 md:hidden">
                    {compraActiva.detalles.map((d, idx) => (
                      <div
                        key={d.id || idx}
                        className="rounded-2xl border border-slate-200 p-4"
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          {badgeTipoItem(d.tipoItem)}
                          <div className="text-xs text-slate-500">
                            {d.codigoItem || "-"}
                          </div>
                        </div>
                        <div className="text-sm font-semibold text-slate-900">
                          {d.descripcionItem || "-"}
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                          <div className="rounded-xl bg-slate-50 p-3">
                            <div className="text-xs text-slate-500">Unidad</div>
                            <div className="font-bold text-slate-900">
                              {d.unidadMedida || "UND"}
                            </div>
                          </div>
                          <div className="rounded-xl bg-slate-50 p-3">
                            <div className="text-xs text-slate-500">Cantidad</div>
                            <div className="font-bold text-slate-900">
                              {d.cantidad}
                            </div>
                          </div>
                          <div className="rounded-xl bg-slate-50 p-3">
                            <div className="text-xs text-slate-500">Costo</div>
                            <div className="font-bold text-slate-900">
                              {formatMoney(d.costoUnitario)}
                            </div>
                          </div>
                          <div className="rounded-xl bg-slate-50 p-3">
                            <div className="text-xs text-slate-500">Subtotal</div>
                            <div className="font-bold text-slate-900">
                              {formatMoney(d.subtotal)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 p-4">
                  <h3 className="mb-3 text-lg font-black text-slate-900">
                    Historial
                  </h3>

                  <div className="space-y-3">
                    {(compraActiva.historial || []).map((h) => (
                      <div
                        key={h.id}
                        className="rounded-xl border border-slate-200 p-3 text-sm"
                      >
                        <div className="font-bold text-slate-900">
                          {h.tipoEvento}
                        </div>
                        <div className="text-slate-600">{h.detalle || "-"}</div>
                        <div className="text-xs text-slate-500">
                          {formatDateTime(h.createdAt)} · {h.usuarioEmail || "-"}
                        </div>
                        <div className="text-xs text-slate-500">
                          {h.estadoAnterior || "-"} → {h.estadoNuevo || "-"}
                        </div>
                      </div>
                    ))}

                    {(compraActiva.historial || []).length === 0 && (
                      <p className="text-sm text-slate-500">
                        No hay historial disponible.
                      </p>
                    )}
                  </div>
                </section>
              </div>

              <div className="space-y-4">
                <section className="rounded-2xl border border-slate-200 p-4">
                  <h3 className="mb-3 text-lg font-black text-slate-900">
                    Resumen económico
                  </h3>

                  <div className="space-y-2 text-sm text-slate-700">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <b>{formatMoney(compraActiva.subtotal)}</b>
                    </div>
                    <div className="flex justify-between">
                      <span>IGV</span>
                      <b>{formatMoney(compraActiva.igv)}</b>
                    </div>
                    <div className="flex justify-between">
                      <span>Total</span>
                      <b>{formatMoney(compraActiva.total)}</b>
                    </div>
                    <div className="flex justify-between">
                      <span>Adelanto</span>
                      <b>{formatMoney(compraActiva.adelanto)}</b>
                    </div>
                    <div className="flex justify-between text-base">
                      <span>Saldo</span>
                      <b>{formatMoney(compraActiva.saldo)}</b>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 p-4">
                  <h3 className="mb-3 text-lg font-black text-slate-900">
                    Registrar pago
                  </h3>

                  <div className="space-y-3">
                    <input
                      type="number"
                      step="0.01"
                      value={pagoMonto}
                      onChange={(e) => setPagoMonto(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                      placeholder="Monto"
                    />

                    <select
                      value={pagoMetodo}
                      onChange={(e) => setPagoMetodo(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                    >
                      <option value="EFECTIVO">EFECTIVO</option>
                      <option value="YAPE">YAPE</option>
                      <option value="PLIN">PLIN</option>
                      <option value="TRANSFERENCIA">TRANSFERENCIA</option>
                    </select>

                    <textarea
                      value={pagoNota}
                      onChange={(e) => setPagoNota(e.target.value)}
                      className="min-h-[90px] w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                      placeholder="Nota del pago"
                    />

                    <button
                      onClick={registrarPagoCompra}
                      disabled={procesando || compraActiva.estadoCompra === "CANCELADA"}
                      className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      Registrar pago
                    </button>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 p-4">
                  <h3 className="mb-3 text-lg font-black text-slate-900">
                    Acciones
                  </h3>

                  <div className="space-y-2">
                    <button
                      onClick={ingresarInventarioCompra}
                      disabled={procesando || !puedeIngresarInventario}
                      className="w-full rounded-xl border border-blue-300 px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                    >
                      Ingresar a inventario / recepción
                    </button>

                    <button
                      onClick={cancelarCompra}
                      disabled={procesando || compraActiva.estadoCompra === "CANCELADA"}
                      className="w-full rounded-xl border border-red-300 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      Cancelar compra
                    </button>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 p-4">
                  <h3 className="mb-3 text-lg font-black text-slate-900">
                    Estados
                  </h3>

                  <div className="space-y-3">
                    <div>{badgeEstadoCompra(compraActiva.estadoCompra)}</div>
                    <div>{badgeEstadoRecepcion(compraActiva.estadoRecepcion)}</div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalMaterial && (
        <div className="fixed inset-0 z-[60] bg-black/50 p-2 sm:p-4">
          <div className="mx-auto w-full max-w-xl rounded-3xl bg-white p-4 shadow-xl sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-black text-slate-900">
                  Nuevo material
                </h3>
                <p className="text-sm text-slate-500">
                  Créalo aquí y luego aparecerá en la búsqueda de compras
                </p>
              </div>

              <button
                onClick={cerrarModalMaterial}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
              >
                Cerrar
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Código
                </label>
                <input
                  value={formMaterial.codigo}
                  onChange={(e) =>
                    setFormMaterial((prev) => ({
                      ...prev,
                      codigo: e.target.value,
                    }))
                  }
                  placeholder="MAT-CUERO-00001"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Unidad
                </label>
                <input
                  value={formMaterial.unidadMedida}
                  onChange={(e) =>
                    setFormMaterial((prev) => ({
                      ...prev,
                      unidadMedida: e.target.value,
                    }))
                  }
                  placeholder="UND, MTS, KG..."
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Nombre
                </label>
                <input
                  value={formMaterial.nombre}
                  onChange={(e) =>
                    setFormMaterial((prev) => ({
                      ...prev,
                      nombre: e.target.value,
                      codigo:
                        prev.codigo.trim() ||
                        generarCodigoRapido("MAT", e.target.value),
                    }))
                  }
                  placeholder="Ej. Cuero negro premium"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Descripción
                </label>
                <textarea
                  value={formMaterial.descripcion}
                  onChange={(e) =>
                    setFormMaterial((prev) => ({
                      ...prev,
                      descripcion: e.target.value,
                    }))
                  }
                  className="min-h-[100px] w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                  placeholder="Detalle del material"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Costo referencial
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formMaterial.costoReferencial}
                  onChange={(e) =>
                    setFormMaterial((prev) => ({
                      ...prev,
                      costoReferencial: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                />
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                onClick={cerrarModalMaterial}
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
              >
                Cancelar
              </button>
              <button
                onClick={() => crearItemRapido("MATERIAL")}
                disabled={guardandoItemRapido}
                className="rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
              >
                Guardar material
              </button>
            </div>
          </div>
        </div>
      )}

      {modalInsumo && (
        <div className="fixed inset-0 z-[60] bg-black/50 p-2 sm:p-4">
          <div className="mx-auto w-full max-w-xl rounded-3xl bg-white p-4 shadow-xl sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-black text-slate-900">
                  Nuevo insumo
                </h3>
                <p className="text-sm text-slate-500">
                  Créalo aquí y luego aparecerá en la búsqueda de compras
                </p>
              </div>

              <button
                onClick={cerrarModalInsumo}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
              >
                Cerrar
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Código
                </label>
                <input
                  value={formInsumo.codigo}
                  onChange={(e) =>
                    setFormInsumo((prev) => ({
                      ...prev,
                      codigo: e.target.value,
                    }))
                  }
                  placeholder="INS-PEGAMENTO-00001"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Unidad
                </label>
                <input
                  value={formInsumo.unidadMedida}
                  onChange={(e) =>
                    setFormInsumo((prev) => ({
                      ...prev,
                      unidadMedida: e.target.value,
                    }))
                  }
                  placeholder="UND, LT, KG..."
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Nombre
                </label>
                <input
                  value={formInsumo.nombre}
                  onChange={(e) =>
                    setFormInsumo((prev) => ({
                      ...prev,
                      nombre: e.target.value,
                      codigo:
                        prev.codigo.trim() ||
                        generarCodigoRapido("INS", e.target.value),
                    }))
                  }
                  placeholder="Ej. Pegamento industrial"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Descripción
                </label>
                <textarea
                  value={formInsumo.descripcion}
                  onChange={(e) =>
                    setFormInsumo((prev) => ({
                      ...prev,
                      descripcion: e.target.value,
                    }))
                  }
                  className="min-h-[100px] w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                  placeholder="Detalle del insumo"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Costo referencial
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formInsumo.costoReferencial}
                  onChange={(e) =>
                    setFormInsumo((prev) => ({
                      ...prev,
                      costoReferencial: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                />
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                onClick={cerrarModalInsumo}
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
              >
                Cancelar
              </button>
              <button
                onClick={() => crearItemRapido("INSUMO")}
                disabled={guardandoItemRapido}
                className="rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
              >
                Guardar insumo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}