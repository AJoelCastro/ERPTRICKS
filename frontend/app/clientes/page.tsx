"use client";

import { useEffect, useMemo, useState } from "react";

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
  telefono: string;
  categoria: string;
  departamento?: string | null;
  ciudad?: string | null;
  distrito?: string | null;
  direccion?: string | null;
  agencia?: string | null;
  local?: string | null;
  estado: "ACTIVO" | "INACTIVO";
  createdAt: string;
  updatedAt: string;
};

type SortKey =
  | "codigo"
  | "tipoCliente"
  | "documento"
  | "nombre"
  | "telefono"
  | "categoria"
  | "ciudad"
  | "estado"
  | "createdAt";

type ClienteForm = {
  tipoCliente: "PERSONA_NATURAL" | "PERSONA_JURIDICA";
  dni: string;
  ruc: string;
  nombres: string;
  apellidos: string;
  razonSocial: string;
  telefono: string;
  categoria: string;
  departamento: string;
  ciudad: string;
  distrito: string;
  direccion: string;
  agencia: string;
  local: string;
};

const initialForm: ClienteForm = {
  tipoCliente: "PERSONA_NATURAL",
  dni: "",
  ruc: "",
  nombres: "",
  apellidos: "",
  razonSocial: "",
  telefono: "",
  categoria: "MINORISTA",
  departamento: "",
  ciudad: "",
  distrito: "",
  direccion: "",
  agencia: "",
  local: "",
};

async function readJsonSafe(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(text || "La respuesta del servidor no es JSON válido");
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

function getNombreCliente(c: Cliente) {
  if (c.tipoCliente === "PERSONA_JURIDICA") {
    return c.razonSocial || "-";
  }
  return `${c.nombres || ""} ${c.apellidos || ""}`.trim() || "-";
}

function getDocumentoCliente(c: Cliente) {
  return c.tipoCliente === "PERSONA_JURIDICA" ? c.ruc || "-" : c.dni || "-";
}

export default function ClientesPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState(false);

  const [q, setQ] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("");
  const [tipoClienteFiltro, setTipoClienteFiltro] = useState("");

  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [pagina, setPagina] = useState(1);
  const [filas, setFilas] = useState(10);

  const [modalCrear, setModalCrear] = useState(false);
  const [modalEditar, setModalEditar] = useState(false);
  const [detalleOpen, setDetalleOpen] = useState(false);

  const [form, setForm] = useState<ClienteForm>(initialForm);
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);
  const [clienteDetalle, setClienteDetalle] = useState<Cliente | null>(null);

  async function cargarClientes() {
    try {
      setLoading(true);

      const res = await fetch(`${apiUrl}/clientes`);
      const data = await readJsonSafe(res);

      if (!res.ok || !data.ok) {
        alert(data.error || "No se pudieron cargar los clientes");
        return;
      }

      setClientes(data.data || []);
    } catch (error) {
      console.error(error);
      alert("Error cargando clientes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarClientes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clientesFiltrados = useMemo(() => {
    const texto = q.trim().toLowerCase();

    const filtrados = clientes.filter((c) => {
      const matchQ =
        !texto ||
        c.codigo.toLowerCase().includes(texto) ||
        String(c.dni || "").toLowerCase().includes(texto) ||
        String(c.ruc || "").toLowerCase().includes(texto) ||
        String(c.nombres || "").toLowerCase().includes(texto) ||
        String(c.apellidos || "").toLowerCase().includes(texto) ||
        String(c.razonSocial || "").toLowerCase().includes(texto) ||
        String(c.telefono || "").toLowerCase().includes(texto) ||
        String(c.ciudad || "").toLowerCase().includes(texto) ||
        String(c.distrito || "").toLowerCase().includes(texto) ||
        String(c.direccion || "").toLowerCase().includes(texto) ||
        String(c.local || "").toLowerCase().includes(texto);

      const matchEstado = !estadoFiltro || c.estado === estadoFiltro;
      const matchCategoria = !categoriaFiltro || c.categoria === categoriaFiltro;
      const matchTipo = !tipoClienteFiltro || c.tipoCliente === tipoClienteFiltro;

      return matchQ && matchEstado && matchCategoria && matchTipo;
    });

    return [...filtrados].sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";

      switch (sortKey) {
        case "codigo":
          av = a.codigo;
          bv = b.codigo;
          break;
        case "tipoCliente":
          av = a.tipoCliente;
          bv = b.tipoCliente;
          break;
        case "documento":
          av = getDocumentoCliente(a);
          bv = getDocumentoCliente(b);
          break;
        case "nombre":
          av = getNombreCliente(a);
          bv = getNombreCliente(b);
          break;
        case "telefono":
          av = a.telefono;
          bv = b.telefono;
          break;
        case "categoria":
          av = a.categoria;
          bv = b.categoria;
          break;
        case "ciudad":
          av = a.ciudad || "";
          bv = b.ciudad || "";
          break;
        case "estado":
          av = a.estado;
          bv = b.estado;
          break;
        case "createdAt":
          av = new Date(a.createdAt).getTime();
          bv = new Date(b.createdAt).getTime();
          break;
      }

      if (typeof av === "string") av = av.toUpperCase();
      if (typeof bv === "string") bv = bv.toUpperCase();

      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [
    clientes,
    q,
    estadoFiltro,
    categoriaFiltro,
    tipoClienteFiltro,
    sortKey,
    sortDir,
  ]);

  const totalPaginas = Math.max(1, Math.ceil(clientesFiltrados.length / filas));

  const clientesPagina = useMemo(() => {
    const start = (pagina - 1) * filas;
    return clientesFiltrados.slice(start, start + filas);
  }, [clientesFiltrados, pagina, filas]);

  useEffect(() => {
    setPagina(1);
  }, [q, estadoFiltro, categoriaFiltro, tipoClienteFiltro, filas]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function labelSort(label: string, key: SortKey) {
    if (sortKey !== key) return `${label} ↕`;
    return `${label} ${sortDir === "asc" ? "▲" : "▼"}`;
  }

  function badgeEstado(estado: string) {
    const styles =
      estado === "ACTIVO"
        ? "bg-emerald-100 text-emerald-700"
        : "bg-red-100 text-red-700";

    return (
      <span className={`rounded-full px-3 py-1 text-xs font-bold ${styles}`}>
        {estado}
      </span>
    );
  }

  function badgeTipo(tipo: string) {
    const styles =
      tipo === "PERSONA_JURIDICA"
        ? "bg-violet-100 text-violet-700"
        : "bg-sky-100 text-sky-700";

    return (
      <span className={`rounded-full px-3 py-1 text-xs font-bold ${styles}`}>
        {tipo === "PERSONA_JURIDICA" ? "PERSONA_JURIDICA" : "PERSONA_NATURAL"}
      </span>
    );
  }

  function resetForm() {
    setForm(initialForm);
  }

  function openCrear() {
    resetForm();
    setModalCrear(true);
  }

  function openEditar(cliente: Cliente) {
    setClienteEditando(cliente);
    setForm({
      tipoCliente: cliente.tipoCliente,
      dni: cliente.dni || "",
      ruc: cliente.ruc || "",
      nombres: cliente.nombres || "",
      apellidos: cliente.apellidos || "",
      razonSocial: cliente.razonSocial || "",
      telefono: cliente.telefono || "",
      categoria: cliente.categoria || "MINORISTA",
      departamento: cliente.departamento || "",
      ciudad: cliente.ciudad || "",
      distrito: cliente.distrito || "",
      direccion: cliente.direccion || "",
      agencia: cliente.agencia || "",
      local: cliente.local || "",
    });
    setModalEditar(true);
  }

  function openDetalle(cliente: Cliente) {
    setClienteDetalle(cliente);
    setDetalleOpen(true);
  }

  async function crearCliente() {
    try {
      setProcesando(true);

      const res = await fetch(`${apiUrl}/clientes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await readJsonSafe(res);

      if (!res.ok || !data.ok) {
        alert(data.error || "No se pudo crear el cliente");
        return;
      }

      await cargarClientes();
      setModalCrear(false);
      resetForm();
      alert("Cliente creado correctamente");
    } catch (error) {
      console.error(error);
      alert("Error creando cliente");
    } finally {
      setProcesando(false);
    }
  }

  async function guardarEdicion() {
    if (!clienteEditando) return;

    try {
      setProcesando(true);

      const res = await fetch(`${apiUrl}/clientes/${clienteEditando.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await readJsonSafe(res);

      if (!res.ok || !data.ok) {
        alert(data.error || "No se pudo actualizar el cliente");
        return;
      }

      await cargarClientes();
      setModalEditar(false);
      setClienteEditando(null);
      resetForm();
      alert("Cliente actualizado correctamente");
    } catch (error) {
      console.error(error);
      alert("Error actualizando cliente");
    } finally {
      setProcesando(false);
    }
  }

  async function cambiarEstado(cliente: Cliente, estado: "ACTIVO" | "INACTIVO") {
    try {
      setProcesando(true);

      const res = await fetch(`${apiUrl}/clientes/${cliente.id}/estado`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ estado }),
      });

      const data = await readJsonSafe(res);

      if (!res.ok || !data.ok) {
        alert(data.error || "No se pudo cambiar el estado");
        return;
      }

      await cargarClientes();
      alert(`Cliente ${estado === "ACTIVO" ? "activado" : "inactivado"} correctamente`);
    } catch (error) {
      console.error(error);
      alert("Error cambiando estado");
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <section className="rounded-2xl bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-black text-slate-900 sm:text-2xl">Clientes</h1>
            <p className="text-sm text-slate-500">
              Gestión completa de clientes naturales y jurídicos
            </p>
          </div>

          <button
            onClick={openCrear}
            className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 sm:w-auto sm:py-2"
          >
            + Nuevo cliente
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
            <div className="text-sm font-semibold text-slate-500">Total clientes</div>
            <div className="mt-2 text-2xl font-black text-slate-900 sm:text-3xl">
              {clientes.length}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
            <div className="text-sm font-semibold text-slate-500">Activos</div>
            <div className="mt-2 text-2xl font-black text-emerald-700 sm:text-3xl">
              {clientes.filter((c) => c.estado === "ACTIVO").length}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
            <div className="text-sm font-semibold text-slate-500">Inactivos</div>
            <div className="mt-2 text-2xl font-black text-red-700 sm:text-3xl">
              {clientes.filter((c) => c.estado === "INACTIVO").length}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
            <div className="text-sm font-semibold text-slate-500">Persona natural</div>
            <div className="mt-2 text-2xl font-black text-sky-700 sm:text-3xl">
              {clientes.filter((c) => c.tipoCliente === "PERSONA_NATURAL").length}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
            <div className="text-sm font-semibold text-slate-500">Persona jurídica</div>
            <div className="mt-2 text-2xl font-black text-violet-700 sm:text-3xl">
              {clientes.filter((c) => c.tipoCliente === "PERSONA_JURIDICA").length}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6">
        <div className="mb-4">
          <h2 className="text-lg font-black text-slate-900 sm:text-xl">Tabla de clientes</h2>
          <p className="text-sm text-slate-500">
            Buscador, filtros, ordenamiento, paginación y acciones
          </p>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por código, DNI, RUC, nombre, razón social..."
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
          />

          <select
            value={tipoClienteFiltro}
            onChange={(e) => setTipoClienteFiltro(e.target.value)}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
          >
            <option value="">Todos los tipos</option>
            <option value="PERSONA_NATURAL">PERSONA_NATURAL</option>
            <option value="PERSONA_JURIDICA">PERSONA_JURIDICA</option>
          </select>

          <select
            value={estadoFiltro}
            onChange={(e) => setEstadoFiltro(e.target.value)}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
          >
            <option value="">Todos los estados</option>
            <option value="ACTIVO">ACTIVO</option>
            <option value="INACTIVO">INACTIVO</option>
          </select>

          <select
            value={categoriaFiltro}
            onChange={(e) => setCategoriaFiltro(e.target.value)}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
          >
            <option value="">Todas las categorías</option>
            <option value="MINORISTA">MINORISTA</option>
            <option value="MAYORISTA">MAYORISTA</option>
          </select>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Cargando clientes...</p>
        ) : (
          <>
            <div className="hidden xl:block overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100 text-left text-slate-700">
                  <tr>
                    <th onClick={() => toggleSort("codigo")} className="cursor-pointer px-4 py-3 font-bold">
                      {labelSort("Código", "codigo")}
                    </th>
                    <th onClick={() => toggleSort("tipoCliente")} className="cursor-pointer px-4 py-3 font-bold">
                      {labelSort("Tipo", "tipoCliente")}
                    </th>
                    <th onClick={() => toggleSort("documento")} className="cursor-pointer px-4 py-3 font-bold">
                      {labelSort("Documento", "documento")}
                    </th>
                    <th onClick={() => toggleSort("nombre")} className="cursor-pointer px-4 py-3 font-bold">
                      {labelSort("Nombre / Razón social", "nombre")}
                    </th>
                    <th onClick={() => toggleSort("telefono")} className="cursor-pointer px-4 py-3 font-bold">
                      {labelSort("Teléfono", "telefono")}
                    </th>
                    <th onClick={() => toggleSort("categoria")} className="cursor-pointer px-4 py-3 font-bold">
                      {labelSort("Categoría", "categoria")}
                    </th>
                    <th onClick={() => toggleSort("ciudad")} className="cursor-pointer px-4 py-3 font-bold">
                      {labelSort("Ciudad", "ciudad")}
                    </th>
                    <th onClick={() => toggleSort("estado")} className="cursor-pointer px-4 py-3 font-bold">
                      {labelSort("Estado", "estado")}
                    </th>
                    <th className="px-4 py-3 font-bold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {clientesPagina.map((cliente) => (
                    <tr key={cliente.id} className="border-t border-slate-200 bg-white">
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {cliente.codigo}
                      </td>
                      <td className="px-4 py-3">{badgeTipo(cliente.tipoCliente)}</td>
                      <td className="px-4 py-3">{getDocumentoCliente(cliente)}</td>
                      <td className="px-4 py-3">{getNombreCliente(cliente)}</td>
                      <td className="px-4 py-3">{cliente.telefono}</td>
                      <td className="px-4 py-3">{cliente.categoria}</td>
                      <td className="px-4 py-3">{cliente.ciudad || "-"}</td>
                      <td className="px-4 py-3">{badgeEstado(cliente.estado)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => openDetalle(cliente)}
                            className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            Ver
                          </button>

                          <button
                            onClick={() => openEditar(cliente)}
                            className="rounded-lg border border-blue-300 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                          >
                            Editar
                          </button>

                          {cliente.estado === "ACTIVO" ? (
                            <button
                              onClick={() => cambiarEstado(cliente, "INACTIVO")}
                              className="rounded-lg border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                            >
                              Inactivar
                            </button>
                          ) : (
                            <button
                              onClick={() => cambiarEstado(cliente, "ACTIVO")}
                              className="rounded-lg border border-emerald-300 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                            >
                              Activar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 xl:hidden">
              {clientesPagina.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
                  No hay clientes para esos filtros.
                </div>
              ) : (
                clientesPagina.map((cliente) => (
                  <div
                    key={cliente.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-black text-slate-900">{cliente.codigo}</div>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {badgeTipo(cliente.tipoCliente)}
                          {badgeEstado(cliente.estado)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 space-y-2 text-sm text-slate-700">
                      <div>
                        <span className="font-semibold">Nombre:</span>{" "}
                        {getNombreCliente(cliente)}
                      </div>
                      <div>
                        <span className="font-semibold">Documento:</span>{" "}
                        {getDocumentoCliente(cliente)}
                      </div>
                      <div>
                        <span className="font-semibold">Teléfono:</span>{" "}
                        {cliente.telefono || "-"}
                      </div>
                      <div>
                        <span className="font-semibold">Categoría:</span>{" "}
                        {cliente.categoria}
                      </div>
                      <div>
                        <span className="font-semibold">Ciudad:</span>{" "}
                        {cliente.ciudad || "-"}
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <button
                        onClick={() => openDetalle(cliente)}
                        className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        Ver
                      </button>

                      <button
                        onClick={() => openEditar(cliente)}
                        className="rounded-xl border border-blue-300 px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                      >
                        Editar
                      </button>

                      {cliente.estado === "ACTIVO" ? (
                        <button
                          onClick={() => cambiarEstado(cliente, "INACTIVO")}
                          className="rounded-xl border border-red-300 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-50"
                        >
                          Inactivar
                        </button>
                      ) : (
                        <button
                          onClick={() => cambiarEstado(cliente, "ACTIVO")}
                          className="rounded-xl border border-emerald-300 px-4 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
                        >
                          Activar
                        </button>
                      )}
                    </div>
                  </div>
                ))
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

      {(modalCrear || modalEditar) && (
        <div className="fixed inset-0 z-50 bg-black/40 p-0 sm:flex sm:items-center sm:justify-center sm:p-4">
          <div className="flex h-dvh w-full flex-col bg-white shadow-xl sm:h-auto sm:max-h-[92vh] sm:max-w-4xl sm:rounded-3xl">
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white p-4 sm:static sm:rounded-t-3xl sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-xl font-black text-slate-900">
                  {modalCrear ? "Nuevo cliente" : "Editar cliente"}
                </h3>

                <button
                  onClick={() => {
                    setModalCrear(false);
                    setModalEditar(false);
                    setClienteEditando(null);
                    resetForm();
                  }}
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 sm:py-2"
                >
                  Cerrar
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() =>
                    setForm({
                      ...form,
                      tipoCliente: "PERSONA_NATURAL",
                      ruc: "",
                      razonSocial: "",
                    })
                  }
                  className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
                    form.tipoCliente === "PERSONA_NATURAL"
                      ? "border-sky-500 bg-sky-50 text-sky-700"
                      : "border-slate-300 text-slate-700"
                  }`}
                >
                  PERSONA_NATURAL
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setForm({
                      ...form,
                      tipoCliente: "PERSONA_JURIDICA",
                      dni: "",
                      nombres: "",
                      apellidos: "",
                    })
                  }
                  className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
                    form.tipoCliente === "PERSONA_JURIDICA"
                      ? "border-violet-500 bg-violet-50 text-violet-700"
                      : "border-slate-300 text-slate-700"
                  }`}
                >
                  PERSONA_JURIDICA
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {form.tipoCliente === "PERSONA_NATURAL" ? (
                  <>
                    <input
                      value={form.dni}
                      onChange={(e) => setForm({ ...form, dni: e.target.value })}
                      placeholder="DNI"
                      className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
                    />
                    <input
                      value={form.nombres}
                      onChange={(e) => setForm({ ...form, nombres: e.target.value })}
                      placeholder="Nombres"
                      className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
                    />
                    <input
                      value={form.apellidos}
                      onChange={(e) => setForm({ ...form, apellidos: e.target.value })}
                      placeholder="Apellidos"
                      className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
                    />
                  </>
                ) : (
                  <>
                    <input
                      value={form.ruc}
                      onChange={(e) => setForm({ ...form, ruc: e.target.value })}
                      placeholder="RUC"
                      className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
                    />
                    <input
                      value={form.razonSocial}
                      onChange={(e) =>
                        setForm({ ...form, razonSocial: e.target.value })
                      }
                      placeholder="Razón social"
                      className="rounded-xl border border-slate-300 px-4 py-3 text-sm md:col-span-2"
                    />
                  </>
                )}

                <input
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                  placeholder="Teléfono"
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
                />

                <select
                  value={form.categoria}
                  onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
                >
                  <option value="MINORISTA">MINORISTA</option>
                  <option value="MAYORISTA">MAYORISTA</option>
                </select>

                <input
                  value={form.departamento}
                  onChange={(e) => setForm({ ...form, departamento: e.target.value })}
                  placeholder="Departamento"
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
                />
                <input
                  value={form.ciudad}
                  onChange={(e) => setForm({ ...form, ciudad: e.target.value })}
                  placeholder="Ciudad"
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
                />
                <input
                  value={form.distrito}
                  onChange={(e) => setForm({ ...form, distrito: e.target.value })}
                  placeholder="Distrito"
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
                />
                <input
                  value={form.agencia}
                  onChange={(e) => setForm({ ...form, agencia: e.target.value })}
                  placeholder="Agencia"
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
                />
                <input
                  value={form.local}
                  onChange={(e) => setForm({ ...form, local: e.target.value })}
                  placeholder="Local"
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
                />
                <textarea
                  value={form.direccion}
                  onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                  placeholder="Dirección"
                  className="min-h-[100px] rounded-xl border border-slate-300 px-4 py-3 text-sm md:col-span-2 xl:col-span-3"
                />
              </div>
            </div>

            <div className="border-t border-slate-200 p-4 sm:rounded-b-3xl sm:p-6">
              <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                <button
                  onClick={() => {
                    setModalCrear(false);
                    setModalEditar(false);
                    setClienteEditando(null);
                    resetForm();
                  }}
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
                >
                  Cancelar
                </button>

                <button
                  onClick={modalCrear ? crearCliente : guardarEdicion}
                  disabled={procesando}
                  className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {modalCrear ? "Crear cliente" : "Guardar cambios"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {detalleOpen && clienteDetalle && (
        <div className="fixed inset-0 z-50 bg-black/40 p-0 sm:flex sm:items-center sm:justify-center sm:p-4">
          <div className="flex h-dvh w-full flex-col bg-white shadow-xl sm:h-auto sm:max-h-[92vh] sm:max-w-3xl sm:rounded-3xl">
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white p-4 sm:static sm:rounded-t-3xl sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-xl font-black text-slate-900">
                    Detalle de cliente
                  </h3>
                  <p className="text-sm text-slate-500">{clienteDetalle.codigo}</p>
                </div>

                <button
                  onClick={() => setDetalleOpen(false)}
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 sm:py-2"
                >
                  Cerrar
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-4 text-sm">
                  <div><b>Código:</b> {clienteDetalle.codigo}</div>
                  <div className="mt-2 flex items-center gap-2">
                    <b>Tipo:</b> {badgeTipo(clienteDetalle.tipoCliente)}
                  </div>
                  <div><b>Documento:</b> {getDocumentoCliente(clienteDetalle)}</div>
                  <div><b>Nombre:</b> {getNombreCliente(clienteDetalle)}</div>
                  <div><b>Teléfono:</b> {clienteDetalle.telefono}</div>
                  <div><b>Categoría:</b> {clienteDetalle.categoria}</div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4 text-sm">
                  <div><b>Departamento:</b> {clienteDetalle.departamento || "-"}</div>
                  <div><b>Ciudad:</b> {clienteDetalle.ciudad || "-"}</div>
                  <div><b>Distrito:</b> {clienteDetalle.distrito || "-"}</div>
                  <div><b>Dirección:</b> {clienteDetalle.direccion || "-"}</div>
                  <div><b>Agencia:</b> {clienteDetalle.agencia || "-"}</div>
                  <div><b>Local:</b> {clienteDetalle.local || "-"}</div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4 text-sm">
                  <div className="flex items-center gap-2">
                    <b>Estado:</b> {badgeEstado(clienteDetalle.estado)}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4 text-sm">
                  <div><b>Creado:</b> {formatDateTime(clienteDetalle.createdAt)}</div>
                  <div><b>Actualizado:</b> {formatDateTime(clienteDetalle.updatedAt)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}