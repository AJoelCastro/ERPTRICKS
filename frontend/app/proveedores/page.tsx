"use client";

import { useEffect, useMemo, useState } from "react";

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

type SortKeyProveedor =
  | "codigo"
  | "tipoProveedor"
  | "documento"
  | "nombre"
  | "telefono"
  | "estado"
  | "createdAt";

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

export default function ProveedoresPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState(false);

  const [q, setQ] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");

  const [sortKey, setSortKey] = useState<SortKeyProveedor>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [pagina, setPagina] = useState(1);
  const [filas, setFilas] = useState(10);

  const [modalNuevo, setModalNuevo] = useState(false);
  const [modalEditar, setModalEditar] = useState(false);

  const [proveedorEditando, setProveedorEditando] = useState<Proveedor | null>(
    null
  );

  const [tipoProveedor, setTipoProveedor] = useState<
    "PERSONA_NATURAL" | "PERSONA_JURIDICA"
  >("PERSONA_NATURAL");
  const [dni, setDni] = useState("");
  const [ruc, setRuc] = useState("");
  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [direccion, setDireccion] = useState("");
  const [contacto, setContacto] = useState("");

  async function cargarProveedores() {
    try {
      setLoading(true);
      const res = await fetch(`${apiUrl}/proveedores`);
      const data = await readJsonSafe(res);

      if (!res.ok || !data.ok) {
        alert(data.error || "No se pudo cargar proveedores");
        return;
      }

      setProveedores(data.data || []);
    } catch (error) {
      console.error(error);
      alert("Error cargando proveedores");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarProveedores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetFormulario() {
    setTipoProveedor("PERSONA_NATURAL");
    setDni("");
    setRuc("");
    setNombres("");
    setApellidos("");
    setRazonSocial("");
    setTelefono("");
    setEmail("");
    setDireccion("");
    setContacto("");
    setProveedorEditando(null);
  }

  function abrirNuevo() {
    resetFormulario();
    setModalNuevo(true);
  }

  function abrirEditar(proveedor: Proveedor) {
    setProveedorEditando(proveedor);
    setTipoProveedor(proveedor.tipoProveedor);
    setDni(proveedor.dni || "");
    setRuc(proveedor.ruc || "");
    setNombres(proveedor.nombres || "");
    setApellidos(proveedor.apellidos || "");
    setRazonSocial(proveedor.razonSocial || "");
    setTelefono(proveedor.telefono || "");
    setEmail(proveedor.email || "");
    setDireccion(proveedor.direccion || "");
    setContacto(proveedor.contacto || "");
    setModalEditar(true);
  }

  async function crearProveedor() {
    try {
      setProcesando(true);

      const res = await fetch(`${apiUrl}/proveedores`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tipoProveedor,
          dni: tipoProveedor === "PERSONA_NATURAL" ? dni || null : null,
          ruc: tipoProveedor === "PERSONA_JURIDICA" ? ruc || null : null,
          nombres:
            tipoProveedor === "PERSONA_NATURAL" ? nombres || null : null,
          apellidos:
            tipoProveedor === "PERSONA_NATURAL" ? apellidos || null : null,
          razonSocial:
            tipoProveedor === "PERSONA_JURIDICA" ? razonSocial || null : null,
          telefono: telefono || null,
          email: email || null,
          direccion: direccion || null,
          contacto: contacto || null,
        }),
      });

      const data = await readJsonSafe(res);

      if (!res.ok || !data.ok) {
        alert(data.error || "No se pudo crear proveedor");
        return;
      }

      await cargarProveedores();
      setModalNuevo(false);
      resetFormulario();
      alert("Proveedor creado correctamente");
    } catch (error) {
      console.error(error);
      alert("Error creando proveedor");
    } finally {
      setProcesando(false);
    }
  }

  async function guardarEdicion() {
    if (!proveedorEditando) return;

    try {
      setProcesando(true);

      const res = await fetch(`${apiUrl}/proveedores/${proveedorEditando.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tipoProveedor,
          dni: tipoProveedor === "PERSONA_NATURAL" ? dni || null : null,
          ruc: tipoProveedor === "PERSONA_JURIDICA" ? ruc || null : null,
          nombres:
            tipoProveedor === "PERSONA_NATURAL" ? nombres || null : null,
          apellidos:
            tipoProveedor === "PERSONA_NATURAL" ? apellidos || null : null,
          razonSocial:
            tipoProveedor === "PERSONA_JURIDICA" ? razonSocial || null : null,
          telefono: telefono || null,
          email: email || null,
          direccion: direccion || null,
          contacto: contacto || null,
        }),
      });

      const data = await readJsonSafe(res);

      if (!res.ok || !data.ok) {
        alert(data.error || "No se pudo actualizar proveedor");
        return;
      }

      await cargarProveedores();
      setModalEditar(false);
      resetFormulario();
      alert("Proveedor actualizado correctamente");
    } catch (error) {
      console.error(error);
      alert("Error actualizando proveedor");
    } finally {
      setProcesando(false);
    }
  }

  async function cambiarEstado(
    proveedor: Proveedor,
    estado: "ACTIVO" | "INACTIVO"
  ) {
    try {
      setProcesando(true);

      const res = await fetch(`${apiUrl}/proveedores/${proveedor.id}/estado`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ estado }),
      });

      const data = await readJsonSafe(res);

      if (!res.ok || !data.ok) {
        alert(data.error || "No se pudo cambiar estado");
        return;
      }

      await cargarProveedores();
    } catch (error) {
      console.error(error);
      alert("Error cambiando estado");
    } finally {
      setProcesando(false);
    }
  }

  const resumen = useMemo(() => {
    const total = proveedores.length;
    const activos = proveedores.filter((p) => p.estado === "ACTIVO").length;
    const inactivos = proveedores.filter((p) => p.estado === "INACTIVO").length;
    const naturales = proveedores.filter(
      (p) => p.tipoProveedor === "PERSONA_NATURAL"
    ).length;
    const juridicos = proveedores.filter(
      (p) => p.tipoProveedor === "PERSONA_JURIDICA"
    ).length;

    return {
      total,
      activos,
      inactivos,
      naturales,
      juridicos,
    };
  }, [proveedores]);

  const proveedoresFiltrados = useMemo(() => {
    const t = q.trim().toLowerCase();

    const filtrados = proveedores.filter((p) => {
      const matchQ =
        !t ||
        p.codigo.toLowerCase().includes(t) ||
        String(p.dni || "")
          .toLowerCase()
          .includes(t) ||
        String(p.ruc || "")
          .toLowerCase()
          .includes(t) ||
        String(p.nombres || "")
          .toLowerCase()
          .includes(t) ||
        String(p.apellidos || "")
          .toLowerCase()
          .includes(t) ||
        String(p.razonSocial || "")
          .toLowerCase()
          .includes(t) ||
        String(p.telefono || "")
          .toLowerCase()
          .includes(t) ||
        String(p.contacto || "")
          .toLowerCase()
          .includes(t);

      const matchTipo = !tipoFiltro || p.tipoProveedor === tipoFiltro;
      const matchEstado = !estadoFiltro || p.estado === estadoFiltro;

      return matchQ && matchTipo && matchEstado;
    });

    return [...filtrados].sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";

      switch (sortKey) {
        case "codigo":
          av = a.codigo;
          bv = b.codigo;
          break;
        case "tipoProveedor":
          av = a.tipoProveedor;
          bv = b.tipoProveedor;
          break;
        case "documento":
          av = getProveedorDocumento(a);
          bv = getProveedorDocumento(b);
          break;
        case "nombre":
          av = getProveedorNombre(a);
          bv = getProveedorNombre(b);
          break;
        case "telefono":
          av = a.telefono || "";
          bv = b.telefono || "";
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
  }, [proveedores, q, tipoFiltro, estadoFiltro, sortKey, sortDir]);

  const totalPaginas = Math.max(1, Math.ceil(proveedoresFiltrados.length / filas));
  const proveedoresPagina = useMemo(() => {
    const start = (pagina - 1) * filas;
    return proveedoresFiltrados.slice(start, start + filas);
  }, [proveedoresFiltrados, pagina, filas]);

  useEffect(() => {
    setPagina(1);
  }, [q, tipoFiltro, estadoFiltro, filas]);

  function toggleSort(key: SortKeyProveedor) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function sortLabel(label: string, key: SortKeyProveedor) {
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
        ? "bg-blue-100 text-blue-700"
        : "bg-violet-100 text-violet-700";

    return (
      <span className={`rounded-full px-3 py-1 text-xs font-bold ${styles}`}>
        {tipo === "PERSONA_JURIDICA" ? "JURÍDICA" : "NATURAL"}
      </span>
    );
  }

  function FormProveedor() {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            Tipo de proveedor
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setTipoProveedor("PERSONA_NATURAL")}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                tipoProveedor === "PERSONA_NATURAL"
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 text-slate-700"
              }`}
            >
              Persona natural
            </button>
            <button
              type="button"
              onClick={() => setTipoProveedor("PERSONA_JURIDICA")}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                tipoProveedor === "PERSONA_JURIDICA"
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 text-slate-700"
              }`}
            >
              Persona jurídica
            </button>
          </div>
        </div>

        {tipoProveedor === "PERSONA_NATURAL" ? (
          <>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                DNI
              </label>
              <input
                value={dni}
                onChange={(e) => setDni(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                placeholder="DNI"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Teléfono
              </label>
              <input
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                placeholder="Teléfono"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Nombres
              </label>
              <input
                value={nombres}
                onChange={(e) => setNombres(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                placeholder="Nombres"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Apellidos
              </label>
              <input
                value={apellidos}
                onChange={(e) => setApellidos(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                placeholder="Apellidos"
              />
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                RUC
              </label>
              <input
                value={ruc}
                onChange={(e) => setRuc(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                placeholder="RUC"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Teléfono
              </label>
              <input
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                placeholder="Teléfono"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Razón social
              </label>
              <input
                value={razonSocial}
                onChange={(e) => setRazonSocial(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                placeholder="Razón social"
              />
            </div>
          </>
        )}

        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            Email
          </label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
            placeholder="Email"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            Contacto
          </label>
          <input
            value={contacto}
            onChange={(e) => setContacto(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
            placeholder="Contacto"
          />
        </div>

        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            Dirección
          </label>
          <textarea
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            className="min-h-[90px] w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
            placeholder="Dirección"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Proveedores</h1>
            <p className="text-sm text-slate-500">
              Gestión completa de proveedores naturales y jurídicos
            </p>
          </div>

          <button
            onClick={abrirNuevo}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            + Nuevo proveedor
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="text-sm font-semibold text-slate-500">Total</div>
            <div className="mt-2 text-3xl font-black text-slate-900">
              {resumen.total}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="text-sm font-semibold text-slate-500">Activos</div>
            <div className="mt-2 text-3xl font-black text-emerald-700">
              {resumen.activos}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="text-sm font-semibold text-slate-500">Inactivos</div>
            <div className="mt-2 text-3xl font-black text-red-700">
              {resumen.inactivos}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="text-sm font-semibold text-slate-500">Naturales</div>
            <div className="mt-2 text-3xl font-black text-violet-700">
              {resumen.naturales}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="text-sm font-semibold text-slate-500">Jurídicos</div>
            <div className="mt-2 text-3xl font-black text-blue-700">
              {resumen.juridicos}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="text-xl font-black text-slate-900">
            Lista de proveedores
          </h2>
          <p className="text-sm text-slate-500">
            Buscador, filtros, ordenamiento y acciones rápidas
          </p>
        </div>

        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por código, DNI, RUC, nombre, razón social..."
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
          />

          <select
            value={tipoFiltro}
            onChange={(e) => setTipoFiltro(e.target.value)}
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
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Cargando proveedores...</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
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
                      onClick={() => toggleSort("tipoProveedor")}
                      className="cursor-pointer px-4 py-3 font-bold"
                    >
                      {sortLabel("Tipo", "tipoProveedor")}
                    </th>
                    <th
                      onClick={() => toggleSort("documento")}
                      className="cursor-pointer px-4 py-3 font-bold"
                    >
                      {sortLabel("Documento", "documento")}
                    </th>
                    <th
                      onClick={() => toggleSort("nombre")}
                      className="cursor-pointer px-4 py-3 font-bold"
                    >
                      {sortLabel("Nombre / Razón social", "nombre")}
                    </th>
                    <th
                      onClick={() => toggleSort("telefono")}
                      className="cursor-pointer px-4 py-3 font-bold"
                    >
                      {sortLabel("Teléfono", "telefono")}
                    </th>
                    <th
                      onClick={() => toggleSort("estado")}
                      className="cursor-pointer px-4 py-3 font-bold"
                    >
                      {sortLabel("Estado", "estado")}
                    </th>
                    <th
                      onClick={() => toggleSort("createdAt")}
                      className="cursor-pointer px-4 py-3 font-bold"
                    >
                      {sortLabel("Registro", "createdAt")}
                    </th>
                    <th className="px-4 py-3 font-bold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {proveedoresPagina.map((p) => (
                    <tr key={p.id} className="border-t border-slate-200 bg-white">
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {p.codigo}
                      </td>
                      <td className="px-4 py-3">{badgeTipo(p.tipoProveedor)}</td>
                      <td className="px-4 py-3">{getProveedorDocumento(p)}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">
                          {getProveedorNombre(p)}
                        </div>
                        <div className="text-xs text-slate-500">
                          {p.contacto || p.email || "-"}
                        </div>
                      </td>
                      <td className="px-4 py-3">{p.telefono || "-"}</td>
                      <td className="px-4 py-3">{badgeEstado(p.estado)}</td>
                      <td className="px-4 py-3">{formatDate(p.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => abrirEditar(p)}
                            className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            Editar
                          </button>

                          {p.estado === "ACTIVO" ? (
                            <button
                              disabled={procesando}
                              onClick={() => cambiarEstado(p, "INACTIVO")}
                              className="rounded-lg border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                            >
                              Inactivar
                            </button>
                          ) : (
                            <button
                              disabled={procesando}
                              onClick={() => cambiarEstado(p, "ACTIVO")}
                              className="rounded-lg border border-emerald-300 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                            >
                              Activar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}

                  {proveedoresPagina.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-10 text-center text-sm text-slate-500"
                      >
                        No hay proveedores para esos filtros.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
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

              <div className="flex items-center gap-2">
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

      {modalNuevo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-black text-slate-900">
                  Nuevo proveedor
                </h3>
                <p className="text-sm text-slate-500">
                  Registro de persona natural o jurídica
                </p>
              </div>

              <button
                onClick={() => setModalNuevo(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Cerrar
              </button>
            </div>

            <FormProveedor />

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setModalNuevo(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Cancelar
              </button>
              <button
                onClick={crearProveedor}
                disabled={procesando}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                Guardar proveedor
              </button>
            </div>
          </div>
        </div>
      )}

      {modalEditar && proveedorEditando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-black text-slate-900">
                  Editar proveedor
                </h3>
                <p className="text-sm text-slate-500">
                  {proveedorEditando.codigo} · {getProveedorNombre(proveedorEditando)}
                </p>
              </div>

              <button
                onClick={() => setModalEditar(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Cerrar
              </button>
            </div>

            <FormProveedor />

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setModalEditar(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Cancelar
              </button>
              <button
                onClick={guardarEdicion}
                disabled={procesando}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}