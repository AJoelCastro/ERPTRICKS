"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import jsPDF from "jspdf";

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
  departamento?: string | null;
  ciudad?: string | null;
  distrito?: string | null;
  direccion?: string | null;
  agencia?: string | null;
  local?: string | null;
  estado?: string;
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
  costo: string | number;
  precio: string | number;
  estado?: string;
};

type Almacen = {
  id: string;
  codigo: string;
  nombre: string;
  activo: boolean;
};

type InventarioBusqueda = {
  id: string;
  productoId: string;
  almacenId: string;
  codigoBarras: string;
  sku: string;
  stock: number;
  createdAt: string;
  updatedAt: string;
  alertaStock?: "SIN_STOCK" | "ULTIMOS_PARES" | null;
  producto: Producto;
  almacen: Almacen;
};

type DetalleVenta = {
  id: string;
  ventaId: string;
  productoId: string;
  codigoBarras?: string | null;
  sku?: string | null;
  modelo: string;
  color: string;
  material?: string | null;
  talla: number;
  taco?: string | null;
  cantidad: number;
  precioUnitario: string | number;
  subtotal: string | number;
  fechaEnvio?: string | null;
  producto?: Producto;
};

type Venta = {
  id: string;
  codigo: string;
  clienteId: string;
  almacenId: string;
  totalProductos: number;
  subtotalSinIgv: string | number;
  descuento: string | number;
  igv: string | number;
  totalConIgv: string | number;
  metodoPago: string;
  adelanto: string | number;
  saldo: string | number;
  estado: string;
  fechaEnvio?: string | null;
  createdAt: string;
  updatedAt: string;
  tipoComprobante?: string | null;
  serie?: string | null;
  numero?: string | null;
  docCliente?: string | null;
  razonSocial?: string | null;
  direccionFiscal?: string | null;
  cliente: Cliente;
  almacen: Almacen;
  detalles: DetalleVenta[];
};

type CartItem = {
  productoId: string;
  codigoBarras: string;
  sku: string;
  modelo: string;
  color: string;
  material: string;
  taco: string;
  talla: number;
  precioUnitario: number;
  stock: number;
  cantidad: number;
  alertaStock?: "SIN_STOCK" | "ULTIMOS_PARES" | null;
};

type SortVentaKey =
  | "codigo"
  | "createdAt"
  | "tipoComprobante"
  | "cliente"
  | "totalConIgv"
  | "adelanto"
  | "saldo"
  | "estado";

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

type TicketWidth = "58" | "80";

type EmpresaConfig = {
  nombre: string;
  ruc: string;
  direccion: string;
  telefono: string;
  logoUrl?: string;
};

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

function getVentaClienteNombre(venta: Venta) {
  if (venta.razonSocial) return venta.razonSocial;
  return getClienteDisplayName(venta.cliente);
}

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

function toMoney(v: string | number | null | undefined) {
  return Number(Number(v || 0).toFixed(2));
}

function mmToPt(mm: number) {
  return mm * 2.834645669;
}

function getDocumentoLabel(tipo?: string | null) {
  if (tipo === "BOLETA") return "BOLETA DE VENTA";
  if (tipo === "FACTURA") return "FACTURA";
  return "NOTA DE VENTA";
}

function getEmpresaConfig(logoUrl?: string): EmpresaConfig {
  return {
    nombre: "CALZADO ELEGANCE",
    ruc: "20612345678",
    direccion: "Av. Principal 123 - Lima",
    telefono: "999 888 777",
    logoUrl: logoUrl || undefined,
  };
}

export default function VentasPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  const [ventas, setVentas] = useState<Venta[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [, setProductos] = useState<Producto[]>([]);
  const [inventario, setInventario] = useState<InventarioBusqueda[]>([]);
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);

  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState(false);

  const [clienteQuery, setClienteQuery] = useState("");
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);

  const [productoQuery, setProductoQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);

  const [almacenId, setAlmacenId] = useState("");
  const [tipoComprobante, setTipoComprobante] = useState<
    "BOLETA" | "FACTURA" | "NOTA_VENTA"
  >("NOTA_VENTA");
  const [metodoPago, setMetodoPago] = useState("EFECTIVO");
  const [descuento, setDescuento] = useState("0");
  const [adelanto, setAdelanto] = useState("0");
  const [fechaEnvio, setFechaEnvio] = useState("");
  const [docCliente, setDocCliente] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [direccionFiscal, setDireccionFiscal] = useState("");
  const [observacionVenta, setObservacionVenta] = useState("");

  const [scanInput, setScanInput] = useState("");
  const [scanStatus, setScanStatus] = useState("Listo para escanear");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const qrScannerRef = useRef<{
    stop: () => void;
    destroy: () => void;
  } | null>(null);

  const [qVenta, setQVenta] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [metodoFiltro, setMetodoFiltro] = useState("");
  const [comprobanteFiltro, setComprobanteFiltro] = useState("");
  const [fechaDesdeFiltro, setFechaDesdeFiltro] = useState("");
  const [fechaHastaFiltro, setFechaHastaFiltro] = useState("");

  const [sortKey, setSortKey] = useState<SortVentaKey>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [pagina, setPagina] = useState(1);
  const [filas, setFilas] = useState(10);

  const [detalleVenta, setDetalleVenta] = useState<Venta | null>(null);
  const [detalleOpen, setDetalleOpen] = useState(false);

  const [modalPagoOpen, setModalPagoOpen] = useState(false);
  const [ventaPago, setVentaPago] = useState<Venta | null>(null);
  const [montoPago, setMontoPago] = useState("0");
  const [metodoPagoExtra, setMetodoPagoExtra] = useState("EFECTIVO");
  const [notaPago, setNotaPago] = useState("");

  const [ticketWidth, setTicketWidth] = useState<TicketWidth>("80");
  const [logoUrl, setLogoUrl] = useState("");
  const [mostrarLogo, setMostrarLogo] = useState(false);
  const [ocultarIgvEnNotaVenta, setOcultarIgvEnNotaVenta] = useState(true);
  const [copiasTicket, setCopiasTicket] = useState<1 | 2>(1);

  async function cargarTodo() {
    try {
      setLoading(true);

      const [ventasRes, clientesRes, productosRes, inventarioRes, almacenesRes] =
        await Promise.all([
          fetch(`${apiUrl}/ventas`),
          fetch(`${apiUrl}/clientes`),
          fetch(`${apiUrl}/productos`),
          fetch(`${apiUrl}/inventario`),
          fetch(`${apiUrl}/almacenes`),
        ]);

      const ventasData = await readJsonSafe(ventasRes);
      const clientesData = await readJsonSafe(clientesRes);
      const productosData = await readJsonSafe(productosRes);
      const inventarioData = await readJsonSafe(inventarioRes);
      const almacenesData = await readJsonSafe(almacenesRes);

      const ventasList = ventasData.data || [];
      const clientesList = clientesData.data || [];
      const productosList = productosData.data || [];
      const inventarioList = inventarioData.data || [];
      const almacenesList = almacenesData.data || [];

      setVentas(ventasList);
      setClientes(clientesList);
      setProductos(productosList);
      setInventario(inventarioList);
      setAlmacenes(almacenesList);

      if (!almacenId && almacenesList.length > 0) {
        setAlmacenId(almacenesList[0].id);
      }
    } catch (error) {
      console.error(error);
      alert("No se pudo cargar Ventas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarTodo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clientesFiltrados = useMemo(() => {
    const t = clienteQuery.trim().toLowerCase();
    if (!t) return clientes.slice(0, 12);

    return clientes
      .filter((c) => {
        return (
          String(c.codigo || "").toLowerCase().includes(t) ||
          String(c.dni || "").toLowerCase().includes(t) ||
          String(c.ruc || "").toLowerCase().includes(t) ||
          String(c.nombres || "").toLowerCase().includes(t) ||
          String(c.apellidos || "").toLowerCase().includes(t) ||
          String(c.razonSocial || "").toLowerCase().includes(t) ||
          String(c.nombreCompleto || "").toLowerCase().includes(t) ||
          String(c.documentoPrincipal || "").toLowerCase().includes(t) ||
          String(c.telefono || "").toLowerCase().includes(t)
        );
      })
      .slice(0, 12);
  }, [clientes, clienteQuery]);

  const inventarioAlmacen = useMemo(() => {
    return inventario.filter((i) => i.almacenId === almacenId);
  }, [inventario, almacenId]);

  const productosFiltrados = useMemo(() => {
    const t = productoQuery.trim().toLowerCase();
    if (!t) return inventarioAlmacen.slice(0, 20);

    return inventarioAlmacen
      .filter((i) => {
        const p = i.producto;
        return (
          String(i.codigoBarras || "").toLowerCase().includes(t) ||
          String(i.sku || "").toLowerCase().includes(t) ||
          String(p.codigo || "").toLowerCase().includes(t) ||
          String(p.modelo || "").toLowerCase().includes(t) ||
          String(p.color || "").toLowerCase().includes(t) ||
          String(p.material || "").toLowerCase().includes(t) ||
          String(p.taco || "").toLowerCase().includes(t) ||
          String(p.talla || "").toLowerCase().includes(t)
        );
      })
      .slice(0, 20);
  }, [inventarioAlmacen, productoQuery]);

  function addToCart(item: InventarioBusqueda, cantidad = 1) {
    const stock = Number(item.stock || 0);

    if (stock <= 0) {
      alert(`SIN STOCK: ${item.producto.modelo} talla ${item.producto.talla}`);
      return;
    }

    if (stock <= 2) {
      alert(
        `ÚLTIMOS PARES: ${item.producto.modelo} talla ${item.producto.talla}. Stock actual: ${stock}`
      );
    }

    setCart((prev) => {
      const idx = prev.findIndex((x) => x.productoId === item.productoId);
      if (idx >= 0) {
        const actual = prev[idx];
        const nuevaCantidad = actual.cantidad + cantidad;

        if (nuevaCantidad > stock) {
          alert(
            `No puedes agregar más de ${stock} unidad(es) para ${item.producto.modelo} talla ${item.producto.talla}`
          );
          return prev;
        }

        const copy = [...prev];
        copy[idx] = {
          ...actual,
          cantidad: nuevaCantidad,
          stock,
          alertaStock:
            stock <= 0 ? "SIN_STOCK" : stock <= 2 ? "ULTIMOS_PARES" : null,
        };
        return copy;
      }

      return [
        ...prev,
        {
          productoId: item.productoId,
          codigoBarras: item.codigoBarras,
          sku: item.sku,
          modelo: item.producto.modelo,
          color: item.producto.color,
          material: item.producto.material,
          taco: item.producto.taco,
          talla: item.producto.talla,
          precioUnitario: Number(item.producto.precio || 0),
          stock,
          cantidad,
          alertaStock:
            stock <= 0 ? "SIN_STOCK" : stock <= 2 ? "ULTIMOS_PARES" : null,
        },
      ];
    });
  }

  function removeCartItem(productoId: string) {
    setCart((prev) => prev.filter((x) => x.productoId !== productoId));
  }

  function changeQty(productoId: string, qty: number) {
    setCart((prev) =>
      prev
        .map((x) => {
          if (x.productoId !== productoId) return x;
          if (qty <= 0) return null;
          if (qty > x.stock) {
            alert(`Stock máximo disponible: ${x.stock}`);
            return x;
          }
          return { ...x, cantidad: qty };
        })
        .filter(Boolean) as CartItem[]
    );
  }

  const totales = useMemo(() => {
    const subtotalBruto = cart.reduce(
      (acc, item) =>
        acc + Number(item.precioUnitario || 0) * Number(item.cantidad || 0),
      0
    );

    let totalConIgv = toMoney(subtotalBruto - Number(descuento || 0));
    if (totalConIgv < 0) totalConIgv = 0;

    const subtotalSinIgv = toMoney(totalConIgv / 1.18);
    const igv = toMoney(totalConIgv - subtotalSinIgv);

    let saldo = toMoney(totalConIgv - Number(adelanto || 0));
    if (saldo < 0) saldo = 0;

    return {
      totalProductos: cart.reduce(
        (acc, item) => acc + Number(item.cantidad || 0),
        0
      ),
      subtotalSinIgv,
      igv,
      totalConIgv,
      saldo,
    };
  }, [cart, descuento, adelanto]);

  async function procesarCodigoEscaneado(codigoParam?: string) {
    try {
      const codigo = String(codigoParam ?? scanInput).trim();

      if (!codigo) return;
      if (!almacenId) {
        alert("Selecciona un almacén primero.");
        return;
      }

      const res = await fetch(
        `${apiUrl}/ventas/buscar-por-barras/${encodeURIComponent(
          codigo
        )}?almacenId=${encodeURIComponent(almacenId)}`
      );

      const data = await readJsonSafe(res);

      if (!res.ok || !data.ok) {
        alert(data.error || "No se encontró el producto escaneado");
        return;
      }

      const item = data.data as InventarioBusqueda;
      addToCart(item, 1);
      setScanInput("");
      setScanStatus(
        `Producto agregado: ${item.producto.modelo} talla ${item.producto.talla}`
      );
    } catch (error) {
      console.error(error);
      alert("No se pudo procesar el código escaneado");
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
      if (!videoRef.current) return;

      setCameraError("");
      setScanStatus("Iniciando cámara...");

      stopCameraScanner();

      const mod = (await import("qr-scanner")) as QrScannerModule;
      const QrScanner = mod.default;

      const scanner = new QrScanner(
        videoRef.current,
        (result) => {
          const text = typeof result === "string" ? result : result?.data || "";
          if (!text) return;
          setScanInput(text);
          setScanStatus(`Leído: ${text}`);
          procesarCodigoEscaneado(text);
        },
        {
          returnDetailedScanResult: true,
          highlightScanRegion: true,
          highlightCodeOutline: true,
        }
      );

      qrScannerRef.current = scanner;
      await scanner.start();
      setScanStatus("Escaneo continuo activo");
    } catch (error) {
      console.error(error);
      setCameraError(
        "No se pudo iniciar la cámara. Usa lector externo o entrada manual."
      );
      setScanStatus("Error de cámara");
    }
  }

  useEffect(() => {
    if (cameraOpen) {
      startCameraScanner();
    } else {
      stopCameraScanner();
    }

    return () => {
      stopCameraScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraOpen, almacenId]);

  function resetVenta() {
    setClienteQuery("");
    setClienteSeleccionado(null);
    setProductoQuery("");
    setCart([]);
    setTipoComprobante("NOTA_VENTA");
    setMetodoPago("EFECTIVO");
    setDescuento("0");
    setAdelanto("0");
    setFechaEnvio("");
    setDocCliente("");
    setRazonSocial("");
    setDireccionFiscal("");
    setObservacionVenta("");
    setScanInput("");
    setScanStatus("Listo para escanear");
  }

  async function registrarVenta() {
    if (!clienteSeleccionado) {
      alert("Selecciona un cliente.");
      return;
    }

    if (!almacenId) {
      alert("Selecciona un almacén.");
      return;
    }

    if (cart.length === 0) {
      alert("Agrega al menos un producto.");
      return;
    }

    try {
      setProcesando(true);

      const detalles = cart.map((item) => ({
        productoId: item.productoId,
        cantidad: Number(item.cantidad),
        precioUnitario: Number(item.precioUnitario),
      }));

      const nombreClienteFinal =
        razonSocial || getClienteDisplayName(clienteSeleccionado);

      const documentoFinal =
        docCliente || getClienteDocumento(clienteSeleccionado);

      const res = await fetch(`${apiUrl}/ventas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clienteId: clienteSeleccionado.id,
          almacenId,
          tipoComprobante,
          metodoPago,
          adelanto: Number(adelanto || 0),
          descuento: Number(descuento || 0),
          fechaEnvio: fechaEnvio || null,
          docCliente: documentoFinal,
          razonSocial: nombreClienteFinal,
          direccionFiscal: direccionFiscal || clienteSeleccionado.direccion || "",
          detalles,
          observacionVenta,
        }),
      });

      const data = await readJsonSafe(res);

      if (!res.ok || !data.ok) {
        alert(data.error || "No se pudo registrar la venta");
        return;
      }

      alert("Venta registrada correctamente");
      resetVenta();
      await cargarTodo();
      setDetalleVenta(data.data);
      setDetalleOpen(true);
    } catch (error) {
      console.error(error);
      alert("Error registrando la venta");
    } finally {
      setProcesando(false);
    }
  }

  async function abrirDetalleVenta(id: string) {
    try {
      const res = await fetch(`${apiUrl}/ventas/${id}`);
      const data = await readJsonSafe(res);

      if (!res.ok || !data.ok) {
        alert(data.error || "No se pudo abrir la venta");
        return;
      }

      setDetalleVenta(data.data);
      setDetalleOpen(true);
    } catch (error) {
      console.error(error);
      alert("Error al abrir detalle de venta");
    }
  }

  async function registrarPagoExtra() {
    if (!ventaPago) return;

    try {
      setProcesando(true);

      const res = await fetch(`${apiUrl}/ventas/${ventaPago.id}/pagos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          monto: Number(montoPago || 0),
          metodoPago: metodoPagoExtra,
          nota: notaPago || null,
        }),
      });

      const data = await readJsonSafe(res);

      if (!res.ok || !data.ok) {
        alert(data.error || "No se pudo registrar el pago");
        return;
      }

      alert("Pago registrado correctamente");
      setModalPagoOpen(false);
      setMontoPago("0");
      setMetodoPagoExtra("EFECTIVO");
      setNotaPago("");
      await cargarTodo();

      if (detalleVenta?.id === ventaPago.id) {
        await abrirDetalleVenta(ventaPago.id);
      }
    } catch (error) {
      console.error(error);
      alert("Error registrando pago");
    } finally {
      setProcesando(false);
    }
  }

  function getEmpresa() {
    return getEmpresaConfig(mostrarLogo ? logoUrl : "");
  }

  function getDocumentoLabelLocal(tipo?: string | null) {
    return getDocumentoLabel(tipo);
  }

  function buildTicketHtml(venta: Venta) {
    const empresa = getEmpresa();
    const tipo = venta.tipoComprobante || "NOTA_VENTA";
    const docLabel = getDocumentoLabelLocal(tipo);
    const pageWidth = ticketWidth === "58" ? "50mm" : "72mm";
    const pageRule = ticketWidth === "58" ? "58mm auto" : "80mm auto";
    const showIgv = !(tipo === "NOTA_VENTA" && ocultarIgvEnNotaVenta);
    const clienteNombre = getVentaClienteNombre(venta);
    const documentoMostrar =
      venta.docCliente || getClienteDocumento(venta.cliente);

    const detalleRows = venta.detalles
      .map(
        (d) => `
        <div class="item">
          <div class="item-name">${d.modelo} ${d.color} T${d.talla}</div>
          <div class="item-sub">${d.sku || ""}</div>
          <div class="item-line">
            <span>${d.cantidad} x ${Number(d.precioUnitario).toFixed(2)}</span>
            <span>${Number(d.subtotal).toFixed(2)}</span>
          </div>
        </div>
      `
      )
      .join("");

    const clienteHtml =
      tipo === "FACTURA"
        ? `
          <div class="block compact">
            <div><b>RUC:</b> ${documentoMostrar || "-"}</div>
            <div><b>Razón:</b> ${clienteNombre}</div>
            <div><b>Dir:</b> ${venta.direccionFiscal || "-"}</div>
          </div>
        `
        : `
          <div class="block compact">
            <div><b>Cliente:</b> ${clienteNombre}</div>
            <div><b>Doc:</b> ${documentoMostrar || "-"}</div>
          </div>
        `;

    const logoHtml =
      empresa.logoUrl && mostrarLogo
        ? `<div class="logo-wrap"><img src="${empresa.logoUrl}" class="logo" alt="logo" /></div>`
        : "";

    const copiasHtml =
      copiasTicket === 2 ? `<div class="copy">COPIA TIENDA</div>` : "";

    return `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${venta.codigo}</title>
          <style>
            @page {
              size: ${pageRule};
              margin: 4mm;
            }

            body {
              font-family: Arial, Helvetica, sans-serif;
              width: ${pageWidth};
              margin: 0 auto;
              color: #111827;
              font-size: ${ticketWidth === "58" ? "10px" : "11px"};
            }

            .center { text-align: center; }
            .title {
              font-size: ${ticketWidth === "58" ? "12px" : "15px"};
              font-weight: 700;
              margin-bottom: 2px;
              letter-spacing: 0.2px;
            }
            .subtitle {
              font-size: ${ticketWidth === "58" ? "10px" : "11px"};
              font-weight: 700;
              margin-top: 4px;
            }
            .muted {
              font-size: ${ticketWidth === "58" ? "8px" : "10px"};
              color: #374151;
            }
            .divider {
              border-top: 1px dashed #222;
              margin: 7px 0;
            }
            .block {
              margin-bottom: 7px;
              line-height: 1.35;
            }
            .compact {
              font-size: ${ticketWidth === "58" ? "9px" : "10px"};
            }
            .row {
              display: flex;
              justify-content: space-between;
              gap: 8px;
              margin-bottom: 3px;
            }
            .item {
              margin-bottom: 7px;
            }
            .item-name {
              font-weight: 700;
              font-size: ${ticketWidth === "58" ? "9.5px" : "11px"};
              line-height: 1.2;
            }
            .item-sub {
              font-size: ${ticketWidth === "58" ? "7.5px" : "9px"};
              color: #6b7280;
              margin-top: 1px;
              margin-bottom: 2px;
            }
            .item-line {
              display: flex;
              justify-content: space-between;
              font-size: ${ticketWidth === "58" ? "8px" : "10px"};
            }
            .totals {
              margin-top: 6px;
            }
            .totals .row {
              font-size: ${ticketWidth === "58" ? "9px" : "11px"};
            }
            .totals .grand {
              font-size: ${ticketWidth === "58" ? "11px" : "13px"};
              font-weight: 700;
              margin-top: 4px;
            }
            .footer {
              text-align: center;
              margin-top: 10px;
              font-size: ${ticketWidth === "58" ? "8px" : "10px"};
            }
            .logo-wrap {
              text-align: center;
              margin-bottom: 6px;
            }
            .logo {
              max-width: ${ticketWidth === "58" ? "34mm" : "44mm"};
              max-height: ${ticketWidth === "58" ? "18mm" : "20mm"};
              object-fit: contain;
            }
            .copy {
              text-align: center;
              font-size: ${ticketWidth === "58" ? "8px" : "9px"};
              font-weight: 700;
              margin-top: 4px;
              margin-bottom: 4px;
            }
          </style>
        </head>
        <body>
          ${logoHtml}
          <div class="center">
            <div class="title">${empresa.nombre}</div>
            <div class="muted">RUC: ${empresa.ruc}</div>
            <div class="muted">${empresa.direccion}</div>
            <div class="muted">Tel: ${empresa.telefono}</div>
            <div class="subtitle">${docLabel}</div>
            <div class="muted">${venta.serie || ""}-${venta.numero || ""}</div>
            ${copiasHtml}
          </div>

          <div class="divider"></div>

          <div class="block compact">
            <div><b>Venta:</b> ${venta.codigo}</div>
            <div><b>Fecha:</b> ${formatDateTime(venta.createdAt)}</div>
            <div><b>Pago:</b> ${venta.metodoPago}</div>
            ${venta.fechaEnvio ? `<div><b>Entrega:</b> ${formatDate(venta.fechaEnvio)}</div>` : ""}
          </div>

          ${clienteHtml}

          <div class="divider"></div>

          <div class="block">
            ${detalleRows}
          </div>

          <div class="divider"></div>

          <div class="totals">
            <div class="row"><span>Subtotal</span><span>${Number(venta.subtotalSinIgv).toFixed(2)}</span></div>
            ${
              showIgv
                ? `<div class="row"><span>IGV</span><span>${Number(venta.igv).toFixed(2)}</span></div>`
                : ""
            }
            <div class="row"><span>Descuento</span><span>${Number(venta.descuento).toFixed(2)}</span></div>
            <div class="row grand"><span>TOTAL</span><span>${Number(venta.totalConIgv).toFixed(2)}</span></div>
            <div class="row"><span>Adelanto</span><span>${Number(venta.adelanto).toFixed(2)}</span></div>
            <div class="row"><span>Saldo</span><span>${Number(venta.saldo).toFixed(2)}</span></div>
          </div>

          <div class="divider"></div>

          <div class="footer">
            ${
              tipo === "FACTURA"
                ? "Representación impresa de la factura"
                : tipo === "BOLETA"
                ? "Representación impresa de la boleta"
                : "Comprobante interno de venta"
            }
            <br />
            Gracias por su compra
          </div>
        </body>
      </html>
    `;
  }

  function imprimirTicket(venta: Venta) {
    const html = buildTicketHtml(venta);
    const win = window.open("", "_blank", "width=420,height=900");

    if (!win) {
      alert("El navegador bloqueó la ventana de impresión.");
      return;
    }

    win.document.open();
    win.document.write(html);
    win.document.close();

    win.onload = () => {
      win.focus();
      win.print();
    };
  }

  function exportarTicketPdf(venta: Venta) {
    const tipo = venta.tipoComprobante || "NOTA_VENTA";
    const widthMm = ticketWidth === "58" ? 58 : 80;
    const width = mmToPt(widthMm);
    const showIgv = !(tipo === "NOTA_VENTA" && ocultarIgvEnNotaVenta);
    const approxHeight =
      320 +
      venta.detalles.length * (ticketWidth === "58" ? 22 : 26) +
      (mostrarLogo ? 40 : 0);

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: [width, approxHeight],
    });

    const empresa = getEmpresa();
    const docLabel = getDocumentoLabelLocal(tipo);
    const marginX = 10;
    const rightX = width - 10;
    const centerX = width / 2;
    const small = ticketWidth === "58" ? 7.5 : 8.5;
    const base = ticketWidth === "58" ? 8 : 9;
    const title = ticketWidth === "58" ? 11 : 13;
    const strong = ticketWidth === "58" ? 9.5 : 10.5;
    const clienteNombre = getVentaClienteNombre(venta);
    const documentoMostrar =
      venta.docCliente || getClienteDocumento(venta.cliente);

    let y = 16;

    if (empresa.logoUrl && mostrarLogo) {
      try {
        doc.addImage(empresa.logoUrl, "PNG", centerX - 52, y, 104, 28);
        y += 34;
      } catch {
        // noop
      }
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(title);
    doc.text(empresa.nombre, centerX, y, { align: "center" });
    y += 12;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(small);
    doc.text(`RUC: ${empresa.ruc}`, centerX, y, { align: "center" });
    y += 9;
    doc.text(empresa.direccion, centerX, y, { align: "center" });
    y += 9;
    doc.text(`Tel: ${empresa.telefono}`, centerX, y, { align: "center" });
    y += 12;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(strong);
    doc.text(docLabel, centerX, y, { align: "center" });
    y += 10;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(base);
    doc.text(`${venta.serie || ""}-${venta.numero || ""}`, centerX, y, {
      align: "center",
    });
    y += 8;

    if (copiasTicket === 2) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(small);
      doc.text("COPIA TIENDA", centerX, y, { align: "center" });
      y += 10;
    }

    doc.line(marginX, y, width - marginX, y);
    y += 10;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(base);
    doc.text(`Venta: ${venta.codigo}`, marginX, y);
    y += 10;
    doc.text(`Fecha: ${formatDateTime(venta.createdAt)}`, marginX, y);
    y += 10;
    doc.text(`Pago: ${venta.metodoPago}`, marginX, y);
    y += 10;
    if (venta.fechaEnvio) {
      doc.text(`Entrega: ${formatDate(venta.fechaEnvio)}`, marginX, y);
      y += 10;
    }

    doc.line(marginX, y, width - marginX, y);
    y += 10;

    if (tipo === "FACTURA") {
      doc.setFont("helvetica", "bold");
      doc.text("RUC:", marginX, y);
      doc.setFont("helvetica", "normal");
      doc.text(`${documentoMostrar || "-"}`, marginX + 26, y);
      y += 10;

      doc.setFont("helvetica", "bold");
      doc.text("Razón:", marginX, y);
      doc.setFont("helvetica", "normal");
      const razonLines = doc.splitTextToSize(clienteNombre || "-", width - 52);
      doc.text(razonLines, marginX + 32, y);
      y += razonLines.length * 8.5;

      doc.setFont("helvetica", "bold");
      doc.text("Dir:", marginX, y);
      doc.setFont("helvetica", "normal");
      const dirLines = doc.splitTextToSize(
        venta.direccionFiscal || "-",
        width - 34
      );
      doc.text(dirLines, marginX + 20, y);
      y += dirLines.length * 8.5 + 2;
    } else {
      doc.setFont("helvetica", "bold");
      doc.text("Cliente:", marginX, y);
      doc.setFont("helvetica", "normal");
      const clienteLines = doc.splitTextToSize(clienteNombre || "-", width - 54);
      doc.text(clienteLines, marginX + 36, y);
      y += clienteLines.length * 8.5;

      doc.setFont("helvetica", "bold");
      doc.text("Doc:", marginX, y);
      doc.setFont("helvetica", "normal");
      doc.text(`${documentoMostrar || "-"}`, marginX + 22, y);
      y += 12;
    }

    doc.line(marginX, y, width - marginX, y);
    y += 10;

    venta.detalles.forEach((d) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(base);
      const nombre = `${d.modelo} ${d.color} T${d.talla}`;
      const nombreLines = doc.splitTextToSize(nombre, width - 20);
      doc.text(nombreLines, marginX, y);
      y += nombreLines.length * 8;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(small);
      if (d.sku) {
        const skuLines = doc.splitTextToSize(d.sku, width - 20);
        doc.text(skuLines, marginX, y);
        y += skuLines.length * 7.5;
      }

      doc.text(
        `${d.cantidad} x ${Number(d.precioUnitario).toFixed(2)}`,
        marginX,
        y
      );
      doc.text(`${Number(d.subtotal).toFixed(2)}`, rightX, y, {
        align: "right",
      });
      y += 11;
    });

    doc.line(marginX, y, width - marginX, y);
    y += 10;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(base);
    doc.text("Subtotal", marginX, y);
    doc.text(Number(venta.subtotalSinIgv).toFixed(2), rightX, y, {
      align: "right",
    });
    y += 10;

    if (showIgv) {
      doc.text("IGV", marginX, y);
      doc.text(Number(venta.igv).toFixed(2), rightX, y, { align: "right" });
      y += 10;
    }

    doc.text("Descuento", marginX, y);
    doc.text(Number(venta.descuento).toFixed(2), rightX, y, {
      align: "right",
    });
    y += 12;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(strong);
    doc.text("TOTAL", marginX, y);
    doc.text(Number(venta.totalConIgv).toFixed(2), rightX, y, {
      align: "right",
    });
    y += 12;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(base);
    doc.text("Adelanto", marginX, y);
    doc.text(Number(venta.adelanto).toFixed(2), rightX, y, {
      align: "right",
    });
    y += 10;

    doc.text("Saldo", marginX, y);
    doc.text(Number(venta.saldo).toFixed(2), rightX, y, {
      align: "right",
    });
    y += 14;

    doc.line(marginX, y, width - marginX, y);
    y += 12;

    doc.setFontSize(small);
    doc.text(
      tipo === "FACTURA"
        ? "Representación impresa de la factura"
        : tipo === "BOLETA"
        ? "Representación impresa de la boleta"
        : "Comprobante interno de venta",
      centerX,
      y,
      { align: "center" }
    );
    y += 10;

    doc.text("Gracias por su compra", centerX, y, { align: "center" });

    const fileName =
      tipo === "FACTURA"
        ? `${venta.codigo}-factura.pdf`
        : tipo === "BOLETA"
        ? `${venta.codigo}-boleta.pdf`
        : `${venta.codigo}-nota-venta.pdf`;

    doc.save(fileName);
  }

  const ventasFiltradas = useMemo(() => {
    const t = qVenta.trim().toLowerCase();

    const filtradas = ventas.filter((v) => {
      const clienteNombre = getVentaClienteNombre(v).toLowerCase();

      const matchQ =
        !t ||
        v.codigo.toLowerCase().includes(t) ||
        String(v.serie || "").toLowerCase().includes(t) ||
        String(v.numero || "").toLowerCase().includes(t) ||
        String(v.docCliente || "").toLowerCase().includes(t) ||
        String(v.razonSocial || "").toLowerCase().includes(t) ||
        clienteNombre.includes(t) ||
        String(v.cliente.dni || "").toLowerCase().includes(t) ||
        String(v.cliente.ruc || "").toLowerCase().includes(t);

      const matchEstado = !estadoFiltro || v.estado === estadoFiltro;
      const matchMetodo = !metodoFiltro || v.metodoPago === metodoFiltro;
      const matchComp =
        !comprobanteFiltro ||
        (v.tipoComprobante || "NOTA_VENTA") === comprobanteFiltro;

      const fecha = new Date(v.createdAt).getTime();
      const matchDesde =
        !fechaDesdeFiltro ||
        fecha >= new Date(`${fechaDesdeFiltro}T00:00:00`).getTime();
      const matchHasta =
        !fechaHastaFiltro ||
        fecha <= new Date(`${fechaHastaFiltro}T23:59:59`).getTime();

      return (
        matchQ &&
        matchEstado &&
        matchMetodo &&
        matchComp &&
        matchDesde &&
        matchHasta
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
        case "createdAt":
          av = new Date(a.createdAt).getTime();
          bv = new Date(b.createdAt).getTime();
          break;
        case "tipoComprobante":
          av = a.tipoComprobante || "";
          bv = b.tipoComprobante || "";
          break;
        case "cliente":
          av = getVentaClienteNombre(a);
          bv = getVentaClienteNombre(b);
          break;
        case "totalConIgv":
          av = Number(a.totalConIgv || 0);
          bv = Number(b.totalConIgv || 0);
          break;
        case "adelanto":
          av = Number(a.adelanto || 0);
          bv = Number(b.adelanto || 0);
          break;
        case "saldo":
          av = Number(a.saldo || 0);
          bv = Number(b.saldo || 0);
          break;
        case "estado":
          av = a.estado;
          bv = b.estado;
          break;
      }

      if (typeof av === "string") av = av.toUpperCase();
      if (typeof bv === "string") bv = bv.toUpperCase();

      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [
    ventas,
    qVenta,
    estadoFiltro,
    metodoFiltro,
    comprobanteFiltro,
    fechaDesdeFiltro,
    fechaHastaFiltro,
    sortKey,
    sortDir,
  ]);

  const totalPaginas = Math.max(1, Math.ceil(ventasFiltradas.length / filas));
  const ventasPagina = useMemo(() => {
    const start = (pagina - 1) * filas;
    return ventasFiltradas.slice(start, start + filas);
  }, [ventasFiltradas, pagina, filas]);

  useEffect(() => {
    setPagina(1);
  }, [
    qVenta,
    estadoFiltro,
    metodoFiltro,
    comprobanteFiltro,
    fechaDesdeFiltro,
    fechaHastaFiltro,
    filas,
  ]);

  function toggleSort(key: SortVentaKey) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function sortLabel(label: string, key: SortVentaKey) {
    if (sortKey !== key) return `${label} ↕`;
    return `${label} ${sortDir === "asc" ? "▲" : "▼"}`;
  }

  function badgeEstado(estado: string) {
    const map: Record<string, string> = {
      PENDIENTE: "bg-yellow-100 text-yellow-700",
      PAGADO_PARCIAL: "bg-blue-100 text-blue-700",
      PAGADO: "bg-emerald-100 text-emerald-700",
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

  return (
    <div className="space-y-4 sm:space-y-6">
      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-2xl bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6">
          <div className="mb-4">
            <h1 className="text-xl font-black text-slate-900 sm:text-2xl">Ventas POS</h1>
            <p className="text-sm text-slate-500">
              Punto de venta con escaneo continuo, comprobantes y control de adelantos
            </p>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <select
              value={almacenId}
              onChange={(e) => setAlmacenId(e.target.value)}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
            >
              {almacenes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.codigo} - {a.nombre}
                </option>
              ))}
            </select>

            <select
              value={tipoComprobante}
              onChange={(e) =>
                setTipoComprobante(
                  e.target.value as "BOLETA" | "FACTURA" | "NOTA_VENTA"
                )
              }
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
            >
              <option value="NOTA_VENTA">NOTA_VENTA</option>
              <option value="BOLETA">BOLETA</option>
              <option value="FACTURA">FACTURA</option>
            </select>

            <select
              value={metodoPago}
              onChange={(e) => setMetodoPago(e.target.value)}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
            >
              <option value="EFECTIVO">EFECTIVO</option>
              <option value="YAPE">YAPE</option>
              <option value="PLIN">PLIN</option>
              <option value="TRANSFERENCIA">TRANSFERENCIA</option>
            </select>

            <input
              type="date"
              value={fechaEnvio}
              onChange={(e) => setFechaEnvio(e.target.value)}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
            />
          </div>

          <div className="mb-4 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 p-4 sm:grid-cols-2 xl:grid-cols-5">
            <select
              value={ticketWidth}
              onChange={(e) => setTicketWidth(e.target.value as TicketWidth)}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
            >
              <option value="58">Ticket 58 mm</option>
              <option value="80">Ticket 80 mm</option>
            </select>

            <label className="flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-sm">
              <input
                type="checkbox"
                checked={mostrarLogo}
                onChange={(e) => setMostrarLogo(e.target.checked)}
              />
              Mostrar logo
            </label>

            <label className="flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-sm">
              <input
                type="checkbox"
                checked={ocultarIgvEnNotaVenta}
                onChange={(e) => setOcultarIgvEnNotaVenta(e.target.checked)}
              />
              Ocultar IGV en nota
            </label>

            <select
              value={String(copiasTicket)}
              onChange={(e) => setCopiasTicket(Number(e.target.value) as 1 | 2)}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
            >
              <option value="1">1 copia</option>
              <option value="2">2 copias</option>
            </select>

            <input
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="URL logo PNG/JPG"
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
            />
          </div>

          <div className="mb-5 rounded-2xl border border-slate-200 p-4">
            <div className="mb-2 text-sm font-bold text-slate-700">Cliente</div>

            <input
              value={clienteQuery}
              onChange={(e) => setClienteQuery(e.target.value)}
              placeholder="Buscar cliente por DNI, RUC, nombre, razón social, teléfono..."
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
            />

            {!clienteSeleccionado ? (
              <div className="mt-3 max-h-64 overflow-y-auto rounded-xl border border-slate-200">
                {clientesFiltrados.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setClienteSeleccionado(c);
                      setClienteQuery(getClienteDisplayName(c));
                      setDocCliente(getClienteDocumento(c));
                      setRazonSocial(getClienteDisplayName(c));
                      setDireccionFiscal(c.direccion || "");
                    }}
                    className="block w-full border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-slate-900">
                          {getClienteDisplayName(c)}
                        </div>
                        <div className="text-xs text-slate-500">
                          {getClienteDocLabel(c)}: {getClienteDocumento(c)} · Tel: {c.telefono || "-"}
                        </div>
                      </div>

                      {badgeTipoCliente(c.tipoCliente)}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-3 rounded-2xl bg-blue-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                  <div>
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <div className="font-bold text-slate-900">
                        {getClienteDisplayName(clienteSeleccionado)}
                      </div>
                      {badgeTipoCliente(clienteSeleccionado.tipoCliente)}
                    </div>
                    <div className="text-sm text-slate-600">
                      {getClienteDocLabel(clienteSeleccionado)}: {getClienteDocumento(clienteSeleccionado)}
                    </div>
                    <div className="text-sm text-slate-600">
                      Dirección: {clienteSeleccionado.direccion || "-"}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setClienteSeleccionado(null);
                      setClienteQuery("");
                      setDocCliente("");
                      setRazonSocial("");
                      setDireccionFiscal("");
                    }}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-white"
                  >
                    Cambiar
                  </button>
                </div>
              </div>
            )}

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <input
                value={docCliente}
                onChange={(e) => setDocCliente(e.target.value)}
                placeholder="Documento para comprobante"
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
              />
              <input
                value={razonSocial}
                onChange={(e) => setRazonSocial(e.target.value)}
                placeholder="Razón social / cliente"
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
              />
              <input
                value={direccionFiscal}
                onChange={(e) => setDireccionFiscal(e.target.value)}
                placeholder="Dirección fiscal"
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
              />
            </div>
          </div>

          <div className="mb-5 rounded-2xl border border-slate-200 p-4">
            <div className="mb-2 text-sm font-bold text-slate-700">Escaneo POS</div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_auto_auto]">
              <input
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    procesarCodigoEscaneado();
                  }
                }}
                placeholder="Escanea o pega código QR / barras"
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
              />

              <button
                onClick={() => procesarCodigoEscaneado()}
                className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Agregar
              </button>

              <button
                onClick={() => setCameraOpen((v) => !v)}
                className={`rounded-xl px-4 py-3 text-sm font-semibold ${
                  cameraOpen
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : "border border-slate-300 text-slate-700 hover:bg-slate-100"
                }`}
              >
                {cameraOpen ? "Detener cámara" : "Cámara"}
              </button>
            </div>

            <div className="mt-3 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
              {scanStatus}
            </div>

            {cameraOpen ? (
              <div className="mt-3">
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-black">
                  <video
                    ref={videoRef}
                    className="h-[240px] w-full object-cover sm:h-[280px]"
                    muted
                    playsInline
                  />
                </div>

                {cameraError ? (
                  <div className="mt-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                    {cameraError}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="mb-2 text-sm font-bold text-slate-700">Buscar productos</div>

            <input
              value={productoQuery}
              onChange={(e) => setProductoQuery(e.target.value)}
              placeholder="Buscar por código, modelo, color, talla, SKU..."
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
            />

            <div className="mt-3 max-h-72 overflow-y-auto rounded-xl border border-slate-200">
              {productosFiltrados.map((item) => (
                <button
                  key={item.id}
                  onClick={() => addToCart(item, 1)}
                  className="block w-full border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900">
                        {item.producto.modelo} · {item.producto.color} · T{item.producto.talla}
                      </div>
                      <div className="break-words text-xs text-slate-500">
                        {item.producto.codigo} · {item.sku} · QR {item.codigoBarras}
                      </div>
                      <div className="text-xs text-slate-500">
                        Material: {item.producto.material} · Taco: {item.producto.taco}
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="font-bold text-slate-900">
                        {formatMoney(item.producto.precio)}
                      </div>
                      <div
                        className={`text-xs font-bold ${
                          Number(item.stock) <= 0
                            ? "text-red-600"
                            : Number(item.stock) <= 2
                            ? "text-amber-600"
                            : "text-emerald-600"
                        }`}
                      >
                        Stock: {item.stock}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-900">Carrito POS</h2>
              <p className="text-sm text-slate-500">Venta actual y totales</p>
            </div>

            <button
              onClick={resetVenta}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:w-auto sm:py-2"
            >
              Limpiar
            </button>
          </div>

          <div className="space-y-3">
            {cart.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                No hay productos en el carrito
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.productoId}
                  className="rounded-2xl border border-slate-200 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900">
                        {item.modelo} · {item.color} · T{item.talla}
                      </div>
                      <div className="text-xs text-slate-500">
                        {item.material} · {item.taco}
                      </div>
                      <div className="break-words text-xs text-slate-500">{item.sku}</div>

                      {item.alertaStock === "SIN_STOCK" ? (
                        <div className="mt-2 inline-block rounded-lg bg-red-50 px-2 py-1 text-xs font-bold text-red-700">
                          SIN STOCK
                        </div>
                      ) : item.alertaStock === "ULTIMOS_PARES" ? (
                        <div className="mt-2 inline-block rounded-lg bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700">
                          ÚLTIMOS PARES
                        </div>
                      ) : null}
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="text-sm font-bold text-slate-900">
                        {formatMoney(item.precioUnitario)}
                      </div>
                      <div className="text-xs text-slate-500">Stock: {item.stock}</div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => changeQty(item.productoId, item.cantidad - 1)}
                        className="rounded-lg border border-slate-300 px-3 py-2 font-bold"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={item.stock}
                        value={item.cantidad}
                        onChange={(e) =>
                          changeQty(item.productoId, Number(e.target.value))
                        }
                        className="w-20 rounded-lg border border-slate-300 px-3 py-2 text-center text-sm"
                      />
                      <button
                        onClick={() => changeQty(item.productoId, item.cantidad + 1)}
                        className="rounded-lg border border-slate-300 px-3 py-2 font-bold"
                      >
                        +
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <div className="text-sm font-black text-slate-900">
                        {formatMoney(item.cantidad * item.precioUnitario)}
                      </div>
                      <button
                        onClick={() => removeCartItem(item.productoId)}
                        className="rounded-lg border border-red-300 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-5 space-y-3 rounded-2xl border border-slate-200 p-4">
            <textarea
              value={observacionVenta}
              onChange={(e) => setObservacionVenta(e.target.value)}
              placeholder="Observaciones de venta"
              className="min-h-[80px] w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                type="number"
                step="0.01"
                value={descuento}
                onChange={(e) => setDescuento(e.target.value)}
                placeholder="Descuento"
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
              />
              <input
                type="number"
                step="0.01"
                value={adelanto}
                onChange={(e) => setAdelanto(e.target.value)}
                placeholder="Adelanto"
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
              />
            </div>

            <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm">
              <div className="flex items-center justify-between">
                <span>Total productos</span>
                <b>{totales.totalProductos}</b>
              </div>
              <div className="flex items-center justify-between">
                <span>Subtotal sin IGV</span>
                <b>{formatMoney(totales.subtotalSinIgv)}</b>
              </div>
              <div className="flex items-center justify-between">
                <span>IGV</span>
                <b>{formatMoney(totales.igv)}</b>
              </div>
              <div className="flex items-center justify-between">
                <span>Total</span>
                <b>{formatMoney(totales.totalConIgv)}</b>
              </div>
              <div className="flex items-center justify-between">
                <span>Adelanto</span>
                <b>{formatMoney(adelanto)}</b>
              </div>
              <div className="flex items-center justify-between text-lg">
                <span>Saldo</span>
                <b className="text-blue-700">{formatMoney(totales.saldo)}</b>
              </div>
            </div>

            <button
              onClick={registrarVenta}
              disabled={procesando}
              className="w-full rounded-2xl bg-emerald-600 px-4 py-4 text-base font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              Registrar venta POS
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6">
        <div className="mb-4">
          <h2 className="text-xl font-black text-slate-900">Ventas registradas</h2>
          <p className="text-sm text-slate-500">
            Tabla con filtros, detalle, pagos, impresión y PDF térmico
          </p>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <input
            value={qVenta}
            onChange={(e) => setQVenta(e.target.value)}
            placeholder="Buscar venta, cliente, doc..."
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
          />
          <select
            value={estadoFiltro}
            onChange={(e) => setEstadoFiltro(e.target.value)}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
          >
            <option value="">Estado</option>
            <option value="PENDIENTE">PENDIENTE</option>
            <option value="PAGADO_PARCIAL">PAGADO_PARCIAL</option>
            <option value="PAGADO">PAGADO</option>
          </select>
          <select
            value={metodoFiltro}
            onChange={(e) => setMetodoFiltro(e.target.value)}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
          >
            <option value="">Método</option>
            <option value="EFECTIVO">EFECTIVO</option>
            <option value="YAPE">YAPE</option>
            <option value="PLIN">PLIN</option>
            <option value="TRANSFERENCIA">TRANSFERENCIA</option>
          </select>
          <select
            value={comprobanteFiltro}
            onChange={(e) => setComprobanteFiltro(e.target.value)}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
          >
            <option value="">Comprobante</option>
            <option value="NOTA_VENTA">NOTA_VENTA</option>
            <option value="BOLETA">BOLETA</option>
            <option value="FACTURA">FACTURA</option>
          </select>
          <input
            type="date"
            value={fechaDesdeFiltro}
            onChange={(e) => setFechaDesdeFiltro(e.target.value)}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
          />
          <input
            type="date"
            value={fechaHastaFiltro}
            onChange={(e) => setFechaHastaFiltro(e.target.value)}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
          />
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Cargando ventas...</p>
        ) : (
          <>
            <div className="hidden xl:block overflow-x-auto rounded-2xl border border-slate-200">
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
                      onClick={() => toggleSort("createdAt")}
                      className="cursor-pointer px-4 py-3 font-bold"
                    >
                      {sortLabel("Fecha", "createdAt")}
                    </th>
                    <th
                      onClick={() => toggleSort("tipoComprobante")}
                      className="cursor-pointer px-4 py-3 font-bold"
                    >
                      {sortLabel("Comprobante", "tipoComprobante")}
                    </th>
                    <th
                      onClick={() => toggleSort("cliente")}
                      className="cursor-pointer px-4 py-3 font-bold"
                    >
                      {sortLabel("Cliente", "cliente")}
                    </th>
                    <th
                      onClick={() => toggleSort("totalConIgv")}
                      className="cursor-pointer px-4 py-3 font-bold"
                    >
                      {sortLabel("Total", "totalConIgv")}
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
                      onClick={() => toggleSort("estado")}
                      className="cursor-pointer px-4 py-3 font-bold"
                    >
                      {sortLabel("Estado", "estado")}
                    </th>
                    <th className="px-4 py-3 font-bold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {ventasPagina.map((venta) => (
                    <tr key={venta.id} className="border-t border-slate-200 bg-white">
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {venta.codigo}
                      </td>
                      <td className="px-4 py-3">{formatDateTime(venta.createdAt)}</td>
                      <td className="px-4 py-3">
                        {(venta.tipoComprobante || "NOTA_VENTA")} {venta.serie || ""}-{venta.numero || ""}
                      </td>
                      <td className="px-4 py-3">{getVentaClienteNombre(venta)}</td>
                      <td className="px-4 py-3">{formatMoney(venta.totalConIgv)}</td>
                      <td className="px-4 py-3">{formatMoney(venta.adelanto)}</td>
                      <td className="px-4 py-3">{formatMoney(venta.saldo)}</td>
                      <td className="px-4 py-3">{badgeEstado(venta.estado)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => abrirDetalleVenta(venta.id)}
                            className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            Ver
                          </button>

                          <button
                            onClick={() => imprimirTicket(venta)}
                            className="rounded-lg border border-indigo-300 px-3 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                          >
                            Imprimir
                          </button>

                          <button
                            onClick={() => exportarTicketPdf(venta)}
                            className="rounded-lg border border-blue-300 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                          >
                            PDF
                          </button>

                          {Number(venta.saldo || 0) > 0 ? (
                            <button
                              onClick={() => {
                                setVentaPago(venta);
                                setMontoPago(String(Number(venta.saldo || 0)));
                                setMetodoPagoExtra("EFECTIVO");
                                setNotaPago("");
                                setModalPagoOpen(true);
                              }}
                              className="rounded-lg border border-emerald-300 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                            >
                              Registrar pago
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 xl:hidden">
              {ventasPagina.map((venta) => (
                <div
                  key={venta.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-black text-slate-900">{venta.codigo}</div>
                      <div className="truncate text-sm font-semibold text-slate-800">
                        {getVentaClienteNombre(venta)}
                      </div>
                      <div className="text-xs text-slate-500">
                        {(venta.tipoComprobante || "NOTA_VENTA")} {venta.serie || ""}-{venta.numero || ""}
                      </div>
                    </div>
                    {badgeEstado(venta.estado)}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                    <div>
                      <span className="font-semibold">Fecha:</span> {formatDate(venta.createdAt)}
                    </div>
                    <div>
                      <span className="font-semibold">Método:</span> {venta.metodoPago}
                    </div>
                    <div>
                      <span className="font-semibold">Total:</span> {formatMoney(venta.totalConIgv)}
                    </div>
                    <div>
                      <span className="font-semibold">Adelanto:</span> {formatMoney(venta.adelanto)}
                    </div>
                    <div className="col-span-2">
                      <span className="font-semibold">Saldo:</span> {formatMoney(venta.saldo)}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => abrirDetalleVenta(venta.id)}
                      className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Ver
                    </button>

                    <button
                      onClick={() => imprimirTicket(venta)}
                      className="rounded-xl border border-indigo-300 px-4 py-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
                    >
                      Imprimir
                    </button>

                    <button
                      onClick={() => exportarTicketPdf(venta)}
                      className="rounded-xl border border-blue-300 px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                    >
                      PDF
                    </button>

                    {Number(venta.saldo || 0) > 0 ? (
                      <button
                        onClick={() => {
                          setVentaPago(venta);
                          setMontoPago(String(Number(venta.saldo || 0)));
                          setMetodoPagoExtra("EFECTIVO");
                          setNotaPago("");
                          setModalPagoOpen(true);
                        }}
                        className="rounded-xl border border-emerald-300 px-4 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
                      >
                        Cobrar
                      </button>
                    ) : (
                      <div className="rounded-xl border border-slate-200 px-4 py-3 text-center text-sm text-slate-400">
                        Sin saldo
                      </div>
                    )}
                  </div>
                </div>
              ))}
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

              <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center">
                <button
                  disabled={pagina <= 1}
                  onClick={() => setPagina((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  ◀ Ant.
                </button>
                <div className="flex items-center justify-center rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                  {pagina} / {totalPaginas}
                </div>
                <button
                  disabled={pagina >= totalPaginas}
                  onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  Sig. ▶
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {detalleOpen && detalleVenta ? (
        <div className="fixed inset-0 z-50 bg-black/40 p-0 sm:flex sm:items-start sm:justify-center sm:p-4">
          <div className="flex h-dvh w-full flex-col bg-white shadow-xl sm:h-auto sm:max-h-[94vh] sm:max-w-5xl sm:rounded-3xl sm:p-6">
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white p-4 sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:pb-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-xl font-black text-slate-900">
                    Venta {detalleVenta.codigo}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {detalleVenta.tipoComprobante || "NOTA_VENTA"}{" "}
                    {detalleVenta.serie || ""}-{detalleVenta.numero || ""}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-2">
                  <button
                    onClick={() => imprimirTicket(detalleVenta)}
                    className="rounded-xl border border-indigo-300 px-4 py-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 sm:py-2"
                  >
                    Imprimir
                  </button>
                  <button
                    onClick={() => exportarTicketPdf(detalleVenta)}
                    className="rounded-xl border border-blue-300 px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-50 sm:py-2"
                  >
                    PDF
                  </button>
                  <button
                    onClick={() => setDetalleOpen(false)}
                    className="col-span-2 rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:col-span-1 sm:py-2"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-0">
              <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs font-semibold text-slate-500">Cliente</div>
                  <div className="mt-2 font-bold text-slate-900">
                    {getVentaClienteNombre(detalleVenta)}
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs font-semibold text-slate-500">Documento</div>
                  <div className="mt-2 font-bold text-slate-900 break-words">
                    {detalleVenta.docCliente || getClienteDocumento(detalleVenta.cliente)}
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs font-semibold text-slate-500">Total</div>
                  <div className="mt-2 text-xl font-black text-slate-900">
                    {formatMoney(detalleVenta.totalConIgv)}
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs font-semibold text-slate-500">Estado</div>
                  <div className="mt-2">{badgeEstado(detalleVenta.estado)}</div>
                </div>
              </div>

              <div className="mb-5 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-4 text-sm">
                  <div>
                    <b>Almacén:</b> {detalleVenta.almacen.codigo} -{" "}
                    {detalleVenta.almacen.nombre}
                  </div>
                  <div>
                    <b>Método pago:</b> {detalleVenta.metodoPago}
                  </div>
                  <div>
                    <b>Fecha venta:</b> {formatDateTime(detalleVenta.createdAt)}
                  </div>
                  <div>
                    <b>Fecha envío:</b> {formatDate(detalleVenta.fechaEnvio)}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4 text-sm">
                  <div>
                    <b>Subtotal:</b> {formatMoney(detalleVenta.subtotalSinIgv)}
                  </div>
                  <div>
                    <b>IGV:</b> {formatMoney(detalleVenta.igv)}
                  </div>
                  <div>
                    <b>Adelanto:</b> {formatMoney(detalleVenta.adelanto)}
                  </div>
                  <div>
                    <b>Saldo:</b> {formatMoney(detalleVenta.saldo)}
                  </div>
                </div>
              </div>

              <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-100 text-left text-slate-700">
                    <tr>
                      <th className="px-4 py-3 font-bold">Producto</th>
                      <th className="px-4 py-3 font-bold">SKU</th>
                      <th className="px-4 py-3 font-bold">Cantidad</th>
                      <th className="px-4 py-3 font-bold">Precio</th>
                      <th className="px-4 py-3 font-bold">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalleVenta.detalles.map((d) => (
                      <tr key={d.id} className="border-t border-slate-200 bg-white">
                        <td className="px-4 py-3">
                          {d.modelo} · {d.color} · T{d.talla}
                        </td>
                        <td className="px-4 py-3">{d.sku || "-"}</td>
                        <td className="px-4 py-3">{d.cantidad}</td>
                        <td className="px-4 py-3">{formatMoney(d.precioUnitario)}</td>
                        <td className="px-4 py-3">{formatMoney(d.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 md:hidden">
                {detalleVenta.detalles.map((d) => (
                  <div key={d.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="font-semibold text-slate-900">
                      {d.modelo} · {d.color} · T{d.talla}
                    </div>
                    <div className="mt-2 text-xs text-slate-500 break-words">
                      SKU: {d.sku || "-"}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-700">
                      <div>
                        <span className="font-semibold">Cantidad:</span> {d.cantidad}
                      </div>
                      <div>
                        <span className="font-semibold">Precio:</span> {formatMoney(d.precioUnitario)}
                      </div>
                      <div className="col-span-2">
                        <span className="font-semibold">Subtotal:</span> {formatMoney(d.subtotal)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {modalPagoOpen && ventaPago ? (
        <div className="fixed inset-0 z-50 bg-black/40 p-0 sm:flex sm:items-center sm:justify-center sm:p-4">
          <div className="flex h-dvh w-full flex-col bg-white shadow-xl sm:h-auto sm:max-w-lg sm:rounded-3xl sm:p-6">
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white p-4 sm:static sm:border-0 sm:bg-transparent sm:p-0">
              <h3 className="text-xl font-black text-slate-900">
                Registrar pago adicional
              </h3>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-0">
              <div className="mb-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                <div>
                  <b>Venta:</b> {ventaPago.codigo}
                </div>
                <div>
                  <b>Total:</b> {formatMoney(ventaPago.totalConIgv)}
                </div>
                <div>
                  <b>Adelanto:</b> {formatMoney(ventaPago.adelanto)}
                </div>
                <div>
                  <b>Saldo:</b> {formatMoney(ventaPago.saldo)}
                </div>
              </div>

              <div className="space-y-3">
                <input
                  type="number"
                  step="0.01"
                  value={montoPago}
                  onChange={(e) => setMontoPago(e.target.value)}
                  placeholder="Monto"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                />

                <select
                  value={metodoPagoExtra}
                  onChange={(e) => setMetodoPagoExtra(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                >
                  <option value="EFECTIVO">EFECTIVO</option>
                  <option value="YAPE">YAPE</option>
                  <option value="PLIN">PLIN</option>
                  <option value="TRANSFERENCIA">TRANSFERENCIA</option>
                </select>

                <textarea
                  value={notaPago}
                  onChange={(e) => setNotaPago(e.target.value)}
                  placeholder="Nota del pago"
                  className="min-h-[100px] w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                />
              </div>
            </div>

            <div className="border-t border-slate-200 p-4 sm:border-0 sm:p-0 sm:pt-5">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setModalPagoOpen(false)}
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  onClick={registrarPagoExtra}
                  disabled={procesando}
                  className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  Registrar pago
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}