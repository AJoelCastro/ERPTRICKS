"use client";

import { useEffect, useMemo, useState } from "react";

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

type FormProducto = {
  modelo: string;
  color: string;
  material: string;
  taco: string;
  coleccion: string;
  talla: string;
  tallaDesde: string;
  tallaHasta: string;
  costo: string;
  precio: string;
};

type SortKey =
  | "codigo"
  | "modelo"
  | "color"
  | "material"
  | "taco"
  | "coleccion"
  | "talla"
  | "costo"
  | "precio"
  | "estado";

const initialForm: FormProducto = {
  modelo: "",
  color: "",
  material: "",
  taco: "",
  coleccion: "",
  talla: "",
  tallaDesde: "34",
  tallaHasta: "42",
  costo: "",
  precio: "",
};

async function readJsonSafe(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(text || "La respuesta del servidor no es JSON válido");
  }
}

export default function ProductosPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [filasPorPagina, setFilasPorPagina] = useState(10);
  const [paginaActual, setPaginaActual] = useState(1);

  const [sortKey, setSortKey] = useState<SortKey>("codigo");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const [modalOpen, setModalOpen] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [productoEditandoId, setProductoEditandoId] = useState<string | null>(
    null
  );
  const [form, setForm] = useState<FormProducto>(initialForm);
  const [guardando, setGuardando] = useState(false);
  const [crearMasivo, setCrearMasivo] = useState(true);

  async function cargarProductos() {
    try {
      setLoading(true);
      const res = await fetch(`${apiUrl}/productos`);
      const data = await readJsonSafe(res);
      setProductos(data.data || []);
    } catch (error) {
      console.error("Error cargando productos:", error);
      alert("No se pudieron cargar los productos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarProductos();
  }, [apiUrl]);

  const productosFiltrados = useMemo(() => {
    const filtrados = productos.filter((p) => {
      const texto = q.toLowerCase();

      const matchQ =
        !q ||
        p.codigo.toLowerCase().includes(texto) ||
        p.modelo.toLowerCase().includes(texto) ||
        p.color.toLowerCase().includes(texto) ||
        p.material.toLowerCase().includes(texto) ||
        p.taco.toLowerCase().includes(texto) ||
        (p.coleccion || "").toLowerCase().includes(texto) ||
        String(p.talla).includes(texto);

      const matchEstado =
        !estadoFiltro || p.estado.toUpperCase() === estadoFiltro.toUpperCase();

      return matchQ && matchEstado;
    });

    const sorted = [...filtrados].sort((a, b) => {
      let av: string | number = a[sortKey] as string | number;
      let bv: string | number = b[sortKey] as string | number;

      if (sortKey === "talla") {
        av = Number(a.talla);
        bv = Number(b.talla);
      }

      if (sortKey === "costo" || sortKey === "precio") {
        av = Number(a[sortKey]);
        bv = Number(b[sortKey]);
      }

      if (typeof av === "string") av = av.toUpperCase();
      if (typeof bv === "string") bv = bv.toUpperCase();

      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [productos, q, estadoFiltro, sortKey, sortDir]);

  const totalPaginas = Math.max(
    1,
    Math.ceil(productosFiltrados.length / filasPorPagina)
  );

  const productosPagina = useMemo(() => {
    const start = (paginaActual - 1) * filasPorPagina;
    const end = start + filasPorPagina;
    return productosFiltrados.slice(start, end);
  }, [productosFiltrados, paginaActual, filasPorPagina]);

  useEffect(() => {
    setPaginaActual(1);
  }, [q, estadoFiltro, filasPorPagina]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function sortLabel(label: string, key: SortKey) {
    if (sortKey !== key) return `${label} ↕`;
    return `${label} ${sortDir === "asc" ? "▲" : "▼"}`;
  }

  function abrirModalNuevo() {
    setModoEdicion(false);
    setProductoEditandoId(null);
    setForm(initialForm);
    setCrearMasivo(true);
    setModalOpen(true);
  }

  function abrirModalEditar(producto: Producto) {
    setModoEdicion(true);
    setProductoEditandoId(producto.id);
    setCrearMasivo(false);
    setForm({
      modelo: producto.modelo || "",
      color: producto.color || "",
      material: producto.material || "",
      taco: producto.taco || "",
      coleccion: producto.coleccion || "",
      talla: String(producto.talla ?? ""),
      tallaDesde: "34",
      tallaHasta: "42",
      costo: String(producto.costo ?? ""),
      precio: String(producto.precio ?? ""),
    });
    setModalOpen(true);
  }

  function cerrarModal() {
    if (guardando) return;
    setModalOpen(false);
    setModoEdicion(false);
    setProductoEditandoId(null);
    setForm(initialForm);
    setCrearMasivo(true);
  }

  function updateForm<K extends keyof FormProducto>(key: K, value: FormProducto[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function guardarProducto(e: React.FormEvent) {
    e.preventDefault();

    try {
      setGuardando(true);

      let payload: Record<string, unknown> = {
        modelo: form.modelo,
        color: form.color,
        material: form.material,
        taco: form.taco,
        coleccion: form.coleccion || null,
        costo: Number(form.costo),
        precio: Number(form.precio),
      };

      if (modoEdicion) {
        payload = {
          ...payload,
          talla: Number(form.talla),
        };
      } else {
        if (crearMasivo) {
          payload = {
            ...payload,
            tallaDesde: Number(form.tallaDesde),
            tallaHasta: Number(form.tallaHasta),
          };
        } else {
          payload = {
            ...payload,
            talla: Number(form.talla),
          };
        }
      }

      const url =
        modoEdicion && productoEditandoId
          ? `${apiUrl}/productos/${productoEditandoId}`
          : `${apiUrl}/productos`;

      const method = modoEdicion ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await readJsonSafe(res);

      if (!res.ok || !data.ok) {
        alert(data.error || "No se pudo guardar el producto");
        return;
      }

      await cargarProductos();
      cerrarModal();
    } catch (error: unknown) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "Ocurrió un error al guardar el producto"
      );
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarEstado(
    producto: Producto,
    nuevoEstado: "ACTIVO" | "INACTIVO"
  ) {
    const ok = window.confirm(
      `¿Seguro que deseas marcar este producto como ${nuevoEstado}?`
    );
    if (!ok) return;

    try {
      const res = await fetch(`${apiUrl}/productos/${producto.id}/estado`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          estado: nuevoEstado,
        }),
      });

      const data = await readJsonSafe(res);

      if (!res.ok || !data.ok) {
        alert(data.error || "No se pudo cambiar el estado");
        return;
      }

      await cargarProductos();
    } catch (error: unknown) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "Ocurrió un error al cambiar el estado"
      );
    }
  }

  function badgeEstado(estado: string) {
    const isActivo = estado === "ACTIVO";

    return (
      <span
        className={`rounded-full px-3 py-1 text-xs font-bold ${
          isActivo
            ? "bg-emerald-100 text-emerald-700"
            : "bg-red-100 text-red-700"
        }`}
      >
        {estado}
      </span>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Productos</h1>
            <p className="text-sm text-slate-500">
              Catálogo completo de productos del sistema
            </p>
          </div>

          <button
            onClick={abrirModalNuevo}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            + Nuevo producto
          </button>
        </div>

        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por código, modelo, color, material..."
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
          />

          <select
            value={estadoFiltro}
            onChange={(e) => setEstadoFiltro(e.target.value)}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
          >
            <option value="">Todos los estados</option>
            <option value="ACTIVO">ACTIVO</option>
            <option value="INACTIVO">INACTIVO</option>
          </select>

          <div className="flex items-center justify-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <span className="font-semibold">Total filtrado:</span>
            <span>{productosFiltrados.length}</span>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Cargando productos...</p>
        ) : productosFiltrados.length === 0 ? (
          <p className="text-sm text-slate-500">No hay productos registrados.</p>
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
                      onClick={() => toggleSort("modelo")}
                      className="cursor-pointer px-4 py-3 font-bold"
                    >
                      {sortLabel("Modelo", "modelo")}
                    </th>
                    <th
                      onClick={() => toggleSort("color")}
                      className="cursor-pointer px-4 py-3 font-bold"
                    >
                      {sortLabel("Color", "color")}
                    </th>
                    <th
                      onClick={() => toggleSort("material")}
                      className="cursor-pointer px-4 py-3 font-bold"
                    >
                      {sortLabel("Material", "material")}
                    </th>
                    <th
                      onClick={() => toggleSort("taco")}
                      className="cursor-pointer px-4 py-3 font-bold"
                    >
                      {sortLabel("Taco", "taco")}
                    </th>
                    <th
                      onClick={() => toggleSort("coleccion")}
                      className="cursor-pointer px-4 py-3 font-bold"
                    >
                      {sortLabel("Colección", "coleccion")}
                    </th>
                    <th
                      onClick={() => toggleSort("talla")}
                      className="cursor-pointer px-4 py-3 font-bold"
                    >
                      {sortLabel("Talla", "talla")}
                    </th>
                    <th
                      onClick={() => toggleSort("costo")}
                      className="cursor-pointer px-4 py-3 font-bold"
                    >
                      {sortLabel("Costo", "costo")}
                    </th>
                    <th
                      onClick={() => toggleSort("precio")}
                      className="cursor-pointer px-4 py-3 font-bold"
                    >
                      {sortLabel("Precio", "precio")}
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
                  {productosPagina.map((producto) => (
                    <tr
                      key={producto.id}
                      className="border-t border-slate-200 bg-white hover:bg-slate-50"
                    >
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {producto.codigo}
                      </td>
                      <td className="px-4 py-3">{producto.modelo}</td>
                      <td className="px-4 py-3">{producto.color}</td>
                      <td className="px-4 py-3">{producto.material}</td>
                      <td className="px-4 py-3">{producto.taco}</td>
                      <td className="px-4 py-3">{producto.coleccion || "-"}</td>
                      <td className="px-4 py-3">{producto.talla}</td>
                      <td className="px-4 py-3">S/ {producto.costo}</td>
                      <td className="px-4 py-3">S/ {producto.precio}</td>
                      <td className="px-4 py-3">{badgeEstado(producto.estado)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => abrirModalEditar(producto)}
                            className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            Editar
                          </button>

                          {producto.estado === "ACTIVO" ? (
                            <button
                              onClick={() => cambiarEstado(producto, "INACTIVO")}
                              className="rounded-lg border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                            >
                              Inactivar
                            </button>
                          ) : (
                            <button
                              onClick={() => cambiarEstado(producto, "ACTIVO")}
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
                  onClick={() =>
                    setPaginaActual((p) => Math.min(totalPaginas, p + 1))
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

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-4xl rounded-3xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-900">
                  {modoEdicion ? "Editar producto" : "Nuevo producto"}
                </h2>
                <p className="text-sm text-slate-500">
                  {modoEdicion
                    ? "Editar una talla específica"
                    : "Crear un producto individual o varias tallas en masivo"}
                </p>
              </div>

              <button
                onClick={cerrarModal}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Cerrar
              </button>
            </div>

            <form onSubmit={guardarProducto} className="space-y-4">
              {!modoEdicion && (
                <div className="flex flex-wrap gap-4 rounded-2xl bg-slate-50 p-4">
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input
                      type="radio"
                      checked={crearMasivo}
                      onChange={() => setCrearMasivo(true)}
                    />
                    Crear por rango de tallas
                  </label>

                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input
                      type="radio"
                      checked={!crearMasivo}
                      onChange={() => setCrearMasivo(false)}
                    />
                    Crear una sola talla
                  </label>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-3">
                <input
                  value={form.modelo}
                  onChange={(e) => updateForm("modelo", e.target.value)}
                  placeholder="Modelo"
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                  required
                />
                <input
                  value={form.color}
                  onChange={(e) => updateForm("color", e.target.value)}
                  placeholder="Color"
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                  required
                />
                <input
                  value={form.material}
                  onChange={(e) => updateForm("material", e.target.value)}
                  placeholder="Material"
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                  required
                />

                <input
                  value={form.taco}
                  onChange={(e) => updateForm("taco", e.target.value)}
                  placeholder="Taco"
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                  required
                />
                <input
                  value={form.coleccion}
                  onChange={(e) => updateForm("coleccion", e.target.value)}
                  placeholder="Colección"
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                />
                <input
                  type="number"
                  step="0.01"
                  value={form.costo}
                  onChange={(e) => updateForm("costo", e.target.value)}
                  placeholder="Costo"
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                  required
                />

                <input
                  type="number"
                  step="0.01"
                  value={form.precio}
                  onChange={(e) => updateForm("precio", e.target.value)}
                  placeholder="Precio"
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                  required
                />

                {modoEdicion ? (
                  <input
                    type="number"
                    value={form.talla}
                    onChange={(e) => updateForm("talla", e.target.value)}
                    placeholder="Talla"
                    className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                    required
                  />
                ) : crearMasivo ? (
                  <>
                    <input
                      type="number"
                      value={form.tallaDesde}
                      onChange={(e) => updateForm("tallaDesde", e.target.value)}
                      placeholder="Talla desde"
                      className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                      required
                    />
                    <input
                      type="number"
                      value={form.tallaHasta}
                      onChange={(e) => updateForm("tallaHasta", e.target.value)}
                      placeholder="Talla hasta"
                      className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                      required
                    />
                  </>
                ) : (
                  <input
                    type="number"
                    value={form.talla}
                    onChange={(e) => updateForm("talla", e.target.value)}
                    placeholder="Talla"
                    className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                    required
                  />
                )}
              </div>

              {!modoEdicion && (
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                  El código del producto se genera automáticamente. Si eliges rango,
                  se crearán varias tallas del mismo modelo en una sola acción.
                </div>
              )}

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
                  {guardando
                    ? "Guardando..."
                    : modoEdicion
                    ? "Actualizar producto"
                    : "Crear producto(s)"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}