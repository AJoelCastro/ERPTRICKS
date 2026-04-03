"use client";

import { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Cliente = {
  id: string;
  codigo: string;
  tipoCliente: "PERSONA_NATURAL" | "PERSONA_JURIDICA";
  dni?: string | null;
  ruc?: string | null;
  nombres?: string | null;
  apellidos?: string | null;
  razonSocial?: string | null;
  nombreCompleto?: string;
  documentoPrincipal?: string;
  telefono?: string | null;
  categoria?: string | null;
  direccion?: string | null;
};

type Almacen = {
  id: string;
  codigo: string;
  nombre: string;
};

type Producto = {
  id: string;
  codigo: string;
  modelo: string;
  color: string;
  material: string;
  taco: string;
  coleccion?: string | null;
  talla: number;
  precio: string;
  estado: string;
};

type DetallePedido = {
  id?: string;
  productoId: string;
  cantidad: number;
  tipoAtencion?: string;
  observaciones?: string | null;
  producto?: Producto;
  modelo?: string;
  color?: string;
  material?: string;
  taco?: string;
  talla?: number;
  precioUnitario?: string | number;
  subtotal?: string | number;
  estadoLinea?: string;
};

type HistorialPedido = {
  id: string;
  tipoEvento: string;
  estadoAnterior?: string | null;
  estadoNuevo?: string | null;
  detalle?: string | null;
  usuarioEmail?: string | null;
  createdAt: string;
};

type Pedido = {
  id: string;
  codigo: string;
  clienteId: string;
  modalidad: string;
  tipoPedido: string;
  almacenSolicitadoId: string;
  almacenAtendidoId: string;
  fechaCompromiso?: string | null;
  prioridad: string;
  subtotal: string | number;
  descuento: string | number;
  igv: string | number;
  total: string | number;
  adelanto: string | number;
  saldo: string | number;
  metodoPago?: string | null;
  estadoPedido: string;
  estadoEntrega: string;
  origenAtencion?: string | null;
  observaciones?: string | null;
  createdAt: string;
  cliente: Cliente;
  almacenSolicitado: Almacen;
  almacenAtendido: Almacen;
  detalles: DetallePedido[];
  historial?: HistorialPedido[];
};

type PedidoFormLine = {
  uid: string;
  productoId: string;
  productoTexto: string;
  cantidad: string;
  observaciones: string;
};

type ProductoGrupo = {
  key: string;
  modelo: string;
  color: string;
  material: string;
  taco: string;
  coleccion?: string | null;
  productos: Producto[];
};

type SortKeyPedido =
  | "codigo"
  | "cliente"
  | "modalidad"
  | "createdAt"
  | "fechaCompromiso"
  | "total"
  | "adelanto"
  | "saldo"
  | "estadoPedido"
  | "estadoEntrega";

type JsPDFWithAutoTable = jsPDF & {
  lastAutoTable?: {
    finalY?: number;
  };
};

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function formatMoney(value: string | number | null | undefined) {
  const n = Number(value || 0);
  return `S/ ${n.toFixed(2)}`;
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

function getClienteDisplayName(cliente: Cliente) {
  if (cliente.tipoCliente === "PERSONA_JURIDICA") {
    return cliente.razonSocial || cliente.nombreCompleto || "";
  }
  const natural = `${cliente.nombres || ""} ${cliente.apellidos || ""}`.trim();
  return natural || cliente.nombreCompleto || "";
}

function getClienteDocumento(cliente: Cliente) {
  return cliente.tipoCliente === "PERSONA_JURIDICA"
    ? cliente.ruc || cliente.documentoPrincipal || ""
    : cliente.dni || cliente.documentoPrincipal || "";
}

function getClienteDocLabel(cliente: Cliente | null | undefined) {
  if (!cliente) return "Documento";
  return cliente.tipoCliente === "PERSONA_JURIDICA" ? "RUC" : "DNI";
}

function badgeTipoCliente(tipo?: string) {
  if (tipo === "PERSONA_JURIDICA") {
    return (
      <span className="rounded-full bg-violet-100 px-2 py-1 text-[10px] font-bold text-violet-700">
        JURÍDICA
      </span>
    );
  }

  return (
    <span className="rounded-full bg-sky-100 px-2 py-1 text-[10px] font-bold text-sky-700">
      NATURAL
    </span>
  );
}

export default function PedidosPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);

  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [estadoPedidoFiltro, setEstadoPedidoFiltro] = useState("");
  const [estadoEntregaFiltro, setEstadoEntregaFiltro] = useState("");
  const [clienteFiltro, setClienteFiltro] = useState("");
  const [clienteFiltroTexto, setClienteFiltroTexto] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  const [sortKey, setSortKey] = useState<SortKeyPedido>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [paginaActual, setPaginaActual] = useState(1);
  const [filasPorPagina, setFilasPorPagina] = useState(10);

  const [modalNuevoOpen, setModalNuevoOpen] = useState(false);
  const [detalleOpen, setDetalleOpen] = useState(false);
  const [pedidoActivo, setPedidoActivo] = useState<Pedido | null>(null);

  const [guardando, setGuardando] = useState(false);
  const [procesandoAccion, setProcesandoAccion] = useState(false);

  const [clienteBusqueda, setClienteBusqueda] = useState("");
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);

  const [modalidad, setModalidad] = useState<"MINORISTA" | "MAYORISTA">("MINORISTA");
  const [tipoPedido, setTipoPedido] = useState("SIN_STOCK");
  const [almacenSolicitadoId, setAlmacenSolicitadoId] = useState("");
  const [almacenAtendidoId, setAlmacenAtendidoId] = useState("");
  const [fechaCompromiso, setFechaCompromiso] = useState("");
  const [prioridad, setPrioridad] = useState("MEDIA");
  const [metodoPago, setMetodoPago] = useState("EFECTIVO");
  const [adelanto, setAdelanto] = useState("0");
  const [origenAtencion, setOrigenAtencion] = useState("PRODUCCION");
  const [observaciones, setObservaciones] = useState("");

  const [detalle, setDetalle] = useState<PedidoFormLine[]>([
    {
      uid: uid(),
      productoId: "",
      productoTexto: "",
      cantidad: "1",
      observaciones: "",
    },
  ]);

  const [productoSearchByLine, setProductoSearchByLine] = useState<Record<string, string>>({});

  const [mayoristaBusqueda, setMayoristaBusqueda] = useState("");
  const [grupoMayoristaSeleccionado, setGrupoMayoristaSeleccionado] = useState<ProductoGrupo | null>(null);
  const [cantidadesMayorista, setCantidadesMayorista] = useState<Record<string, string>>({});
  const [obsMayorista, setObsMayorista] = useState("");

  const [pagoMonto, setPagoMonto] = useState("0");
  const [pagoMetodo, setPagoMetodo] = useState("EFECTIVO");
  const [pagoNota, setPagoNota] = useState("");

  const [modoEdicionDetalle, setModoEdicionDetalle] = useState(false);
  const [detalleEditable, setDetalleEditable] = useState<PedidoFormLine[]>([]);
  const [editFechaCompromiso, setEditFechaCompromiso] = useState("");
  const [editPrioridad, setEditPrioridad] = useState("MEDIA");
  const [editMetodoPago, setEditMetodoPago] = useState("EFECTIVO");
  const [editAdelanto, setEditAdelanto] = useState("0");
  const [editOrigenAtencion, setEditOrigenAtencion] = useState("PRODUCCION");
  const [editObservaciones, setEditObservaciones] = useState("");

  async function cargarTodo() {
    try {
      setLoading(true);

      const [pedidosRes, clientesRes, productosRes, almacenesRes] = await Promise.all([
        fetch(`${apiUrl}/pedidos`),
        fetch(`${apiUrl}/clientes`),
        fetch(`${apiUrl}/productos`),
        fetch(`${apiUrl}/almacenes`),
      ]);

      const pedidosData = await readJsonSafe(pedidosRes);
      const clientesData = await readJsonSafe(clientesRes);
      const productosData = await readJsonSafe(productosRes);
      const almacenesData = await readJsonSafe(almacenesRes);

      setPedidos(pedidosData.data || []);
      setClientes(clientesData.data || []);
      setProductos((productosData.data || []).filter((p: Producto) => p.estado === "ACTIVO"));
      setAlmacenes(almacenesData.data || []);

      if ((almacenesData.data || []).length > 0) {
        const firstId = almacenesData.data[0].id;
        setAlmacenSolicitadoId(firstId);
        setAlmacenAtendidoId(firstId);
      }
    } catch (error) {
      console.error(error);
      alert("No se pudo cargar la información de pedidos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarTodo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const gruposMayorista = useMemo<ProductoGrupo[]>(() => {
    const map = new Map<string, ProductoGrupo>();

    for (const p of productos) {
      const key = [p.modelo, p.color, p.material, p.taco, p.coleccion || ""].join("|");
      if (!map.has(key)) {
        map.set(key, {
          key,
          modelo: p.modelo,
          color: p.color,
          material: p.material,
          taco: p.taco,
          coleccion: p.coleccion || null,
          productos: [],
        });
      }
      map.get(key)!.productos.push(p);
    }

    return Array.from(map.values()).map((g) => ({
      ...g,
      productos: [...g.productos].sort((a, b) => a.talla - b.talla),
    }));
  }, [productos]);

  const gruposMayoristaFiltrados = useMemo(() => {
    const t = mayoristaBusqueda.trim().toLowerCase();
    if (!t) return gruposMayorista.slice(0, 12);

    return gruposMayorista
      .filter((g) => {
        const text = `${g.modelo} ${g.color} ${g.material} ${g.taco} ${g.coleccion || ""}`.toLowerCase();
        return text.includes(t) || g.productos.some((p) => p.codigo.toLowerCase().includes(t));
      })
      .slice(0, 12);
  }, [gruposMayorista, mayoristaBusqueda]);

  const clientesFiltradosBusqueda = useMemo(() => {
    const t = clienteBusqueda.trim().toLowerCase();
    if (!t) return clientes.slice(0, 8);

    return clientes
      .filter((c) =>
        String(c.dni || "").toLowerCase().includes(t) ||
        String(c.ruc || "").toLowerCase().includes(t) ||
        String(c.codigo || "").toLowerCase().includes(t) ||
        String(c.nombres || "").toLowerCase().includes(t) ||
        String(c.apellidos || "").toLowerCase().includes(t) ||
        String(c.razonSocial || "").toLowerCase().includes(t) ||
        String(c.nombreCompleto || "").toLowerCase().includes(t)
      )
      .slice(0, 8);
  }, [clienteBusqueda, clientes]);

  const clientesFiltroTabla = useMemo(() => {
    const t = clienteFiltroTexto.trim().toLowerCase();
    if (!t) return clientes.slice(0, 8);

    return clientes
      .filter((c) =>
        String(c.dni || "").toLowerCase().includes(t) ||
        String(c.ruc || "").toLowerCase().includes(t) ||
        String(c.codigo || "").toLowerCase().includes(t) ||
        String(c.nombres || "").toLowerCase().includes(t) ||
        String(c.apellidos || "").toLowerCase().includes(t) ||
        String(c.razonSocial || "").toLowerCase().includes(t) ||
        String(c.nombreCompleto || "").toLowerCase().includes(t)
      )
      .slice(0, 8);
  }, [clienteFiltroTexto, clientes]);

  function productosFiltradosLinea(lineUid: string) {
    const t = (productoSearchByLine[lineUid] || "").trim().toLowerCase();
    if (!t) return productos.slice(0, 8);

    return productos
      .filter((p) =>
        p.codigo.toLowerCase().includes(t) ||
        p.modelo.toLowerCase().includes(t) ||
        p.color.toLowerCase().includes(t) ||
        p.material.toLowerCase().includes(t) ||
        p.taco.toLowerCase().includes(t) ||
        String(p.talla).includes(t)
      )
      .slice(0, 8);
  }

  const pedidosFiltrados = useMemo(() => {
    const filtrados = pedidos.filter((p) => {
      const texto = q.trim().toLowerCase();
      const clienteNombre = getClienteDisplayName(p.cliente).toLowerCase();
      const clienteDoc = getClienteDocumento(p.cliente).toLowerCase();

      const matchQ =
        !texto ||
        p.codigo.toLowerCase().includes(texto) ||
        clienteNombre.includes(texto) ||
        clienteDoc.includes(texto) ||
        String(p.cliente.codigo || "").toLowerCase().includes(texto);

      const matchEstadoPedido =
        !estadoPedidoFiltro || p.estadoPedido === estadoPedidoFiltro;

      const matchEstadoEntrega =
        !estadoEntregaFiltro || p.estadoEntrega === estadoEntregaFiltro;

      const matchCliente =
        !clienteFiltro || p.clienteId === clienteFiltro;

      const fechaPedido = new Date(p.createdAt).getTime();
      const matchDesde = !fechaDesde || fechaPedido >= new Date(`${fechaDesde}T00:00:00`).getTime();
      const matchHasta = !fechaHasta || fechaPedido <= new Date(`${fechaHasta}T23:59:59`).getTime();

      return (
        matchQ &&
        matchEstadoPedido &&
        matchEstadoEntrega &&
        matchCliente &&
        matchDesde &&
        matchHasta
      );
    });

    return [...filtrados].sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";

      switch (sortKey) {
        case "codigo":
          av = a.codigo;
          bv = b.codigo;
          break;
        case "cliente":
          av = getClienteDisplayName(a.cliente);
          bv = getClienteDisplayName(b.cliente);
          break;
        case "modalidad":
          av = a.modalidad;
          bv = b.modalidad;
          break;
        case "createdAt":
          av = new Date(a.createdAt).getTime();
          bv = new Date(b.createdAt).getTime();
          break;
        case "fechaCompromiso":
          av = a.fechaCompromiso ? new Date(a.fechaCompromiso).getTime() : 0;
          bv = b.fechaCompromiso ? new Date(b.fechaCompromiso).getTime() : 0;
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
        case "estadoPedido":
          av = a.estadoPedido;
          bv = b.estadoPedido;
          break;
        case "estadoEntrega":
          av = a.estadoEntrega;
          bv = b.estadoEntrega;
          break;
      }

      if (typeof av === "string") av = av.toUpperCase();
      if (typeof bv === "string") bv = bv.toUpperCase();

      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [
    pedidos,
    q,
    estadoPedidoFiltro,
    estadoEntregaFiltro,
    clienteFiltro,
    fechaDesde,
    fechaHasta,
    sortKey,
    sortDir,
  ]);

  const totalPaginas = Math.max(1, Math.ceil(pedidosFiltrados.length / filasPorPagina));
  const pedidosPagina = useMemo(() => {
    const start = (paginaActual - 1) * filasPorPagina;
    return pedidosFiltrados.slice(start, start + filasPorPagina);
  }, [pedidosFiltrados, paginaActual, filasPorPagina]);

  useEffect(() => {
    setPaginaActual(1);
  }, [q, estadoPedidoFiltro, estadoEntregaFiltro, clienteFiltro, fechaDesde, fechaHasta, filasPorPagina]);

  const resumenPedidoNuevo = useMemo(() => {
    const rows = detalle
      .map((line) => {
        const producto = productos.find((p) => p.id === line.productoId);
        const cantidad = Number(line.cantidad || 0);
        const precio = Number(producto?.precio || 0);
        const subtotal = cantidad * precio;
        return { producto, cantidad, precio, subtotal };
      })
      .filter((x) => x.producto && x.cantidad > 0);

    const total = rows.reduce((acc, row) => acc + row.subtotal, 0);
    const subtotalSinIgv = total / 1.18;
    const igv = total - subtotalSinIgv;
    const adelantoNum = Number(adelanto || 0);
    const saldo = Math.max(0, total - adelantoNum);

    return {
      total,
      subtotalSinIgv,
      igv,
      adelantoNum,
      saldo,
      totalProductos: rows.reduce((acc, row) => acc + row.cantidad, 0),
    };
  }, [detalle, productos, adelanto]);

  const resumenMayoristaBloque = useMemo(() => {
    if (!grupoMayoristaSeleccionado) {
      return { totalPares: 0, totalMonto: 0 };
    }

    let totalPares = 0;
    let totalMonto = 0;

    for (const p of grupoMayoristaSeleccionado.productos) {
      const cantidad = Number(cantidadesMayorista[p.id] || 0);
      if (cantidad > 0) {
        totalPares += cantidad;
        totalMonto += cantidad * Number(p.precio || 0);
      }
    }

    return { totalPares, totalMonto };
  }, [grupoMayoristaSeleccionado, cantidadesMayorista]);

  const resumenDetalleEditable = useMemo(() => {
    const total = detalleEditable.reduce((acc, line) => {
      const producto = productos.find((p) => p.id === line.productoId);
      return acc + Number(line.cantidad || 0) * Number(producto?.precio || 0);
    }, 0);

    const subtotal = total / 1.18;
    const igv = total - subtotal;
    const adelantoNum = Number(editAdelanto || 0);
    const saldo = Math.max(0, total - adelantoNum);

    return {
      total,
      subtotal,
      igv,
      saldo,
    };
  }, [detalleEditable, productos, editAdelanto]);

  function resetFormulario() {
    setClienteBusqueda("");
    setClienteSeleccionado(null);
    setModalidad("MINORISTA");
    setTipoPedido("SIN_STOCK");
    setFechaCompromiso("");
    setPrioridad("MEDIA");
    setMetodoPago("EFECTIVO");
    setAdelanto("0");
    setOrigenAtencion("PRODUCCION");
    setObservaciones("");
    setDetalle([
      {
        uid: uid(),
        productoId: "",
        productoTexto: "",
        cantidad: "1",
        observaciones: "",
      },
    ]);
    setProductoSearchByLine({});
    setMayoristaBusqueda("");
    setGrupoMayoristaSeleccionado(null);
    setCantidadesMayorista({});
    setObsMayorista("");
  }

  function abrirNuevoPedido() {
    resetFormulario();
    setModalNuevoOpen(true);
  }

  function cerrarNuevoPedido() {
    if (guardando) return;
    setModalNuevoOpen(false);
  }

  function agregarLinea() {
    setDetalle((prev) => [
      ...prev,
      {
        uid: uid(),
        productoId: "",
        productoTexto: "",
        cantidad: "1",
        observaciones: "",
      },
    ]);
  }

  function agregarLineaEditable() {
    setDetalleEditable((prev) => [
      ...prev,
      {
        uid: uid(),
        productoId: "",
        productoTexto: "",
        cantidad: "1",
        observaciones: "",
      },
    ]);
  }

  function eliminarLinea(uidLine: string) {
    setDetalle((prev) => prev.filter((x) => x.uid !== uidLine));
  }

  function eliminarLineaEditable(uidLine: string) {
    setDetalleEditable((prev) => prev.filter((x) => x.uid !== uidLine));
  }

  function updateLinea(uidLine: string, field: keyof PedidoFormLine, value: string) {
    setDetalle((prev) =>
      prev.map((line) =>
        line.uid === uidLine ? { ...line, [field]: value } : line
      )
    );
  }

  function updateLineaEditable(uidLine: string, field: keyof PedidoFormLine, value: string) {
    setDetalleEditable((prev) =>
      prev.map((line) =>
        line.uid === uidLine ? { ...line, [field]: value } : line
      )
    );
  }

  function seleccionarProducto(uidLine: string, producto: Producto) {
    setDetalle((prev) =>
      prev.map((line) =>
        line.uid === uidLine
          ? {
              ...line,
              productoId: producto.id,
              productoTexto: `${producto.codigo} - ${producto.modelo} - ${producto.color} - ${producto.material} - ${producto.taco} - T${producto.talla}`,
            }
          : line
      )
    );

    setProductoSearchByLine((prev) => ({
      ...prev,
      [uidLine]: `${producto.codigo} ${producto.modelo}`,
    }));
  }

  function seleccionarProductoEditable(uidLine: string, producto: Producto) {
    setDetalleEditable((prev) =>
      prev.map((line) =>
        line.uid === uidLine
          ? {
              ...line,
              productoId: producto.id,
              productoTexto: `${producto.codigo} - ${producto.modelo} - ${producto.color} - ${producto.material} - ${producto.taco} - T${producto.talla}`,
            }
          : line
      )
    );

    setProductoSearchByLine((prev) => ({
      ...prev,
      [uidLine]: `${producto.codigo} ${producto.modelo}`,
    }));
  }

  function seleccionarGrupoMayorista(grupo: ProductoGrupo) {
    setGrupoMayoristaSeleccionado(grupo);
    const next: Record<string, string> = {};
    for (const p of grupo.productos) {
      next[p.id] = "";
    }
    setCantidadesMayorista(next);
  }

  function agregarGrupoMayoristaAlDetalle() {
    if (!grupoMayoristaSeleccionado) {
      alert("Selecciona un modelo para mayorista.");
      return;
    }

    const nuevasLineas: PedidoFormLine[] = [];

    for (const p of grupoMayoristaSeleccionado.productos) {
      const cantidad = Number(cantidadesMayorista[p.id] || 0);
      if (cantidad > 0) {
        nuevasLineas.push({
          uid: uid(),
          productoId: p.id,
          productoTexto: `${p.codigo} - ${p.modelo} - ${p.color} - ${p.material} - ${p.taco} - T${p.talla}`,
          cantidad: String(cantidad),
          observaciones: obsMayorista,
        });
      }
    }

    if (nuevasLineas.length === 0) {
      alert("Debes ingresar al menos una cantidad por talla.");
      return;
    }

    setDetalle((prev) => [...prev, ...nuevasLineas]);
    setCantidadesMayorista({});
    setObsMayorista("");
    alert("Modelo mayorista agregado al pedido.");
  }

  function toggleSort(key: SortKeyPedido) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function sortLabel(label: string, key: SortKeyPedido) {
    if (sortKey !== key) return `${label} ↕`;
    return `${label} ${sortDir === "asc" ? "▲" : "▼"}`;
  }

  async function guardarPedido() {
    try {
      if (!clienteSeleccionado) {
        alert("Debes seleccionar un cliente.");
        return;
      }

      const lineasValidas = detalle
        .filter((line) => line.productoId && Number(line.cantidad) > 0)
        .map((line) => ({
          productoId: line.productoId,
          cantidad: Number(line.cantidad),
          tipoAtencion: origenAtencion,
          observaciones: line.observaciones || null,
        }));

      if (lineasValidas.length === 0) {
        alert("Debes agregar al menos una línea válida.");
        return;
      }

      setGuardando(true);

      const res = await fetch(`${apiUrl}/pedidos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clienteId: clienteSeleccionado.id,
          modalidad,
          tipoPedido,
          almacenSolicitadoId,
          almacenAtendidoId,
          fechaCompromiso: fechaCompromiso || null,
          prioridad,
          metodoPago,
          adelanto: Number(adelanto || 0),
          origenAtencion,
          observaciones,
          usuarioEmail: "admin@erp.com",
          detalle: lineasValidas,
        }),
      });

      const data = await readJsonSafe(res);

      if (!res.ok || !data.ok) {
        alert(data.error || "No se pudo registrar el pedido");
        return;
      }

      await cargarTodo();
      setModalNuevoOpen(false);
      alert("Pedido creado correctamente");
    } catch (error) {
      console.error(error);
      alert("Error al guardar pedido");
    } finally {
      setGuardando(false);
    }
  }

  async function abrirDetalle(id: string) {
    try {
      const res = await fetch(`${apiUrl}/pedidos/${id}`);
      const data = await readJsonSafe(res);

      if (!res.ok || !data.ok) {
        alert(data.error || "No se pudo abrir el pedido");
        return;
      }

      const pedido = data.data as Pedido;
      setPedidoActivo(pedido);
      setPagoMonto(String(Number(pedido.saldo || 0)));
      setPagoMetodo(pedido.metodoPago || "EFECTIVO");
      setPagoNota("");

      setDetalleEditable(
        pedido.detalles.map((d) => ({
          uid: uid(),
          productoId: d.productoId,
          productoTexto: `${d.producto?.codigo || ""} - ${d.modelo || ""} - ${d.color || ""} - ${d.material || ""} - ${d.taco || ""} - T${d.talla || ""}`,
          cantidad: String(d.cantidad || 1),
          observaciones: d.observaciones || "",
        }))
      );

      setEditFechaCompromiso(
        pedido.fechaCompromiso
          ? new Date(pedido.fechaCompromiso).toISOString().slice(0, 10)
          : ""
      );
      setEditPrioridad(pedido.prioridad || "MEDIA");
      setEditMetodoPago(pedido.metodoPago || "EFECTIVO");
      setEditAdelanto(String(Number(pedido.adelanto || 0)));
      setEditOrigenAtencion(pedido.origenAtencion || "PRODUCCION");
      setEditObservaciones(pedido.observaciones || "");
      setModoEdicionDetalle(false);

      setDetalleOpen(true);
    } catch (error) {
      console.error(error);
      alert("Error al abrir detalle");
    }
  }

  async function guardarEdicionPedido() {
    if (!pedidoActivo) return;

    try {
      setProcesandoAccion(true);

      const lineasValidas = detalleEditable
        .filter((line) => line.productoId && Number(line.cantidad) > 0)
        .map((line) => ({
          productoId: line.productoId,
          cantidad: Number(line.cantidad),
          tipoAtencion: editOrigenAtencion,
          observaciones: line.observaciones || null,
        }));

      if (lineasValidas.length === 0) {
        alert("Debes dejar al menos una línea válida.");
        return;
      }

      const res = await fetch(`${apiUrl}/pedidos/${pedidoActivo.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fechaCompromiso: editFechaCompromiso || null,
          prioridad: editPrioridad,
          metodoPago: editMetodoPago,
          adelanto: Number(editAdelanto || 0),
          origenAtencion: editOrigenAtencion,
          observaciones: editObservaciones,
          usuarioEmail: "admin@erp.com",
          detalle: lineasValidas,
        }),
      });

      const data = await readJsonSafe(res);

      if (!res.ok || !data.ok) {
        alert(data.error || "No se pudo guardar la edición");
        return;
      }

      await cargarTodo();
      await abrirDetalle(pedidoActivo.id);
      setModoEdicionDetalle(false);
      alert("Pedido actualizado correctamente");
    } catch (error) {
      console.error(error);
      alert("Error guardando cambios del pedido");
    } finally {
      setProcesandoAccion(false);
    }
  }

  async function registrarPagoPedido() {
    if (!pedidoActivo) return;

    try {
      setProcesandoAccion(true);

      const res = await fetch(`${apiUrl}/pedidos/${pedidoActivo.id}/pagos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          monto: Number(pagoMonto || 0),
          metodoPago: pagoMetodo,
          nota: pagoNota || "Pago registrado desde frontend",
          usuarioEmail: "admin@erp.com",
        }),
      });

      const data = await readJsonSafe(res);

      if (!res.ok || !data.ok) {
        alert(data.error || "No se pudo registrar el pago");
        return;
      }

      await cargarTodo();
      await abrirDetalle(pedidoActivo.id);
      alert("Pago registrado correctamente");
    } catch (error) {
      console.error(error);
      alert("Error registrando pago");
    } finally {
      setProcesandoAccion(false);
    }
  }

  async function marcarListo() {
    if (!pedidoActivo) return;

    try {
      setProcesandoAccion(true);

      const res = await fetch(`${apiUrl}/pedidos/${pedidoActivo.id}/marcar-listo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          usuarioEmail: "admin@erp.com",
        }),
      });

      const data = await readJsonSafe(res);

      if (!res.ok || !data.ok) {
        alert(data.error || "No se pudo marcar como listo");
        return;
      }

      await cargarTodo();
      await abrirDetalle(pedidoActivo.id);
    } catch (error) {
      console.error(error);
      alert("Error marcando pedido como listo");
    } finally {
      setProcesandoAccion(false);
    }
  }

  async function marcarEntregado() {
    if (!pedidoActivo) return;

    try {
      setProcesandoAccion(true);

      const res = await fetch(`${apiUrl}/pedidos/${pedidoActivo.id}/marcar-entregado`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          usuarioEmail: "admin@erp.com",
        }),
      });

      const data = await readJsonSafe(res);

      if (!res.ok || !data.ok) {
        alert(data.error || "No se pudo marcar como entregado");
        return;
      }

      await cargarTodo();
      await abrirDetalle(pedidoActivo.id);
    } catch (error) {
      console.error(error);
      alert("Error marcando pedido como entregado");
    } finally {
      setProcesandoAccion(false);
    }
  }

  async function cancelarPedido() {
    if (!pedidoActivo) return;

    const confirmar = window.confirm("¿Seguro que deseas cancelar este pedido?");
    if (!confirmar) return;

    try {
      setProcesandoAccion(true);

      const res = await fetch(`${apiUrl}/pedidos/${pedidoActivo.id}/cancelar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          detalle: "Cancelado desde frontend",
          usuarioEmail: "admin@erp.com",
        }),
      });

      const data = await readJsonSafe(res);

      if (!res.ok || !data.ok) {
        alert(data.error || "No se pudo cancelar");
        return;
      }

      await cargarTodo();
      await abrirDetalle(pedidoActivo.id);
    } catch (error) {
      console.error(error);
      alert("Error cancelando pedido");
    } finally {
      setProcesandoAccion(false);
    }
  }

  async function mandarAProduccion() {
    if (!pedidoActivo) return;

    try {
      setProcesandoAccion(true);

      const res = await fetch(`${apiUrl}/produccion/desde-pedido/${pedidoActivo.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          usuarioEmail: "admin@erp.com",
        }),
      });

      const data = await readJsonSafe(res);

      if (!res.ok || !data.ok) {
        alert(data.error || "No se pudo generar la orden de producción");
        return;
      }

      await cargarTodo();
      await abrirDetalle(pedidoActivo.id);
      alert(`Orden de producción generada: ${data.data?.codigo || "OK"}`);
    } catch (error) {
      console.error(error);
      alert("Error mandando pedido a producción");
    } finally {
      setProcesandoAccion(false);
    }
  }

  function exportarPedidoPDF(pedido: Pedido) {
    const doc = new jsPDF();
    const clienteNombre = getClienteDisplayName(pedido.cliente);
    const clienteDocumento = getClienteDocumento(pedido.cliente);
    const docLabel = getClienteDocLabel(pedido.cliente);

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 30, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.text("ERP CALZADO V2", 14, 14);
    doc.setFontSize(10);
    doc.text("Resumen profesional de pedido", 14, 22);

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(11);

    doc.roundedRect(14, 36, 182, 32, 3, 3);
    doc.text(`Pedido: ${pedido.codigo}`, 18, 45);
    doc.text(`Fecha emisión: ${formatDate(pedido.createdAt)}`, 18, 52);
    doc.text(`Entrega pactada: ${formatDate(pedido.fechaCompromiso)}`, 18, 59);

    doc.text(`Cliente: ${clienteNombre}`, 110, 45);
    doc.text(`${docLabel}: ${clienteDocumento || "-"}`, 110, 52);
    doc.text(`Modalidad: ${pedido.modalidad}`, 110, 59);

    autoTable(doc, {
      startY: 76,
      head: [[
        "Código",
        "Descripción",
        "Talla",
        "Cant.",
        "P. Unit.",
        "Subtotal",
      ]],
      body: pedido.detalles.map((d) => [
        d.producto?.codigo || "",
        `${d.modelo || ""} ${d.color || ""} ${d.material || ""} ${d.taco || ""}`.trim(),
        String(d.talla || ""),
        String(d.cantidad || ""),
        formatMoney(d.precioUnitario || 0),
        formatMoney(d.subtotal || 0),
      ]),
      headStyles: {
        fillColor: [30, 41, 59],
      },
      styles: {
        fontSize: 9,
        cellPadding: 2.5,
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
    const obs = pedido.observaciones || "-";
    const splitObs = doc.splitTextToSize(obs, 80);
    doc.text(splitObs, 18, finalY + 23);

    doc.roundedRect(116, finalY + 8, 80, 40, 3, 3);
    doc.setFontSize(10);
    doc.text(`Subtotal: ${formatMoney(pedido.subtotal)}`, 120, finalY + 18);
    doc.text(`IGV: ${formatMoney(pedido.igv)}`, 120, finalY + 25);
    doc.text(`Total: ${formatMoney(pedido.total)}`, 120, finalY + 32);
    doc.text(`Adelanto: ${formatMoney(pedido.adelanto)}`, 120, finalY + 39);
    doc.setFontSize(11);
    doc.text(`Saldo: ${formatMoney(pedido.saldo)}`, 120, finalY + 46);

    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text("Documento generado desde ERP Calzado V2", 14, 285);

    doc.save(`${pedido.codigo}.pdf`);
  }

  function badgeEstadoPedido(estado: string) {
    const map: Record<string, string> = {
      CONFIRMADO: "bg-slate-100 text-slate-700",
      PAGADO_PARCIAL: "bg-yellow-100 text-yellow-700",
      PAGADO: "bg-emerald-100 text-emerald-700",
      CANCELADO: "bg-red-100 text-red-700",
    };

    return (
      <span className={`rounded-full px-3 py-1 text-xs font-bold ${map[estado] || "bg-slate-100 text-slate-700"}`}>
        {estado}
      </span>
    );
  }

  function badgeEstadoEntrega(estado: string) {
    const map: Record<string, string> = {
      PENDIENTE: "bg-slate-100 text-slate-700",
      EN_PRODUCCION: "bg-blue-100 text-blue-700",
      LISTO: "bg-emerald-100 text-emerald-700",
      ENTREGADO: "bg-green-100 text-green-700",
      CANCELADO: "bg-red-100 text-red-700",
    };

    return (
      <span className={`rounded-full px-3 py-1 text-xs font-bold ${map[estado] || "bg-slate-100 text-slate-700"}`}>
        {estado}
      </span>
    );
  }

  const puedeEditarPedido =
    pedidoActivo &&
    pedidoActivo.estadoEntrega !== "ENTREGADO" &&
    pedidoActivo.estadoPedido !== "CANCELADO";

  return (
    <div className="space-y-4 sm:space-y-6">
      <section className="rounded-2xl bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-black text-slate-900 sm:text-2xl">Pedidos</h1>
            <p className="text-sm text-slate-500">
              Gestión completa de pedidos minoristas y mayoristas
            </p>
          </div>

          <button
            onClick={abrirNuevoPedido}
            className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 sm:w-auto sm:py-2"
          >
            + Nuevo pedido
          </button>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por código, cliente, DNI o RUC"
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
          />

          <select
            value={estadoPedidoFiltro}
            onChange={(e) => setEstadoPedidoFiltro(e.target.value)}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
          >
            <option value="">Estado pago</option>
            <option value="CONFIRMADO">CONFIRMADO</option>
            <option value="PAGADO_PARCIAL">PAGADO_PARCIAL</option>
            <option value="PAGADO">PAGADO</option>
            <option value="CANCELADO">CANCELADO</option>
          </select>

          <select
            value={estadoEntregaFiltro}
            onChange={(e) => setEstadoEntregaFiltro(e.target.value)}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
          >
            <option value="">Estado entrega</option>
            <option value="PENDIENTE">PENDIENTE</option>
            <option value="EN_PRODUCCION">EN_PRODUCCION</option>
            <option value="LISTO">LISTO</option>
            <option value="ENTREGADO">ENTREGADO</option>
            <option value="CANCELADO">CANCELADO</option>
          </select>

          <div className="relative">
            <input
              value={clienteFiltroTexto}
              onChange={(e) => {
                setClienteFiltroTexto(e.target.value);
                setClienteFiltro("");
              }}
              placeholder="Buscar cliente por DNI, RUC o nombre"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
            />
            {clienteFiltroTexto && (
              <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                {clientesFiltroTabla.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setClienteFiltro(c.id);
                      setClienteFiltroTexto(`${getClienteDocumento(c)} - ${getClienteDisplayName(c)}`);
                    }}
                    className="block w-full border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-slate-900">
                          {getClienteDisplayName(c)}
                        </div>
                        <div className="text-xs text-slate-500">
                          {getClienteDocLabel(c)}: {getClienteDocumento(c)}
                        </div>
                      </div>
                      {badgeTipoCliente(c.tipoCliente)}
                    </div>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setClienteFiltro("");
                    setClienteFiltroTexto("");
                  }}
                  className="block w-full px-4 py-3 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
                >
                  Limpiar filtro
                </button>
              </div>
            )}
          </div>

          <input
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
          />

          <input
            type="date"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
          />
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Cargando pedidos...</p>
        ) : pedidosFiltrados.length === 0 ? (
          <p className="text-sm text-slate-500">No hay pedidos para esos filtros.</p>
        ) : (
          <>
            <div className="hidden xl:block overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100 text-left text-slate-700">
                  <tr>
                    <th onClick={() => toggleSort("codigo")} className="cursor-pointer px-4 py-3 font-bold">
                      {sortLabel("Código", "codigo")}
                    </th>
                    <th onClick={() => toggleSort("cliente")} className="cursor-pointer px-4 py-3 font-bold">
                      {sortLabel("Cliente", "cliente")}
                    </th>
                    <th onClick={() => toggleSort("modalidad")} className="cursor-pointer px-4 py-3 font-bold">
                      {sortLabel("Modalidad", "modalidad")}
                    </th>
                    <th onClick={() => toggleSort("createdAt")} className="cursor-pointer px-4 py-3 font-bold">
                      {sortLabel("Fecha", "createdAt")}
                    </th>
                    <th onClick={() => toggleSort("fechaCompromiso")} className="cursor-pointer px-4 py-3 font-bold">
                      {sortLabel("Entrega pactada", "fechaCompromiso")}
                    </th>
                    <th onClick={() => toggleSort("total")} className="cursor-pointer px-4 py-3 font-bold">
                      {sortLabel("Total", "total")}
                    </th>
                    <th onClick={() => toggleSort("adelanto")} className="cursor-pointer px-4 py-3 font-bold">
                      {sortLabel("Adelanto", "adelanto")}
                    </th>
                    <th onClick={() => toggleSort("saldo")} className="cursor-pointer px-4 py-3 font-bold">
                      {sortLabel("Saldo", "saldo")}
                    </th>
                    <th onClick={() => toggleSort("estadoPedido")} className="cursor-pointer px-4 py-3 font-bold">
                      {sortLabel("Pago", "estadoPedido")}
                    </th>
                    <th onClick={() => toggleSort("estadoEntrega")} className="cursor-pointer px-4 py-3 font-bold">
                      {sortLabel("Entrega", "estadoEntrega")}
                    </th>
                    <th className="px-4 py-3 font-bold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {pedidosPagina.map((pedido) => (
                    <tr key={pedido.id} className="border-t border-slate-200 bg-white hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {pedido.codigo}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span>{getClienteDisplayName(pedido.cliente)}</span>
                          {badgeTipoCliente(pedido.cliente.tipoCliente)}
                        </div>
                        <div className="text-xs text-slate-500">
                          {getClienteDocLabel(pedido.cliente)}: {getClienteDocumento(pedido.cliente)}
                        </div>
                      </td>
                      <td className="px-4 py-3">{pedido.modalidad}</td>
                      <td className="px-4 py-3">{formatDate(pedido.createdAt)}</td>
                      <td className="px-4 py-3">{formatDate(pedido.fechaCompromiso)}</td>
                      <td className="px-4 py-3">{formatMoney(pedido.total)}</td>
                      <td className="px-4 py-3">{formatMoney(pedido.adelanto)}</td>
                      <td className="px-4 py-3">{formatMoney(pedido.saldo)}</td>
                      <td className="px-4 py-3">{badgeEstadoPedido(pedido.estadoPedido)}</td>
                      <td className="px-4 py-3">{badgeEstadoEntrega(pedido.estadoEntrega)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => abrirDetalle(pedido.id)}
                            className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            Ver detalle
                          </button>
                          <button
                            onClick={() => exportarPedidoPDF(pedido)}
                            className="rounded-lg border border-blue-300 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                          >
                            PDF
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 xl:hidden">
              {pedidosPagina.map((pedido) => (
                <div
                  key={pedido.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-black text-slate-900">{pedido.codigo}</div>
                      <div className="truncate text-sm font-semibold text-slate-800">
                        {getClienteDisplayName(pedido.cliente)}
                      </div>
                      <div className="text-xs text-slate-500">
                        {getClienteDocLabel(pedido.cliente)}: {getClienteDocumento(pedido.cliente)}
                      </div>
                    </div>
                    {badgeTipoCliente(pedido.cliente.tipoCliente)}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                    <div>
                      <span className="font-semibold">Modalidad:</span> {pedido.modalidad}
                    </div>
                    <div>
                      <span className="font-semibold">Fecha:</span> {formatDate(pedido.createdAt)}
                    </div>
                    <div>
                      <span className="font-semibold">Entrega:</span> {formatDate(pedido.fechaCompromiso)}
                    </div>
                    <div>
                      <span className="font-semibold">Total:</span> {formatMoney(pedido.total)}
                    </div>
                    <div>
                      <span className="font-semibold">Adelanto:</span> {formatMoney(pedido.adelanto)}
                    </div>
                    <div>
                      <span className="font-semibold">Saldo:</span> {formatMoney(pedido.saldo)}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {badgeEstadoPedido(pedido.estadoPedido)}
                    {badgeEstadoEntrega(pedido.estadoEntrega)}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => abrirDetalle(pedido.id)}
                      className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Ver detalle
                    </button>
                    <button
                      onClick={() => exportarPedidoPDF(pedido)}
                      className="rounded-xl border border-blue-300 px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                    >
                      PDF
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
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

              <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center">
                <button
                  disabled={paginaActual <= 1}
                  onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  ◀ Ant.
                </button>
                <div className="flex items-center justify-center rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                  {paginaActual} / {totalPaginas}
                </div>
                <button
                  disabled={paginaActual >= totalPaginas}
                  onClick={() => setPaginaActual((p) => Math.min(totalPaginas, p + 1))}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  Sig. ▶
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {modalNuevoOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 p-0 sm:flex sm:items-start sm:justify-center sm:p-4">
          <div className="flex h-dvh w-full flex-col bg-white shadow-xl sm:h-auto sm:max-h-[95vh] sm:max-w-7xl sm:rounded-3xl sm:p-6">
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white p-4 sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:pb-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-slate-900 sm:text-2xl">Nuevo pedido</h2>
                  <p className="text-sm text-slate-500">
                    Minorista o mayorista con búsqueda rápida de clientes y productos
                  </p>
                </div>

                <button
                  onClick={cerrarNuevoPedido}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Cerrar
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-0">
              <div className="grid gap-6 xl:grid-cols-3">
                <div className="space-y-4 xl:col-span-2">
                  <section className="rounded-2xl border border-slate-200 p-4">
                    <h3 className="mb-3 text-lg font-black text-slate-900">Cliente</h3>

                    <div className="space-y-2">
                      <input
                        value={clienteBusqueda}
                        onChange={(e) => setClienteBusqueda(e.target.value)}
                        placeholder="Buscar por DNI, RUC, nombre, apellido o razón social..."
                        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                      />

                      <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200">
                        {clientesFiltradosBusqueda.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setClienteSeleccionado(c);
                              setClienteBusqueda(`${getClienteDocumento(c)} - ${getClienteDisplayName(c)}`);
                            }}
                            className="block w-full border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate font-semibold text-slate-900">
                                  {getClienteDisplayName(c)}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {getClienteDocLabel(c)}: {getClienteDocumento(c)} · Código: {c.codigo}
                                </div>
                              </div>
                              {badgeTipoCliente(c.tipoCliente)}
                            </div>
                          </button>
                        ))}
                      </div>

                      {clienteSeleccionado && (
                        <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
                          Cliente seleccionado: <b>{getClienteDisplayName(clienteSeleccionado)}</b> ·{" "}
                          {getClienteDocLabel(clienteSeleccionado)} {getClienteDocumento(clienteSeleccionado)}
                        </div>
                      )}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-200 p-4">
                    <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                      <h3 className="text-lg font-black text-slate-900">Detalle del pedido</h3>
                      {modalidad === "MINORISTA" && (
                        <button
                          type="button"
                          onClick={agregarLinea}
                          className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 sm:w-auto sm:py-2"
                        >
                          + Agregar línea
                        </button>
                      )}
                    </div>

                    <div className="mb-4 grid grid-cols-2 gap-3 sm:flex sm:gap-3">
                      <button
                        type="button"
                        onClick={() => setModalidad("MINORISTA")}
                        className={`rounded-xl px-4 py-3 text-sm font-semibold sm:py-2 ${
                          modalidad === "MINORISTA"
                            ? "bg-slate-900 text-white"
                            : "border border-slate-300 text-slate-700"
                        }`}
                      >
                        Minorista
                      </button>
                      <button
                        type="button"
                        onClick={() => setModalidad("MAYORISTA")}
                        className={`rounded-xl px-4 py-3 text-sm font-semibold sm:py-2 ${
                          modalidad === "MAYORISTA"
                            ? "bg-slate-900 text-white"
                            : "border border-slate-300 text-slate-700"
                        }`}
                      >
                        Mayorista
                      </button>
                    </div>

                    {modalidad === "MINORISTA" ? (
                      <div className="space-y-4">
                        {detalle.map((line, index) => {
                          const productoSeleccionado = productos.find((p) => p.id === line.productoId);
                          const sugerencias = productosFiltradosLinea(line.uid);

                          return (
                            <div key={line.uid} className="rounded-2xl border border-slate-200 p-4">
                              <div className="mb-2 flex items-center justify-between gap-3">
                                <div className="font-bold text-slate-900">
                                  Línea {index + 1}
                                </div>
                                {detalle.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => eliminarLinea(line.uid)}
                                    className="rounded-lg border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                                  >
                                    Eliminar
                                  </button>
                                )}
                              </div>

                              <div className="grid gap-3 md:grid-cols-12">
                                <div className="md:col-span-7">
                                  <label className="mb-1 block text-sm font-semibold text-slate-700">
                                    Buscar producto
                                  </label>
                                  <input
                                    value={productoSearchByLine[line.uid] || ""}
                                    onChange={(e) =>
                                      setProductoSearchByLine((prev) => ({
                                        ...prev,
                                        [line.uid]: e.target.value,
                                      }))
                                    }
                                    placeholder="Buscar código o producto..."
                                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                                  />

                                  <div className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-slate-200">
                                    {sugerencias.map((p) => (
                                      <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => seleccionarProducto(line.uid, p)}
                                        className="block w-full border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50"
                                      >
                                        <div className="font-semibold text-slate-900">
                                          {p.codigo} - {p.modelo}
                                        </div>
                                        <div className="text-xs text-slate-500">
                                          {p.color} · {p.material} · {p.taco} · T{p.talla} · {formatMoney(p.precio)}
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2 md:col-span-5 md:grid-cols-5">
                                  <div className="sm:col-span-1 md:col-span-3">
                                    <label className="mb-1 block text-sm font-semibold text-slate-700">
                                      Cantidad
                                    </label>
                                    <input
                                      type="number"
                                      min={1}
                                      value={line.cantidad}
                                      onChange={(e) => updateLinea(line.uid, "cantidad", e.target.value)}
                                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                                    />
                                  </div>

                                  <div className="sm:col-span-1 md:col-span-2">
                                    <label className="mb-1 block text-sm font-semibold text-slate-700">
                                      Precio
                                    </label>
                                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                                      {formatMoney(productoSeleccionado?.precio || 0)}
                                    </div>
                                  </div>
                                </div>

                                <div className="md:col-span-12">
                                  <label className="mb-1 block text-sm font-semibold text-slate-700">
                                    Producto seleccionado
                                  </label>
                                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 break-words">
                                    {line.productoTexto || "Aún no seleccionado"}
                                  </div>
                                </div>

                                <div className="md:col-span-12">
                                  <label className="mb-1 block text-sm font-semibold text-slate-700">
                                    Observación línea
                                  </label>
                                  <input
                                    value={line.observaciones}
                                    onChange={(e) =>
                                      updateLinea(line.uid, "observaciones", e.target.value)
                                    }
                                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-slate-200 p-4">
                          <h4 className="mb-3 text-base font-black text-slate-900">
                            Seleccionar modelo base
                          </h4>

                          <input
                            value={mayoristaBusqueda}
                            onChange={(e) => setMayoristaBusqueda(e.target.value)}
                            placeholder="Buscar modelo, color, material, taco o código..."
                            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                          />

                          <div className="mt-3 max-h-52 overflow-y-auto rounded-xl border border-slate-200">
                            {gruposMayoristaFiltrados.map((g) => (
                              <button
                                key={g.key}
                                type="button"
                                onClick={() => seleccionarGrupoMayorista(g)}
                                className={`block w-full border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50 ${
                                  grupoMayoristaSeleccionado?.key === g.key ? "bg-blue-50" : ""
                                }`}
                              >
                                <div className="font-semibold text-slate-900">
                                  {g.modelo} · {g.color} · {g.material} · {g.taco}
                                </div>
                                <div className="text-xs text-slate-500">
                                  Colección: {g.coleccion || "-"} · Tallas: {g.productos.map((p) => p.talla).join(", ")}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>

                        {grupoMayoristaSeleccionado && (
                          <div className="rounded-2xl border border-slate-200 p-4">
                            <div className="mb-3">
                              <h4 className="text-base font-black text-slate-900">
                                Matriz de tallas
                              </h4>
                              <p className="text-sm text-slate-500">
                                {grupoMayoristaSeleccionado.modelo} · {grupoMayoristaSeleccionado.color} · {grupoMayoristaSeleccionado.material} · {grupoMayoristaSeleccionado.taco}
                              </p>
                            </div>

                            <div className="overflow-x-auto rounded-xl border border-slate-200">
                              <table className="min-w-full text-sm">
                                <thead className="bg-slate-100 text-slate-700">
                                  <tr>
                                    {grupoMayoristaSeleccionado.productos.map((p) => (
                                      <th key={p.id} className="px-4 py-3 text-center font-bold">
                                        T{p.talla}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr className="border-t border-slate-200">
                                    {grupoMayoristaSeleccionado.productos.map((p) => (
                                      <td key={p.id} className="px-3 py-3">
                                        <input
                                          type="number"
                                          min={0}
                                          value={cantidadesMayorista[p.id] || ""}
                                          onChange={(e) =>
                                            setCantidadesMayorista((prev) => ({
                                              ...prev,
                                              [p.id]: e.target.value,
                                            }))
                                          }
                                          placeholder="0"
                                          className="w-20 rounded-xl border border-slate-300 px-3 py-2 text-center text-sm outline-none focus:border-blue-500"
                                        />
                                        <div className="mt-1 text-center text-[11px] text-slate-500">
                                          {formatMoney(p.precio)}
                                        </div>
                                      </td>
                                    ))}
                                  </tr>
                                </tbody>
                              </table>
                            </div>

                            <div className="mt-4 grid gap-3 lg:grid-cols-2">
                              <div>
                                <label className="mb-1 block text-sm font-semibold text-slate-700">
                                  Observación del bloque
                                </label>
                                <input
                                  value={obsMayorista}
                                  onChange={(e) => setObsMayorista(e.target.value)}
                                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                                />
                              </div>

                              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                                <div className="flex justify-between">
                                  <span>Total pares del bloque</span>
                                  <b>{resumenMayoristaBloque.totalPares}</b>
                                </div>
                                <div className="mt-2 flex justify-between">
                                  <span>Total monto del bloque</span>
                                  <b>{formatMoney(resumenMayoristaBloque.totalMonto)}</b>
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={agregarGrupoMayoristaAlDetalle}
                              className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 sm:w-auto"
                            >
                              Agregar modelo al pedido
                            </button>
                          </div>
                        )}

                        <div className="rounded-2xl border border-slate-200 p-4">
                          <h4 className="mb-3 text-base font-black text-slate-900">
                            Líneas agregadas al pedido
                          </h4>

                          <div className="space-y-2">
                            {detalle.map((line, idx) => (
                              <div key={line.uid} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-semibold text-slate-900">
                                    {line.productoTexto || `Línea ${idx + 1}`}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    Cantidad: {line.cantidad} {line.observaciones ? `· ${line.observaciones}` : ""}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => eliminarLinea(line.uid)}
                                  className="shrink-0 rounded-lg border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                                >
                                  Quitar
                                </button>
                              </div>
                            ))}

                            {detalle.length === 0 && (
                              <p className="text-sm text-slate-500">Aún no hay líneas agregadas.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </section>
                </div>

                <div className="space-y-4">
                  <section className="rounded-2xl border border-slate-200 p-4">
                    <h3 className="mb-3 text-lg font-black text-slate-900">Datos del pedido</h3>

                    <div className="space-y-3">
                      <div>
                        <label className="mb-1 block text-sm font-semibold text-slate-700">
                          Tipo pedido
                        </label>
                        <select
                          value={tipoPedido}
                          onChange={(e) => setTipoPedido(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                        >
                          <option value="SIN_STOCK">SIN_STOCK</option>
                          <option value="CON_STOCK">CON_STOCK</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-semibold text-slate-700">
                          Almacén solicitado
                        </label>
                        <select
                          value={almacenSolicitadoId}
                          onChange={(e) => setAlmacenSolicitadoId(e.target.value)}
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
                          Almacén atendido
                        </label>
                        <select
                          value={almacenAtendidoId}
                          onChange={(e) => setAlmacenAtendidoId(e.target.value)}
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
                          Fecha pactada de entrega
                        </label>
                        <input
                          type="date"
                          value={fechaCompromiso}
                          onChange={(e) => setFechaCompromiso(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-semibold text-slate-700">
                          Prioridad
                        </label>
                        <select
                          value={prioridad}
                          onChange={(e) => setPrioridad(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                        >
                          <option value="BAJA">BAJA</option>
                          <option value="MEDIA">MEDIA</option>
                          <option value="ALTA">ALTA</option>
                        </select>
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
                          Origen atención
                        </label>
                        <select
                          value={origenAtencion}
                          onChange={(e) => setOrigenAtencion(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                        >
                          <option value="PRODUCCION">PRODUCCION</option>
                          <option value="ALMACEN">ALMACEN</option>
                          <option value="MIXTO">MIXTO</option>
                        </select>
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
                    <h3 className="mb-3 text-lg font-black text-slate-900">Resumen</h3>

                    <div className="space-y-2 text-sm text-slate-700">
                      <div className="flex justify-between">
                        <span>Total pares</span>
                        <b>{resumenPedidoNuevo.totalProductos}</b>
                      </div>
                      <div className="flex justify-between">
                        <span>Subtotal</span>
                        <b>{formatMoney(resumenPedidoNuevo.subtotalSinIgv)}</b>
                      </div>
                      <div className="flex justify-between">
                        <span>IGV</span>
                        <b>{formatMoney(resumenPedidoNuevo.igv)}</b>
                      </div>
                      <div className="flex justify-between">
                        <span>Total</span>
                        <b>{formatMoney(resumenPedidoNuevo.total)}</b>
                      </div>
                      <div className="flex justify-between">
                        <span>Adelanto</span>
                        <b>{formatMoney(resumenPedidoNuevo.adelantoNum)}</b>
                      </div>
                      <div className="flex justify-between text-base">
                        <span>Saldo</span>
                        <b>{formatMoney(resumenPedidoNuevo.saldo)}</b>
                      </div>
                    </div>

                    <button
                      onClick={guardarPedido}
                      disabled={guardando}
                      className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                      {guardando ? "Guardando..." : "Registrar pedido"}
                    </button>
                  </section>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {detalleOpen && pedidoActivo && (
        <div className="fixed inset-0 z-50 bg-black/40 p-0 sm:flex sm:items-start sm:justify-center sm:p-4">
          <div className="flex h-dvh w-full flex-col bg-white shadow-xl sm:h-auto sm:max-h-[95vh] sm:max-w-7xl sm:rounded-3xl sm:p-6">
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white p-4 sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:pb-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-900 sm:text-2xl">
                    Detalle del pedido {pedidoActivo.codigo}
                  </h2>
                  <p className="text-sm text-slate-500">
                    {getClienteDisplayName(pedidoActivo.cliente)} · {getClienteDocLabel(pedidoActivo.cliente)} {getClienteDocumento(pedidoActivo.cliente)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                  {puedeEditarPedido && !modoEdicionDetalle && (
                    <button
                      onClick={() => setModoEdicionDetalle(true)}
                      className="rounded-xl border border-amber-300 px-4 py-3 text-sm font-semibold text-amber-700 hover:bg-amber-50 sm:py-2"
                    >
                      Editar pedido
                    </button>
                  )}

                  {modoEdicionDetalle && (
                    <>
                      <button
                        onClick={() => setModoEdicionDetalle(false)}
                        className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:py-2"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={guardarEdicionPedido}
                        disabled={procesandoAccion}
                        className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 sm:py-2"
                      >
                        Guardar
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => exportarPedidoPDF(pedidoActivo)}
                    className="rounded-xl border border-blue-300 px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-50 sm:py-2"
                  >
                    PDF
                  </button>

                  <button
                    onClick={() => setDetalleOpen(false)}
                    className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:py-2"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-0">
              <div className="grid gap-6 xl:grid-cols-3">
                <div className="space-y-4 xl:col-span-2">
                  {!modoEdicionDetalle ? (
                    <>
                      <section className="rounded-2xl border border-slate-200 p-4">
                        <h3 className="mb-3 text-lg font-black text-slate-900">Cabecera</h3>

                        <div className="grid gap-3 sm:grid-cols-2 text-sm text-slate-700">
                          <div><b>Código:</b> {pedidoActivo.codigo}</div>
                          <div><b>Modalidad:</b> {pedidoActivo.modalidad}</div>
                          <div><b>Fecha:</b> {formatDate(pedidoActivo.createdAt)}</div>
                          <div><b>Entrega pactada:</b> {formatDate(pedidoActivo.fechaCompromiso)}</div>
                          <div><b>Prioridad:</b> {pedidoActivo.prioridad}</div>
                          <div><b>Método pago:</b> {pedidoActivo.metodoPago || "-"}</div>
                          <div><b>Cliente:</b> {getClienteDisplayName(pedidoActivo.cliente)}</div>
                          <div><b>{getClienteDocLabel(pedidoActivo.cliente)}:</b> {getClienteDocumento(pedidoActivo.cliente)}</div>
                          <div><b>Almacén solicitado:</b> {pedidoActivo.almacenSolicitado.codigo}</div>
                          <div><b>Almacén atendido:</b> {pedidoActivo.almacenAtendido.codigo}</div>
                          <div><b>Estado pago:</b> {pedidoActivo.estadoPedido}</div>
                          <div><b>Estado entrega:</b> {pedidoActivo.estadoEntrega}</div>
                          <div className="sm:col-span-2"><b>Observaciones:</b> {pedidoActivo.observaciones || "-"}</div>
                        </div>
                      </section>

                      <section className="rounded-2xl border border-slate-200 p-4">
                        <h3 className="mb-3 text-lg font-black text-slate-900">Detalle</h3>

                        <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200">
                          <table className="min-w-full text-sm">
                            <thead className="bg-slate-100 text-left text-slate-700">
                              <tr>
                                <th className="px-4 py-3 font-bold">Código</th>
                                <th className="px-4 py-3 font-bold">Producto</th>
                                <th className="px-4 py-3 font-bold">Talla</th>
                                <th className="px-4 py-3 font-bold">Cantidad</th>
                                <th className="px-4 py-3 font-bold">Precio</th>
                                <th className="px-4 py-3 font-bold">Subtotal</th>
                                <th className="px-4 py-3 font-bold">Estado línea</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pedidoActivo.detalles.map((d, idx) => (
                                <tr key={d.id || idx} className="border-t border-slate-200">
                                  <td className="px-4 py-3">{d.producto?.codigo || "-"}</td>
                                  <td className="px-4 py-3">
                                    {d.modelo} {d.color} {d.material} {d.taco}
                                  </td>
                                  <td className="px-4 py-3">{d.talla}</td>
                                  <td className="px-4 py-3">{d.cantidad}</td>
                                  <td className="px-4 py-3">{formatMoney(d.precioUnitario || 0)}</td>
                                  <td className="px-4 py-3">{formatMoney(d.subtotal || 0)}</td>
                                  <td className="px-4 py-3">{d.estadoLinea || "-"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="space-y-3 md:hidden">
                          {pedidoActivo.detalles.map((d, idx) => (
                            <div key={d.id || idx} className="rounded-xl border border-slate-200 p-3">
                              <div className="font-semibold text-slate-900">
                                {d.producto?.codigo || "-"} · T{d.talla}
                              </div>
                              <div className="text-sm text-slate-700">
                                {d.modelo} {d.color} {d.material} {d.taco}
                              </div>
                              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                                <div><span className="font-semibold">Cantidad:</span> {d.cantidad}</div>
                                <div><span className="font-semibold">Precio:</span> {formatMoney(d.precioUnitario || 0)}</div>
                                <div><span className="font-semibold">Subtotal:</span> {formatMoney(d.subtotal || 0)}</div>
                                <div><span className="font-semibold">Estado:</span> {d.estadoLinea || "-"}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    </>
                  ) : (
                    <>
                      <section className="rounded-2xl border border-slate-200 p-4">
                        <h3 className="mb-3 text-lg font-black text-slate-900">Editar cabecera</h3>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-sm font-semibold text-slate-700">
                              Fecha pactada
                            </label>
                            <input
                              type="date"
                              value={editFechaCompromiso}
                              onChange={(e) => setEditFechaCompromiso(e.target.value)}
                              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-sm font-semibold text-slate-700">
                              Prioridad
                            </label>
                            <select
                              value={editPrioridad}
                              onChange={(e) => setEditPrioridad(e.target.value)}
                              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                            >
                              <option value="BAJA">BAJA</option>
                              <option value="MEDIA">MEDIA</option>
                              <option value="ALTA">ALTA</option>
                            </select>
                          </div>

                          <div>
                            <label className="mb-1 block text-sm font-semibold text-slate-700">
                              Método pago
                            </label>
                            <select
                              value={editMetodoPago}
                              onChange={(e) => setEditMetodoPago(e.target.value)}
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
                              Adelanto
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={editAdelanto}
                              onChange={(e) => setEditAdelanto(e.target.value)}
                              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-sm font-semibold text-slate-700">
                              Origen atención
                            </label>
                            <select
                              value={editOrigenAtencion}
                              onChange={(e) => setEditOrigenAtencion(e.target.value)}
                              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                            >
                              <option value="PRODUCCION">PRODUCCION</option>
                              <option value="ALMACEN">ALMACEN</option>
                              <option value="MIXTO">MIXTO</option>
                            </select>
                          </div>

                          <div className="sm:col-span-2">
                            <label className="mb-1 block text-sm font-semibold text-slate-700">
                              Observaciones
                            </label>
                            <textarea
                              value={editObservaciones}
                              onChange={(e) => setEditObservaciones(e.target.value)}
                              className="min-h-[90px] w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                            />
                          </div>
                        </div>
                      </section>

                      <section className="rounded-2xl border border-slate-200 p-4">
                        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <h3 className="text-lg font-black text-slate-900">Editar líneas</h3>
                          <button
                            onClick={agregarLineaEditable}
                            className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 sm:w-auto sm:py-2"
                          >
                            + Agregar línea
                          </button>
                        </div>

                        <div className="space-y-4">
                          {detalleEditable.map((line, index) => {
                            const productoSeleccionado = productos.find((p) => p.id === line.productoId);
                            const sugerencias = productosFiltradosLinea(line.uid);

                            return (
                              <div key={line.uid} className="rounded-2xl border border-slate-200 p-4">
                                <div className="mb-2 flex items-center justify-between gap-3">
                                  <div className="font-bold text-slate-900">
                                    Línea {index + 1}
                                  </div>
                                  {detalleEditable.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => eliminarLineaEditable(line.uid)}
                                      className="rounded-lg border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                                    >
                                      Eliminar
                                    </button>
                                  )}
                                </div>

                                <div className="grid gap-3 md:grid-cols-12">
                                  <div className="md:col-span-7">
                                    <label className="mb-1 block text-sm font-semibold text-slate-700">
                                      Buscar producto
                                    </label>
                                    <input
                                      value={productoSearchByLine[line.uid] || ""}
                                      onChange={(e) =>
                                        setProductoSearchByLine((prev) => ({
                                          ...prev,
                                          [line.uid]: e.target.value,
                                        }))
                                      }
                                      placeholder="Buscar código o producto..."
                                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                                    />

                                    <div className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-slate-200">
                                      {sugerencias.map((p) => (
                                        <button
                                          key={p.id}
                                          type="button"
                                          onClick={() => seleccionarProductoEditable(line.uid, p)}
                                          className="block w-full border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50"
                                        >
                                          <div className="font-semibold text-slate-900">
                                            {p.codigo} - {p.modelo}
                                          </div>
                                          <div className="text-xs text-slate-500">
                                            {p.color} · {p.material} · {p.taco} · T{p.talla} · {formatMoney(p.precio)}
                                          </div>
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  <div className="grid gap-3 sm:grid-cols-2 md:col-span-5 md:grid-cols-5">
                                    <div className="sm:col-span-1 md:col-span-3">
                                      <label className="mb-1 block text-sm font-semibold text-slate-700">
                                        Cantidad
                                      </label>
                                      <input
                                        type="number"
                                        min={1}
                                        value={line.cantidad}
                                        onChange={(e) => updateLineaEditable(line.uid, "cantidad", e.target.value)}
                                        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                                      />
                                    </div>

                                    <div className="sm:col-span-1 md:col-span-2">
                                      <label className="mb-1 block text-sm font-semibold text-slate-700">
                                        Precio
                                      </label>
                                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                                        {formatMoney(productoSeleccionado?.precio || 0)}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="md:col-span-12">
                                    <label className="mb-1 block text-sm font-semibold text-slate-700">
                                      Producto seleccionado
                                    </label>
                                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 break-words">
                                      {line.productoTexto || "Aún no seleccionado"}
                                    </div>
                                  </div>

                                  <div className="md:col-span-12">
                                    <label className="mb-1 block text-sm font-semibold text-slate-700">
                                      Observación línea
                                    </label>
                                    <input
                                      value={line.observaciones}
                                      onChange={(e) =>
                                        updateLineaEditable(line.uid, "observaciones", e.target.value)
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
                    </>
                  )}

                  <section className="rounded-2xl border border-slate-200 p-4">
                    <h3 className="mb-3 text-lg font-black text-slate-900">Historial</h3>

                    <div className="space-y-3">
                      {(pedidoActivo.historial || []).map((h) => (
                        <div key={h.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                          <div className="font-bold text-slate-900">{h.tipoEvento}</div>
                          <div className="text-slate-600">{h.detalle || "-"}</div>
                          <div className="text-xs text-slate-500">
                            {formatDateTime(h.createdAt)} · {h.usuarioEmail || "-"}
                          </div>
                          <div className="text-xs text-slate-500">
                            {h.estadoAnterior || "-"} → {h.estadoNuevo || "-"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>

                <div className="space-y-4">
                  <section className="rounded-2xl border border-slate-200 p-4">
                    <h3 className="mb-3 text-lg font-black text-slate-900">
                      {modoEdicionDetalle ? "Resumen recalculado" : "Resumen económico"}
                    </h3>

                    <div className="space-y-2 text-sm text-slate-700">
                      <div className="flex justify-between">
                        <span>Subtotal</span>
                        <b>{modoEdicionDetalle ? formatMoney(resumenDetalleEditable.subtotal) : formatMoney(pedidoActivo.subtotal)}</b>
                      </div>
                      <div className="flex justify-between">
                        <span>IGV</span>
                        <b>{modoEdicionDetalle ? formatMoney(resumenDetalleEditable.igv) : formatMoney(pedidoActivo.igv)}</b>
                      </div>
                      <div className="flex justify-between">
                        <span>Total</span>
                        <b>{modoEdicionDetalle ? formatMoney(resumenDetalleEditable.total) : formatMoney(pedidoActivo.total)}</b>
                      </div>
                      <div className="flex justify-between">
                        <span>Adelanto</span>
                        <b>{modoEdicionDetalle ? formatMoney(editAdelanto) : formatMoney(pedidoActivo.adelanto)}</b>
                      </div>
                      <div className="flex justify-between text-base">
                        <span>Saldo</span>
                        <b>{modoEdicionDetalle ? formatMoney(resumenDetalleEditable.saldo) : formatMoney(pedidoActivo.saldo)}</b>
                      </div>
                    </div>
                  </section>

                  {!modoEdicionDetalle && (
                    <>
                      <section className="rounded-2xl border border-slate-200 p-4">
                        <h3 className="mb-3 text-lg font-black text-slate-900">Registrar pago</h3>

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
                            onClick={registrarPagoPedido}
                            disabled={procesandoAccion}
                            className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                          >
                            Registrar adelanto / pago
                          </button>
                        </div>
                      </section>

                      <section className="rounded-2xl border border-slate-200 p-4">
                        <h3 className="mb-3 text-lg font-black text-slate-900">Acciones</h3>

                        <div className="space-y-2">
                          <button
                            onClick={marcarListo}
                            disabled={procesandoAccion}
                            className="w-full rounded-xl border border-blue-300 px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                          >
                            Marcar como LISTO
                          </button>

                          <button
                            onClick={marcarEntregado}
                            disabled={procesandoAccion}
                            className="w-full rounded-xl border border-emerald-300 px-4 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
                          >
                            Marcar como ENTREGADO
                          </button>

                          <button
                            onClick={cancelarPedido}
                            disabled={procesandoAccion}
                            className="w-full rounded-xl border border-red-300 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-50"
                          >
                            Cancelar pedido
                          </button>

                          <button
                            onClick={mandarAProduccion}
                            disabled={procesandoAccion}
                            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            Mandar a producción
                          </button>
                        </div>
                      </section>
                    </>
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